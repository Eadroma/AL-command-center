import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { sourceDir, initialProfile, scripts } from '../server/scripts';
import { buildBundle, effectiveConfig } from '../server/builder';
import { Telemetry } from '../server/telemetry';
import { profileSchema } from '../shared/schema';
const source = fs.readFileSync(path.join(sourceDir, 'event-expedition.js'), 'utf8');
function fixture(characterName = 'Merchant', saved?: any) {
  let now = 1000;
  const online = new Set<string>();
  const starts: string[] = [], stops: string[] = [], orders: any[] = [], actions: string[] = [];
  const board = { enabled: true, allowed: ['mrgreen', 'mrpumpkin'], maxMinutes: 20, maxDeaths: 3, merchant: 'Merchant', warrior: 'Tank', priest: 'Healer' };
  const character: any = { name: characterName, ctype: characterName === 'Merchant' ? 'merchant' : 'warrior', map: 'main', x: 0, y: 0, hp: 100, max_hp: 100, mp: 100, max_mp: 100, esize: 20, items: [{ name: 'hpot1', q: 20 }, { name: 'mpot1', q: 20 }] };
  const context: any = {
    __ALCC: { eventExpedition: board, profile: 'test', eventsEnabledMaster: true, homeServer: { region: 'EU', name: 'I' }, standSpot: { map: 'main', x: 0, y: 0 }, farmers: ['Archer'] },
    character, parent: { server_region: 'EU', server_identifier: 'I', S: { mrgreen: { live: true } } },
    Date: class extends Date { static now() { return now; } }, get: () => saved, set: (_key: string, data: any) => { saved = structuredClone(data); },
    setTimeout, clearTimeout, setInterval: () => 0,
    team_child_running: (name: string) => online.has(name),
    get_start_character_fn: () => async (name: string, slot: string) => { expect(slot).toBe('CC_' + name); starts.push(name); },
    stop_character: async (name: string) => { stops.push(name); online.delete(name); },
    send_cm: (name: string, data: any) => orders.push({ name, ...data }), game_log: () => {},
    get_player: () => ({ hp: 100, map: 'main', x: 0, y: 0 }), distance: () => 0,
    dumpable_count: () => 0, smart: { moving: false }, stop: () => actions.push('stop'),
    town: async () => { actions.push('town'); }, smart_move: async () => { actions.push('travel'); },
    is_dumpable_slot: () => false, send_item: async () => { actions.push('send'); },
  };
  const runtime = vm.runInNewContext(source + '\nEventExpedition', context);
  const advance = (ms: number) => { now += ms; };
  function report(name: string, patch = {}) { runtime.onCm(name, { t: 'event_expedition_report', id: runtime.snapshot().id, ready: true, returned: false, deaths: 0, free: 20, ...patch }); }
  return { runtime, context, board, character, online, starts, stops, orders, actions, advance, report, saved: () => saved };
}

describe('on-demand event lifecycle', () => {
  it('waits for a verified town exit from the ice arena before pathfinding', async () => {
    const f = fixture('Tank'); Object.assign(f.character, { map: 'winterland', x: 841, y: 390 });
    const order = () => f.runtime.onCm('Merchant', { t: 'event_expedition', id: 'ice', event: 'mrgreen', phase: 'returning', assembly: { map: 'main', x: 0, y: 0 } });
    order(); await f.runtime.actorTick(); await f.runtime.actorTick();
    expect(f.actions).toEqual(['town']); // A resolved town promise alone does not prove escape.
    f.advance(15000); order(); f.context.town = async () => { f.actions.push('town'); f.character.x = 0; f.character.y = 0; };
    await f.runtime.actorTick(); await f.runtime.actorTick(); await new Promise(resolve => setTimeout(resolve, 0));
    expect(f.actions).toEqual(['town', 'town', 'travel']);
  });
  it('backs off suspended return routes, limits logs and retries town', async () => {
    const f = fixture('Tank'); f.character.map = 'winterland';
    const logs: string[] = []; f.context.game_log = (s: string) => logs.push(s);
    f.context.smart_move = async () => { f.actions.push('travel'); throw { reason: 'route_suspended' }; };
    const order = () => f.runtime.onCm('Merchant', { t: 'event_expedition', id: 'return', event: 'mrgreen', phase: 'returning', assembly: { map: 'main', x: 0, y: 0 } });
    order(); await f.runtime.actorTick();
    await f.runtime.actorTick(); await new Promise(resolve => setTimeout(resolve, 0));
    for (let i = 0; i < 10; i++) await f.runtime.actorTick();
    expect(f.actions.filter(a => a === 'travel')).toHaveLength(1);
    expect(logs.filter(s => s.includes('travel failed'))).toHaveLength(1);
    f.advance(30000); order(); await f.runtime.actorTick();
    expect(f.actions.filter(a => a === 'town')).toHaveLength(2);
    await f.runtime.actorTick(); await new Promise(resolve => setTimeout(resolve, 0));
    expect(f.actions.filter(a => a === 'travel')).toHaveLength(2);
    expect(logs.filter(s => s.includes('travel failed'))).toHaveLength(1);
  });
  it('releases redundant potion stacks only under departure pressure, keeping supplies and locks', async () => {
    const f = fixture('Tank'); f.character.esize=0;
    f.character.items=[{name:'hpot1',q:9000},{name:'hpot1',q:8000},{name:'mpot1',q:20},{name:'hpot1',q:5000,l:true}];
    f.context.send_item=async (_name:string,slot:number) => { f.actions.push('send');f.character.items[slot]=null;f.character.esize++; };
    f.runtime.onCm('Merchant',{t:'event_expedition',id:'prep',event:'mrgreen',phase:'forming',assembly:{map:'main',x:0,y:0}});
    await f.runtime.actorTick(); expect(f.character.items[0]).toBeNull(); expect(f.character.items[1].q).toBe(8000);
    f.character.esize=5; await f.runtime.actorTick(); expect(f.actions).toEqual(['send']);
    f.character.esize=0;f.character.items[1]=null; await f.runtime.actorTick();expect(f.actions).toEqual(['send']);expect(f.character.items[3].l).toBe(true);
  });
  it('unloads before departure and waits for confirmed capacity, preserving protected equipment', async () => {
    const f = fixture('Tank');
    f.character.esize = 0; f.character.items.push({name:'coat',level:0}, {name:'protected',l:true});
    f.context.dumpable_count = () => f.character.items[2] ? 1 : 0;
    f.context.is_dumpable_slot = (slot:number) => slot === 2;
    f.context.send_item = async (_name:string, slot:number) => { f.actions.push('send'); f.character.items[slot] = null; f.character.esize++; };
    f.runtime.onCm('Merchant',{t:'event_expedition',id:'prep',event:'mrgreen',phase:'forming',assembly:{map:'main',x:0,y:0}});
    f.runtime.report(); expect(f.orders.at(-1)).toMatchObject({ready:false,readinessReason:'Unloading carried loot before departure'});
    await f.runtime.actorTick(); expect(f.actions).toEqual(['send']); expect(f.character.items[3].name).toBe('protected');
    f.runtime.report(); expect(f.orders.at(-1)).toMatchObject({ready:false,readinessReason:'Needs 5 free inventory slots before departure'});
    f.character.esize = 5; f.runtime.report(); expect(f.orders.at(-1).ready).toBe(true);
  });
  it('keeps the merchant available and rejects ready reports with a full bag', async () => {
    const f = fixture(); f.online.add('Tank'); f.online.add('Healer'); f.advance(16000); await f.runtime.merchantTick();
    f.report('Tank',{free:0}); f.report('Healer');
    expect(f.runtime.needsReturnService()).toBe(true);
    await f.runtime.merchantTick(); expect(f.runtime.snapshot().phase).toBe('forming');
    f.report('Tank',{free:5}); await f.runtime.merchantTick(); expect(f.runtime.snapshot().phase).toBe('engaging');
  });
  it('retains verified unloading after reports expire, but rejects another mission report', () => {
    const mission = { id: 'current', phase: 'returning', owned: [], lastReports: { Tank: { id: 'current', returned: true }, Healer: { id: 'current', returned: true } } };
    const f = fixture('Merchant', mission); f.online.add('Tank'); f.online.add('Healer'); f.advance(30000);
    expect(f.runtime.needsReturnService()).toBe(false);
    const other = fixture('Merchant', { ...mission, lastReports: { ...mission.lastReports, Tank: { id: 'older', returned: true } } });
    other.online.add('Tank'); expect(other.runtime.needsReturnService()).toBe(true);
  });
  it('waits for startup confirmation, assembles both workers, unloads then stops only owned workers', async () => {
    const f = fixture(); f.online.add('Healer'); f.advance(16000);
    await f.runtime.merchantTick(); expect(f.starts).toEqual(['Tank']);
    f.advance(3000); await f.runtime.merchantTick(); expect(f.runtime.snapshot().phase).toBe('forming'); expect(f.starts).toHaveLength(1);
    f.online.add('Tank'); f.report('Tank'); await f.runtime.merchantTick(); expect(f.runtime.snapshot().phase).toBe('forming');
    f.report('Healer'); await f.runtime.merchantTick(); expect(f.runtime.snapshot().phase).toBe('engaging');
    f.context.parent.S.mrgreen.live = false; await f.runtime.merchantTick(); expect(f.stops).toHaveLength(0); expect(f.runtime.snapshot().phase).toBe('returning');
    f.report('Tank', { returned: true }); f.report('Healer', { returned: true }); await f.runtime.merchantTick();
    expect(f.stops).toEqual(['Tank']); expect(f.online.has('Healer')).toBe(true); expect(f.runtime.snapshot().phase).toBe('complete');
    f.context.parent.S.mrgreen.live = true; await f.runtime.merchantTick(); expect(f.starts).toHaveLength(1);
  });
  it('aborts a startup timeout without repeated login requests', async () => {
    const f = fixture(); f.advance(16000); await f.runtime.merchantTick(); f.advance(46000); await f.runtime.merchantTick();
    expect(f.starts).toEqual(['Tank']); expect(['returning', 'complete']).toContain(f.runtime.snapshot().phase);
  });
  it('does not start on another server or while the master switch is paused', async () => {
    const f = fixture(); f.advance(16000); f.context.parent.server_identifier = 'II'; await f.runtime.merchantTick();
    expect(f.starts).toHaveLength(0); f.context.parent.server_identifier = 'I'; f.context.__ALCC.eventsEnabledMaster = false; await f.runtime.merchantTick(); expect(f.starts).toHaveLength(0);
  });
  it('returns on death limit, and marks failed cleanup as blocked rather than force-disconnecting', async () => {
    const f = fixture(); f.online.add('Tank'); f.online.add('Healer'); f.advance(16000); await f.runtime.merchantTick();
    f.report('Tank'); f.report('Healer'); await f.runtime.merchantTick(); f.report('Tank', { deaths: 3 }); await f.runtime.merchantTick();
    expect(f.runtime.snapshot().phase).toBe('returning'); f.advance(241000); await f.runtime.merchantTick(); expect(f.runtime.snapshot().phase).toBe('blocked'); expect(f.stops).toHaveLength(0);
  });
  it('returns on duration limit and rejects stale heartbeats', async () => {
    const f = fixture(); f.online.add('Tank'); f.online.add('Healer'); f.advance(16000); await f.runtime.merchantTick(); f.report('Tank'); f.report('Healer'); await f.runtime.merchantTick();
    f.advance(1200000); f.report('Tank'); f.report('Healer'); await f.runtime.merchantTick(); expect(f.runtime.snapshot().reason).toBe('Mission duration limit');
  });
  it('workers reject foreign commands and return when their coordinator lease expires', async () => {
    const f = fixture('Tank'); const order = { t: 'event_expedition', id: 'one', event: 'mrgreen', phase: 'engaging', assembly: { map: 'main', x: 0, y: 0 } };
    f.runtime.onCm('Stranger', order); expect(f.runtime.canCombat()).toBe(false);
    f.runtime.onCm('Merchant', order); expect(f.runtime.canCombat({ mtype: 'mrgreen' })).toBe(true); expect(f.runtime.canCombat({ mtype: 'oneeye' })).toBe(false);
    f.advance(21000); await f.runtime.actorTick(); expect(f.actions).toEqual(['town']); expect(f.runtime.canCombat()).toBe(false);
    f.runtime.report(); expect(f.orders.at(-1).returned).toBe(true);
  });
  it('preserves completed-mission cooldown over merchant reloads', async () => {
    const f = fixture('Merchant', { id: 'old', event: 'mrgreen', phase: 'complete', startedAt: 100, completedAt: 1000, owned: [], attempts: {}, loneWolfDowntimeMs: 0 });
    f.advance(16000); await f.runtime.merchantTick(); expect(f.starts).toHaveLength(0);
  });
});

it('builds a duo roster, leaves the ranger alone, and prevents competing worker autostart', async () => {
  const list = scripts(), profile = initialProfile(list);
  profile.events.allowed = ['mrgreen', 'mrpumpkin']; profile.events.expedition.enabled = true;
  for (const c of profile.characters) { if (c.ctype === 'warrior') c.script = 'eadroma-warrior-v2'; if (c.ctype === 'priest') c.script = 'aedroma-priest-v2'; if (c.ctype === 'merchant') c.script = 'eadrosell-merchant-v2'; }
  expect(profileSchema.safeParse(profile).success).toBe(true);
  const ranger = profile.characters.find(c => c.ctype === 'ranger')!;
  expect(effectiveConfig(profile, ranger, list.find(s => s.id === ranger.script)!).PARTY).toEqual([]);
  const merchant = profile.characters.find(c => c.ctype === 'merchant')!;
  const config = effectiveConfig(profile, merchant, list.find(s => s.id === merchant.script)!);
  expect(Object.keys(config.TEAM_SLOTS as object)).not.toContain('Eadroma'); expect(Object.keys(config.TEAM_SLOTS as object)).not.toContain('Aedroma');
  expect((await buildBundle(profile, ranger.name)).code).toMatch(/"eventsEnabled":\s*false/);
  expect((await buildBundle(profile, 'Eadroma')).code).toContain('EventExpedition.install()');
});

it('retains expedition telemetry and rejects invalid mission limits', () => {
  const t = new Telemetry(), session = t.create('Merchant', 'hash'), f = fixture();
  const packet = { ticket: session.ticket, character: 'Merchant', sequence: 1, logs: [], stats: { hp: 10, max_hp: 20, mp: 5, max_mp: 10, gold: 0, xp: 0, level: 1, map: 'main', target: '' }, eventExpedition: f.runtime.snapshot() };
  t.ingest(packet); expect(t.view(session.id)?.eventExpedition?.phase).toBe('idle');
  const profile = initialProfile(scripts()); profile.events.expedition.maxDeaths = 0; expect(profileSchema.safeParse(profile).success).toBe(false);
});
it('unloads only slots allowed by existing gear protections, and defers disconnect until confirmation', async () => {
  const f = fixture('Tank'); f.character.items.push({ name: 'drop', q: 3 });
  f.context.is_dumpable_slot = (slot: number) => slot === 2;
  f.context.dumpable_count = () => 1;
  f.runtime.onCm('Merchant', { t: 'event_expedition', id: 'one', event: 'mrgreen', phase: 'returning', assembly: { map: 'main', x: 0, y: 0 } });
  await f.runtime.actorTick(); await f.runtime.actorTick(); f.runtime.report();
  expect(f.actions).toEqual(['town', 'send']); expect(f.orders.at(-1).returned).toBe(false);
  f.context.dumpable_count = () => 0; f.runtime.report(); expect(f.orders.at(-1).returned).toBe(true);
});

it('finishes a blocked cleanup after verified late unloading, without stopping manual workers', async () => {
  const f = fixture('Merchant', {id:'late',event:'mrgreen',phase:'blocked',reason:'Cleanup incomplete',startedAt:1,returnAt:1,loneWolfDowntimeMs:0,owned:['Healer'],attempts:{}});
  f.online.add('Healer'); f.online.add('Tank'); f.advance(16000);
  f.report('Healer'); f.report('Tank');
  expect(f.runtime.needsReturnService()).toBe(true);
  await f.runtime.merchantTick(); expect(f.stops).toEqual([]);
  f.report('Healer',{returned:true});f.report('Tank',{returned:true});
  await f.runtime.merchantTick();
  expect(f.stops).toEqual(['Healer']);expect(f.online.has('Tank')).toBe(true);
  expect(f.runtime.snapshot().phase).toBe('complete');
});
it('blocked workers confirm returned only after inventory cleanup', () => {
  const f=fixture('Healer');f.context.dumpable_count=()=>1;
  f.runtime.onCm('Merchant',{t:'event_expedition',id:'late',event:'mrgreen',phase:'blocked',assembly:{map:'main',x:0,y:0}});
  f.runtime.report();expect(f.orders.at(-1).returned).toBe(false);
  f.context.dumpable_count=()=>0;f.runtime.report();expect(f.orders.at(-1).returned).toBe(true);
});

it.each(['crabxx', 'franky', 'icegolem'])('starts and returns the duo for %s while preserving ownership', async event => {
  const f = fixture(); f.board.allowed = [event]; f.context.parent.S = { [event]: { live: true, hp: 1000 } };
  f.advance(16000); await f.runtime.merchantTick(); expect(f.starts).toEqual(['Tank']);
  f.online.add('Tank'); f.advance(3000); await f.runtime.merchantTick(); expect(f.starts).toEqual(['Tank', 'Healer']);
  f.online.add('Tank'); f.online.add('Healer'); f.report('Tank'); f.report('Healer'); await f.runtime.merchantTick();
  expect(f.runtime.snapshot().event).toBe(event); expect(f.runtime.snapshot().phase).toBe('engaging');
  f.context.parent.S[event].live = false; await f.runtime.merchantTick(); expect(f.runtime.snapshot().phase).toBe('returning');
  f.report('Tank', { returned: true }); f.report('Healer', { returned: true }); await f.runtime.merchantTick();
  expect(f.stops).toEqual(['Tank', 'Healer']);
});

it('retains a completed expedition report, including last worker metrics and return verification', async () => {
  const f=fixture(); f.online.add('Tank'); f.online.add('Healer'); f.advance(16000); await f.runtime.merchantTick();
  f.report('Tank',{metrics:{damage:500,bossDamage:400,bossHits:2,healing:0,lootGold:200,attacks:3}});f.report('Healer');await f.runtime.merchantTick();
  f.context.parent.S.mrgreen.live=false;await f.runtime.merchantTick();
  f.report('Tank',{returned:true,metrics:{damage:500,bossDamage:400,bossHits:2,healing:0,lootGold:200,attacks:3}});f.report('Healer',{returned:true});await f.runtime.merchantTick();
  const history=f.runtime.snapshot().history;
  expect(history).toHaveLength(1);expect(history[0].phase).toBe('complete');
  expect(history[0].participants[0]).toMatchObject({returned:true,metrics:{bossDamage:400,bossHits:2}});
});

it('manual recall sends return orders once without stopping anyone before unloading', () => {
 const f=fixture('Merchant',{id:'active',event:'mrgreen',phase:'engaging',owned:['Tank'],lastReports:{}});f.advance(16000);
 expect(f.runtime.recall()).toBe(true);expect(f.runtime.snapshot().phase).toBe('returning');
 expect(f.orders.map((r:any)=>[r.name,r.phase])).toEqual([['Tank','returning'],['Healer','returning']]);
 expect(f.stops).toEqual([]);expect(f.runtime.recall()).toBe(false);expect(f.orders).toHaveLength(2);
 expect(fixture().runtime.recall()).toBe(false);expect(fixture('Tank').runtime.recall()).toBe(false);
});
