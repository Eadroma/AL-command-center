/** Telemetry: v2-compatible packets, tickets, sequence, commands until receipt, v2 relay, feed, routes. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';
import { GAME_ORIGIN } from '../server/security.ts';
import { createTeamFeed, mergeCharacters } from '../server/telemetry/feed.ts';
import { createTelemetryStore, hashTicket } from '../server/telemetry/store.ts';
import type { IngestResult, SessionRecord } from '../server/telemetry/store.ts';
import { mapV2Deployments } from '../server/telemetry/v2-relay.ts';
import type { CharacterLive } from '../shared/telemetry.ts';
import { testApp } from './helpers/fakes.ts';

const fixture: unknown = JSON.parse(await readFile(path.join(import.meta.dirname, 'fixtures', 'v2-packet.json'), 'utf8'));

function packet(ticket: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { ...(typeof fixture === 'object' && fixture !== null ? fixture : {}), ticket, ...overrides };
}

/** True when the store accepted the packet as new live data. */
function wasAccepted(result: IngestResult): boolean {
  return result.ok && result.accepted;
}

function clock(start: number): { now: () => number; advance: (ms: number) => void } {
  let current = start;
  return { now: () => current, advance: (ms) => { current += ms; } };
}

describe('telemetry store', () => {
  it('accepts a full v2 packet for a known ticket, then exposes the character', () => {
    const time = clock(1_000_000);
    const store = createTelemetryStore([], () => undefined, time.now);
    const { ticket } = store.createSession('Hero');
    const result = store.ingest(packet(ticket));
    assert.ok(result.ok && result.accepted);
    const [hero] = store.snapshot();
    assert.deepEqual([hero?.name, hero?.hp, hero?.maxHp, hero?.map, hero?.activity, hero?.freshness], ['Hero', 6222, 6715, 'main', 'Hunting bigbird', 'live']);
  });

  it('refuses unknown tickets, another character\'s ticket and malformed packets', () => {
    const store = createTelemetryStore([], () => undefined);
    const { ticket } = store.createSession('Hero');
    assert.deepEqual(store.ingest(packet('f'.repeat(64))), { ok: false, code: 'telemetry.unknownTicket' });
    assert.deepEqual(store.ingest(packet(ticket, { character: 'Other' })), { ok: false, code: 'telemetry.unknownTicket' });
    assert.deepEqual(store.ingest({ ticket }), { ok: false, code: 'telemetry.invalidPacket' });
  });

  it('ignores replayed sequences and packets sent less than a second apart', () => {
    const time = clock(1_000_000);
    const store = createTelemetryStore([], () => undefined, time.now);
    const { ticket } = store.createSession('Hero');
    store.ingest(packet(ticket, { sequence: 10 }));
    time.advance(2000);
    assert.ok(store.ingest(packet(ticket, { sequence: 10 })).ok);
    assert.equal(wasAccepted(store.ingest(packet(ticket, { sequence: 10 }))), false);
    assert.equal(wasAccepted(store.ingest(packet(ticket, { sequence: 11 }))), true);
    time.advance(500);
    assert.equal(wasAccepted(store.ingest(packet(ticket, { sequence: 12 }))), false);
  });

  it('resends a command with every answer until the script acknowledges it', () => {
    const time = clock(1_000_000);
    const store = createTelemetryStore([], () => undefined, time.now);
    const { ticket } = store.createSession('Hero');
    store.ingest(packet(ticket, { sequence: 1 }));
    const command = store.enqueue('Hero', 'sort_bank');
    assert.ok(command !== null);
    time.advance(1500);
    const second = store.ingest(packet(ticket, { sequence: 2 }));
    assert.ok(second.ok && second.commands.some((c) => c.id === command.id));
    time.advance(1500);
    const third = store.ingest(packet(ticket, { sequence: 3, commandReceipts: [{ id: command.id, state: 'complete', message: 'done' }] }));
    assert.ok(third.ok && third.commands.length === 0);
  });

  it('refuses commands for characters without fresh telemetry', () => {
    assert.equal(createTelemetryStore([], () => undefined).enqueue('Ghost', 'sort_bank'), null);
  });

  it('persists only ticket hashes and drops sessions older than 7 days', () => {
    let saved: readonly SessionRecord[] = [];
    const old: SessionRecord = { id: 'old', character: 'Hero', ticketHash: 'a'.repeat(64), createdAt: 0 };
    const store = createTelemetryStore([old], (sessions) => { saved = sessions; }, () => 8 * 86_400_000);
    const { ticket, session } = store.createSession('Hero');
    assert.deepEqual(saved.map((s) => s.id), [session.id]);
    assert.equal(session.ticketHash, hashTicket(ticket));
    assert.doesNotMatch(JSON.stringify(saved), new RegExp(ticket));
  });
});

describe('v2 relay and merge', () => {
  const v2Body = { characters: {
    Hero: { telemetry: { lastSeen: 1000, stats: { hp: 10, max_hp: 20, mp: 5, max_mp: 10, level: 70, gold: 1, map: 'main', x: 1, y: 2, target: '', skin: 'x' }, intent: { state: 'Resting' } } },
    Ghost: { telemetry: null },
  } };

  it('maps dashboard-v2 deployments, unknown values staying null', () => {
    const characters = mapV2Deployments(v2Body, 5000) ?? [];
    assert.deepEqual(characters.map((c) => [c.name, c.freshness, c.target, c.activity]), [['Hero', 'live', null, 'Resting'], ['Ghost', 'never', null, null]]);
    assert.equal(mapV2Deployments({ nope: true }, 0), null);
  });

  it('prefers our live telemetry, and a live relay over our stale data', () => {
    const base = mapV2Deployments(v2Body, 5000)?.[0];
    assert.ok(base !== undefined);
    const ownLive: CharacterLive = { ...base, source: 'telemetry', freshness: 'live' };
    const ownStale: CharacterLive = { ...base, source: 'telemetry', freshness: 'stale' };
    assert.equal(mergeCharacters([ownLive], [base])[0]?.source, 'telemetry');
    assert.equal(mergeCharacters([ownStale], [base])[0]?.source, 'v2');
  });

  it('sends the current team as soon as someone subscribes', () => {
    const feed = createTeamFeed({ store: createTelemetryStore([], () => undefined), relayV2Url: '' });
    let received = -1;
    const unsubscribe = feed.subscribe((team) => { received = team.characters.length; });
    unsubscribe();
    assert.equal(received, 0);
  });
});

describe('telemetry routes', () => {
  it('accepts packets from adventure.land without the CSRF token and returns pending commands', async () => {
    const telemetry = createTelemetryStore([], () => undefined);
    const { ticket } = telemetry.createSession('Hero');
    const app = testApp({ telemetry });
    const headers = { host: '127.0.0.1:9321', origin: GAME_ORIGIN, 'content-type': 'application/json' };
    const ok = await app.request('/api/telemetry', { method: 'POST', headers, body: JSON.stringify(packet(ticket)) });
    assert.equal(ok.status, 200);
    assert.deepEqual(await ok.json(), { ok: true, accepted: true, commands: [] });
    const rejected = await app.request('/api/telemetry', { method: 'POST', headers, body: JSON.stringify(packet('0'.repeat(64))) });
    assert.equal(rejected.status, 403);
    const team = await app.request('/api/team/live', { headers: { host: '127.0.0.1:9321' } });
    assert.match(await team.text(), /"name":"Hero"/);
  });
});

describe('live reconnection', () => {
  it('waits 1 s, 2 s, 4 s… and never more than 10 s', async () => {
    const { reconnectDelayMs } = await import('../src/api/live.ts');
    assert.deepEqual([0, 1, 2, 3, 4, 10].map(reconnectDelayMs), [1000, 2000, 4000, 8000, 10_000, 10_000]);
  });
});
