import { expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { sourceDir } from '../server/scripts';

const source = fs.readFileSync(path.join(sourceDir, 'event-router.js'), 'utf8');

it('abandons an event after two deaths there and takes it again once it has ended', () => {
  let now = 1_000_000, watch: () => void = () => {};
  const store: Record<string, unknown> = {}, logs: string[] = [];
  const statuses: Record<string, unknown> = { icegolem: { live: true } };
  const character = { name: 'Eadroma', ctype: 'warrior', map: 'winterland', x: 0, y: 0, rip: false };
  const context = {
    Date: { now: () => now }, __ALCC: { eventsEnabled: true, events: ['icegolem'] }, character, server: { status: statuses },
    G: { events: { icegolem: { join: true } } }, get: (k: string) => store[k], set: (k: string, v: unknown) => { store[k] = v; },
    setInterval: (fn: () => void) => { watch = fn; return 1; }, game_log: (m: string) => logs.push(m),
  };
  const router = vm.runInNewContext(`${source}\nEventRouter`, context);
  const die = () => { store['alcc_event_session_Eadroma'] = { id: 'icegolem', seenAt: now }; character.rip = true; watch(); now += 15_000; character.rip = false; watch(); };
  expect(router.next().id).toBe('icegolem');
  die();
  expect(router.next().id).toBe('icegolem');
  die();
  expect(router.next()).toBe(null);
  expect(logs.at(-1)).toContain('icegolem');
  // A brief status flicker does not reset the budget; a finished event does.
  statuses.icegolem = { live: false }; router.next(); now += 60_000; statuses.icegolem = { live: true };
  expect(router.next()).toBe(null);
  statuses.icegolem = { live: false }; router.next(); now += 121_000; router.next(); statuses.icegolem = { live: true };
  expect(router.next().id).toBe('icegolem');
});

it('ignores deaths outside events', () => {
  let watch: () => void = () => {};
  const store: Record<string, unknown> = {};
  const character = { name: 'Eadroma', ctype: 'warrior', map: 'desertland', rip: false };
  const context = { __ALCC: { eventsEnabled: true, events: ['icegolem'] }, character, server: { status: { icegolem: { live: true } } }, G: { events: { icegolem: { join: true } } }, get: (k: string) => store[k], set: (k: string, v: unknown) => { store[k] = v; }, setInterval: (fn: () => void) => { watch = fn; return 1; } };
  const router = vm.runInNewContext(`${source}\nEventRouter`, context);
  for (let i = 0; i < 3; i++) { character.rip = true; watch(); character.rip = false; watch(); }
  expect(router.next().id).toBe('icegolem');
});
