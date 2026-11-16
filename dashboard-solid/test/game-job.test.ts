/** Update job: cross-process lock, single run at a time, persisted state, change reports, routes. */
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { buildReport, diffRecords, readReports } from '../server/game-data/changes.ts';
import { parseDataJs } from '../server/game-data/data-js.ts';
import { createGameDataJob, readJobState } from '../server/game-data/job.ts';
import { acquireLock } from '../server/game-data/lock.ts';
import type { SettingsHolder } from '../server/settings/holder.ts';
import { CSRF_HEADER } from '../server/security.ts';
import { updateGameData } from '../server/game-data/store.ts';
import { emptyGameData, missingSettings, testApp } from './helpers/fakes.ts';

let directory = '';
before(async () => { directory = await mkdtemp(path.join(os.tmpdir(), 'alcc-job-')); });
after(async () => { await rm(directory, { recursive: true, force: true }); });

const g = (version: number, items: Record<string, unknown>): string => `var G=${JSON.stringify({
  version, items, monsters: { bigbird: { name: 'Big Bird', hp: 3000 } }, maps: {}, classes: {}, imagesets: {}, positions: {}, sprites: {}, tilesets: {},
})};`;

describe('lock', () => {
  it('lets one owner in, then takes over an abandoned lock', async () => {
    const file = path.join(directory, 'a.lock');
    const release = await acquireLock(file);
    assert.ok(release !== null);
    assert.equal(await acquireLock(file), null);
    await release();
    await writeFile(file, JSON.stringify({ pid: 999_999, at: Date.now() }));
    assert.ok(await acquireLock(file, Date.now(), () => false) !== null);
  });
});

describe('change report', () => {
  it('lists added, removed and changed keys', () => {
    assert.deepEqual(diffRecords({ a: 1, b: 2, c: 3 }, { a: 1, b: 5, d: 4 }), { added: ['d'], removed: ['c'], changed: ['b'] });
  });

  it('is written when the content of G changes, newest first', async () => {
    const dir = path.join(directory, 'reports');
    let body = g(1, { hpot1: { name: 'HP Potion', g: 20 } });
    let etag = '"1"';
    const fakeFetch: typeof fetch = (_input, init) =>
      Promise.resolve(init?.method === 'HEAD' ? new Response(null, { headers: { etag } }) : new Response(body));
    await updateGameData(dir, fakeFetch);
    body = g(2, { hpot1: { name: 'HP Potion', g: 25 }, mpot1: { name: 'MP Potion' } });
    etag = '"2"';
    await updateGameData(dir, fakeFetch);
    const [report] = await readReports(dir);
    assert.ok(report !== undefined);
    assert.deepEqual([report.fromVersion, report.toVersion, report.items], [1, 2, { added: ['mpot1'], removed: [], changed: ['hpot1'] }]);
    const first = parseDataJs(g(1, {}));
    const second = parseDataJs(g(1, { x: { name: 'X' } }));
    assert.ok(first.ok && second.ok);
    assert.deepEqual(buildReport(first.data, second.data, 'now').items.added, ['x']);
  });
});

describe('job', () => {
  it('runs once at a time and records the last run', async () => {
    const dir = path.join(directory, 'job');
    // A refresh that never finishes keeps the first run busy.
    const slow = { ...emptyGameData, isStale: () => true, refresh: () => new Promise<never>(() => undefined) };
    const job = await createGameDataJob({ service: emptyGameData, directory: dir, checkEveryHours: 24, log: () => undefined });
    const result = await job.run('manual');
    assert.ok(result !== 'busy' && result.status === 'failed' && result.trigger === 'manual');
    assert.equal((await readJobState(dir)).trigger, 'manual');
    const blocked = await createGameDataJob({ service: slow, directory: path.join(directory, 'job2'), checkEveryHours: 24, log: () => undefined });
    void blocked.run('schedule');
    assert.equal(await blocked.run('manual'), 'busy');
  });
});

describe('routes', () => {
  const settings: SettingsHolder = {
    state: () => ({ status: 'missing', file: 'x' }),
    check: () => Promise.resolve({ ok: false, error: { code: 'x' } }),
    save: () => Promise.resolve({ ok: false, error: { code: 'x' } }),
    client: missingSettings.client,
  };

  it('starts a manual update (202), refuses a second one (409), and needs the CSRF token', async () => {
    const job = await createGameDataJob({
      service: { ...emptyGameData, refresh: () => new Promise<never>(() => undefined) },
      directory: path.join(directory, 'routes'), checkEveryHours: 24, log: () => undefined,
    });
    const app = testApp({ settings, job, csrfToken: 't' });
    const headers = { host: '127.0.0.1', [CSRF_HEADER]: 't' };
    assert.equal((await app.request('/api/game/refresh', { method: 'POST', headers: { host: '127.0.0.1' } })).status, 403);
    const started = await app.request('/api/game/refresh', { method: 'POST', headers });
    assert.equal(started.status, 202);
    assert.match(await started.text(), /"status":"running"/);
    assert.equal((await app.request('/api/game/refresh', { method: 'POST', headers })).status, 409);
  });
});
