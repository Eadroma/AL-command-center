import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { initialProfile, scripts, sourceDir } from '../server/scripts';
import { buildBundle } from '../server/builder';
import { applyActivity } from '../src/models/activities';
import { profileSchema } from '../shared/schema';
import { automationDefaults, dangerDefaults, runtimePolicyStatusSchema } from '../shared/automation';
import { Telemetry, instrument } from '../server/telemetry';

const source = fs.readFileSync(path.join(sourceDir, 'runtime-policy.js'), 'utf8');
function runtime(automation: any = {}, store: Record<string, any> = {}, name = 'Droma') {
  let now = 100000;
  const calls: string[] = [], listeners: Record<string, (data: any) => void> = {};
  class Clock extends Date { static now() { return now; } }
  const c: any = {
    Date: Clock, __ALCC: { profile: 'test', automation: { ...structuredClone(automationDefaults), ...automation }, farmers: ['Droma', 'Aedroma'], priests: ['Aedroma'] },
    character: { name, ctype: name === 'EadroSell' ? 'merchant' : name === 'Aedroma' ? 'priest' : 'ranger', hp: 1000, max_hp: 1000, mp: 100, mp_cost: 10, range: 100, x: 0, y: 0, map: 'main', items: [], target: 'm', on: (event: string, fn: any) => { listeners[event] = fn; } },
    parent: { entities: { m: { id: 'm', type: 'monster', mtype: 'crab', x: 20, y: 0 } } },
    setInterval: () => 1, get: (key: string) => structuredClone(store[key]), set: (key: string, value: any) => { store[key] = structuredClone(value); },
    is_disabled: () => false, is_on_cooldown: () => false,
    attack: async () => { calls.push('attack'); }, heal: async () => { calls.push('heal'); }, use_skill: async (skill: string) => { calls.push(skill); },
    can_attack: () => true, stop: () => { calls.push('stop'); }, town: async () => { calls.push('town'); }, move: () => { calls.push('move'); }, smart_move: () => { calls.push('smart_move'); },
    G: { craft: { wingedboots: { cost: 100, items: [[20, 'feather', 0], [1, 'shoes', 0]] } }, items: { shoes: { g: 50 } } },
    item_count_level: (item: string) => item === 'feather' ? 20 : 0, craft_shop_for: (item: string) => item === 'shoes' ? 'basics' : null,
  };
  vm.runInNewContext(source, c); c.RuntimePolicy.install();
  return { c, policy: c.RuntimePolicy, calls, listeners, advance: (ms: number) => { now += ms; } };
}

describe('activity runtime and automation', () => {
  it('gates rogue damage skills during safety holds and resolves target ID arrays for self-defence', async () => {
    const { c, policy, calls } = runtime({ dangers: { ...dangerDefaults, enabled: true, retreatHpPercent: 50 } });
    c.character.hp = 100; policy.tick();
    await expect(c.use_skill('fanofknives', ['m'])).rejects.toMatchObject({ reason: 'Command Center safety / objective hold' });
    await expect(c.use_skill('mentalburst', 'm')).rejects.toMatchObject({ reason: 'Command Center safety / objective hold' });
    c.parent.entities.m.target = 'Droma';
    await c.use_skill('fanofknives', ['m']); await c.use_skill('mentalburst', 'm');
    expect(calls).toContain('fanofknives'); expect(calls).toContain('mentalburst');
  });
  it('coordinates fresh peer retreats without echoing them and rejects unrelated senders/runs', () => {
    const settings = { dangers: { ...dangerDefaults, enabled: true, coordinatedRetreat: true, runId: 'run' } };
    const farmer = runtime(settings);
    const sent: any[] = [];
    farmer.c.send_cm = (_: string, message: any) => { sent.push(message); };
    const message = { type: 'alcc_risk', profile: 'test', run: 'run', realm: ':', sequence: 1, active: true, reason: 'Death budget reached (3/3)' };
    farmer.listeners.cm({ name: 'stranger', message });
    expect(farmer.policy.snapshot().danger.active).toBe(false);
    farmer.listeners.cm({ name: 'Aedroma', message: { ...message, run: 'other' } });
    expect(farmer.policy.snapshot().danger.active).toBe(false);
    farmer.listeners.cm({ name: 'Aedroma', message });
    expect(farmer.policy.allowLoop('movementLoop')).toBe(false);
    expect(farmer.policy.snapshot().danger.reason).toContain('Aedroma');
    farmer.advance(6000); farmer.policy.tick();
    expect(sent.at(-1).active).toBe(false);
    farmer.advance(21000);
    expect(farmer.policy.snapshot().danger.active).toBe(false);
  });
  it('counts death edges once, holds after revival and preserves the budget through CODE restarts', () => {
    const store = {}, settings = { dangers: { ...dangerDefaults, enabled: true, maxDeaths: 2, runId: 'risk-run' } };
    const first = runtime(settings, store);
    first.c.character.rip = true; first.policy.tick(); first.policy.tick();
    expect(first.policy.snapshot().danger.deaths).toBe(1);
    first.c.character.rip = false; first.policy.tick();
    const restarted = runtime(settings, store);
    expect(restarted.policy.snapshot().danger.deaths).toBe(1);
    restarted.c.character.rip = true; restarted.policy.tick();
    restarted.c.character.rip = false; restarted.advance(5000); restarted.policy.tick();
    expect(restarted.policy.allowLoop('movementLoop')).toBe(false);
    expect(restarted.policy.snapshot().danger).toMatchObject({ active: true, deaths: 2, deathLimit: 2, reason: 'Death budget reached (2/2)' });
    expect(runtime(settings, store).policy.allowLoop('movementLoop')).toBe(false);
    expect(runtime({ dangers: { ...settings.dangers, runId: 'new-run' } }, store).policy.snapshot().danger).toMatchObject({ deaths: 0, active: false });
  });
  it('never applies farmer death budgets to the merchant or disabled safety rules', () => {
    const settings = { dangers: { ...dangerDefaults, enabled: true, maxDeaths: 1 } };
    const merchant = runtime(settings, {}, 'EadroSell');
    merchant.c.character.rip = true; merchant.policy.tick(); merchant.c.character.rip = false;
    expect(merchant.policy.snapshot().danger.active).toBe(false);
    const disabled = runtime({ dangers: { ...settings.dangers, enabled: false } });
    disabled.c.character.rip = true; disabled.policy.tick(); disabled.c.character.rip = false;
    expect(disabled.policy.snapshot().danger.deaths).toBe(0);
  });
  it('stages fresh activity contract runs, preserves standalone goals and replaces prior contracts', () => {
    const profile = initialProfile(scripts());
    profile.automation.activities = [{ id: 'contract', name: 'Feathers', kind: 'farm', monster: 'crab', style: 'aoe', characters: ['Droma'], hunts: false, events: false, dangers: structuredClone(dangerDefaults), builds: {}, consumables: [], contract: { items: ['feather'], quantity: 20, action: 'pause' } }];
    profile.automation.lootGoals = [{ id: 'manual', enabled: true, item: 'gem0', quantity: 2, characters: ['Droma'], action: 'notify' }, { id: 'old', activityId: 'old-activity', enabled: true, item: 'feather', quantity: 1, characters: ['Droma'], action: 'pause' }];
    const staged = applyActivity(profile, 'contract');
    expect(staged.automation.lootGoals).toHaveLength(2);
    expect(staged.automation.lootGoals[0].id).toBe('manual');
    expect(staged.automation.lootGoals[1]).toMatchObject({ activityId: 'contract', characters: ['Droma'], quantity: 20, action: 'pause' });
    expect(applyActivity(staged, 'contract').automation.lootGoals[1].id).not.toBe(staged.automation.lootGoals[1].id);
    expect(profile.automation.lootGoals[1].id).toBe('old');
    const running = runtime(staged.automation);
    running.listeners.loot({ id: 'contract-drop', opener: 'Droma', items: [{ name: 'feather', q: 20 }] });
    expect(running.policy.allowLoop('movementLoop')).toBe(false);
    expect(running.policy.snapshot().goals.find((goal: any) => goal.item === 'feather')).toMatchObject({ complete: true, paused: true });
  });
  it('rejects empty contracts and leaves legacy activities compatible', () => {
    const profile = initialProfile(scripts());
    const activity = { id: 'farm', name: 'Farm', kind: 'farm', monster: 'crab', style: 'aoe', characters: ['Droma'], hunts: false, events: false, dangers: structuredClone(dangerDefaults), builds: {}, consumables: [] } as const;
    expect(profileSchema.safeParse({ ...profile, automation: { ...profile.automation, activities: [activity] } }).success).toBe(true);
    expect(profileSchema.safeParse({ ...profile, automation: { ...profile.automation, activities: [{ ...activity, contract: { items: [], quantity: 1, action: 'pause' } }] } }).success).toBe(false);
  });
  it('observes range/mana/cooldown and records actual failed actions without suppressing them', async () => {
    const { c, policy, advance } = runtime();
    c.parent.entities.m.x = 500;
    expect(policy.snapshot().diagnostic.reason).toBe('Target out of range');
    c.parent.entities.m.x = 20; c.character.mp = 0;
    expect(policy.snapshot().diagnostic.reason).toBe('Insufficient attack mana');
    c.character.mp = 100; c.is_on_cooldown = () => true;
    expect(policy.snapshot().diagnostic.reason).toBe('Attack / heal cooldown');
    advance(1000);
    await c.heal(c.character);
    expect(policy.snapshot().diagnostic.reason).toBe('Healing priority');
    expect(runtimePolicyStatusSchema.safeParse(policy.snapshot()).success).toBe(true);
  });
  it('holds new pulls but permits healing, potions and targeted defence, then recovers with hysteresis', async () => {
    const { c, policy, calls, advance } = runtime({ dangers: { ...dangerDefaults, enabled: true } });
    c.character.hp = 200;
    expect(policy.allowLoop('movementLoop')).toBe(false);
    expect(c.can_attack(c.parent.entities.m)).toBe(false);
    await expect(c.attack(c.parent.entities.m)).rejects.toMatchObject({ reason: 'Command Center safety / objective hold' });
    await c.heal(c.character); await c.use_skill('use_mp');
    c.parent.entities.m.target = 'Droma'; await c.attack(c.parent.entities.m);
    await c.move(10, 20);
    expect(calls).toContain('heal'); expect(calls).toContain('use_mp'); expect(calls).toContain('attack'); expect(calls).not.toContain('move');
    c.character.hp = 750;
    expect(policy.allowLoop('movementLoop')).toBe(false);
    advance(3100);
    expect(policy.allowLoop('movementLoop')).toBe(true);
  });
  it('throttles town attempts and handles absent priests and excessive attackers', () => {
    const { c, policy, calls, advance } = runtime({ dangers: { ...dangerDefaults, enabled: true, requirePriest: true, action: 'town' } });
    policy.tick(); policy.tick(); advance(1000); policy.tick();
    expect(calls.filter(c => c === 'town')).toHaveLength(1);
    expect(policy.snapshot().danger.reason).toContain('Priest');
    advance(30000); policy.tick(); expect(calls.filter(c => c === 'town')).toHaveLength(2);
    c.parent.entities.Aedroma = { name: 'Aedroma', x: 0, y: 0 };
    for (let n = 0; n < 5; n++) c.parent.entities[`a${n}`] = { type: 'monster', target: 'Droma', x: 0, y: 0 };
    expect(policy.snapshot().danger.reason).toBe('Too many attackers');
  });
  it('credits party loot only to recipients, deduplicates receipts and persists shared goal progress', () => {
    const store = {}, settings = { lootGoals: [{ id: 'goal', enabled: true, item: 'feather', quantity: 5, characters: ['Droma', 'Aedroma'], action: 'pause' }] };
    const ranger = runtime(settings, store), priest = runtime(settings, store, 'Aedroma');
    const loot = { id: 'chest', opener: 'Droma', party: true, items: [{ name: 'feather', q: 3, looter: 'Droma' }, { name: 'feather', q: 2, looter: 'Aedroma' }] };
    ranger.listeners.loot(loot); priest.listeners.loot(loot); ranger.listeners.loot(loot);
    expect(ranger.policy.snapshot().goals[0].count).toBe(5);
    expect(priest.policy.allowLoop('movementLoop')).toBe(false);
    expect(runtime(settings, store).policy.snapshot().goals[0].count).toBe(5);
  });
  it('does not pause for a notification goal or count initial inventory and transfers', () => {
    const { c, policy, listeners } = runtime({ lootGoals: [{ id: 'g', enabled: true, item: 'feather', quantity: 1, characters: ['Droma'], action: 'notify' }] });
    c.character.items = [{ name: 'feather', q: 100 }];
    expect(policy.snapshot().goals[0].count).toBe(0);
    listeners.loot({ id: 'solo', opener: 'Droma', items: [{ name: 'feather' }] });
    expect(policy.snapshot().goals[0].complete).toBe(true);
    expect(policy.allowLoop('movementLoop')).toBe(true);
  });
  it('shares progress between separate game stores and rejects unknown senders and regressing counters', () => {
    const settings = { lootGoals: [{ id: 'g', enabled: true, item: 'feather', quantity: 4, characters: ['Droma', 'Aedroma'], action: 'pause' }] };
    const ranger = runtime(settings), priest = runtime(settings, {}, 'Aedroma');
    ranger.c.send_cm = (name: string, message: any) => { if (name === 'Aedroma') priest.listeners.cm({ name: 'Droma', message }); };
    ranger.listeners.loot({ id: 'chest', party: true, items: [{ name: 'feather', q: 4, looter: 'Droma' }] });
    ranger.policy.tick();
    expect(priest.policy.snapshot().goals[0].count).toBe(4);
    const message = { type: 'alcc_loot_progress', profile: 'test', goals: [{ id: 'g', item: 'feather', count: 999 }] };
    priest.listeners.cm({ name: 'Stranger', message });
    priest.listeners.cm({ name: 'Droma', message: { ...message, goals: [{ id: 'g', item: 'feather', count: 0 }] } });
    expect(priest.policy.snapshot().goals[0].count).toBe(4);
  });
  it('caps production by quantity and total recipe/NPC costs and persists unconfirmed transactions', () => {
    const settings = { commercialGoals: [{ id: 'craft', enabled: true, item: 'wingedboots', quantity: 2, budget: 250 }] }, store = {};
    const { policy } = runtime(settings, store, 'EadroSell');
    expect(policy.commercialAllowed('wingedboots')).toBe(true);
    policy.reserve('wingedboots', 100);
    expect(policy.commercialAllowed('wingedboots')).toBe(false);
    expect(runtime(settings, store, 'EadroSell').policy.snapshot().commerce[0].state).toContain('Unconfirmed');
    policy.settle('wingedboots', 100, 1);
    policy.reserve('wingedboots', 100); policy.settle('wingedboots', 100, 1);
    expect(policy.commercialAllowed('wingedboots')).toBe(false);
    expect(policy.snapshot().commerce[0].state).toBe('complete');
    const tight = runtime({ commercialGoals: [{ ...settings.commercialGoals[0], budget: 149 }] }, {}, 'EadroSell');
    expect(tight.policy.commercialAllowed('wingedboots')).toBe(false);
  });
  it('stages activity builds and switches the pinned crab ranger while preserving commerce and loadouts', () => {
    const p = initialProfile(scripts());
    p.characters.find(c => c.name === 'Droma')!.script = 'droma-ranger-crab-aoe-v2';
    p.automation.activities = [{ id: 'farm', name: 'Ghosts', kind: 'farm', monster: 'ghost', style: 'mono', characters: ['Droma'], hunts: false, events: false, dangers: { ...dangerDefaults }, builds: { Droma: 'tank' }, consumables: [] }];
    p.farming.loadouts.Droma = { aoe: { gear: [], skills: [] }, mono: { gear: [], skills: [] }, tank: { gear: [{ item: 'candleward', slot: 'offhand', minLevel: 5 }], skills: [] } };
    const result = applyActivity(p, 'farm');
    expect(result.characters.find(c => c.name === 'Droma')?.script).toBe('droma-ranger-v2');
    expect(result.automation.activeBuilds.Droma.style).toBe('tank');
    expect(result.farming.loadouts).toEqual(p.farming.loadouts);
    expect(result.seller.listings).toEqual(p.seller.listings);
    expect(p.farming.defaultMonster).not.toBe('ghost');
  });
  it('rejects invalid team participants and unsafe recovery thresholds, migrates old profiles', () => {
    const p = initialProfile(scripts());
    const old: any = structuredClone(p); delete old.automation;
    expect(profileSchema.parse(old).automation.lootGoals).toEqual([]);
    p.automation.dangers.resumeHpPercent = 10;
    expect(profileSchema.safeParse(p).success).toBe(false);
  });
  it('embeds policy before loop startup and sends bounded telemetry to the server', async () => {
    const p = initialProfile(scripts()), built = await buildBundle(p, 'Droma');
    expect(built.code.indexOf('RuntimePolicy.install()')).toBeLessThan(built.code.indexOf('combatLoop();'));
    expect(built.code).toContain('RuntimePolicy.allowLoop');
    expect(instrument('', 'Droma', 'a'.repeat(64), 9320)).toContain('RuntimePolicy.snapshot');
    const t = new Telemetry(), session = t.create('Droma', 'hash'), policy = runtime().policy.snapshot();
    t.ingest({ character: 'Droma', ticket: session.ticket, sequence: 1, logs: [], runtimePolicy: policy, stats: { hp: 1, max_hp: 1, mp: 1, max_mp: 1, gold: 1, xp: 1, level: 1, map: 'main', target: '' } });
    expect(t.view(session.id)?.runtimePolicy?.diagnostic.reason).toBe('Ready to attack');
  });
});

it('bounds craft provisioning by remaining quantity and counts carried NPC bases only once', () => {
  const f = runtime({ commercialGoals: [{ id: 'craft-run', enabled: true, item: 'wingedboots', quantity: 1, budget: 150 }] }, {}, 'EadroSell');
  expect(f.policy.commercialBatchLimit('wingedboots', 20)).toBe(1);
  f.policy.reserve('wingedboots', 50); f.policy.settle('wingedboots', 50, 0);
  f.c.item_count_level = (item: string) => item === 'shoes' ? 1 : 20;
  expect(f.policy.commercialBatchLimit('wingedboots', 20)).toBe(1);
  f.policy.reserve('wingedboots', 100); f.policy.settle('wingedboots', 100, 1);
  expect(f.policy.commercialBatchLimit('wingedboots', 20)).toBe(0);
});
