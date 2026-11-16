import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.join(process.env.AL_CODE_DIR || '../code', 'aedroma-priest-v2.js'), 'utf8');
const fn = (name: string) => source.match(new RegExp(`function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\r?\\n\\}\\r?\\n`))![0];
const scorpion = { type: 'monster', mtype: 'bscorpion', x: 0, y: 0, speed: 24, range: 32, attack: 3200, visible: true };

function run(expr: string, extra: Record<string, unknown> = {}) {
  const moves: Array<[number, number]> = [];
  const context: Record<string, unknown> = {
    CONFIG: { kiting: { enabled: false, origins: { bscorpion: { map: 'desertland', x: 0, y: 0 } } }, MELEE_SAFE: 60, SELF_CRITICAL_RATIO: 0.4, WARRIOR: 'Eadroma' },
    character: { name: 'Aedroma', map: 'desertland', x: 0, y: 90, hp: 7000, max_hp: 7500, mp: 2000, speed: 55, range: 120 },
    cache: { warrior: null, ranger: null }, G: { skills: { heal: { mp: 20 } }, monsters: { bscorpion: { abilities: { weakness_aura: { aura: true, radius: 100 } } }, crab: {} } },
    distance: (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y),
    can_move_to: () => true, move: (x: number, y: number) => moves.push([x, y]),
    mp_spend_ok: () => true, needs_heal: () => false, hp_ratio: (e: { hp: number; max_hp: number }) => e.hp / e.max_hp, is_in_range: () => false,
    ...extra,
  };
  const result = vm.runInNewContext(`var kite_anchor = null;${fn('kite_step')}${fn('safe_gap')}${fn('can_kite')}${fn('kite_origin')}${fn('circle_kite_point')}${fn('tank_kite')}${fn('pick_heal_target')}${fn('partyheal_needed')}; ${expr}`, context);
  return { result, moves };
}

describe('priest tank kiting', () => {
  it('kites a slow short-range monster like the black scorpion', () => {
    expect(run('can_kite(mob)', { mob: scorpion }).result).toBe(true);
    expect(run('can_kite(mob)', { mob: { ...scorpion, speed: 80 } }).result).toBe(false);
  });
  it('still counts the scorpion as kitable while its weakness aura slows her, so Absorb is not dropped', () => {
    const weakened = { name: 'Aedroma', map: 'desertland', x: 0, y: 90, speed: 20, range: 120, s: { weakness: { ms: 15000 } } };
    const G = { skills: { heal: { mp: 20 } }, conditions: { weakness: { speed: -30 } } };
    expect(run('can_kite(mob)', { mob: scorpion, character: weakened, G }).result).toBe(true);
  });
  it('keeps clear of the weakness aura, not only of melee', () => {
    expect(run('safe_gap(mob)', { mob: scorpion }).result).toBe(130);
    expect(run('safe_gap(mob)', { mob: { ...scorpion, mtype: 'crab' } }).result).toBe(60);
  });
  it('moves 90 degrees around the kite centre, on the side closest to the priest', () => {
    // Centre (0,0), monster east at (100,0), priest south: the point is (0,130), perpendicular and outside the 100 px aura.
    const { moves } = run('tank_kite(mob)', { mob: { ...scorpion, x: 100, y: 0 } });
    expect(moves).toEqual([[0, 130]]);
    expect(Math.hypot(100 - 0, 0 - 130)).toBeGreaterThan(100);
  });
  it('turns the other way when the closest point is not walkable', () => {
    const { moves } = run('tank_kite(mob)', { mob: { ...scorpion, x: 100, y: 0 }, can_move_to: (_x: number, y: number) => y < 0 });
    expect(moves).toEqual([[0, -130]]);
  });
  it('keeps moving towards the closest point when neither is walkable instead of standing still', () => {
    const { moves } = run('tank_kite(mob)', { mob: { ...scorpion, x: 100, y: 0 }, can_move_to: () => false });
    expect(moves).toEqual([[0, 130]]);
  });
  it('does not step radially when close, so it never zig-zags against the circle point', () => {
    const { moves } = run('tank_kite(mob)', { mob: { ...scorpion, x: 0, y: 60 } });
    expect(moves).toHaveLength(1);
    expect(Math.hypot(moves[0][0], moves[0][1] - 60)).toBeGreaterThan(100);
  });
  it('circles around where the fight started when the monster has no fixed centre', () => {
    const { moves } = run('tank_kite(mob)', { mob: { ...scorpion, mtype: 'crab', x: 0, y: 0 } });
    expect(Math.hypot(moves[0][0], moves[0][1])).toBeCloseTo(82, 0);
  });
});

describe('priest heal target', () => {
  it('returns no heal target for an injured ally out of range, so the priest keeps attacking', () => {
    const ranger = { name: 'Droma', hp: 6000, max_hp: 6635 };
    expect(run('pick_heal_target()', { cache: { ranger }, needs_heal: (e: unknown) => e === ranger }).result).toBe(null);
  });
  it('returns no heal target when the mana reserve blocks single heals', () => {
    expect(run('pick_heal_target()', { mp_spend_ok: () => false, character: { name: 'Aedroma', hp: 1000, max_hp: 7500, mp: 500 } }).result).toBe(null);
  });
});

describe('priest party heal', () => {
  const cfg = { PARTYHEAL_WARRIOR_RATIO: 0.7, PARTYHEAL_SELF_RATIO: 0.55, PARTYHEAL_MIN_ALLIES: 2 };
  const priest = { name: 'Aedroma', hp: 3000, max_hp: 7500 };
  const warrior = { name: 'Eadroma', hp: 5000, max_hp: 11000 };
  const needed = (cache: Record<string, unknown>, character: Record<string, unknown> = priest) =>
    run('partyheal_needed()', { CONFIG: cfg, character, cache: { criticalCount: 0, ...cache } }).result;
  it('keeps the single heal when only one character is low', () => {
    expect(needed({ injuredAllies: [priest], warrior: null })).toBe(false);
    expect(needed({ injuredAllies: [warrior], warrior }, { ...priest, hp: 7500 })).toBe(false);
  });
  it('party heals when several are low and not poisoned', () => {
    expect(needed({ injuredAllies: [priest, warrior], warrior })).toBe(true);
  });
  it('does not spam party heal on poisoned targets (heals -75%)', () => {
    const poisoned = { s: { poisoned: { ms: 4000 } } };
    expect(needed({ injuredAllies: [priest, warrior], warrior: { ...warrior, ...poisoned } }, { ...priest, ...poisoned })).toBe(false);
  });
  it('still party heals a real group emergency', () => {
    expect(needed({ injuredAllies: [priest, warrior], warrior, criticalCount: 2 })).toBe(true);
  });
});
