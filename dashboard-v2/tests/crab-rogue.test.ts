import fs from 'node:fs';
import vm from 'node:vm';
import { describe, it, expect } from 'vitest';
const source = fs.readFileSync(new URL('../../code/dromas-rogue.js', import.meta.url), 'utf8');
function makeFixture(scriptSource = source) {
  const casts: any[] = [], attacks: any[] = [], routes: any[] = [];
  const character: any = { name: 'Dromas', ctype: 'rogue', level: 65, map: 'main', x: -1200, y: -70,
    hp: 1000, max_hp: 1000, mp: 1000, max_mp: 1000, range: 30, slots: { belt: { name: 'knifebelt' }, elixir: { name: 'elixirluck' } }, items: [], esize: 20 };
  const entities: any = {};
  for (let i = 0; i < 7; i++) entities[i] = { id: String(i), type: 'monster', mtype: 'crab', hp: 100, x: -1180 + i, y: -70 };
  entities.other = { ...entities[0], id: 'other', target: 'OtherPlayer' };
  entities.boss = { ...entities[0], id: 'boss', mtype: 'crabxx' };
  const context: any = { character, parent: { entities }, G: { skills: { fanofknives: { level: 65, mp: 180, range: 160, max_targets: 5 } } },
    is_disabled: () => false, is_on_cooldown: () => false, can_attack: () => true,
    use_skill: async (...args: any[]) => casts.push(args), attack: async (e: any) => attacks.push(e.id),
    get_player: () => null, get_party: () => ({}), smart: { moving: false }, smart_move: async (d: any) => routes.push(d),
    can_move_to: () => true, move: () => {}, stop: () => {}, game_log: () => {}, set_message: () => {}, setTimeout: () => 0, loot: () => {} };
  // Test explicit actions without starting background loops.
  const runtime = vm.runInNewContext(scriptSource.replace('CrabRogue.install();', 'CrabRogue;'), context);
  return { runtime, context, character, casts, attacks, routes, entities };
}
describe.each(['dromas-rogue.js', 'dromas-rogue-v2.js'])('Dromas crab farmer: %s', filename => {
  const scriptSource = fs.readFileSync(new URL('../../code/' + filename, import.meta.url), 'utf8');
  const fixture = () => makeFixture(scriptSource);
  it('visits the merchant with an empty bag when Liquid Luck is missing and waits for delivery', async () => {
    const f = fixture(); f.character.slots.elixir = null;
    await f.runtime.movement(); expect(f.routes).toEqual([{ map: 'main', x: -100, y: -20 }]);
    await f.runtime.combat(); expect(f.casts).toEqual([]);
    f.character.x = -100; f.character.y = -20;
    f.context.get_player = () => ({ name: 'EadroSell', map: 'main', x: -100, y: -20 });
    await f.runtime.movement(); expect(f.routes).toHaveLength(1);
    f.character.items.push({ name: 'elixirluck' });
    await f.runtime.movement(); expect(f.routes.at(-1)).toEqual({ map: 'main', x: -1200, y: -70 });
  });
  it('does not visit for Liquid Luck while it is active or available in the bag', async () => {
    const f = fixture(); await f.runtime.movement(); expect(f.routes).toEqual([]);
    f.character.slots.elixir = null; f.character.items = [{ name: 'elixirluck' }];
    await f.runtime.movement(); expect(f.routes).toEqual([]);
  });
  it('consumes unlocked Liquid Luck only when inactive, with a retry delay', async () => {
    const f = fixture(); const used: number[] = []; f.context.consume = async (slot: number) => used.push(slot);
    f.character.items = [{ name: 'elixirluck', l: true }, { name: 'elixirluck' }];
    f.character.slots.elixir = { name: 'elixirluck' }; await f.runtime.liquidLuck(); expect(used).toEqual([]);
    f.character.slots.elixir = null; f.character.s = { elixir: { name: 'elixirluck' } };
    await f.runtime.liquidLuck(); expect(used).toEqual([]);
    f.character.s = {}; await f.runtime.liquidLuck(); await f.runtime.liquidLuck(); expect(used).toEqual([1]);
    expect(f.runtime.protectedItem({ name: 'elixirluck' })).toBe(true);
  });
  it('casts Swiftness on self only when missing and waits for the buff update', async () => {
    const f = fixture(); f.context.G.skills.rspeed = { mp: 320, level: 40 }; f.character.s = { rspeed: { ms: 1 } };
    await f.runtime.swiftness(); expect(f.casts).toEqual([]);
    delete f.character.s.rspeed;
    await f.runtime.swiftness(); await f.runtime.swiftness();
    expect(f.casts).toEqual([['rspeed', 'Dromas']]);
  });
  it.each(['level', 'mana', 'cooldown', 'dead'])('defers Swiftness when unavailable: %s', async reason => {
    const f = fixture(); f.context.G.skills.rspeed = { mp: 320, level: 40 };
    if (reason === 'level') f.character.level = 39;
    if (reason === 'mana') f.character.mp = 319;
    if (reason === 'cooldown') f.context.is_on_cooldown = () => true;
    if (reason === 'dead') f.character.rip = true;
    await f.runtime.swiftness(); expect(f.casts).toEqual([]);
  });
  it('uses Mental Burst on the weakest crab independently of the attack cooldown', async () => {
    const f = fixture(); f.character.int = 64;
    f.context.G.skills.mentalburst = { mp: 180, range_multiplier: 1.2, range_bonus: 32, requirements: { int: 64 } };
    f.entities[2].hp = 10;
    f.context.is_on_cooldown = (name: string) => name === 'attack';
    await f.runtime.combat(); expect(f.casts).toEqual([['mentalburst', '2']]);
  });
  it.each(['intelligence', 'mana', 'cooldown', 'range'])('skips unavailable Mental Burst: %s', async reason => {
    const f = fixture(); f.character.int = 64;
    f.context.G.skills.mentalburst = { mp: 180, range_multiplier: 1.2, range_bonus: 32, requirements: { int: 64 } };
    if (reason === 'intelligence') f.character.int = 63;
    if (reason === 'mana') f.character.mp = 200;
    if (reason === 'cooldown') f.context.is_on_cooldown = (name: string) => name === 'mentalburst';
    if (reason === 'range') Object.values(f.entities).forEach((e: any) => { e.x += 100; });
    await f.runtime.combat(); expect(f.casts.some(c => c[0] === 'mentalburst')).toBe(false);
  });
  it('swaps Midas for combat and travel gloves before movement, keeping both pairs', async () => {
    const f = fixture();
    f.character.items = [{ name: 'handofmidas', level: 3 }, { name: 'gloves', level: 7 }, null];
    f.context.equip = async (index: number, slot: string) => {
      const old = f.character.slots[slot] || null;
      f.character.slots[slot] = f.character.items[index]; f.character.items[index] = old;
    };
    await f.runtime.combat(); expect(f.character.slots.gloves.name).toBe('handofmidas');
    f.character.moving = true; await f.runtime.combat(); expect(f.character.slots.gloves.name).toBe('gloves');
    f.character.moving = false; await f.runtime.combat(); expect(f.character.slots.gloves.name).toBe('handofmidas');
    f.character.x = 0; await f.runtime.movement(); expect(f.character.slots.gloves.name).toBe('gloves');
    expect(f.runtime.protectedItem({ name: 'handofmidas' })).toBe(true);
    expect(f.runtime.protectedItem({ name: 'gloves' })).toBe(true);
  });
  it('prioritizes fan over attacks, caps at five and excludes bosses and other players targets', async () => {
    const f = fixture(); await f.runtime.combat();
    expect(f.casts).toEqual([['fanofknives', ['0', '1', '2', '3', '4']]]);
    expect(f.attacks).toEqual([]);
  });
  it.each(['belt', 'level', 'mana'])('falls back to normal attacks when %s prevents fan', async reason => {
    const f = fixture();
    if (reason === 'belt') f.character.slots.belt = null;
    if (reason === 'level') f.character.level = 64;
    if (reason === 'mana') f.character.mp = 200;
    await f.runtime.combat(); expect(f.casts).toEqual([]); expect(f.attacks).toEqual(['0']);
  });
  it('does not pull fresh crabs while hurt, but defends against its attackers', async () => {
    const f = fixture(); f.character.hp = 400;
    await f.runtime.combat(); expect(f.casts).toEqual([]); expect(f.attacks).toEqual([]);
    f.entities[2].target = 'Dromas'; await f.runtime.combat(); expect(f.casts).toEqual([['fanofknives', ['2']]]);
  });
  it('travels to crabs independently and keeps belts, supplies and protected equipment', async () => {
    const f = fixture(); f.character.x = 0; await f.runtime.movement();
    expect(f.routes).toEqual([{ map: 'main', x: -1200, y: -70 }]);
    for (const item of [{ name: 'knifebelt' }, { name: 'hpot1' }, { name: 'coat', level: 1 }, { name: 'coat', l: true }]) expect(f.runtime.protectedItem(item)).toBe(true);
    expect(f.runtime.protectedItem({ name: 'crabclaw' })).toBe(false);
  });
});
