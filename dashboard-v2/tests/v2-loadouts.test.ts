import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildBundle, effectiveConfig } from '../server/builder';
import { ast, initialProfile, scripts, sourceDir } from '../server/scripts';

function sourceFunction(code: string, name: string, context: Record<string, unknown>) {
  const node = ast(code).body.find((entry: any) => entry.type === 'FunctionDeclaration' && entry.id.name === name) as any;
  return vm.runInNewContext(`(${code.slice(node.start, node.end)})`, context);
}

describe('v2 farming and loadout integration', () => {
  it('accepts duo stock reports in solo mode and never treats hidden inventory as empty', async () => {
    const code=fs.readFileSync(path.join(sourceDir,'eadrosell-merchant-v2.js'),'utf8');
    const context:any={CONFIG:{FARMERS:['Archer'],HPOT:'hpot1',MPOT:'mpot1'},__ALCC:{eventExpedition:{enabled:true,warrior:'Tank',priest:'Healer'}},farmer_reports:{},supply_requests:{},Date,get_player:()=>({name:'Tank'}),fresh_farmer_report:(name:string)=>context.farmer_reports[name]||null};
    context.supply_farmer_names=sourceFunction(code,'supply_farmer_names',context);
    context.visible_potion_count=sourceFunction(code,'visible_potion_count',context);
    const state=sourceFunction(code,'farmer_potion_state',context);
    expect(state('Tank')).toBeNull();
    const receive=sourceFunction(code,'on_cm',context);
    receive('Tank',{t:'pots',hpot:195000,mpot:177000});
    expect(state('Tank')).toMatchObject({hpot:195000,mpot:177000});
    receive('Stranger',{t:'pots',hpot:0,mpot:0});expect(context.farmer_reports.Stranger).toBeUndefined();
    const give=sourceFunction(code,'give_potion_stack',{...context,item_count:()=>10000,find_item:()=>0,send_item:async()=>{throw Error('overstock must not be replenished');},game_log:()=>{}});
    expect(await give('Tank','hpot1',195000,1000)).toBe(0);
    expect(await give('Tank','hpot1',null,1000)).toBe(0);
    context.get_player=()=>({items:[{name:'hpot1',q:9000},{name:'hpot1',q:8000},{name:'mpot1',q:1000}]});
    delete context.farmer_reports.Tank; expect(state('Tank')).toMatchObject({hpot:17000,mpot:1000});
  });
  it('tracks shared farm runtime modules in farmer source hashes', () => {
    const list = scripts();
    const warrior = list.find(entry => entry.id === 'eadroma-warrior-v2')!;
    const plainSource = fs.readFileSync(path.join(sourceDir, warrior.filename), 'utf8');
    const plainHash = crypto.createHash('sha256').update(plainSource).digest('hex');
    expect(warrior.hash).not.toBe(plainHash);
  });

  it('embeds the movement watchdog in farmer and merchant bundles', async () => {
    const list = scripts();
    const profile = initialProfile(list);
    profile.characters.find(character => character.name === 'Eadroma')!.script = 'eadroma-warrior-v2';
    profile.characters.find(character => character.name === 'EadroSell')!.script = 'eadrosell-merchant-v2';
    expect((await buildBundle(profile, 'Eadroma')).code).toContain('var MovementWatchdog');
    expect((await buildBundle(profile, 'EadroSell')).code).toContain('var MovementWatchdog');
  });

  it('escalates stalled movement from route cancellation to nudge and safe town', async () => {
    const source = fs.readFileSync(path.join(sourceDir, 'movement-watchdog.js'), 'utf8');
    let now = 1_000;
    class Clock extends Date { static now() { return now; } }
    const actions: string[] = [];
    const context: any = {
      character: { name: 'Eadroma', map: 'main', x: 10, y: 20, moving: true, target: '', rip: false, q: {} },
      smart: { moving: true, map: 'main', x: 500, y: 500 },
      G: { maps: { main: { instance: false } } },
      parent: { entities: {} },
      EventRouter: { activeMonster: () => null },
      CaveDreams: { inCave: () => false },
      stop: () => actions.push('stop'),
      move: () => actions.push('move'),
      town: async () => actions.push('town'),
      can_move_to: () => true,
      game_log: () => undefined,
      setInterval: () => 1,
      Date: Clock, Math, Object, String, Number,
    };
    const watchdog = vm.runInNewContext(`${source}\nMovementWatchdog;`, context);
    await watchdog.tick();
    now += 15_001;
    await watchdog.tick();
    expect(actions).toEqual(['stop']);
    now += 15_001;
    await watchdog.tick();
    expect(actions).toEqual(['stop', 'stop', 'move']);
    now += 15_001;
    await watchdog.tick();
    expect(actions).toEqual(['stop', 'stop', 'move', 'stop', 'town']);
    expect(watchdog.snapshot()).toMatchObject({ attempts: 3, recoveries: 1, lastAction: 'safe town recovery completed' });
  });

  it('never uses town recovery inside an instance', async () => {
    const source = fs.readFileSync(path.join(sourceDir, 'movement-watchdog.js'), 'utf8');
    let now = 5_000;
    class Clock extends Date { static now() { return now; } }
    const actions: string[] = [];
    const context: any = {
      character: { name: 'Aedroma', map: 'cave', x: 0, y: 0, moving: true, target: '', rip: false, q: {} },
      smart: { moving: true, map: 'cave', x: 100, y: 100 },
      G: { maps: { cave: { instance: true } } }, parent: { entities: {} },
      EventRouter: { activeMonster: () => null }, CaveDreams: { inCave: () => true },
      stop: () => actions.push('stop'), move: () => actions.push('move'), town: async () => actions.push('town'),
      can_move_to: () => true, game_log: () => undefined, setInterval: () => 1,
      Date: Clock, Math, Object, String, Number,
    };
    const watchdog = vm.runInNewContext(`${source}\nMovementWatchdog;`, context);
    await watchdog.tick();
    for (let attempt = 0; attempt < 3; attempt++) { now += 15_001; await watchdog.tick(); }
    expect(actions).not.toContain('town');
    expect(watchdog.snapshot()).toMatchObject({ attempts: 3, state: 'blocked' });
  });

  it('accepts a dashboard Cave Dreams exit command and leaves through cave_exit', async () => {
    const source = fs.readFileSync(path.join(sourceDir, 'cave-dreams.js'), 'utf8');
    let exits = 0;
    const stored: Record<string, any> = {};
    const context: any = {
      character: { name: 'Eadroma', ctype: 'warrior', cave: { floor: 1, remaining_ms: 60000 }, rip: true },
      CONFIG: { WARRIOR: 'Eadroma', PRIEST: 'Aedroma', RANGER: 'Droma' },
      __ALCC: { dailyDungeon: true }, parent: { entities: {}, chests: {} },
      get: (key: string) => stored[key], set: (key: string, value: any) => { stored[key] = value; },
      game_log: () => undefined, set_message: () => undefined, send_cm: () => undefined,
      cave_exit: async () => { exits++; context.character.cave = null; },
      Date, Math, Object, String, Number, Array,
    };
    const cave = vm.runInNewContext(`${source}\nCaveDreams;`, context);
    expect(cave.requestExit()).toBe(true);
    await cave.tick('lead');
    expect(exits).toBe(1);
    expect(cave.snapshot().last).toBe('dashboard exit requested');
  });

  it('waits for the priest after a hunt wipe without requiring the ranger', () => {
    const source = fs.readFileSync(path.join(sourceDir, 'eadroma-warrior-v2.js'), 'utf8');
    const players: Record<string, any> = {
      Aedroma: { name: 'Aedroma', map: 'main', hp: 500, rip: false, x: 10, y: 0 },
    };
    const context: any = {
      CONFIG: { PRIEST: 'Aedroma', RANGER: 'Droma', PARTY: ['Aedroma', 'Droma'], movement: { priestMaxDist: 350 } },
      character: { name: 'Eadroma', map: 'main', x: 0, y: 0 },
      get_player: (name: string) => players[name] ?? null,
      distance: (a: any, b: any) => Math.hypot(a.x - b.x, a.y - b.y),
    };
    const ready = sourceFunction(source, 'is_team_ready_for_hunt', context);
    expect(ready()).toBe(true);
    players.Aedroma.rip = true;
    expect(ready()).toBe(false);
  });

  it('runs an overdue boss check before an active Daisy hunt', () => {
    const source = fs.readFileSync(path.join(sourceDir, 'eadroma-warrior-v2.js'), 'utf8');
    const context: any = {
      CONFIG: { hunts: { enabled: true } },
      hunt_info: () => ({ id: 'ghost', c: 40 }),
      EventRouter: { activeMonster: () => null },
      abandoned_hunt_id: () => '',
      live_control: () => ({ monster: 'auto' }),
      live_boss_check: () => null,
      nearby_phoenix: () => null,
      scheduled_boss_farm: () => 'dragold',
      pick_party_hunt: () => ({ id: 'ghost' }),
      hunt_fallback_monster: () => 'bigbird',
    };
    const choose = sourceFunction(source, 'farm_monster', context);
    expect(choose()).toBe('dragold');
  });

  it('builds the dedicated crab AOE ranger with fixed farm and safe targets', async () => {
    const list = scripts();
    const script = list.find(entry => entry.id === 'droma-ranger-crab-aoe-v2');
    expect(script?.ctype).toBe('ranger');
    expect(script?.config).toMatchObject({ DEFAULT_FARM: 'crab', FARM_INDEPENDENT: true, FIXED_FARM: true });

    const profile = initialProfile(list);
    profile.farming.defaultMonster = 'spider';
    profile.farming.hunts = true;
    profile.farming.rareVisits = true;
    const ranger = profile.characters.find(entry => entry.name === 'Droma')!;
    ranger.script = script!.id;
    const config = effectiveConfig(profile, ranger, script!) as any;
    expect(config).toMatchObject({ DEFAULT_FARM: 'crab', FARM_INDEPENDENT: true, DAILY_DUNGEON: false, RARE_VISITS: false });
    expect(config.hunts.enabled).toBe(false);

    const source = fs.readFileSync(path.join(sourceDir, script!.filename), 'utf8');
    const context: any = { CONFIG: config, character: { name: 'Droma', map: 'main' }, Math };
    context.in_crab_farm = sourceFunction(source, 'in_crab_farm', context);
    const available = sourceFunction(source, 'crab_is_available', context);
    expect(available({ type: 'monster', mtype: 'crab', visible: true, x: -1202, y: -66 })).toBe(true);
    expect(available({ type: 'monster', mtype: 'crab', visible: true, target: 'OtherPlayer', x: -1202, y: -66 })).toBe(false);
    expect(available({ type: 'monster', mtype: 'bee', visible: true, x: -1202, y: -66 })).toBe(false);

    expect(source).toContain('.map(function(mob) { return mob.id; })');
    const bundle = await buildBundle(profile, 'Droma');
    expect(bundle.code).toContain('await send_item(muleName, i, it.q || 1)');
    expect(bundle.code).toContain('StyleLoadout.equip()');
  });

  it('equips the best item meeting minLevel and applies the active style skill allowlist', async () => {
    const source = fs.readFileSync(path.join(sourceDir, 'style-loadout.js'), 'utf8');
    const equipped: Array<[number, string]> = [];
    const context = {
      CONFIG: {
        PACK_STYLE: { crab: 'tank' },
        STYLE_LOADOUTS: {
          aoe: { gear: [], skills: [] },
          mono: { gear: [], skills: [] },
          tank: { gear: [{ slot: 'mainhand', item: 'fireblade', minLevel: 5 }], skills: ['supershot'] },
        },
      },
      cache: { target: { mtype: 'crab' } },
      character: {
        slots: {},
        items: [{ name: 'fireblade', level: 4 }, { name: 'fireblade', level: 8 }, { name: 'fireblade', level: 6 }],
      },
      equip: async (slot: number, name: string) => { equipped.push([slot, name]); },
    };
    const loadout = vm.runInNewContext(`${source}\nStyleLoadout;`, context);
    expect(loadout.mode()).toBe('tank');
    expect(loadout.allows('supershot')).toBe(true);
    expect(loadout.allows('5shot')).toBe(false);
    expect(loadout.selected('supershot')).toBe(true);
    await loadout.equip();
    expect(equipped).toEqual([[1, 'mainhand']]);
  });

  it('switches to the announced event loadout before an event target is visible', () => {
    const source = fs.readFileSync(path.join(sourceDir, 'style-loadout.js'), 'utf8');
    const context = {
      CONFIG: {
        PACK_STYLE: { crab: 'aoe', icegolem: 'mono' },
        STYLE_LOADOUTS: {
          aoe: { gear: [], skills: ['5shot'] },
          mono: { gear: [], skills: ['supershot'] },
          tank: { gear: [], skills: [] },
        },
      },
      EventRouter: { activeMonster: () => 'icegolem' },
      cache: { target: { mtype: 'crab' } },
      character: { slots: {}, items: [] },
    };
    const loadout = vm.runInNewContext(`${source}\nStyleLoadout;`, context);
    expect(loadout.mode()).toBe('mono');
    expect(loadout.allows('supershot')).toBe(true);
    expect(loadout.allows('5shot')).toBe(false);
  });

  it('joins instanced events and routes world bosses only when enabled and allowed', async () => {
    const source = fs.readFileSync(path.join(sourceDir, 'event-router.js'), 'utf8');
    const joined: string[] = [];
    const moved: any[] = [];
    const context: any = {
      __ALCC: { eventsEnabled: true, events: ['icegolem', 'phoenix'] },
      G: { events: { icegolem: { join: true } } },
      server: { status: { icegolem: { live: true }, phoenix: { live: true, map: 'main', x: 100, y: 200 } } },
      character: { map: 'main', x: 0, y: 0 },
      smart: { moving: false },
      get_nearest_monster: () => null,
      join: async (id: string) => { joined.push(id); },
      smart_move: async (destination: any) => { moved.push(destination); },
      distance: (a: any, b: any) => Math.hypot(a.x - b.x, a.y - b.y),
      game_log: () => undefined,
      Date,
      Math,
      isFinite,
    };
    const router = vm.runInNewContext(`${source}\nEventRouter;`, context);
    expect(router.next()).toMatchObject({ id: 'icegolem', kind: 'join' });
    await router.tick();
    await router.tick();
    expect(joined).toEqual(['icegolem']);

    context.server.status = { goobrawl: { end: new Date(Date.now() + 60_000) } };
    context.__ALCC.events = ['goobrawl'];
    expect(router.next()).toMatchObject({ id: 'goobrawl', kind: 'join' });

    context.server.status = { abtesting: { live: true } };
    context.__ALCC.events = ['abtesting'];
    expect(router.accepts({ type: 'monster', mtype: 'target_ar500red', visible: true })).toBe(true);

    context.server.status = { phoenix: { live: true, map: 'main', x: 100, y: 200 } };
    context.__ALCC.events = ['phoenix'];
    expect(router.next()).toMatchObject({ id: 'phoenix', kind: 'boss', map: 'main', x: 100, y: 200 });
    await router.tick();
    expect(moved).toEqual([{ map: 'main', x: 100, y: 200 }]);

    context.__ALCC.eventsEnabled = false;
    expect(router.next()).toBeNull();
  });

  it('prioritizes Mr Green and Mr Pumpkin over concurrent events without changing the allowlist', () => {
    const source = fs.readFileSync(path.join(sourceDir, 'event-router.js'), 'utf8');
    const context: any = {
      __ALCC: { eventsEnabled: true, events: ['slenderman', 'icegolem', 'mrpumpkin', 'mrgreen'] },
      server: { status: { slenderman: { live: true }, mrpumpkin: { live: true }, mrgreen: { live: true } } },
      character: { name: 'Droma', ctype: 'ranger' }, Date, Math, Number, isFinite,
    };
    const router = vm.runInNewContext(`${source}\nEventRouter;`, context);
    expect(router.orderedEvents()).toEqual(['mrgreen', 'mrpumpkin', 'slenderman', 'icegolem']);
    expect(router.next().id).toBe('mrgreen');
    context.server.status.mrgreen.live = false;
    expect(router.next().id).toBe('mrpumpkin');
    context.server.status.mrpumpkin.live = false;
    expect(router.next().id).toBe('slenderman');
    context.server.status.mrgreen.live = true;
    context.__ALCC.events = ['slenderman'];
    expect(router.next().id).toBe('slenderman');
    context.__ALCC.eventsEnabled = false;
    expect(router.next()).toBeNull();
  });

  it('makes rangers wait for another player to tank a world boss and rechecks resets', async () => {
    const source = fs.readFileSync(path.join(sourceDir, 'event-router.js'), 'utf8');
    const moves: any[] = [];
    let boss: any = null;
    let stops = 0;
    const context: any = {
      __ALCC: { eventsEnabled: true, events: ['slenderman'] },
      G: { maps: { spookytown: { spawns: [[10, 20]] } } },
      server: { status: { slenderman: { live: true, map: 'spookytown' } } },
      character: { name: 'Droma', ctype: 'ranger', map: 'main', x: 0, y: 0 },
      smart: { moving: true }, stop: () => { stops++; },
      get_nearest_monster: () => boss,
      smart_move: async (destination: any) => { moves.push(destination); },
      game_log: () => undefined, Date, Math, Number, isFinite,
    };
    const router = vm.runInNewContext(`${source}\nEventRouter;`, context);
    expect(await router.tick()).toBe(true);
    expect(moves).toHaveLength(0);
    expect(stops).toBe(1);
    context.server.status.slenderman.target = 'AnotherPlayer';
    await router.tick();
    expect(moves).toEqual([{ map: 'spookytown' }]);
    boss = { type: 'monster', mtype: 'slenderman', visible: true, target: 'AnotherPlayer' };
    expect(router.canEngage(boss)).toBe(true);
    expect(await router.tick()).toBe(true); // Event owns navigation; no return to fixed crab farm.
    boss.target = null; // The visible reset overrides a stale server target.
    expect(router.canEngage(boss)).toBe(false);
    expect(await router.tick()).toBe(true);
    boss.target = 'Droma';
    expect(router.canEngage(boss)).toBe(true); // Defend while retreating, never stand idle under aggro.
    expect(await router.tick()).toBe(true);
    context.character.ctype = 'warrior';
    expect(router.canEngage(boss)).toBe(true);
    expect(await router.tick()).toBe(false);
    context.character.ctype = 'ranger';
    context.__ALCC.events = ['goobrawl'];
    context.server.status = { goobrawl: { live: true } };
    expect(router.canEngage({ type: 'monster', mtype: 'goo', visible: true })).toBe(true);
  });

  it('keeps ranger event navigation and approaches a visible Mr Green only to shooting range', async () => {
    const source = fs.readFileSync(path.join(sourceDir, 'event-router.js'), 'utf8');
    let now = 1_000_000;
    const moves: any[] = [];
    const boss = { type: 'monster', mtype: 'mrgreen', visible: true, target: 'Tank', x: 500, y: 0 };
    const context: any = {
      __ALCC: { eventsEnabled: true, events: ['mrgreen'] },
      server: { status: { mrgreen: { live: true, map: 'spookytown', target: 'Tank', x: 500, y: 0 } } },
      character: { name: 'Droma', ctype: 'ranger', map: 'spookytown', x: 0, y: 0, range: 200 },
      smart: { moving: false }, get_nearest_monster: () => boss,
      can_move_to: () => true, move: (x: number, y: number) => { moves.push({ x, y }); },
      game_log: () => undefined, Date: { now: () => now }, Math, Number, isFinite,
    };
    const router = vm.runInNewContext(`${source}\nEventRouter;`, context);
    expect(await router.tick()).toBe(true);
    expect(moves).toEqual([{ x: 340, y: 0 }]);
    context.character.x = 340;
    expect(await router.tick()).toBe(true);
    expect(router.canEngage(boss)).toBe(true);
    expect(moves).toHaveLength(1);
    context.character.x = 500;
    now += 1100;
    boss.target = 'Droma';
    expect(await router.tick()).toBe(true);
    expect(moves[1]).toEqual({ x: 660, y: 0 });
    expect(router.canEngage(boss)).toBe(true);
    boss.target = '';
    expect(await router.tick()).toBe(true);
    expect(router.canEngage(boss)).toBe(false);
    expect(moves).toHaveLength(2);
    boss.target = 'Tank';
    now += 1100;
    context.can_move_to = (x: number, y: number) => x < 550 && y > 50;
    expect(await router.tick()).toBe(true);
    expect(moves).toHaveLength(3);
    expect(moves[2].x).toBeLessThan(550);
    expect(moves[2].y).toBeGreaterThan(50);
  });

  it('travels to and searches the announced map for Slenderman without inventing coordinates', async () => {
    const source = fs.readFileSync(path.join(sourceDir, 'event-router.js'), 'utf8');
    let now = 1_000_000;
    class Clock extends Date { static now() { return now; } }
    const moved: any[] = [];
    let visible = false;
    let finish: (() => void) | undefined;
    const context: any = {
      __ALCC: { eventsEnabled: true, events: ['slenderman'] },
      G: { maps: { spookytown: { spawns: [[10, 20]], monsters: [{ boundary: [100, 200, 300, 400] }] } } },
      server: { status: { slenderman: { live: true, map: 'spookytown', x: null, y: '' } } },
      character: { map: 'main', x: 0, y: 0 }, smart: { moving: false },
      get_nearest_monster: () => visible ? { mtype: 'slenderman' } : null,
      smart_move: (destination: any) => { moved.push(destination); return new Promise<void>((resolve) => { finish = resolve; }); },
      game_log: () => undefined, Date: Clock, Math, Number, isFinite,
    };
    const router = vm.runInNewContext(`${source}\nEventRouter;`, context);
    expect(Number.isNaN(router.next().x)).toBe(true);
    const travel = router.tick();
    expect(moved).toEqual([{ map: 'spookytown' }]);
    now += 10_000;
    await router.tick();
    expect(moved).toHaveLength(1); // A long journey is not restarted every five seconds.
    finish!(); await travel;
    context.character.map = 'spookytown';
    now += 6_000;
    const entrance = router.tick(); finish!(); await entrance;
    now += 6_000;
    const search = router.tick(); finish!(); await search;
    expect(moved.slice(1)).toEqual([
      { map: 'spookytown', x: 10, y: 20 }, { map: 'spookytown', x: 200, y: 300 },
    ]);
    visible = true;
    expect(await router.tick()).toBe(false);
    expect(moved).toHaveLength(3);
    visible = false;
    context.server.status.slenderman.map = 'unknown';
    now += 6_000;
    await router.tick();
    expect(moved).toHaveLength(3);
  });

  it('returns to town once when an event ends and rescues farmers stranded at Ice Golem', async () => {
    const source = fs.readFileSync(path.join(sourceDir, 'event-router.js'), 'utf8');
    let now = 1_000_000;
    class Clock extends Date { static now() { return now; } }
    const towns: number[] = [];
    const context: any = {
      __ALCC: { eventsEnabled: true, events: ['icegolem'] },
      G: { events: { icegolem: { join: true } } },
      server: { status: {} },
      character: { name: 'Aedroma', map: 'winterland', x: 848, y: 473 },
      smart: { moving: false },
      town: async () => { towns.push(now); context.character.map = 'main'; },
      stop: () => undefined,
      game_log: () => undefined,
      Date: Clock, Math, Number, Array, String, isFinite,
    };
    const router = vm.runInNewContext(`${source}\nEventRouter;`, context);
    await router.tick();
    expect(towns).toEqual([now]);
    now += 20_000;
    await router.tick();
    expect(towns).toHaveLength(1);

    context.server.status.icegolem = { live: true };
    await router.tick();
    context.server.status = {};
    now += 6_000;
    await router.tick();
    expect(towns).toHaveLength(1);
    now += 2_000;
    await router.tick();
    expect(towns).toHaveLength(2);
  });

  it('clears stale world-event recovery instead of calling town inside Cave Dreams', async () => {
    const source = fs.readFileSync(path.join(sourceDir, 'event-router.js'), 'utf8');
    let saved: any = { id: 'icegolem', kind: 'join', seenAt: 1 };
    let townCalls = 0;
    const context: any = {
      __ALCC: { eventsEnabled: true, events: ['icegolem'] },
      G: { events: { icegolem: { join: true } } },
      server: { status: {} },
      character: { name: 'Aedroma', map: 'zone_run_0', cave: { run: 'run', floor: 0 } },
      smart: { moving: false },
      get: () => saved,
      set: (_key: string, value: any) => { saved = value; },
      town: async () => { townCalls++; },
      Date, Math, Number, Array, String, isFinite,
    };
    const router = vm.runInNewContext(`${source}\nEventRouter;`, context);
    await router.tick();
    expect(townCalls).toBe(0);
    expect(saved).toBeNull();
  });

  it('injects and executes character-specific boards in all three farmer v2 bundles', async () => {
    const list = scripts();
    const profile = initialProfile(list);
    const assignments = {
      Eadroma: { script: 'eadroma-warrior-v2', skill: 'cleave', item: 'ololipop' },
      Aedroma: { script: 'aedroma-priest-v2', skill: 'partyheal', item: 'vstaff' },
      Droma: { script: 'droma-ranger-v2', skill: '5shot', item: 'firebow' },
    } as const;
    profile.farming.defaultMonster = 'crab';
    profile.farming.dailyDungeon = true;
    profile.farming.hunts = false;
    profile.farming.rareVisits = false;
    profile.farming.style.crab = 'aoe';

    for (const [name, assignment] of Object.entries(assignments)) {
      const character = profile.characters.find(entry => entry.name === name)!;
      character.script = assignment.script;
      profile.farming.loadouts[name] = {
        aoe: { gear: [{ slot: 'mainhand', item: assignment.item, minLevel: 3 }], skills: [assignment.skill] },
        mono: { gear: [], skills: [] },
        tank: { gear: [], skills: [] },
      };
    }

    for (const [name, assignment] of Object.entries(assignments)) {
      const character = profile.characters.find(entry => entry.name === name)!;
      const script = list.find(entry => entry.id === assignment.script)!;
      const config = effectiveConfig(profile, character, script) as any;
      expect(config.DEFAULT_FARM).toBe('crab');
      expect(config.DAILY_DUNGEON).toBe(true);
      expect(config.hunts.enabled).toBe(false);
      expect(config.RARE_VISITS).toBe(false);
      expect(config.PACK_STYLE.crab).toBe('aoe');
      expect(config.STYLE_LOADOUTS.aoe.skills).toEqual([assignment.skill]);
      expect(config.STYLE_LOADOUTS.aoe.gear[0]).toEqual({ slot: 'mainhand', item: assignment.item, minLevel: 3 });
      expect(config.LOADOUT_ITEMS).toContainEqual({ item: assignment.item, minLevel: 3 });

      const bundle = await buildBundle(profile, name);
      expect(bundle.code).toContain('var StyleLoadout');
      expect(bundle.code).toContain('var EventRouter');
      expect(bundle.code).toContain('var WorldEventIntel');
      expect(bundle.code).toContain('await EventRouter.tick()');
      expect(bundle.code).toContain('StyleLoadout.equip()');
      expect(bundle.code).toContain(`StyleLoadout.allows("${assignment.skill}")`);
      expect(bundle.code).toContain('CaveDreams.tick(');
      expect(bundle.code).toContain('CaveDreams.onCm(');
      expect(bundle.code).toContain('StyleLoadout.wear(r)');
      expect(bundle.code).toMatch(/"hunts"\s*:\s*\{[^}]*"enabled"\s*:\s*false/);
    }
  });

  it('checks Big Crab before allowing an existing farm smart_move to continue', () => {
    const source = fs.readFileSync(path.join(sourceDir, 'eadroma-warrior-v2.js'), 'utf8');
    const movement = source.slice(source.indexOf('async function movementLoop'), source.indexOf('// ============================================================================\n// 11.', source.indexOf('async function movementLoop')));
    expect(movement.indexOf('await EventRouter.tick()')).toBeGreaterThan(-1);
    expect(movement.indexOf('await EventRouter.tick()')).toBeLessThan(movement.indexOf('if (smart.moving)'));
  });

  it('lets Cave Dreams interrupt the fixed crab farm navigation', () => {
    const source = fs.readFileSync(path.join(sourceDir, 'droma-ranger-crab-aoe-v2.js'), 'utf8');
    const start = source.indexOf('async function movementLoop');
    const movement = source.slice(start, source.indexOf('// ============================================================================\n// 8.', start));
    const caveTick = movement.indexOf('await CaveDreams.tick("follow")');
    const farmReturn = movement.indexOf('character.map !== farm.map');
    expect(caveTick).toBeGreaterThan(-1);
    expect(caveTick).toBeLessThan(farmReturn);
  });

  it('lets only the leader select one remote Big Crab shard and publish a party plan', () => {
    const source = fs.readFileSync(path.join(sourceDir, 'world-event-intel.js'), 'utf8');
    const messages: any[] = [];
    let serverInfo: ((data: any) => void) | undefined;
    let stored: any = null;
    const context: any = {
      character: { name: 'Eadroma' },
      CONFIG: { WARRIOR: 'Eadroma', PARTY: ['Eadroma', 'Aedroma', 'Droma'] },
      __ALCC: { eventsEnabled: true, events: ['crabxx'] },
      parent: {
        server_region: 'EU', server_identifier: 'III', S: {},
        X: { servers: [{ region: 'EU', name: 'II', address: 'eu.example', path: '/socket.io/' }] },
        io: (_url: string, options: any) => ({ on: (name: string, callback: any) => { if (name === 'server_info') serverInfo = callback; }, options }),
      },
      EventRouter: { isLive: (value: any) => value?.live === true },
      send_cm: (_party: string[], data: any) => messages.push(data),
      set: (_key: string, value: any) => { stored = value; },
      get: () => stored,
      change_server: () => undefined,
      game_log: () => undefined,
      Date, Array, Object, String, Number, Math, isFinite,
    };
    const intel = vm.runInNewContext(`${source}\nWorldEventIntel;`, context);
    serverInfo?.({ crabxx: { live: true, map: 'main', x: -1000, y: 1700 } });
    expect(intel.tick()).toBe(true);
    expect(messages[0]).toMatchObject({ t: 'event_hop', region: 'EU', name: 'II', event: 'crabxx' });
    expect(stored).toMatchObject({ region: 'EU', name: 'II', event: 'crabxx' });
  });

  it('returns the party home after a remote event has been quiet for 90 seconds', () => {
    const source = fs.readFileSync(path.join(sourceDir, 'world-event-intel.js'), 'utf8');
    let now = 1_000_000;
    class Clock extends Date { static now() { return now; } }
    const messages: any[] = [];
    const context: any = {
      character: { name: 'Eadroma' },
      CONFIG: { WARRIOR: 'Eadroma', PARTY: ['Eadroma', 'Aedroma', 'Droma'] },
      __ALCC: { eventsEnabled: true, events: ['crabxx'], homeServer: { region: 'EU', name: 'III' } },
      parent: { server_region: 'EU', server_identifier: 'II', S: {}, X: { servers: [] }, io: () => ({ on: () => undefined }) },
      EventRouter: { isLive: () => false },
      send_cm: (_party: string[], data: any) => messages.push(data),
      set: () => undefined, get: () => null, change_server: () => undefined,
      game_log: () => undefined, Date: Clock, Array, Object, String, Number, Math, isFinite,
    };
    const intel = vm.runInNewContext(`${source}\nWorldEventIntel;`, context);
    expect(intel.tick()).toBe(false);
    now += 90_001;
    expect(intel.tick()).toBe(true);
    expect(messages[0]).toMatchObject({ event: '__home', region: 'EU', name: 'III' });
  });

  it('keeps the priest attacking while following without a heal-loop starvation guard', () => {
    const source = fs.readFileSync(path.join(sourceDir, 'aedroma-priest-v2.js'), 'utf8');
    expect(source).toContain('leader_intent.targetId');
    expect(source).toContain('sticky_target_id');
    expect(source).toContain('var combatStable = targetInRange');
    expect(source).toContain('if (character.moving) stop();');
    expect(source).toContain('stop();');
    expect(source).toContain('var idleSpacingNeeded = !cache.target');
    expect(source).not.toContain('critical_heal_target() && healReady');
    expect(source).toContain('curseMinHp: 50000');
    expect(source).not.toContain('ActionTiming.after("curse"');
    expect(source).not.toContain('CaveDreams.inCave()) {\n\t\t\tsetTimeout(combatLoop');
    expect(source).toContain('monster.x + nx * attackPocket');
    expect(source).toContain('attackPocketNeeded');
    expect(source).toContain('e.target === CONFIG.WARRIOR');
  });

  it('broadcasts the leader destination before the leader reaches it', () => {
    const warrior = fs.readFileSync(path.join(sourceDir, 'eadroma-warrior-v2.js'), 'utf8');
    const priest = fs.readFileSync(path.join(sourceDir, 'aedroma-priest-v2.js'), 'utf8');
    expect(warrior).toContain('destMap: intentMap');
    expect(warrior).toContain('targetId: cache.target ? cache.target.id');
    expect(priest).toContain('leader_intent.at');
    expect(priest).toContain('intentFar');
  });

  it('gates every skill exposed by the Farming loadout editor in its v2 bundle', async () => {
    const list = scripts();
    const profile = initialProfile(list);
    const expected = {
      Eadroma: { script: 'eadroma-warrior-v2', skills: ['taunt', 'charge', 'warcry', 'cleave', 'stomp', 'agitate'] },
      Aedroma: { script: 'aedroma-priest-v2', skills: ['heal', 'partyheal', 'curse', 'darkblessing', 'absorb', 'revive'] },
      Droma: { script: 'droma-ranger-v2', skills: ['3shot', '5shot', 'supershot', 'huntersmark', 'poisonarrow', 'energize'] },
    } as const;
    for (const [name, definition] of Object.entries(expected)) {
      profile.characters.find(character => character.name === name)!.script = definition.script;
      const code = (await buildBundle(profile, name)).code;
      for (const skill of definition.skills) {
        expect(code.includes(`StyleLoadout.allows("${skill}")`) || code.includes(`StyleLoadout.selected("${skill}")`), `${name} must gate ${skill}`).toBe(true);
      }
    }
  }, 25000);

  it('prioritizes a usable mana potion for the warrior and falls back to health', () => {
    const code = fs.readFileSync(path.join(sourceDir, 'eadroma-warrior-v2.js'), 'utf8');
    const context: any = {
      character: { items: [{ name: 'mpot1', q: 20 }, { name: 'hpot1', q: 20 }] },
      is_on_cooldown: () => false,
    };
    context.has_potion_kind = sourceFunction(code, 'has_potion_kind', context);
    const choose = sourceFunction(code, 'next_potion_skill', context);
    const config = { hpThreshold: 0.8, mpThreshold: 0.65 };
    expect(choose(0.2, 0.2, config)).toBe('use_mp');
    context.character.items = [{ name: 'hpot1', q: 20 }];
    expect(choose(0.2, 0.2, config)).toBe('use_hp');
  });

  it('keeps the merchant supplied and spends the shared potion cooldown on mana first', async () => {
    const code = fs.readFileSync(path.join(sourceDir, 'eadrosell-merchant-v2.js'), 'utf8');
    const used: string[] = [];
    const counts: Record<string, number> = { mpot1: 150, hpot1: 100 };
    const context: any = {
      CONFIG: { MPOT: 'mpot1', HPOT: 'hpot1', SELF_MP_RATIO: 0.65, SELF_HP_RATIO: 0.7, SELF_MPOT_RESERVE: 150, SELF_HPOT_RESERVE: 100 },
      character: { hp: 50, max_hp: 100, mp: 10, max_mp: 100 },
      item_count: (name: string) => counts[name] || 0,
      is_on_cooldown: () => false,
      use_skill: async (skill: string) => { used.push(skill); },
    };
    const selfPot = sourceFunction(code, 'self_pot', context);
    await expect(selfPot()).resolves.toBe(true);
    expect(used).toEqual(['use_mp']);

    context.character.mp = 100;
    await selfPot();
    expect(used).toEqual(['use_mp', 'use_hp']);

    const give = sourceFunction(code, 'give_potion_stack', {
      ...context,
      find_item: () => 0,
      send_item: async () => { throw Error('personal reserve must not be sent'); },
      game_log: () => {},
    });
    await expect(give('Eadroma', 'mpot1', 0, 1000)).resolves.toBe(0);

    const list = scripts();
    const profile = initialProfile(list);
    profile.characters.find(character => character.name === 'EadroSell')!.script = 'eadrosell-merchant-v2';
    profile.seller.consumables.rules = [{ character: 'Eadroma', item: 'mpot1', minQty: 500, targetQty: 1000, maxQty: 2000, mode: 'carry', source: 'either' }];
    const bundle = await buildBundle(profile, 'EadroSell');
    expect(bundle.code).toContain('CONFIG.SELF_MPOT_RESERVE');
    expect(bundle.code).toContain('available = Math.max(0, fromBag - reserve)');
  });

  it('lets the merchant start one missing farmer in its generated CODE slot', async () => {
    const code = fs.readFileSync(path.join(sourceDir, 'eadrosell-merchant-v2.js'), 'utf8');
    const started: Array<[string, string]> = [];
    const context: any = {
      CONFIG: { FARMERS: ['Eadroma', 'Aedroma', 'Droma'], TEAM_SLOTS: { Eadroma: 'CC_Eadroma', Aedroma: 'CC_Aedroma', Droma: 'CC_Droma' }, TEAM_START_INTERVAL_MS: 8000, TEAM_START_RETRY_MS: 60000 },
      character: { name: 'EadroSell', bot: false },
      team_start_busy: false,
      last_team_start: 0,
      team_start_retry_at: {},
      team_supervisor_started_at: 0,
      fresh_farmer_report: () => null,
      get_start_character_fn: () => async (name: string, slot: string) => { started.push([name, slot]); },
      team_child_running: (name: string) => name === 'Eadroma',
      set_message: () => undefined,
      game_log: () => undefined,
      Date: { now: () => 100_000 },
    };
    const startTeam = sourceFunction(code, 'maybe_start_team', context);
    expect(startTeam()).toBe(true);
    await Promise.resolve();
    expect(started).toEqual([['Aedroma', 'CC_Aedroma']]);
  });

  it('queues Winged Boots only after 20 magical feathers and preserves the gold reserve', () => {
    const code = fs.readFileSync(path.join(sourceDir, 'eadrosell-merchant-v2.js'), 'utf8');
    const inventory: Record<string, number> = { feather0: 20 };
    const context: any = {
      craft_batch: null, craft_bank_retry: {},
      G: { craft: { wingedboots: { cost: 120000, items: [[1, 'shoes'], [20, 'feather0']] } }, items: { shoes: { g: 1600 } } },
      character: { gold: 2000000 },
      cc_craft_enabled: () => true,
      cc_craft_rules: () => [{ item: 'wingedboots' }],
      cc_craft_gold_reserve: () => 1000000,
      item_count_level: (name: string) => inventory[name] || 0,
      craft_shop_for: (name: string) => name === 'shoes' ? 'basics' : null,
      free_slots: () => 5,
      Number, Math, Array,
    };
    const next = sourceFunction(code, 'next_craft_job', context);
    expect(next()).toMatchObject({ item: 'wingedboots', missing: [{ item: 'shoes', quantity: 1, shop: 'basics' }] });
    inventory.feather0 = 19;
    expect(next()).toBeNull();
    inventory.feather0 = 20;
    context.character.gold = 1100000;
    expect(next()).toBeNull();
  });

  it('wires v2 potion reports and uses the supported send_item delivery API', async () => {
    const list = scripts();
    const profile = initialProfile(list);
    for (const assignment of [
      ['Eadroma', 'eadroma-warrior-v2'],
      ['Aedroma', 'aedroma-priest-v2'],
      ['Droma', 'droma-ranger-v2'],
    ] as const) {
      profile.characters.find(character => character.name === assignment[0])!.script = assignment[1];
      const code = (await buildBundle(profile, assignment[0])).code;
      expect(code).toContain('data.t === "mux"');
      expect(code).toContain('report_potion_stock(name)');
    }
    profile.characters.find(character => character.name === 'EadroSell')!.script = 'eadrosell-merchant-v2';
    profile.seller.consumables.rules = [{ character: 'Eadroma', item: 'hpot1', minQty: 500, targetQty: 1000, maxQty: 2000, mode: 'carry', source: 'either' }];
    const merchant = (await buildBundle(profile, 'EadroSell')).code;
    expect(merchant).toContain('await send_item(name, slot, amount)');
    expect(merchant).toContain('var supply_order = [CONFIG.WARRIOR]');
    expect(merchant.indexOf('var need_m = CONFIG.MPOT_STOCK')).toBeLessThan(merchant.indexOf('var need_h = CONFIG.POT_STOCK'));
    expect(merchant).toMatch(/var cons\s*=\s*__ALCC\.consumables/);
    expect(merchant).toContain('dashboard_handled = await maybe_dashboard_kit()');
  });
});

it('keeps qualifying loadout bows but transfers lower-level loot in both ranger scripts', async () => {
  const profile = initialProfile(scripts());
  profile.farming.loadouts = { Droma: { aoe: { gear: [{slot:'mainhand',item:'firebow',minLevel:8}],skills:[] } } };
  for (const script of ['droma-ranger-v2','droma-ranger-crab-aoe-v2']) {
    profile.characters.find(c => c.name === 'Droma')!.script = script;
    const bundle = await buildBundle(profile,'Droma');
    const protect = sourceFunction(bundle.code, 'is_protected_item', {CONFIG:bundle.config});
    expect(protect({name:'firebow',level:0})).toBe(false);
    expect(protect({name:'firebow',level:8})).toBe(true);
    expect(protect({name:'firebow',level:0,l:true})).toBe(true);
  }
});
