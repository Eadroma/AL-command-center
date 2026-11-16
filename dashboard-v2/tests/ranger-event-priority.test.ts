import { expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { sourceDir } from '../server/scripts';
const source = fs.readFileSync(path.join(sourceDir, 'event-router.js'), 'utf8');
it('keeps attacking a tanked Pumpkin while Green is idle, and switches when Green is engaged', () => {
  const pumpkin = { type: 'monster', mtype: 'mrpumpkin', visible: true, target: 'Ynhi', id: 'pumpkin' };
  const statuses: any = { mrgreen: { live: true, map: 'spookytown' }, mrpumpkin: { live: true, map: 'halloween', target: 'Ynhi' } };
  let green: any = null;
  const context = { __ALCC: { eventsEnabled: true, events: ['mrpumpkin', 'mrgreen'] }, character: { name: 'Droma', ctype: 'ranger', map: 'halloween' }, server: { status: statuses }, get_nearest_monster: ({ type }: { type: string }) => type === 'mrpumpkin' ? pumpkin : green };
  const router = vm.runInNewContext(`${source}\nEventRouter`, context);
  expect(router.next().id).toBe('mrpumpkin');
  expect(router.canEngage(pumpkin)).toBe(true);
  statuses.mrgreen.target = 'Tank';
  expect(router.next().id).toBe('mrgreen');
  green = { target: '' };
  expect(router.next().id).toBe('mrpumpkin'); // visible idle state overrides stale server status
  green = null; statuses.mrgreen.target = ''; statuses.mrpumpkin.target = ''; pumpkin.target = '';
  expect(router.next().id).toBe('mrgreen'); // wait for a tank if all bosses are idle
  expect(router.canEngage(pumpkin)).toBe(false);
});

it('treats Mr Green minions as event targets so the ranger defends and multishots them', () => {
  const green = { type: 'monster', mtype: 'mrgreen', visible: true, target: 'Eadroma' };
  const context = { __ALCC: { eventsEnabled: true, events: ['mrgreen'] }, character: { name: 'Droma', ctype: 'ranger', map: 'spookytown' }, server: { status: { mrgreen: { live: true, map: 'spookytown', target: 'Eadroma' } } }, get_nearest_monster: ({ type }: { type: string }) => type === 'mrgreen' ? green : null };
  const router = vm.runInNewContext(`${source}\nEventRouter`, context);
  expect(router.canEngage({ type: 'monster', mtype: 'greenjr', visible: true, target: 'Droma' })).toBe(true);
  expect(router.canEngage({ type: 'monster', mtype: 'greenjr', visible: true, target: '' })).toBe(false); // never pull idle ones
  expect(router.accepts({ type: 'monster', mtype: 'jr', visible: true, target: 'Droma' })).toBe(false); // jr belongs to Mr Pumpkin only
});

it('accepts only Giga Crab and its crabx on the shared main map, never poisio', () => {
  const context = { __ALCC: { eventsEnabled: true, events: ['crabxx'] }, character: { name: 'Eadroma', ctype: 'warrior', map: 'main' }, server: { status: { crabxx: { live: true, map: 'main', x: -1000, y: 1700 } } }, get_nearest_monster: () => null };
  const router = vm.runInNewContext(`${source}\nEventRouter`, context);
  expect(router.accepts({ type: 'monster', mtype: 'crabxx', visible: true })).toBe(true);
  expect(router.accepts({ type: 'monster', mtype: 'crabx', visible: true })).toBe(true);
  expect(router.accepts({ type: 'monster', mtype: 'poisio', visible: true })).toBe(false);
});

it('releases movement when town keeps failing long after a boss event ended', async () => {
  const store: Record<string, unknown> = { alcc_event_session_Aedroma: { id: 'mrgreen', kind: 'boss', seenAt: Date.now() - 600000 } };
  const logs: string[] = [];
  const context = {
    __ALCC: { eventsEnabled: true, events: ['mrgreen'] }, character: { name: 'Aedroma', ctype: 'priest', map: 'spookytown' }, server: { status: {} },
    get: (k: string) => store[k], set: (k: string, v: unknown) => { store[k] = v; }, town: () => Promise.reject({ reason: 'interrupted' }),
    game_log: (m: string) => logs.push(m), parent: { chests: {} }, smart: { moving: false }, stop: () => {}, setInterval: () => 0, setTimeout, Promise, Date,
  };
  const router = vm.runInNewContext(`${source}\nEventRouter`, context);
  expect(await router.tick()).toBe(false);
  expect(store.alcc_event_session_Aedroma).toBe(null);
  expect(logs.some(m => m.includes('reprise du suivi'))).toBe(true);
});

it('lets every class hit Franky only while an outside player tanks it, and defend against its mummies', () => {
  const franky: any = { type: 'monster', mtype: 'franky', visible: true, target: '', x: 0, y: 0 };
  const mummy: any = { type: 'monster', mtype: 'nerfedmummy', visible: true, target: 'Aedroma' };
  const moves: number[][] = [];
  const character = { name: 'Eadroma', ctype: 'warrior', map: 'level2w', x: 50, y: 0 };
  const context = {
    __ALCC: { eventsEnabled: true, events: ['franky'] }, character, server: { status: { franky: { live: true, map: 'level2w' } } },
    get_party: () => ({ Eadroma: {}, Aedroma: {}, Droma: {} }), get_nearest_monster: ({ type }: { type: string }) => type === 'franky' ? franky : null,
    can_move_to: () => true, move: (x: number, y: number) => moves.push([x, y]), game_log: () => {},
  };
  const router = vm.runInNewContext(`${source}\nEventRouter`, context);
  expect(router.canEngage(franky)).toBe(false); // idle
  franky.target = 'Aedroma';
  expect(router.canEngage(franky)).toBe(false); // on our priest: no taunt, no hit
  expect(router.canEngage(mummy)).toBe(true);
  expect(router.canEngage({ ...mummy, target: 'Stranger' })).toBe(false);
  franky.target = 'Stranger';
  expect(router.canEngage(franky)).toBe(true);
  franky.target = 'Eadroma';
  return router.tick().then((held: boolean) => {
    expect(held).toBe(true);
    expect(moves[0][0]).toBeGreaterThan(50); // steps away from Franky
  });
});

it('joins Franky once he loses HP even without a target, never at full HP (2026-11-04 23:00)', () => {
  const franky: any = { type: 'monster', mtype: 'franky', visible: true, target: '', x: 0, y: 0, hp: 120000000, max_hp: 120000000 };
  const context = {
    __ALCC: { eventsEnabled: true, events: ['franky'] }, character: { name: 'Eadroma', ctype: 'warrior', map: 'level2w', x: 50, y: 0 },
    server: { status: { franky: { live: true, map: 'level2w' } } },
    get_party: () => ({ Eadroma: {}, Aedroma: {}, Dromas: {} }), get_nearest_monster: ({ type }: { type: string }) => type === 'franky' ? franky : null,
    can_move_to: () => true, move: () => {}, game_log: () => {},
  };
  const router = vm.runInNewContext(`${source}\nEventRouter`, context);
  expect(router.canEngage(franky)).toBe(false); // full HP, no target: nobody fights him yet
  franky.hp = 90000000;
  expect(router.canEngage(franky)).toBe(true); // other players are hitting him
  franky.target = 'Aedroma';
  expect(router.canEngage(franky)).toBe(false); // still never while he is on one of us
});
