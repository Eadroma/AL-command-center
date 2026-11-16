/** data.js parsing, conditional update, local snapshot and projections, with a fake game server. */
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { contentHash, parseDataJs } from '../server/game-data/data-js.ts';
import { createGameDataService, searchItems } from '../server/game-data/service.ts';
import { readGameData, updateGameData } from '../server/game-data/store.ts';

const baseG = {
  version: 100,
  items: { hpot1: { name: 'Health Potion', type: 'pot', g: 20 }, mpot1: { name: 'Mana Potion', type: 'pot', g: 20 }, hpbelt: { name: 'HP Belt', type: 'belt' } },
  monsters: { bigbird: { name: 'Big Bird', hp: 3000 } },
  maps: { main: { name: 'Mainland' } },
  classes: { warrior: {} },
  imagesets: { pack_20: { file: '/images/tiles/items/pack_20.png', size: 20 } },
  // Real shapes seen in data.js: a plain [pack, x, y] and a list of animation frames.
  positions: { hpot1: ['pack_20', 1, 2], door0: [['custom', 0, 128, 32, 32], ['custom', 32, 128, 32, 32]] },
  sprites: { monster1: { file: '/images/m.png' } },
  tilesets: { main: { file: '/images/t.png' } },
};

/** Serves one data.js version at a time and counts full downloads. */
function fakeServer(): { fetch: typeof fetch; serve: (g: unknown, etag: string) => void; downloads: () => number; fail: () => void } {
  let body = '';
  let etag = '';
  let downloads = 0;
  let failing = false;
  const fetchImpl: typeof fetch = (_input, init) => {
    if (failing) {
      return Promise.reject(new Error('offline'));
    }
    if (init?.method === 'HEAD') {
      return Promise.resolve(new Response(null, { headers: { etag } }));
    }
    downloads += 1;
    return Promise.resolve(new Response(body));
  };
  return {
    fetch: fetchImpl,
    serve: (g, nextEtag) => { body = `var G=${JSON.stringify(g)};\n`; etag = nextEtag; failing = false; },
    downloads: () => downloads,
    fail: () => { failing = true; },
  };
}

let directory = '';
before(async () => { directory = await mkdtemp(path.join(os.tmpdir(), 'alcc-game-')); });
after(async () => { await rm(directory, { recursive: true, force: true }); });

describe('parseDataJs', () => {
  it('reads G without evaluating code and accepts unknown sections', () => {
    const result = parseDataJs(`var G=${JSON.stringify({ ...baseG, newFeature: { x: 1 } })};\nother();`);
    assert.ok(result.ok);
    assert.equal(result.data.version, 100);
  });

  it('rejects other files, broken JSON and missing required sections', () => {
    assert.deepEqual(parseDataJs('alert(1)'), { ok: false, code: 'gameData.notDataJs' });
    assert.deepEqual(parseDataJs('var G={broken;'), { ok: false, code: 'gameData.invalidJson' });
    const { items, ...withoutItems } = baseG;
    const missing = parseDataJs(`var G=${JSON.stringify(withoutItems)};`);
    assert.ok(!missing.ok && missing.code === 'gameData.unexpectedShape');
  });

  it('ignores the version in the content hash', () => {
    const a = parseDataJs(`var G=${JSON.stringify(baseG)};`);
    const b = parseDataJs(`var G=${JSON.stringify({ ...baseG, version: 101 })};`);
    assert.ok(a.ok && b.ok);
    assert.equal(contentHash(a.data), contentHash(b.data));
  });
});

describe('updateGameData', () => {
  const server = fakeServer();
  const dir = (): string => path.join(directory, 'store');

  it('downloads on first run, then not at all while the ETag is unchanged', async () => {
    server.serve(baseG, '"a"');
    assert.equal((await updateGameData(dir(), server.fetch)).status, 'updated');
    assert.equal((await updateGameData(dir(), server.fetch)).status, 'unchanged');
    assert.equal(server.downloads(), 1);
  });

  it('recognises a version-only bump, then reports new sections', async () => {
    server.serve({ ...baseG, version: 101 }, '"b"');
    assert.equal((await updateGameData(dir(), server.fetch)).status, 'versionOnly');
    server.serve({ ...baseG, version: 102, newFeature: {} }, '"c"');
    const result = await updateGameData(dir(), server.fetch);
    assert.ok(result.status === 'updated');
    assert.deepEqual(result.sectionsAdded, ['newFeature']);
  });

  it('keeps the previous snapshot when the data is invalid or the network fails', async () => {
    server.serve({ version: 103 }, '"d"');
    assert.equal((await updateGameData(dir(), server.fetch)).status, 'failed');
    server.fail();
    assert.deepEqual((await updateGameData(dir(), server.fetch)).status, 'failed');
    assert.equal((await readGameData(dir()))?.version, 102);
  });
});

describe('projections', () => {
  it('searches items by key or name, exact key first, within the limit', () => {
    const parsed = parseDataJs(`var G=${JSON.stringify(baseG)};`);
    assert.ok(parsed.ok);
    assert.deepEqual(searchItems(parsed.data, 'potion', 10).map((item) => item.key), ['hpot1', 'mpot1']);
    assert.equal(searchItems(parsed.data, 'hpbelt', 10)[0]?.npcPrice, null);
    assert.equal(searchItems(parsed.data, '', 2).length, 2);
  });

  it('reports empty, then ready with counts', async () => {
    const server = fakeServer();
    server.serve(baseG, '"x"');
    const service = await createGameDataService({ data: path.join(directory, 'service'), assets: path.join(directory, 'service-assets') }, server.fetch);
    assert.deepEqual(service.status(), { status: 'empty' });
    assert.ok(service.isStale(24));
    await service.refresh();
    const status = service.status();
    assert.ok(status.status === 'ready' && status.items === 3 && status.monsters === 1);
    assert.ok(!service.isStale(24));
  });
});
