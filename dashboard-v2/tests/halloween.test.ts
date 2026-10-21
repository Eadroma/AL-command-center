import fs from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { EVENT_DEFINITIONS, setEventAllowed } from '../src/models/events';
import { expeditionBosses } from '../shared/event-expedition';
import { profileSchema } from '../shared/schema';
import { initialProfile, scripts } from '../server/scripts';
import { adaptSource } from '../server/builder';
const read = (file: string) => fs.readFileSync(new URL('../../code/' + file, import.meta.url), 'utf8');
function fixture() {
  let now = Date.UTC(2026, 9, 21, 10);
  class Clock extends Date { constructor(value?: string | number) { super(value ?? now); } static now() { return now; } }
  const store: Record<string, any> = {}, routes: any[] = [], knocks: number[] = [];
  const character: any = { name: 'Merchant', ctype: 'merchant', map: 'main', x: 0, y: 0, hp: 1000, max_hp: 1000, esize: 10, trickortreat: { doors: [], doors_left: 7 } };
  const context: any = { character, Date: Clock, Math, Number, setTimeout, clearTimeout,
    __ALCC: { trickOrTreat: { enabled: true }, standSpot: { map: 'main', x: 0, y: 0 } },
    G: { events: { trickortreat: { doors: [['halloween', 331, -210], ['spookytown', 70, -103]] } } },
    server: { status: { halloween: true } }, parent: { entities: {} },
    get: (k: string) => store[k], set: (k: string, v: any) => { store[k] = structuredClone(v); }, game_log: () => {},
    cc_stand_spot: () => context.__ALCC.standSpot,
    walk_to: async (point: any) => { routes.push(point); Object.assign(character, point); },
    knock: async (door: number) => { knocks.push(door); return { success: true, door, stamps: knocks.length }; },
  };
  const reload = () => vm.runInNewContext(read('merchant-halloween.js') + '\nMerchantHalloween;', context);
  return { context, character, routes, knocks, reload, runtime: reload(), advance: (ms: number) => { now += ms; } };
}

describe('merchant Trick or Treat', () => {
  it('does nothing outside the season or without the explicit merchant switch', async () => {
    const f = fixture(); f.context.server.status.halloween = false; await f.runtime.tick();
    f.context.server.status.halloween = true; f.context.__ALCC.trickOrTreat.enabled = false; await f.runtime.tick();
    expect(f.routes).toEqual([]); expect(f.knocks).toEqual([]);
  });
  it('uses live door coordinates and waits until arrival before knocking', async () => {
    const f = fixture(); await f.runtime.tick(); expect(f.knocks).toEqual([]);
    expect(f.routes[0]).toEqual({ map: 'halloween', x: 331, y: -186 });
    await f.runtime.tick(); expect(f.knocks).toEqual([0]);
  });
  it('skips authoritative completed doors and journals success across reloads', async () => {
    const f = fixture(); f.character.trickortreat.doors = [0]; await f.runtime.tick(); await f.runtime.tick();
    expect(f.knocks).toEqual([1]); f.advance(2000); await f.reload().tick(); expect(f.knocks).toEqual([1]);
  });
  it('finishes the route and returns to its configured stand despite delayed telemetry', async () => {
    const f = fixture(); for (let i = 0; i < 2; i++) { await f.runtime.tick(); await f.runtime.tick(); f.advance(2000); }
    await f.runtime.tick(); expect(f.knocks).toEqual([0, 1]); expect(f.routes.at(-1)).toEqual(f.context.__ALCC.standSpot);
  });
  it('honors the shared account limit and persists the hold until the next UTC day', async () => {
    const f = fixture(); await f.runtime.tick(); f.context.knock = async () => { throw { reason: 'trickortreat_limit' }; };
    await f.runtime.tick(); expect(f.runtime.snapshot().limited).toBe(true);
    f.advance(120000); await f.reload().tick(); expect(f.routes).toHaveLength(2);
    f.advance(86400000); expect(f.reload().snapshot().limited).toBe(false);
  });
  it('does not leave for an account with no knocks remaining', async () => {
    const f = fixture(); f.character.trickortreat.doors_left = 0; await f.runtime.tick(); expect(f.routes).toEqual([]);
  });
  it('backs off on transient failure without marking the door complete', async () => {
    const f = fixture(); await f.runtime.tick(); f.context.knock = async () => { throw new Error('network'); };
    await f.runtime.tick(); expect(f.runtime.snapshot().doors).toEqual([]); f.advance(2000); await f.runtime.tick(); expect(f.routes).toHaveLength(1);
  });
  it('retreats after a Ghost trick and resumes only after the Ghost lifetime', async () => {
    const f = fixture(); await f.runtime.tick(); f.context.knock = async (door: number) => ({ success: true, door, trick: 'ghost' });
    await f.runtime.tick(); expect(f.routes.at(-1).map).toBe('main');
    await f.runtime.tick(); expect(f.routes).toHaveLength(2); f.advance(120001); await f.runtime.tick(); expect(f.routes.at(-1).map).toBe('spookytown');
  });
  it('yields to expedition assembly, bank review and ongoing exchanges', async () => {
    const f = fixture(); f.context.EventExpedition = { snapshot: () => ({ phase: 'forming' }) }; await f.runtime.tick();
    delete f.context.EventExpedition; f.context.BankCoordinator = { snapshot: () => ({ current: {} }) }; await f.runtime.tick();
    delete f.context.BankCoordinator; f.character.q = { exchange: {} }; await f.runtime.tick(); expect(f.routes).toEqual([]);
  });
  it('does not travel with a full inventory, low HP, or an attacking monster', async () => {
    const f = fixture(); f.character.esize = 2; await f.runtime.tick(); f.character.esize = 10;
    f.character.hp = 200; await f.runtime.tick(); f.advance(120001); f.character.hp = 1000;
    f.context.parent.entities.ghost = { type: 'monster', target: 'Merchant' }; await f.runtime.tick(); expect(f.routes).toEqual([]);
  });
  it('rejects unconfirmed responses and never overlaps requests', async () => {
    const f = fixture(); await f.runtime.tick(); let release!: (value: any) => void;
    f.context.knock = () => new Promise(resolve => { release = resolve; });
    const pending = f.runtime.tick(); expect(await f.runtime.tick()).toBe(false); release(undefined); await pending;
    expect(f.runtime.snapshot().doors).toEqual([]);
  });
});

describe('Halloween event integration', () => {
  it('exposes seasonal fights under their actual join/status IDs and builds the merchant module', () => {
    const list = scripts(), profile = initialProfile(list);
    expect(profileSchema.parse(profile).seller.trickOrTreat.enabled).toBe(false);
    for (const id of ['horseman', 'graveyard']) { expect(EVENT_DEFINITIONS.some(e => e.id === id)).toBe(true); expect(expeditionBosses).toContain(id); expect(setEventAllowed(profile, id, true).events.allowed).toContain(id); }
    profile.seller.trickOrTreat = { enabled: true };
    const merchant = profile.characters.find(c => c.ctype === 'merchant')!, script = list.find(s => s.id === merchant.script)!;
    const bundle = adaptSource(read(script.filename), profile, merchant, script).code;
    expect(bundle).toContain('var MerchantHalloween'); expect(bundle).toContain('"trickOrTreat":{"enabled":true}');
  });
  it('joins seasonal fights and only accepts their own monsters on shared maps', async () => {
    for (const [id, mtype, map] of [['graveyard', 'gargoyle', 'spookytown'], ['horseman', 'horseman', 'halloween']]) {
      const joins: string[] = [], entities: any = {};
      const context: any = { __ALCC: { eventsEnabled: true, events: [id] }, character: { name: 'Tank', ctype: 'warrior', map: 'main' }, server: { status: { [id]: { live: true, map } } }, parent: { entities }, Date, Math, Number, isFinite, join: async (event: string) => joins.push(event), get_nearest_monster: () => null };
      const router = vm.runInNewContext(read('event-router.js') + '\nEventRouter;', context);
      await router.tick(); expect(joins).toEqual([id]);
      context.character.map = map;
      expect(router.accepts({ type: 'monster', mtype, visible: true })).toBe(true);
      expect(router.accepts({ type: 'monster', mtype: 'mummy', visible: true })).toBe(false);
      entities.objective = { type: 'monster', mtype, visible: true }; expect(await router.tick()).toBe(false);
    }
  });
});

function cipherFixture() {
  const f = fixture(), names = ['verdantspore', 'frostscale', 'embercoal', 'gloomfeather'];
  f.context.__ALCC.witchCipher = { enabled: true };
  f.context.G.events.witchcipher = { slots: 5, ingredients: names.map(n => [n, []]) };
  f.context.G.quests = { witch: { map: 'halloween', x: 858, y: -120 } };
  f.context.server.status.witchcipher = { id: 'round', live: true, cracks: 0, board: [] };
  f.character.items = names.map(name => ({ name, q: 20 }));
  f.character.computer = true; f.character.witchcipher = { mixes_left: 5 };
  const brews: string[][] = [];
  f.context.witch_cipher_info = async () => ({ live: true, mixes_left: 5 - brews.length });
  f.context.brew = async (mix: string[]) => { brews.push(mix); return { success: true, right: 2, fits: true, cracked: false, parcels: 1, mixes_left: 5 - brews.length }; };
  const reload = () => vm.runInNewContext(read('merchant-witch-cipher.js') + '\nMerchantWitchCipher;', f.context);
  return { ...f, names, brews, reloadCipher: reload, cipher: reload(), board: f.context.server.status.witchcipher };
}

describe('current Witch Cipher', () => {
  it('finds a five-slot mix meeting every live clue and available inventory', () => {
    const f = cipherFixture(); f.board.board = [{ mix: Array(5).fill(f.names[0]), right: 2 }];
    const mix = f.cipher.nextMix(f.board); expect(mix).toHaveLength(5); expect(mix.filter((n: string) => n === f.names[0])).toHaveLength(2);
  });
  it('does not spend locked ingredients, guess against inconsistent clues, or replay a board mix', () => {
    const f = cipherFixture(); f.character.items.forEach((it: any) => { it.l = true; }); expect(f.cipher.nextMix(f.board)).toBeNull();
    f.character.items.forEach((it: any) => { it.l = false; }); f.board.board = [{ mix: Array(5).fill(f.names[0]), right: 5 }];
    expect(f.cipher.nextMix(f.board)).toBeNull();
    f.board.board = [{ mix: ['unknown'], right: 9 }]; expect(f.cipher.nextMix(f.board)).toBeNull();
  });
  it('brews remotely with a Computer and uses account quota before each spend', async () => {
    const f = cipherFixture(); await f.cipher.tick(); expect(f.brews).toHaveLength(1); expect(f.routes).toEqual([]);
    f.advance(6000); f.context.witch_cipher_info = async () => ({ live: true, mixes_left: 0 });
    await f.cipher.tick(); expect(f.brews).toHaveLength(1);
  });
  it('walks to the live Witch quest location when remote access is unavailable', async () => {
    const f = cipherFixture(); f.character.computer = false; await f.cipher.tick(); expect(f.routes[0]).toEqual(f.context.G.quests.witch); expect(f.brews).toEqual([]);
    await f.cipher.tick(); expect(f.brews).toHaveLength(1);
  });
  it('reserves attempts before sending so reloads do not repeat uncertain spends', async () => {
    const f = cipherFixture(); let attempted: string[] = [];
    f.context.brew = async (mix: string[]) => { attempted = mix.slice(); throw new Error('network'); };
    await f.cipher.tick(); expect(f.cipher.snapshot().spent).toBe(1);
    const reloaded = f.reloadCipher(); expect(reloaded.nextMix(f.board)).not.toEqual(attempted);
    expect(reloaded.nextMix(f.board)).toBeNull(); // wait for a fresh clue board, even after reload
  });
  it('handles a cracked board reset and stops at five attempts in a UTC day', async () => {
    const f = cipherFixture();
    for (let i = 0; i < 5; i++) { f.board.cracks = i; await f.cipher.tick(); f.advance(6000); }
    expect(f.brews).toHaveLength(5); await f.reloadCipher().tick(); expect(f.brews).toHaveLength(5);
    f.advance(86400000); expect(f.reloadCipher().snapshot().spent).toBe(0);
  });
  it('does nothing when disabled, inactive, quota is on another realm, or expedition workers need service', async () => {
    const f = cipherFixture(); f.context.__ALCC.witchCipher.enabled = false; await f.cipher.tick(); f.context.__ALCC.witchCipher.enabled = true;
    f.board.live = false; await f.cipher.tick(); f.board.live = true;
    f.character.witchcipher.server = 'US II'; await f.cipher.tick(); delete f.character.witchcipher.server;
    f.context.EventExpedition = { snapshot: () => ({ phase: 'returning' }) }; await f.cipher.tick(); expect(f.brews).toEqual([]);
  });
});
