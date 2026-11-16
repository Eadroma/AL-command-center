import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { sourceDir } from '../server/scripts';

const source = fs.readFileSync(path.join(sourceDir, 'crypt-run.js'), 'utf8');
const dist = (a: any, b: any) => Math.hypot(a.x - b.x, a.y - b.y);

function setup(character: Record<string, unknown> = {}) {
  const store: Record<string, unknown> = {};
  const sent: any[] = [];
  const entered: any[] = [];
  const ctx: any = {
    character: { name: 'Eadroma', ctype: 'warrior', map: 'cave', x: -193, y: -1296, items: [], ...character },
    CONFIG: {} as Record<string, string>,
    parent: { entities: {} },
    smart: { moving: false },
    get: (k: string) => store[k],
    set: (k: string, v: unknown) => { store[k] = JSON.parse(JSON.stringify(v)); },
    send_cm: (to: string[], data: unknown) => sent.push([to, data]),
    game_log: () => {},
    set_message: () => {},
    distance: dist,
    smart_move: () => Promise.resolve(),
    setInterval: (fn: () => void) => { (ctx.__intervals ||= []).push(fn); },
    stop: () => {},
    enter: async (place: string, name?: string) => { entered.push([place, name]); ctx.character.map = 'crypt'; ctx.character.in = name || 'inst-1'; },
  };
  // Like the builder: a script never receives the key of its own role (the warrior has no CONFIG.WARRIOR).
  const roles: Record<string, string> = { WARRIOR: 'Eadroma', PRIEST: 'Aedroma', RANGER: 'Droma', MERCHANT: 'EadroSell' };
  for (const [key, name] of Object.entries(roles)) if (key.toLowerCase() !== ctx.character.ctype) ctx.CONFIG[key] = name;
  vm.createContext(ctx);
  vm.runInContext(source, ctx);
  return { ctx, sent, entered, store };
}

const mob = (mtype: string, x: number, y: number, extra: Record<string, unknown> = {}) => ({ type: 'monster', mtype, x, y, ...extra });

describe('crypt safe-target predicate', () => {
  it('attacks a lone Vampireling and the healer first, never a healed or crowded unique', () => {
    const { ctx } = setup({ map: 'crypt', x: 1000, y: -400 });
    const run = ctx.CryptRun;
    const vbat = mob('vbat', 1100, -400);
    expect(run.isSafe(vbat, [vbat])).toBe(true);
    const bill = mob('a2', 1100, -630);
    const safe = { a2: 1, a5: 1, vbat: 1 };
    expect(run.isSafe(bill, [bill])).toBe(false); // Bill wiped the trio on the first run: never a default target
    expect(run.isSafe(vbat, [vbat, mob('a2', 1100, -560)])).toBe(false); // nor a Vampireling next to him
    expect(run.isSafe(bill, [bill], safe)).toBe(true);
    const elena = mob('a5', 1100, -300);
    expect(run.isSafe(bill, [bill, elena], safe)).toBe(false); // healer attached
    expect(run.pickTarget([vbat, elena], safe).mtype).toBe('a5'); // healer first
    expect(run.isSafe(vbat, [vbat, mob('a4', 1200, -400)])).toBe(false); // Orlok nearby
    expect(run.isSafe(mob('vbat', 1100, -400, { level: 3 }), [])).toBe(true); // levelled on our deaths: still pulled (run 26)
    expect(run.isSafe(mob('vbat', 1100, -400, { level: 6 }), [])).toBe(true); // any level (audit)
    expect(run.isSafe(mob('a3', 1100, -400, { level: 2 }), [])).toBe(false);
  });
});

describe('crypt corridor graph', () => {
  it('connects the spawn to every unique spawn point', () => {
    const { ctx } = setup();
    const run = ctx.CryptRun;
    const start = run.nearestNode([0, 0]);
    for (const p of [[2464, 416], [2752, -1728], [720, -1072], [1184, -384]]) {
      const path = run.route(start, run.nearestNode(p));
      expect(path, String(p)).not.toBeNull();
      expect(run.nodes()[path[path.length - 1]]).toEqual(p);
    }
  });
});

describe('crypt run protocol', () => {
  it('answers ready to the merchant only, then opens the instance once the warrior holds a key', async () => {
    const { ctx, sent, entered } = setup({ items: [{ name: 'cryptkey', q: 1 }] });
    ctx.CryptRun.onCm('Stranger', { t: 'crypt', a: 'start', runId: 'r1' });
    expect(sent).toEqual([]);
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'r1' });
    expect(sent[0]).toEqual([['EadroSell'], { t: 'crypt', a: 'ready', runId: 'r1', reason: '', hasKey: true }]);
    expect(await ctx.CryptRun.tick()).toBe(true);
    expect(entered).toEqual([['crypt', undefined]]);
    expect(sent[1]).toEqual([['Aedroma', 'Droma', 'EadroSell'], expect.objectContaining({ t: 'crypt', a: 'open', runId: 'r1', id: 'inst-1' })]);
  });

  it('reports busy instead of joining while the cave owns the character', () => {
    const { ctx, sent } = setup();
    ctx.CaveDreams = { inCave: () => true, reservingParty: () => true };
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'r2' });
    expect(sent[0][1]).toMatchObject({ a: 'busy', reason: 'cave' });
    expect(ctx.CryptRun.active()).toBe(false);
  });

  it('lets followers join only the instance id sent by the warrior, and leave on abort', async () => {
    const { ctx, entered } = setup({ name: 'Droma', ctype: 'ranger' });
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'r3' });
    await ctx.CryptRun.tick();
    expect(entered).toEqual([]); // waits for the open message
    ctx.CryptRun.onCm('Aedroma', { t: 'crypt', a: 'open', runId: 'r3', id: 'fake' });
    ctx.CryptRun.onCm('Eadroma', { t: 'crypt', a: 'open', runId: 'r3', id: 'inst-9' });
    await ctx.CryptRun.tick();
    expect(entered).toEqual([['crypt', 'inst-9']]);
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'abort', runId: 'r3' });
    expect(ctx.CryptRun.snapshot().phase).toBe('leaving');
  });

  it('refuses smart_move to another map while inside the crypt', async () => {
    const { ctx } = setup({ map: 'crypt' });
    await expect(ctx.smart_move({ map: 'main', x: 0, y: 0 })).rejects.toMatchObject({ reason: 'crypt_same_map_only' });
    await expect(ctx.smart_move({ x: 10, y: 10 })).resolves.toBeUndefined();
  });
});

describe('crypt key custody', () => {
  it('keeps the key out of the mule dump only while a run is active', () => {
    const { ctx } = setup({ items: [{ name: 'cryptkey', q: 1 }] });
    const key = { name: 'cryptkey', q: 1 };
    expect(ctx.CryptRun.keeps(key)).toBe(false); // outside a run the key is ordinary loot for the mule
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'r9' });
    expect(ctx.CryptRun.keeps(key)).toBe(true);
    expect(ctx.CryptRun.keeps({ name: 'hpot1', q: 10 })).toBe(false);
  });
});

describe('crypt routing around guarded corridors', () => {
  it('reaches the Vampirelings from Lucinda\'s corridor without entering her bubble', () => {
    const { ctx } = setup({ map: 'crypt' });
    const run = ctx.CryptRun, nodes = run.nodes();
    const lucinda = [{ x: 727, y: -796, r: 200 }];
    const from = run.nearestNode([720, -1072]), to = run.nearestNode([1184, -384]);
    const path = run.route(from, to, lucinda);
    expect(path).not.toBeNull();
    for (let i = 1; i < path.length; i++) expect(run.segClear(nodes[path[i - 1]], nodes[path[i]], lucinda)).toBe(true);
    // The direct corridor south (through 736,-720) is the one she blocks.
    expect(run.segClear([736, -1088], [736, -720], lucinda)).toBe(false);
  });

  it('starts every round at the Vampirelings', () => {
    const { ctx, store } = setup();
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'r5' });
    expect((store['alcc:crypt:v1:farmer:Eadroma'] as any).wp).toBe(0);
  });
});

describe('crypt run storage', () => {
  it('keeps one run state per character, seeded once from the shared legacy key', () => {
    const { ctx, store } = setup({ name: 'Droma', ctype: 'ranger' });
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'r7' });
    expect(store['alcc:crypt:v1:farmer:Droma']).toMatchObject({ runId: 'r7' });
    expect(store['alcc:crypt:v1:farmer']).toBeUndefined();
  });
});

describe('crypt priest tanking', () => {
  it('absorbs a monster hitting the warrior instead of letting the warrior tank', async () => {
    const { ctx } = setup({ name: 'Aedroma', ctype: 'priest', map: 'crypt', x: 700, y: -1000, mp: 4000, range: 250 });
    const skills: any[] = [];
    const lucinda = { type: 'monster', mtype: 'a7', x: 720, y: -940, target: 'Eadroma', max_hp: 720000, hp: 600000 };
    ctx.parent.entities = { m1: lucinda };
    ctx.get_player = (n: string) => n === 'Eadroma' ? { name: 'Eadroma', x: 720, y: -968, target: 'm1', mp: 900 } : n === 'Droma' ? { name: 'Droma', x: 720, y: -1072, mp: 900 } : null;
    ctx.use_skill = async (...args: unknown[]) => { skills.push(args); };
    ctx.can_use = () => true; ctx.change_target = () => {}; ctx.move = () => {}; ctx.can_move_to = () => true;
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'r8' });
    ctx.CryptRun.onCm('Eadroma', { t: 'crypt', a: 'open', runId: 'r8', id: 'inst' });
    await ctx.CryptRun.tick();
    expect(skills[0]).toEqual(['absorb', 'Eadroma']);
  });
});

describe('crypt danger memory', () => {
  it('keeps steering around a dangerous monster that flickers out of view', () => {
    const { ctx } = setup({ map: 'crypt', x: 2100, y: -1730 });
    const moves: number[][] = [];
    ctx.move = (x: number, y: number) => moves.push([x, y]);
    ctx.can_move_to = () => true;
    const marceline = { id: 'm6', type: 'monster', mtype: 'a6', x: 2789, y: -1713 };
    ctx.parent.entities = { m6: marceline };
    ctx.CryptRun.walk(2736, -1088);
    const first = moves.at(-1);
    ctx.parent.entities = {}; // out of view on the next tick
    ctx.character.moving = false;
    ctx.CryptRun.walk(2736, -1088);
    expect(moves.at(-1)).toEqual(first);
    expect(ctx.CryptRun.segClear([2100, -1730], first, [{ x: 2789, y: -1713, r: 260 }])).toBe(true);
  });
});

describe('crypt loadout', () => {
  it('reports a crypt monster for the style loadout while inside, Vampirelings by default', () => {
    const { ctx } = setup({ map: 'crypt', target: 'm3' });
    ctx.parent.entities = { m3: { type: 'monster', mtype: 'a3', x: 0, y: 0 } };
    expect(ctx.CryptRun.monster()).toBe('a3');
    const fresh = setup({ map: 'crypt', target: 'm3' }).ctx;
    fresh.parent.entities = { m3: { type: 'monster', mtype: 'a2', x: 0, y: 0 } }; // Bill is never a crypt target
    expect(fresh.CryptRun.monster()).toBe('vbat');
  });
});

describe('crypt retreat and resume', () => {
  it('rejoins a resumed instance by id without a key and without counting it as a death', async () => {
    const { ctx, entered } = setup();
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'r10', id: 'inst-old' });
    await ctx.CryptRun.tick();
    expect(entered).toEqual([['crypt', 'inst-old']]);
    expect(ctx.CryptRun.snapshot()).toMatchObject({ phase: 'gather', id: 'inst-old' });
    expect((ctx.get('alcc:crypt:v1:farmer:Eadroma') as any).rejoins).toBe(0);
  });

  it('steps out on a retreat order, waits at the door, then goes back in as a re-entry', async () => {
    const { ctx, entered } = setup({ name: 'Droma', ctype: 'ranger' });
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'r11' });
    ctx.CryptRun.onCm('Eadroma', { t: 'crypt', a: 'open', runId: 'r11', id: 'inst-2' });
    await ctx.CryptRun.tick(); // first entry
    ctx.character.map = 'cave'; ctx.character.x = -193; ctx.character.y = -1296; // stepped out through the door
    ctx.CryptRun.onCm('Eadroma', { t: 'crypt', a: 'retreat', runId: 'r11', until: Date.now() - 1 });
    expect(ctx.CryptRun.snapshot().phase).toBe('retreat');
    await new Promise(r => setTimeout(r, 4100)); // enter() throttle
    await ctx.CryptRun.tick(); // wait over: back to gather, then enter again
    expect(entered).toEqual([['crypt', 'inst-2'], ['crypt', 'inst-2']]);
    expect((ctx.get('alcc:crypt:v1:farmer:Droma') as any).rejoins).toBe(0);
  }, 15000);

  it('never sends the priest to absorb a Bill hit', async () => {
    const { ctx } = setup({ name: 'Aedroma', ctype: 'priest', map: 'crypt', x: 700, y: -1000, mp: 4000, range: 250 });
    const skills: any[] = [];
    ctx.parent.entities = { m2: { id: 'm2', type: 'monster', mtype: 'a2', x: 1400, y: -600, target: 'Eadroma' } };
    ctx.get_player = (n: string) => n === 'Eadroma' ? { name: 'Eadroma', x: 1380, y: -600, mp: 900 } : null;
    ctx.use_skill = async (...a: unknown[]) => { skills.push(a); };
    ctx.can_use = () => true; ctx.change_target = () => {}; ctx.move = () => {}; ctx.can_move_to = () => true;
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'r12' });
    ctx.CryptRun.onCm('Eadroma', { t: 'crypt', a: 'open', runId: 'r12', id: 'inst' });
    await ctx.CryptRun.tick();
    expect(skills.find(s => s[0] === 'absorb')).toBeUndefined();
  });
});

describe('crypt party cohesion', () => {
  it('keeps the tank in place until both allies are inside and close, and pings its position', async () => {
    const { ctx, sent } = setup({ map: 'crypt', x: 0, y: 0 });
    const moves: number[][] = [];
    ctx.move = (x: number, y: number) => moves.push([x, y]);
    ctx.can_move_to = () => true; ctx.change_target = () => {};
    ctx.get_player = () => null; // allies still at the door
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'r13', id: 'inst' });
    await ctx.CryptRun.tick();
    expect(moves).toEqual([]);
    expect(sent.some(([, d]: any) => d.a === 'pos')).toBe(true);
  });

  it('lets a follower walk to the tank position it received by message', async () => {
    const { ctx } = setup({ name: 'Droma', ctype: 'ranger', map: 'crypt', x: -32, y: -464 });
    const moves: number[][] = [];
    ctx.move = (x: number, y: number) => moves.push([x, y]);
    ctx.can_move_to = () => true; ctx.get_player = () => null;
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'r14', id: 'inst' });
    ctx.CryptRun.onCm('Eadroma', { t: 'crypt', a: 'pos', runId: 'r14', x: 700, y: -624 });
    await ctx.CryptRun.tick();
    expect(moves.length).toBeGreaterThan(0);
  });
});

describe('crypt retreat on deadly aggro', () => {
  it('orders a retreat as soon as Bill targets any member, even far from the tank', async () => {
    const { ctx, sent } = setup({ map: 'crypt', x: 0, y: 0 });
    ctx.parent.entities = { b: { id: 'b', type: 'monster', mtype: 'a2', x: 1800, y: -800, target: 'Droma' } };
    ctx.get_player = () => null; ctx.move = () => {}; ctx.can_move_to = () => true;
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'r15', id: 'inst' });
    await ctx.CryptRun.tick();
    expect(ctx.CryptRun.snapshot().phase).toBe('retreat');
    expect(sent.some(([, d]: any) => d.a === 'retreat')).toBe(true);
  });
});

describe('crypt members after a death', () => {
  it('lets a member who died once come back from a retreat', async () => {
    const { ctx, store } = setup({ name: 'Droma', ctype: 'ranger', map: 'cave', x: -193, y: -1296 });
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'r19', id: 'inst' });
    const key = 'alcc:crypt:v1:farmer:Droma';
    ctx.set(key, { ...(store[key] as object), entered: true, rejoins: 1, phase: 'gather', returning: true });
    vm.runInContext(source, ctx); // reload with the stored state, as after a retreat
    await ctx.CryptRun.tick();
    expect(ctx.CryptRun.snapshot().phase).not.toBe('leaving');
  });

  it('stops waiting for a ranger who left, and ends the run when the priest leaves', () => {
    const { ctx } = setup({ map: 'crypt', x: 0, y: 0 });
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'r20', id: 'inst' });
    ctx.CryptRun.onCm('Droma', { t: 'crypt', a: 'left', runId: 'r20', reason: 'died twice' });
    expect(ctx.CryptRun.snapshot().phase).not.toBe('leaving');
    ctx.CryptRun.onCm('Aedroma', { t: 'crypt', a: 'left', runId: 'r20', reason: 'died twice' });
    expect(ctx.CryptRun.snapshot().phase).toBe('leaving');
  });
});

describe('crypt objective', () => {
  it('ends the run once 7 Vampirelings, Lestat and Lucinda are dead, without finishing the round', async () => {
    const { ctx, store, sent } = setup({ map: 'crypt', x: 720, y: -663 });
    ctx.move = () => {}; ctx.can_move_to = () => true; ctx.change_target = () => {};
    ctx.get_player = (n: string) => ({ name: n, x: 720, y: -700, mp: 900, ctype: n === 'Droma' ? 'ranger' : undefined }); // ranger third: no Bill fight
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'r22', id: 'inst' });
    const key = 'alcc:crypt:v1:farmer:Eadroma';
    ctx.set(key, { ...(store[key] as object), entered: true, kills: { vbat: 7, a7: 1 } });
    vm.runInContext(source, ctx);
    await ctx.CryptRun.tick();
    expect(ctx.CryptRun.snapshot().phase).not.toBe('leaving'); // Lestat still alive
    ctx.set(key, { ...(ctx.get(key) as object), kills: { vbat: 7, a7: 1, a3: 1 } });
    vm.runInContext(source, ctx);
    await ctx.CryptRun.tick();
    expect(ctx.CryptRun.snapshot().phase).toBe('leaving');
    expect(sent.some(([, d]: any) => d.a === 'done' && d.reason === 'objective done')).toBe(true);
  });
});

describe('crypt blocked route', () => {
  it('holds while no route is safe, then skips after the wait', async () => {
    const { ctx, store } = setup({ map: 'crypt', x: 720, y: -663 });
    ctx.move = () => {}; ctx.can_move_to = () => false; ctx.change_target = () => {};
    ctx.get_player = (n: string) => ({ name: n, x: 720, y: -700, mp: 900 });
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'r21', id: 'inst' });
    const key = 'alcc:crypt:v1:farmer:Eadroma';
    ctx.set(key, { ...(store[key] as object), entered: true });
    vm.runInContext(source, ctx);
    for (let i = 0; i < 3; i++) await ctx.CryptRun.tick();
    expect((ctx.get(key) as any).wp || 0).toBe(0);
    vm.runInContext('Date.now = (function (n) { return function () { return n() + 6 * 60000; }; })(Date.now);', ctx);
    await ctx.CryptRun.tick();
    expect((ctx.get(key) as any).wp).toBe(1);
  });
});

describe('crypt loadout monster', () => {
  it('keeps the fought monster while the priest targets an ally to heal', () => {
    const { ctx } = setup({ name: 'Aedroma', ctype: 'priest', map: 'crypt', target: 'l' });
    ctx.parent.entities = { l: { id: 'l', type: 'monster', mtype: 'a7' }, Eadroma: { id: 'Eadroma', type: 'character' } };
    expect(ctx.CryptRun.monster()).toBe('a7');
    ctx.character.target = 'Eadroma';
    expect(ctx.CryptRun.monster()).toBe('a7');
    vm.runInContext('Date.now = (function (n) { return function () { return n() + 11000; }; })(Date.now);', ctx);
    expect(ctx.CryptRun.monster()).toBe('vbat');
  });
});

describe('crypt kill counting', () => {
  it('counts a nearly dead monster that disappears, but not one left behind on a retreat', async () => {
    const { ctx, sent } = setup({ map: 'crypt', x: 1000, y: -600 });
    ctx.move = () => {}; ctx.can_move_to = () => true; ctx.change_target = () => {}; ctx.attack = async () => {}; ctx.can_attack = () => true; ctx.is_in_range = () => true;
    ctx.get_player = (n: string) => ({ name: n, x: 1010, y: -600, mp: 900 });
    ctx.parent.entities = { l: { id: 'l', type: 'monster', mtype: 'a3', x: 1050, y: -600, hp: 9000, max_hp: 342000, target: 'Aedroma' } };
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'r18', id: 'inst' });
    await ctx.CryptRun.tick();
    ctx.parent.entities = {};
    await ctx.CryptRun.tick();
    expect(ctx.CryptRun.snapshot().kills).toEqual({ a3: 1 });
    expect(sent.some(([, d]: any) => d.a === 'kill' && d.mtype === 'a3')).toBe(true);
    ctx.parent.entities = { v: { id: 'v', type: 'monster', mtype: 'vbat', x: 1050, y: -600, hp: 100, max_hp: 156000 } };
    await ctx.CryptRun.tick();
    vm.runInContext('Date.now = (function (n) { return function () { return n() + 10000; }; })(Date.now);', ctx);
    ctx.parent.entities = {};
    await ctx.CryptRun.tick(); // ten seconds without a tick: out of the instance, not a kill
    expect(ctx.CryptRun.snapshot().kills).toEqual({ a3: 1 });
  });

  it('uncounts a monster counted dead that comes back in sight', async () => {
    const { ctx } = setup({ map: 'crypt', x: 1000, y: -600 });
    ctx.move = () => {}; ctx.can_move_to = () => true; ctx.change_target = () => {}; ctx.attack = async () => {}; ctx.can_attack = () => true; ctx.is_in_range = () => true;
    ctx.get_player = (n: string) => ({ name: n, x: 1010, y: -600, mp: 900 });
    const low = { id: 'l', type: 'monster', mtype: 'a3', x: 1050, y: -600, hp: 9000, max_hp: 342000, target: 'Aedroma' };
    ctx.parent.entities = { l: low };
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'r19', id: 'inst' });
    await ctx.CryptRun.tick();
    ctx.parent.entities = {};
    await ctx.CryptRun.tick();
    expect(ctx.CryptRun.snapshot().kills).toEqual({ a3: 1 });
    ctx.parent.entities = { l: low };
    await ctx.CryptRun.tick();
    expect(ctx.CryptRun.snapshot().kills).toEqual({ a3: 0 });
  });
});

describe('crypt ranger spacing', () => {
  it('backs off to max range, away from the priest Lestat is hitting', async () => {
    const { ctx } = setup({ name: 'Droma', ctype: 'ranger', map: 'crypt', x: 1030, y: -600, range: 250, mp: 0 });
    const moves: number[][] = [];
    ctx.move = (x: number, y: number) => moves.push([x, y]);
    ctx.can_move_to = () => true; ctx.change_target = () => {}; ctx.attack = async () => {}; ctx.can_attack = () => true;
    const lestat = { id: 'l', type: 'monster', mtype: 'a3', x: 1000, y: -600, hp: 342000, max_hp: 342000, target: 'Aedroma' };
    ctx.parent.entities = { l: lestat };
    ctx.get_player = (n: string) => n === 'Aedroma' ? { name: 'Aedroma', x: 1010, y: -600 } : n === 'Eadroma' ? { name: 'Eadroma', x: 1000, y: -630, target: 'l' } : null;
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'r17', id: 'inst' });
    await ctx.CryptRun.tick();
    expect(moves.length).toBeGreaterThan(0);
    const to = { x: moves[0][0], y: moves[0][1] };
    expect(dist(to, lestat)).toBeGreaterThan(200);
    expect(dist(to, { x: 1010, y: -600 })).toBeGreaterThan(80);
  });
});

describe('crypt regroup threshold', () => {
  it('moves on when the ranger holds its 130 px follow distance', async () => {
    const { ctx } = setup({ map: 'crypt', x: 720, y: -624 });
    const moves: number[][] = [];
    ctx.move = (x: number, y: number) => moves.push([x, y]);
    ctx.can_move_to = () => true; ctx.change_target = () => {};
    ctx.get_player = (n: string) => n === 'Aedroma' ? { x: 720, y: -624 } : { x: 845, y: -624 }; // ranger 125 px away
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'r16', id: 'inst' });
    const st: any = ctx.get('alcc:crypt:v1:farmer:Eadroma'); st.wp = 4; st.entered = true; ctx.set('alcc:crypt:v1:farmer:Eadroma', st);
    // reload the module so it picks the stored waypoint 4
    const again = setup({ map: 'crypt', x: 720, y: -624 });
    Object.assign(again.ctx, { move: ctx.move, can_move_to: ctx.can_move_to, change_target: ctx.change_target, get_player: ctx.get_player });
    again.ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'r16', id: 'inst' });
    for (let i = 0; i < 5; i++) await again.ctx.CryptRun.tick(); // wp 0 is far: walking means the round is not stuck
    await ctx.CryptRun.tick();
    expect(moves.length).toBeGreaterThan(0);
  });
});

describe('crypt Bill fight at the pillar', () => {
  const PILLAR = { x: 1024, y: -536 };
  const lead = (ranger: Record<string, unknown> = { ctype: 'rogue' }) => {
    const { ctx, sent } = setup({ map: 'crypt', x: 1000, y: -300, hp: 11000, max_hp: 11600, mp: 1400 });
    ctx.CONFIG.RANGER = 'Dromas';
    ctx.CONFIG.CRYPT_SAFE = ['vbat'];
    const players: Record<string, any> = {
      Dromas: { name: 'Dromas', x: 1050, y: -330, hp: 3200, max_hp: 3230, mp: 700, ...ranger },
      Aedroma: { name: 'Aedroma', ctype: 'priest', x: 950, y: -280, hp: 8300, max_hp: 8380, mp: 4500 },
    };
    ctx.get_player = (n: string) => players[n] || null;
    const skills: any[] = [];
    ctx.use_skill = async (...a: unknown[]) => { skills.push(a); };
    ctx.can_use = () => true; ctx.change_target = () => {}; ctx.move = () => {}; ctx.can_move_to = () => true; ctx.attack = async () => {}; ctx.can_attack = () => true;
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'rb' });
    return { ctx, sent, players, skills };
  };

  it('starts the fight when Bill idles in the pillar room and the third member is a rogue', async () => {
    const { ctx, sent } = lead();
    ctx.parent.entities = { b: mob('a2', 1100, -620, { hp: 420000, max_hp: 420000 }) };
    await ctx.CryptRun.tick();
    expect(sent.some(([, d]: any) => d.a === 'bill' && d.on)).toBe(true);
    expect(sent.some(([, d]: any) => d.a === 'retreat')).toBe(false);
  });

  it('keeps avoiding Bill with a ranger as third member', async () => {
    const { ctx, sent } = lead({ ctype: 'ranger' });
    ctx.parent.entities = { b: mob('a2', 1100, -620, { hp: 420000, max_hp: 420000 }) };
    await ctx.CryptRun.tick();
    expect(sent.some(([, d]: any) => d.a === 'bill')).toBe(false);
  });

  it('does not retreat while Bill chases the rogue, and a low tank steps out alone', async () => {
    const { ctx, sent } = lead();
    ctx.parent.entities = { b: mob('a2', 1100, -620, { hp: 420000, max_hp: 420000 }) };
    await ctx.CryptRun.tick();
    ctx.parent.entities = { b: mob('a2', 1000, -640, { hp: 300000, max_hp: 420000, target: 'Dromas' }) };
    await ctx.CryptRun.tick();
    expect(sent.some(([, d]: any) => d.a === 'retreat')).toBe(false);
    // A low tank steps out of the anger radius alone; the rogue keeps the fight, no party retreat.
    const moves: number[][] = []; ctx.move = (x: number, y: number) => moves.push([x, y]);
    ctx.character.hp = 3000;
    await ctx.CryptRun.tick();
    expect(sent.some(([, d]: any) => d.a === 'retreat')).toBe(false);
    const [x, y] = moves.at(-1)!;
    expect(Math.hypot(x - 1000, y + 640)).toBeGreaterThan(340);
  });

  it('runs the ring away from Bill when he chases this rogue, and vanishes when he catches up', async () => {
    const { ctx } = setup({ name: 'Dromas', ctype: 'rogue', map: 'crypt', x: PILLAR.x + 90, y: PILLAR.y, range: 120, hp: 3200, max_hp: 3230, s: {} });
    const moves: number[][] = [], skills: any[] = [];
    ctx.move = (x: number, y: number) => moves.push([x, y]); ctx.can_move_to = () => true; ctx.can_use = () => true;
    ctx.use_skill = async (...a: unknown[]) => { skills.push(a); }; ctx.change_target = () => {}; ctx.attack = async () => {}; ctx.can_attack = () => true;
    ctx.get_player = () => null;
    delete ctx.CONFIG.RANGER; // like the builder: the rogue script has no RANGER key of its own
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'rk' });
    ctx.CryptRun.onCm('Eadroma', { t: 'crypt', a: 'open', runId: 'rk', id: 'inst' });
    ctx.CryptRun.onCm('Eadroma', { t: 'crypt', a: 'bill', runId: 'rk', on: true });
    // Bill a quarter-turn behind (south side): the next step goes further round, away from him.
    const bill = mob('a2', PILLAR.x, PILLAR.y + 90, { hp: 400000, max_hp: 420000, target: 'Dromas' });
    ctx.parent.entities = { b: bill };
    await ctx.CryptRun.tick();
    const [x, y] = moves.at(-1)!;
    expect(Math.hypot(x - PILLAR.x, y - PILLAR.y)).toBeCloseTo(90, 0);
    expect(Math.hypot(x - bill.x, y - bill.y)).toBeGreaterThan(Math.hypot(PILLAR.x + 90 - bill.x, PILLAR.y - bill.y));
    ctx.parent.entities = { b: { ...bill, x: PILLAR.x + 70, y: PILLAR.y + 30 } };
    await ctx.CryptRun.tick();
    expect(skills.some(s => s[0] === 'invis')).toBe(true);
  });
});

describe('crypt Bill fight start distance', () => {
  it('does not start the fight when the party only sees Bill from far away', async () => {
    const { ctx, sent } = setup({ map: 'crypt', x: 390, y: -1150, hp: 11000, max_hp: 11600, mp: 1400 });
    ctx.CONFIG.RANGER = 'Dromas';
    const players: Record<string, any> = {
      Dromas: { name: 'Dromas', ctype: 'rogue', x: 384, y: -1088, hp: 3200, max_hp: 3230 },
      Aedroma: { name: 'Aedroma', ctype: 'priest', x: 384, y: -1088, hp: 8300, max_hp: 8380, mp: 4500 },
    };
    ctx.get_player = (n: string) => players[n] || null;
    ctx.use_skill = async () => {}; ctx.can_use = () => true; ctx.change_target = () => {}; ctx.move = () => {}; ctx.can_move_to = () => true; ctx.attack = async () => {}; ctx.can_attack = () => true;
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'rf' });
    ctx.parent.entities = { b: mob('a2', 1100, -620, { hp: 420000, max_hp: 420000 }) };
    await ctx.CryptRun.tick();
    expect(sent.some(([, d]: any) => d.a === 'bill')).toBe(false);
  });
});

describe('crypt spacing against walls', () => {
  it('steps to the open side when the crowded push points into a wall, instead of staying on the priest', async () => {
    const { ctx } = setup({ name: 'Dromas', ctype: 'rogue', map: 'crypt', x: 384, y: -1088, range: 120, hp: 3000, max_hp: 3230, mp: 700 });
    delete ctx.CONFIG.RANGER;
    const moves: number[][] = [];
    ctx.move = (x: number, y: number) => moves.push([x, y]);
    ctx.can_move_to = (x: number) => x >= 384; // wall west of the junction
    ctx.can_use = () => true; ctx.change_target = () => {}; ctx.attack = async () => {}; ctx.can_attack = () => true;
    ctx.get_player = (n: string) => n === 'Aedroma' ? { name: 'Aedroma', x: 384, y: -1088, hp: 8000 } : n === 'Eadroma' ? { name: 'Eadroma', x: 392, y: -1168, target: 'l', hp: 11000 } : null;
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'rw' });
    ctx.CryptRun.onCm('Eadroma', { t: 'crypt', a: 'open', runId: 'rw', id: 'inst' });
    ctx.parent.entities = { l: mob('a7', 384, -1120, { hp: 500000, max_hp: 720000, target: 'Aedroma' }) };
    await ctx.CryptRun.tick();
    const [x, y] = moves.at(-1)!;
    expect(x).toBeGreaterThan(384 + 60); // pushed east, away from the wall and off the priest
    expect(Math.hypot(x - 384, y + 1088)).toBeGreaterThan(80);
  });
});

describe('crypt Bill fight retries', () => {
  it('starts again after a start that never reached Bill, and allows five engaged fights per run', async () => {
    const { ctx, sent } = setup({ map: 'crypt', x: 1000, y: -300, hp: 11000, max_hp: 11600, mp: 1400 });
    ctx.CONFIG.RANGER = 'Dromas';
    ctx.CONFIG.CRYPT_SAFE = ['vbat'];
    const players: Record<string, any> = {
      Dromas: { name: 'Dromas', ctype: 'rogue', x: 1050, y: -330, hp: 3200, max_hp: 3230 },
      Aedroma: { name: 'Aedroma', ctype: 'priest', x: 950, y: -280, hp: 8300, max_hp: 8380, mp: 4500 },
    };
    ctx.get_player = (n: string) => players[n] || null;
    ctx.use_skill = async () => {}; ctx.can_use = () => true; ctx.change_target = () => {}; ctx.move = () => {}; ctx.can_move_to = () => true; ctx.attack = async () => {}; ctx.can_attack = () => true;
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'rr' });
    const starts = () => sent.filter(([, d]: any) => d.a === 'bill' && d.on).length;
    const idle = mob('a2', 1100, -620, { hp: 420000, max_hp: 420000 });
    ctx.parent.entities = { b: idle };
    await ctx.CryptRun.tick();
    expect(starts()).toBe(1);
    // Bill out of sight for 16 s without ever targeting us: the fight stops and may start again.
    ctx.parent.entities = {};
    const realNow = Date.now; let t = realNow();
    ctx.Date = { now: () => t } as any;
    vm.runInContext('Date = this.Date', ctx);
    t += 16000; await ctx.CryptRun.tick();
    ctx.parent.entities = { b: idle };
    await ctx.CryptRun.tick();
    expect(starts()).toBe(2);
    // Five engaged fights are allowed per run, then Bill is only avoided.
    for (const expected of [3, 4, 5, 6, 6]) {
      ctx.parent.entities = { b: { ...idle, target: 'Dromas' } };
      await ctx.CryptRun.tick();
      ctx.parent.entities = {};
      t += 16000; await ctx.CryptRun.tick();
      ctx.parent.entities = { b: idle };
      await ctx.CryptRun.tick();
      expect(starts()).toBe(expected);
    }
  });
});

describe('crypt run 4 fixes', () => {
  const stubs = (ctx: any) => {
    const log = { moves: [] as number[][], attacks: [] as string[], skills: [] as any[] };
    ctx.move = (x: number, y: number) => log.moves.push([x, y]); ctx.can_move_to = () => true; ctx.can_use = () => true;
    ctx.change_target = () => {}; ctx.attack = async (t: any) => { log.attacks.push(t.mtype); }; ctx.can_attack = () => true;
    ctx.use_skill = async (...a: unknown[]) => { log.skills.push(a); }; ctx.is_in_range = () => true;
    return log;
  };

  it('counts real deaths: a re-entry without one is not "died twice", two deaths are', async () => {
    const { ctx, sent } = setup({ name: 'Aedroma', ctype: 'priest' });
    stubs(ctx); ctx.get_player = () => null;
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'rd' });
    ctx.CryptRun.onCm('Eadroma', { t: 'crypt', a: 'open', runId: 'rd', id: 'inst' });
    await ctx.CryptRun.tick(); // enters
    ctx.character.map = 'cave'; ctx.character.x = -193; ctx.character.y = -1296; // moved out with no death
    await ctx.CryptRun.tick(); await ctx.CryptRun.tick();
    expect(sent.some(([, d]: any) => d.a === 'left')).toBe(false);
    // A character dies where it stands: inside the crypt.
    for (let i = 0; i < 2; i++) { ctx.character.map = 'crypt'; ctx.character.rip = true; await ctx.CryptRun.tick(); ctx.character.rip = false; ctx.character.map = 'cave'; await ctx.CryptRun.tick(); }
    ctx.character.map = 'cave';
    await ctx.CryptRun.tick();
    expect(sent.some(([, d]: any) => d.a === 'left' && d.reason === 'died twice')).toBe(true);
  });

  it('warrior holds back until the priest has the target, then attacks', async () => {
    const { ctx } = setup({ map: 'crypt', x: 1150, y: -380, hp: 11000, max_hp: 11600, range: 38 });
    const log = stubs(ctx);
    ctx.get_player = (n: string) => n === 'Aedroma' ? { name: 'Aedroma', x: 1120, y: -360, mp: 4000, hp: 8000 } : n === 'Droma' ? { name: 'Droma', x: 1100, y: -330, hp: 6000 } : null;
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'rp' });
    const bat = mob('vbat', 1190, -385, { id: 'v1', hp: 9000, max_hp: 9000 });
    ctx.parent.entities = { v1: bat };
    await ctx.CryptRun.tick();
    expect(log.attacks).toEqual([]);
    (bat as any).target = 'Aedroma';
    await ctx.CryptRun.tick();
    expect(log.attacks).toEqual(['vbat']);
  });

  it('priest opens the fight on an idle target', async () => {
    const { ctx } = setup({ name: 'Aedroma', ctype: 'priest', map: 'crypt', x: 1120, y: -360, mp: 4000, range: 200 });
    const log = stubs(ctx);
    ctx.get_player = (n: string) => n === 'Eadroma' ? { name: 'Eadroma', x: 1150, y: -380, target: 'v1', hp: 11000 } : null;
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'rq' });
    ctx.CryptRun.onCm('Eadroma', { t: 'crypt', a: 'open', runId: 'rq', id: 'inst' });
    ctx.parent.entities = { v1: mob('vbat', 1190, -385, { id: 'v1', hp: 9000, max_hp: 9000 }) };
    await ctx.CryptRun.tick();
    expect(log.attacks).toEqual(['vbat']);
  });

  it('after entering, the tank waits at the door for the party and fetches a member that reports itself cut off', async () => {
    const { ctx, sent } = setup({ hp: 11000, max_hp: 11600 });
    const log = stubs(ctx);
    ctx.get_player = () => null; // nobody in sight yet
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'rg' });
    ctx.items = []; ctx.character.items = [{ name: 'cryptkey', q: 1 }];
    ctx.character.map = 'cave'; ctx.character.x = -193; ctx.character.y = -1296;
    await ctx.CryptRun.tick(); // opens and enters
    ctx.character.x = 0; ctx.character.y = 0;
    ctx.parent.entities = { v1: mob('vbat', 200, -300, { id: 'v1', hp: 9000, max_hp: 9000 }) };
    log.moves.length = 0;
    await ctx.CryptRun.tick();
    expect(log.moves).toEqual([]); // no roaming, no pull while regrouping
    ctx.CryptRun.onCm('Aedroma', { t: 'crypt', a: 'stuck', runId: 'rg', x: -192, y: -960 });
    ctx.parent.entities = {};
    await ctx.CryptRun.tick();
    expect(log.moves.length).toBeGreaterThan(0);
    expect(sent.some(([, d]: any) => d.a === 'bill')).toBe(false);
  });
});

describe('crypt stale instance', () => {
  it('leaves the old instance after an abort and a new start instead of fighting in it', async () => {
    const { ctx } = setup({ map: 'crypt', in: 'old-inst', x: 2752, y: -1744 });
    const moves: number[][] = [];
    ctx.move = (x: number, y: number) => moves.push([x, y]); ctx.can_move_to = () => true; ctx.get_player = () => null;
    ctx.parent.entities = { v: mob('vbat', 2700, -1700, { id: 'v', hp: 9000, max_hp: 9000 }) };
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'new' });
    await ctx.CryptRun.tick();
    expect(moves.length).toBeGreaterThan(0); // walking towards the exit, not fighting
    expect(ctx.CryptRun.snapshot().phase).toBe('gather');
  });
});

describe('crypt Bill fight priest support', () => {
  const priest = (bill: any, allies: Record<string, any> = {}) => {
    const { ctx } = setup({ name: 'Aedroma', ctype: 'priest', map: 'crypt', x: 752, y: -961, range: 200, mp: 4000, hp: 8000, max_hp: 8380 });
    const log = { moves: [] as number[][], skills: [] as any[] };
    ctx.move = (x: number, y: number) => log.moves.push([x, y]); ctx.can_move_to = () => true; ctx.can_use = () => true;
    ctx.use_skill = async (...a: unknown[]) => { log.skills.push(a); }; ctx.change_target = () => {};
    ctx.get_player = (n: string) => allies[n] || null;
    ctx.CONFIG.RANGER = 'Dromas';
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'rc' });
    ctx.CryptRun.onCm('Eadroma', { t: 'crypt', a: 'open', runId: 'rc', id: 'inst' });
    ctx.CryptRun.onCm('Eadroma', { t: 'crypt', a: 'bill', runId: 'rc', on: true });
    ctx.parent.entities = { b: bill };
    return { ctx, log };
  };

  it('walks in to curse an uncursed Bill, casts once in range, and holds Curse range once he is cursed (audit)', async () => {
    const bill = mob('a2', 1000, -560, { hp: 390000, max_hp: 420000, target: 'Dromas', s: {} });
    const { ctx, log } = priest(bill);
    await ctx.CryptRun.tick();
    const [x, y] = log.moves.at(-1)!;
    expect(Math.hypot(x - 1000, y + 560)).toBeLessThan(Math.hypot(752 - 1000, -961 + 560)); // stepping towards him
    ctx.character.x = 900; ctx.character.y = -700;
    await ctx.CryptRun.tick();
    expect(log.skills.some(s => s[0] === 'curse')).toBe(true);
    (bill as any).s = { cursed: { ms: 4000 } };
    await ctx.CryptRun.tick();
    const [ox, oy] = log.moves.at(-1)!;
    const od = Math.hypot(ox - 1000, oy + 560);
    expect(od).toBeGreaterThan(120); expect(od).toBeLessThanOrEqual(185); // stays at casting range (100% Curse uptime)
  });

  it('comes within heal range of an ally under half HP', async () => {
    const bill = mob('a2', 1000, -560, { hp: 390000, max_hp: 420000, target: 'Dromas', s: { cursed: { ms: 4000 } } });
    const { ctx, log } = priest(bill, { Eadroma: { name: 'Eadroma', x: 1040, y: -560, hp: 4000, max_hp: 11600 } });
    await ctx.CryptRun.tick();
    const [x, y] = log.moves.at(-1)!;
    expect(x).toBe(1040); expect(y).toBe(-560);
  });
});

describe('crypt waits for Bill after the objective', () => {
  it('holds by the pillar with a rogue third while a Bill try is left, then ends after 20 minutes', async () => {
    const { ctx, store, sent } = setup({ map: 'crypt', x: 1184, y: -384 });
    ctx.CONFIG.RANGER = 'Dromas';
    ctx.CONFIG.CRYPT_MARCELINE = false; // only the Bill wait is under test here
    ctx.move = () => {}; ctx.can_move_to = () => true; ctx.change_target = () => {};
    ctx.get_player = (n: string) => ({ name: n, x: 1180, y: -390, mp: 900, hp: 3000, max_hp: 3200, ctype: n === 'Dromas' ? 'rogue' : 'priest' });
    let t = Date.now();
    ctx.Date = { now: () => t } as any;
    vm.runInContext('Date = this.Date', ctx);
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'rw2', id: 'inst' });
    const key = 'alcc:crypt:v1:farmer:Eadroma';
    ctx.set(key, { ...(store[key] as object), entered: true, kills: { vbat: 7, a7: 1, a3: 1 } });
    vm.runInContext(source, ctx);
    vm.runInContext('Date = this.Date', ctx);
    await ctx.CryptRun.tick();
    expect(ctx.CryptRun.snapshot().phase).not.toBe('leaving');
    expect(ctx.CryptRun.snapshot().last).toMatch(/waiting for Bill/);
    t += 21 * 60 * 1000;
    await ctx.CryptRun.tick();
    expect(sent.some(([, d]: any) => d.a === 'done' && d.reason === 'objective done')).toBe(true);
  });
});

describe('crypt Bill fight curse refresh', () => {
  it('comes back to Curse range while it runs and recasts as soon as it is ending (audit: 100% uptime)', async () => {
    const { ctx } = setup({ name: 'Aedroma', ctype: 'priest', map: 'crypt', x: 1000, y: -900, range: 200, mp: 4000, hp: 8000, max_hp: 8380 });
    const moves: number[][] = [], skills: string[] = [];
    ctx.move = (x: number, y: number) => moves.push([x, y]); ctx.can_move_to = () => true; ctx.can_use = () => true;
    ctx.use_skill = async (sk: string) => { skills.push(sk); }; ctx.change_target = () => {}; ctx.get_player = () => null;
    ctx.CONFIG.RANGER = 'Dromas';
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'rcr' });
    ctx.CryptRun.onCm('Eadroma', { t: 'crypt', a: 'open', runId: 'rcr', id: 'inst' });
    ctx.CryptRun.onCm('Eadroma', { t: 'crypt', a: 'bill', runId: 'rcr', on: true });
    const bill: any = mob('a2', 1000, -540, { hp: 390000, max_hp: 420000, target: 'Dromas', s: { cursed: { ms: 4000 } } });
    ctx.parent.entities = { b: bill };
    await ctx.CryptRun.tick();
    const [x, y] = moves.at(-1)!;
    expect(Math.hypot(x - 1000, y + 540)).toBeLessThanOrEqual(185); // 360 px away: back to casting range
    expect(skills).not.toContain('curse');
    ctx.character.y = -720; bill.s.cursed.ms = 1000;
    await ctx.CryptRun.tick();
    expect(skills).toContain('curse');
  });
});

describe('crypt boss order', () => {
  it('Lucinda before a closer Lestat, Bill only once both are dead, Vampirelings after Bill', async () => {
    const { ctx, sent } = setup({ map: 'crypt', x: 1000, y: -300, hp: 11000, max_hp: 11600, mp: 1400 });
    ctx.CONFIG.RANGER = 'Dromas';
    const lucinda = mob('a7', 2000, -300), lestat = mob('a3', 1000, -1000);
    expect(ctx.CryptRun.pickTarget([lucinda, lestat]).mtype).toBe('a7');
    ctx.get_player = (n: string) => ({ name: n, x: 1010, y: -310, hp: 3200, max_hp: 3230, mp: 4000, ctype: n === 'Dromas' ? 'rogue' : 'priest' });
    ctx.use_skill = async () => {}; ctx.can_use = () => true; ctx.change_target = () => {}; ctx.move = () => {}; ctx.can_move_to = () => true; ctx.attack = async () => {}; ctx.can_attack = () => true;
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'ro' });
    ctx.parent.entities = { b: mob('a2', 1100, -620, { id: 'b', hp: 420000, max_hp: 420000 }) };
    await ctx.CryptRun.tick();
    expect(sent.some(([, d]: any) => d.a === 'bill')).toBe(false); // Lucinda and Lestat still alive
  });
});

describe('crypt Bill fight without the warrior', () => {
  it('keeps the warrior outside the anger radius and never hitting Bill, even at full HP', async () => {
    const { ctx } = setup({ map: 'crypt', x: 1050, y: -480, hp: 11600, max_hp: 11600, mp: 1400 });
    ctx.CONFIG.RANGER = 'Dromas'; ctx.CONFIG.CRYPT_SAFE = ['vbat'];
    const moves: number[][] = [], attacks: string[] = [];
    ctx.get_player = (n: string) => ({ name: n, x: 1000, y: -620, hp: 3200, max_hp: 3230, mp: 4000, ctype: n === 'Dromas' ? 'rogue' : 'priest' });
    ctx.use_skill = async () => {}; ctx.can_use = () => true; ctx.change_target = () => {}; ctx.can_move_to = () => true; ctx.can_attack = () => true;
    ctx.move = (x: number, y: number) => moves.push([x, y]); ctx.attack = async (t: any) => { attacks.push(t.mtype); };
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'rwo' });
    const bill: any = mob('a2', 1060, -560, { id: 'b', hp: 420000, max_hp: 420000 });
    ctx.parent.entities = { b: bill };
    await ctx.CryptRun.tick(); // fight starts
    bill.target = 'Dromas';
    await ctx.CryptRun.tick();
    expect(attacks).toEqual([]);
    const [x, y] = moves.at(-1)!;
    expect(Math.hypot(x - bill.x, y - bill.y)).toBeGreaterThan(340);
  });
});

describe('crypt run 7 fixes', () => {
  it('starts the Bill fight when he is already on one of us far from the pillar, once the bosses are dead', async () => {
    const { ctx, sent } = setup({ map: 'crypt', x: 1400, y: -880, hp: 11000, max_hp: 11600, mp: 1400 });
    ctx.CONFIG.RANGER = 'Dromas'; ctx.CONFIG.CRYPT_SAFE = ['vbat'];
    ctx.get_player = (n: string) => ({ name: n, x: 1420, y: -870, hp: 3200, max_hp: 3230, mp: 4000, ctype: n === 'Dromas' ? 'rogue' : 'priest' });
    ctx.use_skill = async () => {}; ctx.can_use = () => true; ctx.change_target = () => {}; ctx.move = () => {}; ctx.can_move_to = () => true; ctx.attack = async () => {}; ctx.can_attack = () => true;
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'r7' });
    ctx.parent.entities = { b: mob('a2', 1450, -880, { id: 'b', hp: 420000, max_hp: 420000, target: 'Dromas' }) };
    await ctx.CryptRun.tick();
    expect(sent.some(([, d]: any) => d.a === 'bill' && d.on)).toBe(true);
    expect(sent.some(([, d]: any) => d.a === 'retreat')).toBe(false);
  });

  it('counts a death even when the movement loop never calls tick while dead', () => {
    const { ctx } = setup({ name: 'Aedroma', ctype: 'priest' });
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'rd7' });
    ctx.character.map = 'crypt'; ctx.character.rip = true;
    ctx.__intervals.forEach((fn: () => void) => fn());
    expect(ctx.CryptRun.snapshot().last).toMatch(/died in the crypt \(1\)/);
  });
});

describe('crypt farms while Bill is far', () => {
  const lead = () => {
    const { ctx, store } = setup({ map: 'crypt', x: 1184, y: -384, hp: 11000, max_hp: 11600, mp: 1400 });
    ctx.CONFIG.RANGER = 'Dromas';
    const targets: string[] = [];
    ctx.get_player = (n: string) => ({ name: n, x: 1180, y: -390, hp: 3200, max_hp: 3230, mp: 4000, ctype: n === 'Dromas' ? 'rogue' : 'priest' });
    ctx.use_skill = async () => {}; ctx.can_use = () => true; ctx.move = () => {}; ctx.can_move_to = () => true; ctx.attack = async () => {}; ctx.can_attack = () => true;
    ctx.change_target = (t: any) => targets.push(t.mtype);
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'rf7', id: 'inst' });
    const key = 'alcc:crypt:v1:farmer:Eadroma';
    ctx.set(key, { ...(store[key] as object), entered: true, kills: { a7: 1, a3: 1 } });
    vm.runInContext(source, ctx);
    return { ctx, targets };
  };

  it('pulls a Vampireling when Bill is out of sight', async () => {
    const { ctx, targets } = lead();
    ctx.parent.entities = { v: mob('vbat', 1220, -400, { id: 'v', hp: 156000, max_hp: 156000 }) };
    await ctx.CryptRun.tick();
    expect(targets).toContain('vbat');
  });

  it('leaves the Vampirelings alone while Bill is near the pillar', async () => {
    const { ctx, targets } = lead();
    ctx.CONFIG.CRYPT_BILL = false; // no fight start in this test, only the waiting rule
    ctx.parent.entities = { v: mob('vbat', 1220, -400, { id: 'v', hp: 156000, max_hp: 156000 }), b: mob('a2', 700, -700, { id: 'b', hp: 420000, max_hp: 420000 }) };
    await ctx.CryptRun.tick();
    expect(targets).toContain('vbat'); // Bill fights disabled: nothing to wait for
    const second = lead();
    second.ctx.parent.entities = { v: mob('vbat', 1220, -400, { id: 'v', hp: 156000, max_hp: 156000 }), b: mob('a2', 700, -700, { id: 'b', hp: 420000, max_hp: 420000 }) };
    await second.ctx.CryptRun.tick();
    expect(second.targets).not.toContain('vbat'); // Bill 363 px from the pillar: wait for him
  });
});

describe('crypt run 7 rogue safety', () => {
  it('starts the fight when Bill is already on a hurt rogue', async () => {
    const { ctx, sent } = setup({ map: 'crypt', x: 1184, y: -384, hp: 6000, max_hp: 11600, mp: 1400 });
    ctx.CONFIG.RANGER = 'Dromas'; ctx.CONFIG.CRYPT_SAFE = ['vbat'];
    ctx.get_player = (n: string) => n === 'Dromas' ? { name: n, ctype: 'rogue', x: 1300, y: -400, hp: 900, max_hp: 3230 } : { name: n, ctype: 'priest', x: 900, y: -900, hp: 8000, max_hp: 9200, mp: 4000 };
    ctx.use_skill = async () => {}; ctx.can_use = () => true; ctx.change_target = () => {}; ctx.move = () => {}; ctx.can_move_to = () => true; ctx.attack = async () => {}; ctx.can_attack = () => true;
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'rs7' });
    ctx.parent.entities = { b: mob('a2', 1320, -420, { id: 'b', hp: 420000, max_hp: 420000, target: 'Dromas' }) };
    await ctx.CryptRun.tick();
    expect(sent.some(([, d]: any) => d.a === 'bill' && d.on)).toBe(true);
    expect(sent.some(([, d]: any) => d.a === 'retreat')).toBe(false);
  });

  it('makes the rogue vanish when an avoided monster closes in, outside a Bill fight', async () => {
    const { ctx } = setup({ name: 'Dromas', ctype: 'rogue', map: 'crypt', x: 1300, y: -400, hp: 3000, max_hp: 3230, s: {} });
    delete ctx.CONFIG.RANGER;
    const skills: any[] = [];
    ctx.use_skill = async (...a: unknown[]) => { skills.push(a); }; ctx.can_use = () => true; ctx.move = () => {}; ctx.can_move_to = () => true; ctx.get_player = () => null;
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'rv7' });
    ctx.CryptRun.onCm('Eadroma', { t: 'crypt', a: 'open', runId: 'rv7', id: 'inst' });
    ctx.parent.entities = { b: mob('a2', 1340, -420, { id: 'b', hp: 420000, max_hp: 420000, target: 'Dromas' }) };
    await ctx.CryptRun.tick();
    expect(skills.some(s => s[0] === 'invis')).toBe(true);
  });
});

describe('crypt Bill on the priest', () => {
  it('the warrior walks in and taunts Bill off the priest', async () => {
    const { ctx } = setup({ map: 'crypt', x: 1000, y: -900, hp: 11600, max_hp: 11600, mp: 1400 });
    ctx.CONFIG.RANGER = 'Dromas'; ctx.CONFIG.CRYPT_SAFE = ['vbat'];
    const skills: any[] = [];
    ctx.get_player = (n: string) => ({ name: n, x: 1100, y: -800, hp: 5000, max_hp: 9200, mp: 4000, ctype: n === 'Dromas' ? 'rogue' : 'priest' });
    ctx.use_skill = async (...a: unknown[]) => { skills.push(a); }; ctx.can_use = () => true; ctx.change_target = () => {}; ctx.move = () => {}; ctx.can_move_to = () => true; ctx.attack = async () => {}; ctx.can_attack = () => true;
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'rtp' });
    ctx.parent.entities = { b: mob('a2', 1080, -820, { id: 'b', hp: 400000, max_hp: 420000, target: 'Aedroma' }) };
    await ctx.CryptRun.tick(); // engaged start
    await ctx.CryptRun.tick();
    expect(skills.some(s => s[0] === 'taunt')).toBe(true);
  });
});

describe('crypt Bill fight distances (runs 8-9)', () => {
  const follower = (name: string, ctype: string, x: number, y: number, extra: Record<string, unknown> = {}) => {
    const { ctx, sent } = setup({ name, ctype, map: 'crypt', x, y, range: ctype === 'rogue' ? 120 : 200, hp: 3200, max_hp: 3230, mp: 4000, s: {}, ...extra });
    if (ctype === 'rogue') delete ctx.CONFIG.RANGER; else ctx.CONFIG.RANGER = 'Dromas';
    const moves: number[][] = [], skills: any[] = [];
    ctx.move = (mx: number, my: number) => moves.push([mx, my]); ctx.can_move_to = () => true; ctx.can_use = () => true;
    ctx.use_skill = async (...a: unknown[]) => { skills.push(a); }; ctx.change_target = () => {}; ctx.attack = async () => {}; ctx.can_attack = () => false; ctx.get_player = () => null;
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'rd' + name });
    ctx.CryptRun.onCm('Eadroma', { t: 'crypt', a: 'open', runId: 'rd' + name, id: 'inst' });
    ctx.CryptRun.onCm('Eadroma', { t: 'crypt', a: 'bill', runId: 'rd' + name, on: true });
    return { ctx, sent, moves, skills };
  };

  it('pulls an idle Bill from 110 px, never walking onto him', async () => {
    const { ctx, moves } = follower('Dromas', 'rogue', 1000, -360);
    ctx.parent.entities = { b: mob('a2', 1000, -620, { id: 'b', hp: 400000, max_hp: 420000 }) };
    await ctx.CryptRun.tick();
    const [x, y] = moves.at(-1)!;
    expect(Math.hypot(x - 1000, y + 620)).toBeGreaterThanOrEqual(105);
  });

  // Run 26 (user): vanish late at full HP, earlier when hurt, and not at all on a frozen Bill unless close and hurt.
  const vanish = async (gap: number, hp: number, s: object = {}) => {
    const { ctx, skills } = follower('Dromas', 'rogue', 1000, -540);
    ctx.character.hp = hp; ctx.character.max_hp = 3511;
    ctx.parent.entities = { b: mob('a2', 1000, -540 - gap, { id: 'b', hp: 400000, max_hp: 420000, target: 'Dromas', s }) };
    await ctx.CryptRun.tick();
    return skills.some(x => x[0] === 'invis');
  };
  it('vanishes from Bill under 60 px, or under 100 px when hurt', async () => {
    expect(await vanish(90, 3500)).toBe(false);
    expect(await vanish(55, 3500)).toBe(true);
    expect(await vanish(90, 1800)).toBe(true);
  });
  it('keeps hitting a frozen Bill instead of vanishing', async () => {
    expect(await vanish(55, 3500, { frozen: { ms: 3000 } })).toBe(false);
    expect(await vanish(40, 1500, { frozen: { ms: 3000 } })).toBe(true);
  });

  it('the priest walks to Curse range, not onto Bill', async () => {
    const { ctx, moves } = follower('Aedroma', 'priest', 1000, -1000, { hp: 8000, max_hp: 9200 });
    ctx.parent.entities = { b: mob('a2', 1000, -560, { id: 'b', hp: 400000, max_hp: 420000, target: 'Dromas', s: {} }) };
    await ctx.CryptRun.tick();
    const [x, y] = moves.at(-1)!;
    expect(Math.hypot(x - 1000, y + 560)).toBeGreaterThanOrEqual(150);
  });

  it('lets the warrior take over (Taunt) when the rogue is down, instead of stopping the fight', async () => {
    const { ctx, sent } = setup({ map: 'crypt', x: 1184, y: -384, hp: 11000, max_hp: 11600, mp: 1400 });
    ctx.CONFIG.RANGER = 'Dromas'; ctx.CONFIG.CRYPT_SAFE = ['vbat'];
    let rip = false;
    ctx.get_player = (n: string) => n === 'Dromas' ? { name: n, ctype: 'rogue', x: 1100, y: -500, hp: 3000, max_hp: 3230, rip } : { name: n, ctype: 'priest', x: 900, y: -900, hp: 8000, max_hp: 9200, mp: 4000 };
    ctx.use_skill = async () => {}; ctx.can_use = () => true; ctx.change_target = () => {}; ctx.move = () => {}; ctx.can_move_to = () => true; ctx.attack = async () => {}; ctx.can_attack = () => true;
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'rdn' });
    ctx.parent.entities = { b: mob('a2', 1100, -560, { id: 'b', hp: 400000, max_hp: 420000, target: 'Dromas' }) };
    await ctx.CryptRun.tick();
    rip = true;
    await ctx.CryptRun.tick();
    expect(sent.filter(([, d]: any) => d.a === 'bill').map(([, d]: any) => d.on)).not.toContain(false);
  });
});

describe('crypt rogue keeps clear of Bill chasing someone else', () => {
  it('steps back to 115 px when Bill passes closer than 100 px', async () => {
    const { ctx } = setup({ name: 'Dromas', ctype: 'rogue', map: 'crypt', x: 1067, y: -542, range: 120, hp: 3231, max_hp: 3231, mp: 700, s: {} });
    delete ctx.CONFIG.RANGER;
    const moves: number[][] = [];
    ctx.move = (x: number, y: number) => moves.push([x, y]); ctx.can_move_to = () => true; ctx.can_use = () => true;
    ctx.use_skill = async () => {}; ctx.change_target = () => {}; ctx.attack = async () => {}; ctx.can_attack = () => true; ctx.get_player = () => null;
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'rk11' });
    ctx.CryptRun.onCm('Eadroma', { t: 'crypt', a: 'open', runId: 'rk11', id: 'inst' });
    ctx.CryptRun.onCm('Eadroma', { t: 'crypt', a: 'bill', runId: 'rk11', on: true });
    ctx.parent.entities = { b: mob('a2', 1075, -581, { id: 'b', hp: 370000, max_hp: 420000, target: 'Eadroma' }) };
    await ctx.CryptRun.tick();
    const [x, y] = moves.at(-1)!;
    expect(Math.hypot(x - 1075, y + 581)).toBeGreaterThanOrEqual(110);
  });
});

describe('crypt rogue leaves Invisibility', () => {
  it('reappears once no avoided monster is on or near him, stays hidden while Bill is close', async () => {
    const { ctx } = setup({ name: 'Dromas', ctype: 'rogue', map: 'crypt', x: 0, y: 0, range: 120, hp: 3231, max_hp: 3231, mp: 700, s: { invis: { ms: 999 } } });
    delete ctx.CONFIG.RANGER;
    const stops: string[] = [];
    ctx.stop = (what: string) => stops.push(what); ctx.move = () => {}; ctx.can_move_to = () => true; ctx.can_use = () => true; ctx.get_player = () => null; ctx.use_skill = async () => {};
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'ri' });
    ctx.CryptRun.onCm('Eadroma', { t: 'crypt', a: 'open', runId: 'ri', id: 'inst' });
    ctx.parent.entities = { b: mob('a2', 120, 0, { id: 'b', hp: 400000, max_hp: 420000 }) };
    await ctx.CryptRun.tick();
    expect(stops).not.toContain('invis');
    ctx.parent.entities = { b: mob('a2', 300, 0, { id: 'b', hp: 400000, max_hp: 420000 }) }; // run 20: 300 px is too close
    await ctx.CryptRun.tick();
    expect(stops).not.toContain('invis');
    ctx.parent.entities = {};
    await ctx.CryptRun.tick();
    expect(stops).toContain('invis');
  });
});

describe('crypt rogue stays hidden near Bill (run 12)', () => {
  it('stays hidden while Bill is on him and comes back out once Bill switches to the warrior', async () => {
    const { ctx } = setup({ name: 'Dromas', ctype: 'rogue', map: 'crypt', x: 1000, y: -400, range: 120, hp: 3231, max_hp: 3231, mp: 700, s: { invis: { ms: 999 } } });
    delete ctx.CONFIG.RANGER;
    const attacks: string[] = [];
    ctx.move = () => {}; ctx.can_move_to = () => true; ctx.can_use = () => true; ctx.use_skill = async () => {}; ctx.change_target = () => {};
    ctx.attack = async (t: any) => { attacks.push(t.mtype); }; ctx.can_attack = () => true; ctx.get_player = () => null;
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'rh' });
    ctx.CryptRun.onCm('Eadroma', { t: 'crypt', a: 'open', runId: 'rh', id: 'inst' });
    ctx.CryptRun.onCm('Eadroma', { t: 'crypt', a: 'bill', runId: 'rh', on: true });
    const stops: string[] = []; ctx.stop = (w: string) => stops.push(w);
    ctx.parent.entities = { b: mob('a2', 1000, -520, { id: 'b', hp: 390000, max_hp: 420000, target: 'Dromas' }) };
    await ctx.CryptRun.tick();
    expect(attacks).toEqual([]); // Bill on him: stay hidden
    ctx.parent.entities = { b: mob('a2', 1000, -520, { id: 'b', hp: 390000, max_hp: 420000, target: 'Eadroma' }) };
    await ctx.CryptRun.tick();
    expect(stops).toContain('invis'); // Bill switched to the warrior: come back out
  });
});

describe('crypt warrior on Bill (run 12)', () => {
  it('hits Bill only under Hard Shell and runs the ring without it', async () => {
    const { ctx } = setup({ map: 'crypt', x: 1114, y: -536, hp: 11000, max_hp: 11600, mp: 1400, s: {} });
    ctx.CONFIG.RANGER = 'Dromas'; ctx.CONFIG.CRYPT_SAFE = ['vbat'];
    const attacks: string[] = [], moves: number[][] = [];
    let rogueIn = true; // the rogue is there when the fight starts, then drops out (takeover)
    ctx.get_player = (n: string) => n === 'Dromas' ? (rogueIn ? { name: n, ctype: 'rogue', x: 1300, y: -700, hp: 3500, max_hp: 3511, mp: 900 } : null) : { name: n, ctype: 'priest', x: 800, y: -900, hp: 8000, max_hp: 9200, mp: 4000 };
    ctx.can_use = (sk: string) => sk !== 'hardshell'; // Hard Shell on cooldown
    ctx.use_skill = async () => {}; ctx.change_target = () => {}; ctx.can_move_to = () => true; ctx.can_attack = () => true;
    ctx.move = (x: number, y: number) => moves.push([x, y]); ctx.attack = async (t: any) => { attacks.push(t.mtype); };
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'rw12' });
    ctx.parent.entities = { b: mob('a2', 1114, -490, { id: 'b', hp: 390000, max_hp: 420000, target: 'Eadroma' }) };
    await ctx.CryptRun.tick(); // engaged start
    rogueIn = false;
    await ctx.CryptRun.tick();
    expect(attacks).toEqual([]);
    expect(moves.length).toBeGreaterThan(0);
    ctx.character.s = { hardshell: { ms: 6000 } };
    await ctx.CryptRun.tick();
    expect(attacks).toEqual(['a2']);
  });

  const rotation = (s: object, ready: boolean, target: string) => {
    const { ctx } = setup({ map: 'crypt', x: 1114, y: -536, hp: 11000, max_hp: 11600, mp: 1400, s });
    ctx.CONFIG.RANGER = 'Dromas'; ctx.CONFIG.CRYPT_SAFE = ['vbat'];
    const skills: string[] = [], moves: number[][] = [];
    ctx.get_player = (n: string) => n === 'Dromas' ? { name: n, ctype: 'rogue', x: 1000, y: -420, hp: 3500, max_hp: 3511, mp: 900 } : { name: n, ctype: 'priest', x: 700, y: -900, hp: 8000, max_hp: 9200, mp: 4000 };
    ctx.can_use = (sk: string) => ready || sk !== 'hardshell';
    ctx.use_skill = async (sk: string) => { skills.push(sk); }; ctx.change_target = () => {}; ctx.can_move_to = () => true; ctx.can_attack = () => true;
    ctx.move = (x: number, y: number) => moves.push([x, y]); ctx.attack = async () => {};
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'rot' + target });
    ctx.parent.entities = { b: mob('a2', 1040, -400, { id: 'b', hp: 390000, max_hp: 420000, target, s: { cursed: { ms: 4000 } } }) };
    return { ctx, skills, moves };
  };

  it('taunts Bill off the rogue when Hard Shell is ready (rotation, run 25)', async () => {
    const { ctx, skills } = rotation({}, true, 'Dromas');
    await ctx.CryptRun.tick(); // engaged start
    await ctx.CryptRun.tick();
    expect(skills).toContain('taunt');
  });

  it('does not taunt a Bill that is neither cursed nor frozen (he would outrun her after the shell, audit)', async () => {
    const { ctx, skills } = rotation({}, true, 'Dromas');
    ctx.parent.entities.b.s = {};
    await ctx.CryptRun.tick();
    await ctx.CryptRun.tick();
    expect(skills).not.toContain('taunt');
  });

  it('steps out of the anger radius once Hard Shell is over (rotation, run 25)', async () => {
    const { ctx, moves } = rotation({}, false, 'Eadroma');
    await ctx.CryptRun.tick();
    await ctx.CryptRun.tick();
    const last = moves[moves.length - 1];
    expect(Math.hypot(last[0] - 1040, last[1] + 400)).toBeGreaterThan(340);
  });

  it('runs the pillar ring instead when hurt between two shells (rotation, run 26)', async () => {
    const { ctx } = rotation({}, false, 'Eadroma');
    const msgs: string[] = []; ctx.set_message = (m: string) => msgs.push(m);
    ctx.character.hp = 4000;
    await ctx.CryptRun.tick();
    await ctx.CryptRun.tick();
    expect(msgs.at(-1)).toMatch(/no Hard Shell, run/);
    ctx.character.hp = 11000;
    await ctx.CryptRun.tick();
    expect(msgs.at(-1)).toMatch(/Hard Shell over/);
  });

  it('does not start a fight on an engaged Bill while the rogue is out of the instance (run 19)', async () => {
    const { ctx } = setup({ map: 'crypt', x: 1114, y: -536, hp: 11000, max_hp: 11600, mp: 1400, s: {} });
    ctx.CONFIG.RANGER = 'Dromas'; ctx.CONFIG.CRYPT_SAFE = ['vbat'];
    ctx.get_player = (n: string) => n === 'Dromas' ? null : { name: n, ctype: 'priest', x: 800, y: -900, hp: 8000, max_hp: 9200, mp: 4000 };
    ctx.use_skill = async () => {}; ctx.change_target = () => {}; ctx.can_move_to = () => true; ctx.can_attack = () => true;
    ctx.move = () => {}; ctx.attack = async () => {};
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'rw19' });
    ctx.parent.entities = { b: mob('a2', 1114, -490, { id: 'b', hp: 390000, max_hp: 420000, target: 'Eadroma' }) };
    await ctx.CryptRun.tick();
    expect(ctx.CryptRun.snapshot().last).not.toMatch(/Bill fight at the pillar/);
  });
});

describe('crypt lead rejoins a spread party', () => {
  it('walks to an ally in sight but more than 300 px away instead of waiting', async () => {
    const { ctx, store } = setup({ map: 'crypt', x: 736, y: -1088, hp: 11000, max_hp: 11600, mp: 1400 });
    ctx.CONFIG.RANGER = 'Dromas';
    const moves: number[][] = [];
    ctx.get_player = (n: string) => ({ name: n, x: 1080, y: -596, hp: 3000, max_hp: 3230, mp: 4000, ctype: n === 'Dromas' ? 'rogue' : 'priest' });
    ctx.move = (x: number, y: number) => moves.push([x, y]); ctx.can_move_to = () => true; ctx.can_use = () => true; ctx.use_skill = async () => {}; ctx.change_target = () => {};
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'rsp', id: 'inst' });
    const key = 'alcc:crypt:v1:farmer:Eadroma';
    ctx.set(key, { ...(store[key] as object), entered: true, kills: { a7: 1, a3: 1, a2: 1 } });
    vm.runInContext(source, ctx);
    ctx.parent.entities = {};
    await ctx.CryptRun.tick();
    const [x, y] = moves.at(-1)!;
    expect(Math.hypot(x - 1080, y + 596)).toBeLessThan(Math.hypot(736 - 1080, -1088 + 596));
  });
});

describe('crypt deaths outside the instance', () => {
  it('does not count a death on the way to the door', () => {
    const { ctx } = setup({ name: 'Dromas', ctype: 'rogue', map: 'desertland', x: 0, y: 0 });
    delete ctx.CONFIG.RANGER;
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'rdo' });
    ctx.character.rip = true;
    ctx.__intervals.forEach((fn: () => void) => fn());
    expect(ctx.CryptRun.snapshot().last).not.toMatch(/died in the crypt/);
  });
});

describe('crypt Marceline attempt after the objective (run 13)', () => {
  it('starts the attempt instead of finishing once everything else is dead', async () => {
    const { ctx, store, sent } = setup({ map: 'crypt', x: 1184, y: -384, hp: 11000, max_hp: 11600, mp: 1400 });
    ctx.CONFIG.RANGER = 'Dromas';
    ctx.CONFIG.CRYPT_MARCELINE = true; // opt-in since run 15
    ctx.move = () => {}; ctx.can_move_to = () => true; ctx.change_target = () => {};
    ctx.get_player = (n: string) => ({ name: n, x: 1180, y: -390, hp: 3000, max_hp: 3230, mp: 4000, ctype: n === 'Dromas' ? 'rogue' : 'priest' });
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'rm', id: 'inst' });
    const key = 'alcc:crypt:v1:farmer:Eadroma';
    ctx.set(key, { ...(store[key] as object), entered: true, kills: { vbat: 7, a7: 1, a3: 1, a2: 1 } });
    vm.runInContext(source, ctx);
    ctx.parent.entities = {};
    await ctx.CryptRun.tick();
    expect(sent.some(([, d]: any) => d.a === 'marc' && d.on)).toBe(true);
    expect(sent.some(([, d]: any) => d.a === 'done')).toBe(false);
    ctx.CryptRun.onCm('Dromas', { t: 'crypt', a: 'marc_end', runId: 'rm', reason: 'rogue died' });
    await ctx.CryptRun.tick();
    expect(sent.some(([, d]: any) => d.a === 'done' && d.reason === 'objective done')).toBe(true);
  });

  const rogue = () => {
    const { ctx } = setup({ name: 'Dromas', ctype: 'rogue', map: 'crypt', x: 2500, y: -1700, range: 120, hp: 3231, max_hp: 3231, mp: 700, s: {} });
    delete ctx.CONFIG.RANGER;
    const moves: number[][] = [], attacks: string[] = [], skills: any[] = [];
    ctx.move = (x: number, y: number) => moves.push([x, y]); ctx.can_move_to = () => true; ctx.can_use = () => true;
    ctx.use_skill = async (...a: unknown[]) => { skills.push(a); }; ctx.change_target = () => {}; ctx.can_attack = () => true;
    ctx.attack = async (t: any) => { attacks.push(t.mtype); };
    // The priest close by (Curse ready): the rogue only pulls with her within 300 px (run 26).
    ctx.get_player = (n: string) => n === 'Aedroma' ? { name: n, ctype: 'priest', x: 2620, y: -1580, hp: 9000, max_hp: 9499, mp: 4000 } : null;
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'rmr' });
    ctx.CryptRun.onCm('Eadroma', { t: 'crypt', a: 'open', runId: 'rmr', id: 'inst' });
    ctx.CryptRun.onCm('Eadroma', { t: 'crypt', a: 'marc', runId: 'rmr', on: true });
    return { ctx, moves, attacks, skills };
  };

  it('the rogue pulls from 115 px, never walking onto her', async () => {
    const { ctx, moves } = rogue();
    ctx.parent.entities = { m: mob('a6', 2747, -1735, { id: 'm', hp: 320000, max_hp: 320000 }) };
    await ctx.CryptRun.tick();
    const [x, y] = moves.at(-1)!;
    expect(Math.hypot(x - 2747, y + 1735)).toBeGreaterThanOrEqual(110);
  });

  it('never stands inside 105 px: steps out (no hit), vanishes only under 60 px, hits between 105 and 120 px (run 28)', async () => {
    const a = rogue();
    a.ctx.can_use = (sk: string) => sk !== 'invis'; // run 28: Invisibility on cooldown, she roams onto him
    a.ctx.parent.entities = { m: mob('a6', 2550, -1700, { id: 'm', hp: 320000, max_hp: 320000 }) }; // 50 px, idle
    await a.ctx.CryptRun.tick();
    expect(a.attacks).toEqual([]); // the melee hit that killed him
    const [ax, ay] = a.moves.at(-1)!;
    expect(Math.hypot(ax - 2550, ay + 1700)).toBeGreaterThan(120);
    const v = rogue();
    v.ctx.parent.entities = { m: mob('a6', 2550, -1700, { id: 'm', hp: 300000, max_hp: 320000, target: 'Dromas' }) };
    await v.ctx.CryptRun.tick();
    expect(v.skills.some(s => s[0] === 'invis')).toBe(true); // 50 px with it ready: last resort
    const c = rogue();
    c.ctx.parent.entities = { m: mob('a6', 2580, -1700, { id: 'm', hp: 300000, max_hp: 320000, target: 'Dromas' }) }; // 80 px
    await c.ctx.CryptRun.tick();
    expect(c.skills.some(s => s[0] === 'invis')).toBe(false);
    expect(c.attacks).toEqual([]);
    const b = rogue();
    b.ctx.parent.entities = { m: mob('a6', 2612, -1700, { id: 'm', hp: 300000, max_hp: 320000, target: 'Dromas' }) };
    await b.ctx.CryptRun.tick();
    expect(b.attacks).toEqual(['a6']);
  });

  it('the priest curses Marceline only once she is on the rogue, never an idle one (run 28)', async () => {
    const { ctx } = setup({ name: 'Aedroma', ctype: 'priest', map: 'crypt', x: 2400, y: -1700, hp: 9499, max_hp: 9499, mp: 4900, s: {} });
    ctx.CONFIG.RANGER = 'Dromas';
    const skills: string[] = [];
    ctx.move = () => {}; ctx.can_move_to = () => true; ctx.change_target = () => {}; ctx.can_use = () => true;
    ctx.use_skill = async (sk: string) => { skills.push(sk); }; ctx.get_player = () => null;
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'rpc' });
    ctx.CryptRun.onCm('Eadroma', { t: 'crypt', a: 'open', runId: 'rpc', id: 'inst' });
    ctx.CryptRun.onCm('Eadroma', { t: 'crypt', a: 'marc', runId: 'rpc', on: true });
    const m: any = mob('a6', 2570, -1700, { id: 'm', hp: 320000, max_hp: 320000 }); // 170 px, idle
    ctx.parent.entities = { m };
    await ctx.CryptRun.tick();
    expect(skills).not.toContain('curse');
    m.target = 'Dromas';
    await ctx.CryptRun.tick();
    expect(skills).toContain('curse');
  });

  it('avoids another RUN monster (Angel) first during the Marceline attempt (run 29)', async () => {
    const a = rogue();
    a.ctx.parent.entities = {
      m: mob('a6', 2612, -1700, { id: 'm', hp: 320000, max_hp: 320000 }),
      g: mob('a8', 2540, -1700, { id: 'g', hp: 560000, max_hp: 560000, target: 'Dromas' }), // 40 px, on him
    };
    await a.ctx.CryptRun.tick();
    expect(a.skills.some(s => s[0] === 'invis')).toBe(true);
    expect(a.attacks).toEqual([]);
  });

  it('pulls when the priest is in Curse range of Marceline even if she is far from him (run 28)', async () => {
    const a = rogue();
    a.ctx.character.x = 2400; a.ctx.character.y = -1900; // rogue on one side
    a.ctx.get_player = (n: string) => n === 'Aedroma' ? { name: n, ctype: 'priest', x: 2650, y: -1650, hp: 9000, max_hp: 9499, mp: 4000 } : null;
    a.ctx.parent.entities = { m: mob('a6', 2480, -1820, { id: 'm', hp: 320000, max_hp: 320000 }) }; // ~113 px from him, priest ~350 px from him
    await a.ctx.CryptRun.tick();
    expect(a.attacks).toEqual(['a6']);
  });

  it('does not pull her while weakened, and walks off while hidden (run 25)', async () => {
    const a = rogue();
    a.ctx.character.s = { weakness: { ms: 15000 } };
    a.ctx.parent.entities = { m: mob('a6', 2612, -1700, { id: 'm', hp: 320000, max_hp: 320000 }) }; // idle, ~112 px
    await a.ctx.CryptRun.tick();
    expect(a.attacks).toEqual([]);
    const [x, y] = a.moves.at(-1)!;
    expect(Math.hypot(x - 2612, y + 1700)).toBeGreaterThan(200);
    const b = rogue();
    b.ctx.character.s = { invis: { ms: 999 } };
    b.ctx.parent.entities = { m: mob('a6', 2560, -1700, { id: 'm', hp: 320000, max_hp: 320000 }) }; // 60 px
    await b.ctx.CryptRun.tick();
    const [bx, by] = b.moves.at(-1)!;
    expect(Math.hypot(bx - 2560, by + 1700)).toBeGreaterThanOrEqual(200);
  });

  it('reports Marceline killed only when she vanishes low and close, not low and far (audit)', async () => {
    const reports = (sent: any[]) => sent.filter(([, d]: any) => d.a === 'marc_end').map(([, d]: any) => d.reason);
    for (const [x, want] of [[2620, ['killed']], [2850, []]] as const) {
      const a = rogue(); const sent: any[] = []; a.ctx.send_cm = (n: any, d: any) => sent.push([n, d]);
      a.ctx.parent.entities = { m: mob('a6', x, -1700, { id: 'm', hp: 30000, max_hp: 320000, target: 'Dromas' }) };
      await a.ctx.CryptRun.tick();
      a.ctx.parent.entities = {};
      await a.ctx.CryptRun.tick();
      expect(reports(sent)).toEqual(want);
    }
  });

  it('the priest walks towards the rogue out of sight instead of standing at the entry (run 26)', async () => {
    const { ctx } = setup({ name: 'Aedroma', ctype: 'priest', map: 'crypt', x: 384, y: -1360, hp: 9499, max_hp: 9499, mp: 4900, s: {} });
    delete ctx.CONFIG.RANGER; ctx.CONFIG.RANGER = 'Dromas';
    const moves: number[][] = [];
    ctx.move = (x: number, y: number) => moves.push([x, y]); ctx.can_move_to = () => true; ctx.change_target = () => {};
    ctx.get_player = () => null;
    ctx.get_party = () => ({ Dromas: { map: 'crypt', x: 2500, y: -1700 } });
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'rmp' });
    ctx.CryptRun.onCm('Eadroma', { t: 'crypt', a: 'open', runId: 'rmp', id: 'inst' });
    ctx.CryptRun.onCm('Eadroma', { t: 'crypt', a: 'marc', runId: 'rmp', on: true });
    ctx.parent.entities = {};
    await ctx.CryptRun.tick();
    expect(moves.length).toBeGreaterThan(0);
  });

  it('waits for the priest before pulling, steps out under 105 px, stands and hits a frozen one (run 26)', async () => {
    const a = rogue();
    a.ctx.get_player = () => null; // priest out of sight
    a.ctx.parent.entities = { m: mob('a6', 2612, -1700, { id: 'm', hp: 320000, max_hp: 320000 }) };
    await a.ctx.CryptRun.tick();
    expect(a.attacks).toEqual([]);
    const b = rogue();
    b.ctx.parent.entities = { m: mob('a6', 2595, -1700, { id: 'm', hp: 300000, max_hp: 320000, target: 'Dromas' }) }; // 95 px
    await b.ctx.CryptRun.tick();
    const [bx, by] = b.moves.at(-1)!;
    expect(Math.hypot(bx - 2595, by + 1700)).toBeGreaterThan(120);
    const c = rogue();
    c.ctx.parent.entities = { m: mob('a6', 2597, -1700, { id: 'm', hp: 300000, max_hp: 320000, target: 'Dromas', s: { frozen: { ms: 3000 } } }) };
    await c.ctx.CryptRun.tick();
    expect(c.attacks).toEqual(['a6']);
    expect(c.skills.some(s => s[0] === 'invis')).toBe(false);
  });
});

describe('crypt Marceline Hard Shell rotation (run 32)', () => {
  const warrior = (s: object, can: (sk: string) => boolean, target: string | undefined, gap: number) => {
    const { ctx, store } = setup({ map: 'crypt', x: 2500, y: -1700, hp: 11000, max_hp: 11600, mp: 1400, s });
    ctx.CONFIG.RANGER = 'Dromas';
    const skills: string[] = [], moves: number[][] = [], attacks: string[] = [];
    ctx.move = (x: number, y: number) => moves.push([x, y]); ctx.can_move_to = () => true; ctx.change_target = () => {};
    ctx.can_use = can; ctx.use_skill = async (sk: string) => { skills.push(sk); }; ctx.can_attack = () => true;
    ctx.attack = async (t: any) => { attacks.push(t.mtype); };
    ctx.get_player = (n: string) => n === 'Aedroma' ? { name: n, ctype: 'priest', x: 2500 + gap, y: -1520, hp: 9000, max_hp: 9499, mp: 4000 } : { name: n, ctype: 'rogue', x: 2500 + gap + 110, y: -1700, hp: 3500, max_hp: 3511, mp: 900 };
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'rmw', id: 'inst' });
    const key = 'alcc:crypt:v1:farmer:Eadroma';
    ctx.set(key, { ...(store[key] as object), entered: true, kills: { vbat: 7, a7: 1, a3: 1, a2: 1 }, marc: { at: Date.now() } });
    vm.runInContext(source, ctx);
    ctx.parent.entities = { m: mob('a6', 2500 + gap, -1700, { id: 'm', hp: 320000, max_hp: 320000, target, s: { cursed: { ms: 4000 } } }) };
    return { ctx, skills, moves, attacks };
  };

  it('taunts Marceline off the rogue once Hard Shell and Taunt are ready', async () => {
    const w = warrior({}, () => true, 'Dromas', 170);
    await w.ctx.CryptRun.tick();
    expect(w.skills).toContain('taunt');
  });

  it('waits outside her aura while Hard Shell is on cooldown', async () => {
    const w = warrior({}, (sk) => sk !== 'hardshell', 'Dromas', 120);
    await w.ctx.CryptRun.tick();
    expect(w.skills).not.toContain('taunt');
    const [x, y] = w.moves.at(-1)!;
    expect(Math.hypot(x - 2620, y + 1700)).toBeGreaterThanOrEqual(150);
  });

  it('tanks and hits under Hard Shell, then Scares her back to the rogue as it ends', async () => {
    const w = warrior({ hardshell: { ms: 5000 } }, () => true, 'Eadroma', 30);
    await w.ctx.CryptRun.tick();
    expect(w.attacks).toEqual(['a6']);
    expect(w.skills).not.toContain('scare');
    w.ctx.character.s = { hardshell: { ms: 900 } };
    await w.ctx.CryptRun.tick();
    expect(w.skills).toContain('scare');
  });

  it('Scares and runs when she is on the warrior without Hard Shell', async () => {
    const w = warrior({}, (sk) => sk !== 'hardshell', 'Eadroma', 40);
    await w.ctx.CryptRun.tick();
    expect(w.skills).toContain('scare');
    expect(w.attacks).toEqual([]);
  });

  it('taunts her off the priest even without Hard Shell', async () => {
    const w = warrior({}, (sk) => sk !== 'hardshell', 'Aedroma', 170);
    await w.ctx.CryptRun.tick();
    expect(w.skills).toContain('taunt');
  });
});

describe('crypt recovery after Bill (run 29)', () => {
  it('steps out to refill when the priest ends the Bill fight under half mana', async () => {
    const { ctx, sent, store } = setup({ map: 'crypt', x: 1100, y: -500, hp: 9000, max_hp: 11600, mp: 800 });
    ctx.CONFIG.RANGER = 'Dromas';
    ctx.move = () => {}; ctx.can_move_to = () => true; ctx.change_target = () => {}; ctx.attack = async () => {}; ctx.use_skill = async () => {}; ctx.can_use = () => true;
    ctx.get_player = (n: string) => ({ name: n, x: 1100, y: -520, hp: n === 'Aedroma' ? 8000 : 3400, max_hp: n === 'Aedroma' ? 9499 : 3511, mp: n === 'Aedroma' ? 900 : 900, max_mp: n === 'Aedroma' ? 4980 : 905, ctype: n === 'Dromas' ? 'rogue' : 'priest' });
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'rrb', id: 'inst' });
    const key = 'alcc:crypt:v1:farmer:Eadroma';
    ctx.set(key, { ...(store[key] as object), entered: true, kills: { a7: 1, a3: 1 } });
    vm.runInContext(source, ctx);
    ctx.parent.entities = { b: mob('a2', 1040, -520, { id: 'b', hp: 390000, max_hp: 420000, target: 'Dromas' }) };
    await ctx.CryptRun.tick(); // engaged fight
    ctx.parent.entities = {};
    const t = Date.now() + 16000; ctx.Date = class extends Date { static now() { return t; } }; vm.runInContext('Date = this.Date', ctx);
    await ctx.CryptRun.tick(); // Bill lost after 15 s out of sight
    expect(sent.some(([, d]: any) => d.a === 'retreat' && /recover after Bill/.test(d.reason))).toBe(true);
  });
});

describe('crypt boss joins the Bill fight (run 39)', () => {
  it('stops the fight and steps out when Lestat comes within 350 px of Bill', async () => {
    const { ctx, store, sent } = setup({ map: 'crypt', x: 400, y: -1100, hp: 11000, max_hp: 11600, mp: 1400 });
    ctx.CONFIG.RANGER = 'Dromas';
    ctx.move = () => {}; ctx.can_move_to = () => true; ctx.change_target = () => {}; ctx.use_skill = async () => {}; ctx.can_use = () => true; ctx.attack = async () => {};
    ctx.get_player = (n: string) => ({ name: n, x: 420, y: -1100, hp: 3400, max_hp: 3511, mp: 4000, max_mp: 4980, ctype: n === 'Dromas' ? 'rogue' : 'priest' });
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'rbj', id: 'inst' });
    const key = 'alcc:crypt:v1:farmer:Eadroma';
    ctx.set(key, { ...(store[key] as object), entered: true, kills: { a7: 1 }, bill: { at: Date.now(), engaged: true, engagedAt: Date.now() } });
    vm.runInContext(source, ctx);
    ctx.parent.entities = { b: mob('a2', 420, -1090, { id: 'b', hp: 300000, max_hp: 420000, target: 'Eadroma' }), l: mob('a3', 600, -1100, { id: 'l', hp: 342000, max_hp: 342000 }) };
    await ctx.CryptRun.tick();
    expect(sent.some(([, d]: any) => d.a === 'retreat' && /a3 joined/.test(d.reason))).toBe(true);
  });
});

describe('crypt one retreat at a time (run 42)', () => {
  it('Bill on a hurt priest ends the fight with a single retreat, not two', async () => {
    const { ctx, store, sent } = setup({ map: 'crypt', x: 1100, y: -500, hp: 11000, max_hp: 11600, mp: 1400 });
    ctx.CONFIG.RANGER = 'Dromas';
    let t = Date.now();
    ctx.Date = class extends Date { static now() { return t; } };
    ctx.move = () => {}; ctx.can_move_to = () => true; ctx.change_target = () => {}; ctx.use_skill = async () => {}; ctx.can_use = () => true; ctx.attack = async () => {};
    ctx.get_player = (n: string) => ({ name: n, x: 1100, y: -520, hp: n === 'Aedroma' ? 4000 : 3400, max_hp: n === 'Aedroma' ? 9499 : 3511, mp: 4000, max_mp: 4980, ctype: n === 'Dromas' ? 'rogue' : 'priest' });
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'rot1', id: 'inst' });
    const key = 'alcc:crypt:v1:farmer:Eadroma';
    ctx.set(key, { ...(store[key] as object), entered: true, kills: { a7: 1, a3: 1 }, bill: { at: t, engaged: true, engagedAt: t } });
    vm.runInContext(source, ctx);
    vm.runInContext('Date = this.Date', ctx);
    ctx.parent.entities = { b: mob('a2', 1040, -520, { id: 'b', hp: 300000, max_hp: 420000, target: 'Aedroma' }) };
    await ctx.CryptRun.tick();
    t += 11000;
    await ctx.CryptRun.tick();
    expect(sent.filter(([, d]: any) => d.a === 'retreat').length).toBe(1);
  });
});

describe('crypt no progress (run 38)', () => {
  it('ends the run after 15 min without a kill or a Bill fight', async () => {
    const { ctx, store, sent } = setup({ map: 'crypt', x: 1981, y: -1729, hp: 11000, max_hp: 11600, mp: 1400 });
    ctx.CONFIG.RANGER = 'Dromas';
    ctx.move = () => {}; ctx.can_move_to = () => true; ctx.change_target = () => {};
    ctx.get_player = (n: string) => ({ name: n, x: 1980, y: -1730, hp: 3000, max_hp: 3511, mp: 4000, max_mp: 4980, ctype: n === 'Dromas' ? 'rogue' : 'priest' });
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'rnp', id: 'inst' });
    const key = 'alcc:crypt:v1:farmer:Eadroma';
    ctx.set(key, { ...(store[key] as object), entered: true, openedAt: Date.now() - 16 * 60 * 1000, kills: { a7: 1, a3: 1 }, billTries: 5 });
    vm.runInContext(source, ctx);
    ctx.parent.entities = {};
    await ctx.CryptRun.tick();
    expect(sent.some(([, d]: any) => d.a === 'done' && /no progress/.test(d.reason))).toBe(true);
  });
});

describe('crypt priest out of mana (run 36)', () => {
  it('steps out when the priest is under 15% MP with something on us', async () => {
    const { ctx, sent } = setup({ map: 'crypt', x: 1184, y: -384, hp: 9000, max_hp: 11600, mp: 800 });
    ctx.CONFIG.RANGER = 'Dromas';
    ctx.move = () => {}; ctx.can_move_to = () => true; ctx.change_target = () => {}; ctx.attack = async () => {};
    ctx.get_player = (n: string) => ({ name: n, x: 1180, y: -390, hp: 3000, max_hp: 3511, mp: n === 'Aedroma' ? 500 : 900, max_mp: n === 'Aedroma' ? 4980 : 905, ctype: n === 'Dromas' ? 'rogue' : 'priest' });
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'rpm', id: 'inst' });
    ctx.parent.entities = { v: mob('vbat', 1190, -380, { id: 'v', target: 'Aedroma' }) };
    await ctx.CryptRun.tick();
    expect(sent.some(([, d]: any) => d.a === 'retreat' && /out of mana/.test(d.reason))).toBe(true);
  });
});

describe('crypt priest down (run 26)', () => {
  it('steps out when the priest is dead and a Vampireling is on us', async () => {
    const { ctx, sent } = setup({ map: 'crypt', x: 1184, y: -384, hp: 9000, max_hp: 11600, mp: 800 });
    ctx.CONFIG.RANGER = 'Dromas';
    ctx.move = () => {}; ctx.can_move_to = () => true; ctx.change_target = () => {}; ctx.attack = async () => {};
    ctx.get_player = (n: string) => ({ name: n, x: 1180, y: -390, hp: n === 'Aedroma' ? 0 : 3000, max_hp: 3511, mp: 900, rip: n === 'Aedroma', ctype: n === 'Dromas' ? 'rogue' : 'priest' });
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'rpd', id: 'inst' });
    ctx.parent.entities = { v: mob('vbat', 1190, -380, { id: 'v', target: 'Eadroma' }) };
    await ctx.CryptRun.tick();
    expect(sent.some(([, d]: any) => d.a === 'retreat' && /priest down/.test(d.reason))).toBe(true);
  });
});

describe('crypt route around a blocked waypoint (run 13)', () => {
  it('goes on to the next reachable waypoint instead of holding 5 minutes', async () => {
    const { ctx, store } = setup({ map: 'crypt', x: 384, y: -1360, hp: 11000, max_hp: 11600, mp: 1400 });
    const moves: number[][] = [];
    ctx.get_player = (n: string) => ({ name: n, x: 384, y: -1350, hp: 3000, max_hp: 3230, mp: 4000, ctype: n === 'Droma' ? 'ranger' : 'priest' });
    ctx.move = (x: number, y: number) => moves.push([x, y]); ctx.can_move_to = () => true; // only Bill's circle blocks
    ctx.change_target = () => {};
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'rb13', id: 'inst' });
    const key = 'alcc:crypt:v1:farmer:Eadroma';
    ctx.set(key, { ...(store[key] as object), entered: true, wp: 1, kills: {} });
    vm.runInContext(source, ctx);
    // Bill parked on the Vampireling room: waypoint 1 has no safe route, the north corridor is open.
    ctx.parent.entities = { b: mob('a2', 1104, -500, { id: 'b', hp: 420000, max_hp: 420000 }) };
    await ctx.CryptRun.tick();
    expect(ctx.CryptRun.snapshot().last).toMatch(/blocked, going on to/);
  });

  it('holds for the Bill fight instead of skipping once Lucinda and Lestat are dead (run 19)', async () => {
    const { ctx, store } = setup({ map: 'crypt', x: 384, y: -1360, hp: 11000, max_hp: 11600, mp: 1400 });
    ctx.get_player = (n: string) => ({ name: n, x: 384, y: -1350, hp: 3000, max_hp: 3230, mp: 4000, ctype: n === 'Droma' ? 'rogue' : 'priest' });
    ctx.move = () => {}; ctx.can_move_to = () => true; ctx.change_target = () => {};
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'rb19', id: 'inst' });
    const key = 'alcc:crypt:v1:farmer:Eadroma';
    ctx.set(key, { ...(store[key] as object), entered: true, wp: 5, vbatStart: true, kills: { a7: 1, a3: 1 } });
    vm.runInContext(source, ctx);
    // Bill more than 600 px from the pillar (no "wait at the pillar"), sitting on waypoint 5.
    ctx.parent.entities = { b: mob('a2', 720, -1072, { id: 'b', hp: 420000, max_hp: 420000 }) };
    await ctx.CryptRun.tick();
    expect(ctx.CryptRun.snapshot().last).not.toMatch(/going on to/);
    expect(ctx.CryptRun.snapshot().last).toMatch(/Bill in the way|Bill fight/);
  });
});

describe('crypt Bill blocking the route (run 13)', () => {
  it('starts the Bill fight before Lestat once Bill has kept the route blocked for a minute', async () => {
    const { ctx, store, sent } = setup({ map: 'crypt', x: 600, y: -1080, hp: 11000, max_hp: 11600, mp: 1400 });
    ctx.CONFIG.RANGER = 'Dromas';
    let t = Date.now();
    ctx.Date = { now: () => t } as any;
    ctx.get_player = (n: string) => ({ name: n, x: 590, y: -1080, hp: 3200, max_hp: 3230, mp: 4000, ctype: n === 'Dromas' ? 'rogue' : 'priest' });
    ctx.move = () => {}; ctx.can_move_to = () => false; ctx.change_target = () => {}; ctx.use_skill = async () => {}; ctx.can_use = () => true;
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'rbb', id: 'inst' });
    const key = 'alcc:crypt:v1:farmer:Eadroma';
    ctx.set(key, { ...(store[key] as object), entered: true, wp: 1, kills: { a7: 1 } }); // Lestat still alive
    vm.runInContext(source, ctx);
    vm.runInContext('Date = this.Date', ctx);
    ctx.parent.entities = { b: mob('a2', 718, -731, { id: 'b', hp: 420000, max_hp: 420000 }) };
    await ctx.CryptRun.tick(); // route blocked: hold starts
    expect(sent.some(([, d]: any) => d.a === 'bill')).toBe(false);
    t += 61000;
    await ctx.CryptRun.tick();
    expect(sent.some(([, d]: any) => d.a === 'bill' && d.on)).toBe(true);
  });

  it('does not start the fight while a live boss stands by the pillar (run 35)', async () => {
    const { ctx, store, sent } = setup({ map: 'crypt', x: 600, y: -1080, hp: 11000, max_hp: 11600, mp: 1400 });
    ctx.CONFIG.RANGER = 'Dromas';
    let t = Date.now();
    ctx.Date = { now: () => t } as any;
    ctx.get_player = (n: string) => ({ name: n, x: 590, y: -1080, hp: 3200, max_hp: 3230, mp: 4000, ctype: n === 'Dromas' ? 'rogue' : 'priest' });
    ctx.move = () => {}; ctx.can_move_to = () => false; ctx.change_target = () => {}; ctx.use_skill = async () => {}; ctx.can_use = () => true;
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'rb35', id: 'inst' });
    const key = 'alcc:crypt:v1:farmer:Eadroma';
    ctx.set(key, { ...(store[key] as object), entered: true, wp: 1, kills: { a3: 1 } }); // Lucinda still alive
    vm.runInContext(source, ctx);
    vm.runInContext('Date = this.Date', ctx);
    ctx.parent.entities = { b: mob('a2', 718, -731, { id: 'b', hp: 420000, max_hp: 420000 }), l: mob('a7', 1000, -560, { id: 'l', hp: 720000, max_hp: 720000 }) };
    await ctx.CryptRun.tick();
    t += 61000;
    await ctx.CryptRun.tick();
    expect(sent.some(([, d]: any) => d.a === 'bill' && d.on)).toBe(false);
  });

  it('the rogue vanishes when Lucinda targets him during the Bill fight (run 36)', async () => {
    const { ctx } = setup({ name: 'Dromas', ctype: 'rogue', map: 'crypt', x: 1356, y: -480, range: 120, hp: 2700, max_hp: 3511, mp: 700, s: {} });
    delete ctx.CONFIG.RANGER;
    const skills: string[] = [];
    ctx.move = () => {}; ctx.can_move_to = () => true; ctx.can_use = () => true; ctx.change_target = () => {}; ctx.attack = async () => {};
    ctx.use_skill = async (sk: string) => { skills.push(sk); }; ctx.get_player = () => null;
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'rlb' });
    ctx.CryptRun.onCm('Eadroma', { t: 'crypt', a: 'open', runId: 'rlb', id: 'inst' });
    ctx.CryptRun.onCm('Eadroma', { t: 'crypt', a: 'bill', runId: 'rlb', on: true });
    ctx.parent.entities = { b: mob('a2', 1260, -460, { id: 'b', hp: 300000, max_hp: 420000, target: 'Eadroma' }), l: mob('a7', 1366, -480, { id: 'l', hp: 720000, max_hp: 720000, target: 'Dromas' }) };
    await ctx.CryptRun.tick();
    expect(skills).toContain('invis');
  });

  it('the priest flees a roaming Marceline during the Bill fight instead of holding Curse range (run 37)', async () => {
    const { ctx } = setup({ name: 'Aedroma', ctype: 'priest', map: 'crypt', x: 1000, y: -720, range: 200, mp: 4000, hp: 9000, max_hp: 9499 });
    const skills: string[] = [], moves: number[][] = [];
    ctx.CONFIG.RANGER = 'Dromas';
    ctx.move = (x: number, y: number) => moves.push([x, y]); ctx.can_move_to = () => true; ctx.can_use = () => true;
    ctx.use_skill = async (sk: string) => { skills.push(sk); }; ctx.change_target = () => {}; ctx.get_player = () => null;
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'rbm' });
    ctx.CryptRun.onCm('Eadroma', { t: 'crypt', a: 'open', runId: 'rbm', id: 'inst' });
    ctx.CryptRun.onCm('Eadroma', { t: 'crypt', a: 'bill', runId: 'rbm', on: true });
    ctx.parent.entities = { b: mob('a2', 1000, -560, { id: 'b', hp: 300000, max_hp: 420000, target: 'Dromas', s: {} }), m: mob('a6', 1100, -720, { id: 'm', hp: 320000, max_hp: 320000 }) };
    await ctx.CryptRun.tick();
    expect(skills).not.toContain('curse');
    const [x, y] = moves.at(-1)!;
    expect(Math.hypot(x - 1100, y + 720)).toBeGreaterThan(100);
  });

  it('does not start the fight when the blocking Bill is far from the pillar (run 24)', async () => {
    const { ctx, store, sent } = setup({ map: 'crypt', x: 600, y: -1080, hp: 11000, max_hp: 11600, mp: 1400 });
    ctx.CONFIG.RANGER = 'Dromas';
    let t = Date.now();
    ctx.Date = { now: () => t } as any;
    ctx.get_player = (n: string) => ({ name: n, x: 590, y: -1080, hp: 3200, max_hp: 3230, mp: 4000, ctype: n === 'Dromas' ? 'rogue' : 'priest' });
    ctx.move = () => {}; ctx.can_move_to = () => false; ctx.change_target = () => {}; ctx.use_skill = async () => {}; ctx.can_use = () => true;
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'rb24', id: 'inst' });
    const key = 'alcc:crypt:v1:farmer:Eadroma';
    ctx.set(key, { ...(store[key] as object), entered: true, wp: 1, kills: { a7: 1 } });
    vm.runInContext(source, ctx);
    vm.runInContext('Date = this.Date', ctx);
    ctx.parent.entities = { b: mob('a2', 720, -1072, { id: 'b', hp: 420000, max_hp: 420000 }) }; // ~640 px from the pillar
    await ctx.CryptRun.tick();
    t += 61000;
    await ctx.CryptRun.tick();
    expect(sent.some(([, d]: any) => d.a === 'bill' && d.on)).toBe(false);
  });
});

describe('crypt hidden rogue and an idle Bill (run 14)', () => {
  it('comes out of Invisibility and heads to pull when Bill is idle and far', async () => {
    const { ctx } = setup({ name: 'Dromas', ctype: 'rogue', map: 'crypt', x: 1114, y: -536, range: 120, hp: 3231, max_hp: 3231, mp: 700, s: { invis: { ms: 999 } } });
    delete ctx.CONFIG.RANGER;
    const stops: string[] = [], moves: number[][] = [];
    ctx.stop = (w: string) => stops.push(w); ctx.move = (x: number, y: number) => moves.push([x, y]); ctx.can_move_to = () => true;
    ctx.can_use = () => true; ctx.use_skill = async () => {}; ctx.change_target = () => {}; ctx.attack = async () => {}; ctx.can_attack = () => false; ctx.get_player = () => null;
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'rh14' });
    ctx.CryptRun.onCm('Eadroma', { t: 'crypt', a: 'open', runId: 'rh14', id: 'inst' });
    ctx.CryptRun.onCm('Eadroma', { t: 'crypt', a: 'bill', runId: 'rh14', on: true });
    ctx.parent.entities = { b: mob('a2', 718, -731, { id: 'b', hp: 420000, max_hp: 420000 }) };
    await ctx.CryptRun.tick();
    expect(stops).toContain('invis');
    const [x, y] = moves.at(-1)!;
    expect(Math.hypot(x - 718, y + 731)).toBeLessThan(Math.hypot(1114 - 718, -536 + 731));
  });
});

describe('crypt loot goes to the merchant after the run', () => {
  it('starts the dump trip once out of the crypt when the bags hold dumpable loot', async () => {
    const { ctx } = setup({ name: 'Aedroma', ctype: 'priest', map: 'cave' });
    ctx.state = { dumpInProgress: false };
    ctx.dumpable_count = () => 2; // e.g. Crypt ring +0 and earring +0
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'start', runId: 'rl' });
    ctx.CryptRun.onCm('EadroSell', { t: 'crypt', a: 'abort', runId: 'rl' });
    await ctx.CryptRun.tick();
    expect(ctx.state.dumpInProgress).toBe(true);
  });
});
