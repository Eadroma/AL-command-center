/** Character panel: decision details read from scripts, kept logs, and the "why" explanation. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';
import { EMPTY_INSIGHT } from '../server/telemetry/insight.ts';
import { createTelemetryStore } from '../server/telemetry/store.ts';
import { mapV2Deployments } from '../server/telemetry/v2-relay.ts';
import type { CharacterLive, Insight } from '../shared/telemetry.ts';
import { explain, isWarning } from '../src/screens/team/panel/explain.ts';

const fixture: unknown = JSON.parse(await readFile(path.join(import.meta.dirname, 'fixtures', 'v2-packet.json'), 'utf8'));
const basePacket = typeof fixture === 'object' && fixture !== null ? fixture : {};

// Shapes as sent by the v2 instrumented scripts (observed on 2026-10-26).
const sections = {
  intent: { state: 'Combat', since: 1000, updatedAt: 1500, map: 'halloween', target: '1389263', destination: null, blockedBy: null },
  movement: { state: 'monitoring', moving: true, lastProgressAt: 1, stalledForMs: 0, attempts: 0, recoveries: 0, lastAction: '', updatedAt: 1, destination: null, history: [] },
  network: { pingMs: 32.7, socketConnected: true },
  coordination: { role: 'leader', mission: { id: 'm', leader: 'Eadroma', monster: 'mrpumpkin', map: 'halloween', x: 1, y: 2, targetId: '1', phase: 'travel', at: 1 }, ready: ['Aedroma'], canEngage: true, updatedAt: 1 },
  runtimePolicy: { danger: { active: false, reason: '', attackers: 0 }, diagnostic: { reason: 'Target out of range', target: '1389263', source: 'observed' } },
  loopGuard: { task: '', holds: [] },
};

describe('insightOf', () => {
  it('reads the decision details the v2 scripts send', () => {
    const [hero] = mapV2Deployments({ characters: { Eadroma: { script: 'eadroma-warrior-v2', telemetry: { lastSeen: 1, ...sections } } } }, 1) ?? [];
    assert.deepEqual(hero?.insight, {
      since: 1000, destination: null, blockedBy: null,
      movement: { state: 'monitoring', stalledForMs: 0, attempts: 0, lastAction: '' },
      connected: true, danger: null, combat: 'Target out of range', hold: null,
      coordination: { role: 'leader', monster: 'mrpumpkin', phase: 'travel', ready: ['Aedroma'], canEngage: true },
      script: 'eadroma-warrior-v2',
    });
  });

  it('ignores a malformed section instead of rejecting the packet', () => {
    const time = { at: 1_000_000 };
    const store = createTelemetryStore([], () => undefined, () => time.at);
    const { ticket } = store.createSession('Hero');
    const result = store.ingest({ ...basePacket, ticket, movement: { state: 42 }, network: { socketConnected: false } });
    assert.ok(result.ok && result.accepted);
    const [hero] = store.snapshot();
    assert.deepEqual([hero?.insight.movement, hero?.insight.connected], [null, false]);
  });

  it('dates log lines on arrival and keeps the last 20', () => {
    const time = { at: 1_000_000 };
    const store = createTelemetryStore([], () => undefined, () => time.at);
    const { ticket } = store.createSession('Hero');
    store.ingest({ ...basePacket, ticket, sequence: 1, logs: Array.from({ length: 15 }, (_, index) => `a${String(index)}`) });
    time.at += 2000;
    store.ingest({ ...basePacket, ticket, sequence: 2, logs: Array.from({ length: 10 }, (_, index) => `b${String(index)}`) });
    const logs = store.snapshot()[0]?.logs ?? [];
    assert.equal(logs.length, 20);
    assert.deepEqual(logs[0], { at: 1_000_000, message: 'a5' });
    assert.deepEqual(logs.at(-1), { at: 1_002_000, message: 'b9' });
  });

  it('takes the script name and logs from the v2 relay', () => {
    const [hero] = mapV2Deployments({ characters: { Hero: { script: 'hero-v2', telemetry: { lastSeen: 1, logs: [{ time: 5, message: 'Path found!' }], ...sections } } } }, 10) ?? [];
    assert.deepEqual([hero?.insight.script, hero?.insight.coordination?.monster, hero?.logs], ['hero-v2', 'mrpumpkin', [{ at: 5, message: 'Path found!' }]]);
  });
});

function live(insight: Partial<Insight>, overrides: Partial<CharacterLive> = {}): CharacterLive {
  return {
    name: 'A', source: 'v2', freshness: 'live', lastSeen: 1, level: 1, hp: 100, maxHp: 100, mp: 1, maxMp: 1, map: 'main', x: 0, y: 0,
    server: null, target: null, skin: null, activity: 'Hunting', gold: null, positions: [], failures: [], logs: [],
    insight: { ...EMPTY_INSIGHT, ...insight },
    ...overrides,
  };
}

describe('explain', () => {
  it('never explains a live decision from stale or missing data', () => {
    assert.deepEqual(explain(live({}, { freshness: 'never', lastSeen: null })), { kind: 'never' });
    assert.deepEqual(explain(live({ danger: 'too many attackers' }, { freshness: 'stale', lastSeen: 7 })), { kind: 'stale', lastSeen: 7 });
  });

  it('puts the most serious blocker first', () => {
    const everything: Partial<Insight> = { connected: false, danger: 'x', hold: { task: 't', reason: 'r' }, blockedBy: 'b' };
    assert.equal(explain(live(everything)).kind, 'disconnected');
    assert.equal(explain(live({ ...everything, connected: true }, { hp: 0 })).kind, 'dead');
    assert.deepEqual(explain(live({ ...everything, connected: true })), { kind: 'safetyHold', reason: 'x' });
    assert.deepEqual(explain(live({ hold: { task: 't', reason: 'r' }, blockedBy: 'b' })), { kind: 'suspended', task: 't', reason: 'r' });
    assert.deepEqual(explain(live({ blockedBy: 'b' })), { kind: 'blocked', reason: 'b' });
  });

  it('explains a stuck route and a group that is not ready', () => {
    const movement = { state: 'stalled', stalledForMs: 12_500, attempts: 2, lastAction: 'smart_move' };
    assert.deepEqual(explain(live({ movement, destination: { map: 'cave', x: 1, y: 2 } })), { kind: 'routeRecovery', seconds: 12, attempts: 2, destination: { map: 'cave', x: 1, y: 2 } });
    const coordination = { role: 'follower' as const, monster: 'mrpumpkin', phase: 'engage', ready: [], canEngage: false };
    assert.deepEqual(explain(live({ coordination })), { kind: 'waitingTeam', ready: [] });
  });

  it('otherwise says what it is busy with: mission, combat, route, then the script state', () => {
    const coordination = { role: 'leader' as const, monster: 'mrpumpkin', phase: 'travel', ready: ['B'], canEngage: true };
    assert.deepEqual(explain(live({ coordination, combat: 'cooldown' }, { target: '1' })), { kind: 'mission', monster: 'mrpumpkin', phase: 'travel', leader: true });
    assert.deepEqual(explain(live({ combat: 'Attack / heal cooldown' }, { target: '1' })), { kind: 'combat', reason: 'Attack / heal cooldown' });
    assert.deepEqual(explain(live({ combat: 'No target' })), { kind: 'reported', state: 'Hunting' });
    assert.deepEqual(explain(live({ destination: { map: 'bank', x: 0, y: 0 } })), { kind: 'travelling', destination: { map: 'bank', x: 0, y: 0 } });
    assert.deepEqual(explain(live({}, { activity: null })), { kind: 'unknown' });
    assert.equal(isWarning({ kind: 'combat', reason: 'x' }), false);
    assert.equal(isWarning({ kind: 'blocked', reason: 'x' }), true);
  });
});
