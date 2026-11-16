/** "To handle" banner: which signals show, which stay dismissed, and the dismiss endpoint. */
import assert from 'node:assert/strict';
import { EMPTY_INSIGHT } from '../server/telemetry/insight.ts';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import type { JobState } from '../shared/game.ts';
import type { CharacterLive } from '../shared/telemetry.ts';
import { CSRF_HEADER } from '../server/security.ts';
import { attentionSignals, isDismissable, RECENT_DEATH_MS } from '../src/screens/team/attention.ts';
import { testApp } from './helpers/fakes.ts';

const now = 10_000_000;

function character(overrides: Partial<CharacterLive>): CharacterLive {
  return {
    name: 'Eadroma', source: 'telemetry', freshness: 'live', lastSeen: now, level: 70, hp: 900, maxHp: 1000, mp: 100, maxMp: 100,
    map: 'main', x: 0, y: 0, server: 'EU III', target: null, skin: null, activity: null, gold: null, positions: [], failures: [], insight: EMPTY_INSIGHT, logs: [],
    ...overrides,
  };
}

function signals(characters: CharacterLive[], options: { job?: JobState; dismissed?: string[] } = {}): ReturnType<typeof attentionSignals> {
  return attentionSignals({ team: { at: now, characters }, job: options.job ?? null, dismissed: new Set(options.dismissed ?? []), now });
}

describe('attentionSignals', () => {
  it('shows nothing for a healthy live team', () => {
    assert.deepEqual(signals([character({})]), []);
  });

  it('shows deaths from the last 30 minutes only', () => {
    const failures = [{ at: now - 60_000, reason: 'healer out of range', details: '' }, { at: now - RECENT_DEATH_MS - 1, reason: 'old', details: '' }];
    assert.deepEqual(signals([character({ failures })]).map((signal) => signal.key), [`death:Eadroma:${String(now - 60_000)}`]);
  });

  it('flags low HP on live characters and never lets it be dismissed', () => {
    const shown = signals([character({ hp: 200 })], { dismissed: ['lowHp:Eadroma'] });
    assert.deepEqual(shown.map((signal) => [signal.kind, isDismissable(signal)]), [['lowHp', false]]);
    assert.deepEqual(signals([character({ hp: 200, freshness: 'stale', lastSeen: now - 60_000 })]).map((signal) => signal.kind), ['silent']);
  });

  it('gives a new silence a new key, so a dismissed one does not hide the next', () => {
    const first = signals([character({ freshness: 'stale', lastSeen: now - 60_000 })]);
    assert.deepEqual(signals([character({ freshness: 'stale', lastSeen: now - 60_000 })], { dismissed: first.map((signal) => signal.key) }), []);
    assert.equal(signals([character({ freshness: 'stale', lastSeen: now - 30_000 })], { dismissed: first.map((signal) => signal.key) }).length, 1);
  });

  it('reports a failed game data update and characters never heard from', () => {
    const job: JobState = { status: 'failed', trigger: 'schedule', startedAt: null, finishedAt: '2026-10-26T10:00:00.000Z', durationMs: 1, summary: [] };
    assert.deepEqual(signals([character({ freshness: 'never', lastSeen: null })], { job }).map((signal) => signal.kind), ['gameData', 'never']);
  });

  it('sorts danger first, then by key for a stable order', () => {
    const team = [character({ name: 'Zed', freshness: 'never', lastSeen: null }), character({ name: 'Bob', hp: 10 }), character({ name: 'Al', hp: 10 })];
    assert.deepEqual(signals(team).map((signal) => signal.key), ['lowHp:Al', 'lowHp:Bob', 'never:Zed']);
  });
});

describe('attention routes', () => {
  let directory = '';
  before(async () => { directory = await mkdtemp(path.join(os.tmpdir(), 'alcc-attention-')); });
  after(async () => { await rm(directory, { recursive: true, force: true }); });
  const headers = { host: '127.0.0.1:9321', 'content-type': 'application/json', [CSRF_HEADER]: 'csrf' };

  it('needs the CSRF token and a valid key, then persists the key', async () => {
    const attentionFile = path.join(directory, 'attention.json');
    const app = testApp({ attentionFile });
    const noToken = await app.request('/api/attention/dismiss', { method: 'POST', headers: { ...headers, [CSRF_HEADER]: '' }, body: JSON.stringify({ key: 'never:A' }) });
    assert.equal(noToken.status, 403);
    const invalid = await app.request('/api/attention/dismiss', { method: 'POST', headers, body: JSON.stringify({ key: '<script>' }) });
    assert.equal(invalid.status, 400);
    const saved = await app.request('/api/attention/dismiss', { method: 'POST', headers, body: JSON.stringify({ key: 'never:A' }) });
    assert.deepEqual(await saved.json(), { dismissed: ['never:A'] });
    assert.match(await readFile(attentionFile, 'utf8'), /never:A/);
    const listed = await app.request('/api/attention', { headers });
    assert.deepEqual(await listed.json(), { dismissed: ['never:A'] });
  });

  it('treats a corrupt file as nothing dismissed', async () => {
    const attentionFile = path.join(directory, 'corrupt.json');
    await writeFile(attentionFile, '{not json');
    const listed = await testApp({ attentionFile }).request('/api/attention', { headers });
    assert.deepEqual(await listed.json(), { dismissed: [] });
  });
});
