/** Game image mirror: checks, incremental sync, fallback, failure threshold, serving. */
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { needsImages } from '../server/game-data/catch-up.ts';
import type { GameData } from '../server/game-data/data-js.ts';
import { gitBlobSha, readManifest, syncImages } from '../server/game-data/image-sync.ts';
import { checkImage, collectImages, isAssetFileName } from '../server/game-data/images.ts';
import type { SettingsHolder } from '../server/settings/holder.ts';
import { missingSettings, testApp } from './helpers/fakes.ts';

/** Smallest byte sequence our checks read: PNG signature + IHDR width/height. */
function png(width: number, height: number, salt = 0): Uint8Array {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  bytes[32] = salt;
  return bytes;
}

function gameData(paths: readonly string[]): GameData {
  return {
    version: 1, items: {}, monsters: {}, maps: {}, classes: {}, positions: {}, tilesets: {},
    imagesets: { pack: { file: '/images/pack.png?v=2', size: 16, rows: 2, columns: 4 } },
    sprites: Object.fromEntries(paths.map((file, index) => [`s${String(index)}`, { file }])),
  };
}

/** Fake GitHub (tree + raw) and fake adventure.land. */
function fakeNetwork(files: ReadonlyMap<string, Uint8Array>, options: { corrupt?: string; missing?: readonly string[] } = {}): { fetch: typeof fetch; downloads: () => number } {
  let downloads = 0;
  const fetchImpl: typeof fetch = (input) => {
    const url = input instanceof Request ? input.url : input.toString();
    if (url.includes('/git/trees/')) {
      const tree = [...files].map(([file, bytes]) => ({ path: file.slice(1), type: 'blob', sha: gitBlobSha(bytes) }));
      return Promise.resolve(Response.json({ truncated: false, tree }));
    }
    downloads += 1;
    const file = url.replace(/^https:\/\/[^/]+(\/kaansoral\/adventureland_mongodb\/main)?/, '').split('?')[0] ?? '';
    const bytes = files.get(file);
    if (bytes === undefined || options.missing?.includes(file) === true) {
      return Promise.resolve(new Response('<html>Not found</html>', { status: 404 }));
    }
    const fromGitHub = url.includes('raw.githubusercontent.com');
    const body = fromGitHub && options.corrupt === file ? png(1, 1, 99) : bytes;
    return Promise.resolve(new Response(Uint8Array.from(body)));
  };
  return { fetch: fetchImpl, downloads: () => downloads };
}

let directory = '';
before(async () => { directory = await mkdtemp(path.join(os.tmpdir(), 'alcc-images-')); });
after(async () => { await rm(directory, { recursive: true, force: true }); });

describe('image checks', () => {
  it('reads PNG headers and rejects HTML or a wrong icon sheet size', () => {
    assert.equal(checkImage(png(64, 32), { width: 64, height: 32 }), 'ok');
    assert.equal(checkImage(new TextEncoder().encode('<html>error</html>'), null), 'notPng');
    assert.equal(checkImage(png(64, 16), { width: 64, height: 32 }), 'wrongSize');
  });

  it('computes git blob hashes exactly like git', () => {
    assert.equal(gitBlobSha(new TextEncoder().encode('hello\n')), 'ce013625030ba8dba906f756967f9e9ca394464a');
  });

  it('accepts only content-hash file names', () => {
    assert.ok(isAssetFileName(`${'a'.repeat(40)}.png`));
    assert.ok(isAssetFileName(`s256-${'b'.repeat(64)}.png`));
    for (const name of ['../settings.json', 'pack.png', `${'a'.repeat(40)}.png/..`]) {
      assert.ok(!isAssetFileName(name), name);
    }
  });

  it('lists each image once, icon sheets with their expected size', () => {
    const images = collectImages(gameData(['/images/a.png', '/images/a.png?v=3']));
    assert.deepEqual(images.map((image) => image.path), ['/images/pack.png', '/images/a.png']);
    assert.deepEqual(images[0]?.expected, { width: 64, height: 32 });
  });
});

describe('syncImages', () => {
  const files = new Map([['/images/pack.png', png(64, 32)], ['/images/a.png', png(10, 10)], ['/images/b.png', png(20, 20)]]);
  const data = gameData(['/images/a.png', '/images/b.png']);

  it('downloads once, then nothing while the files are unchanged', async () => {
    const dir = path.join(directory, 'incremental');
    const network = fakeNetwork(files);
    const first = await syncImages(dir, data, network.fetch);
    assert.ok(first.status === 'synced' && first.downloaded === 3);
    const second = await syncImages(dir, data, network.fetch);
    assert.ok(second.status === 'synced' && second.downloaded === 0);
    assert.equal(Object.keys((await readManifest(dir))?.files ?? {}).length, 3);
  });

  it('falls back to adventure.land when the GitHub copy does not match its hash', async () => {
    const dir = path.join(directory, 'fallback');
    const result = await syncImages(dir, data, fakeNetwork(files, { corrupt: '/images/a.png' }).fetch);
    assert.ok(result.status === 'synced');
    assert.match((await readManifest(dir))?.files['/images/a.png'] ?? '', /^s256-/);
  });

  it('keeps the previous manifest when more than 2 % of the images fail', async () => {
    const dir = path.join(directory, 'threshold');
    await syncImages(dir, data, fakeNetwork(files).fetch);
    const previous = await readFile(path.join(dir, 'manifest.json'), 'utf8');
    const result = await syncImages(dir, gameData(['/images/a.png', '/images/new.png']), fakeNetwork(files).fetch);
    assert.ok(result.status === 'failed' && result.code === 'images.tooManyFailures');
    assert.equal(await readFile(path.join(dir, 'manifest.json'), 'utf8'), previous);
  });
});

describe('catch-up decision', () => {
  it('syncs images after a data change or when none were ever mirrored, never after a failure', () => {
    assert.ok(needsImages(null, false));
    assert.ok(!needsImages(null, true));
    assert.ok(needsImages({ status: 'unchanged', meta: { etag: null, version: 1, hash: 'h', sections: [], fetchedAt: '', checkedAt: '' } }, false));
    assert.ok(!needsImages({ status: 'failed', code: 'gameData.unreachable', meta: null }, false));
  });
});

describe('asset route', () => {
  const settings: SettingsHolder = {
    state: () => ({ status: 'missing', file: 'x' }),
    check: () => Promise.resolve({ ok: false, error: { code: 'x' } }),
    save: () => Promise.resolve({ ok: false, error: { code: 'x' } }),
    client: missingSettings.client,
  };

  it('serves mirrored images with an immutable cache and refuses other names', async () => {
    const dir = path.join(directory, 'incremental');
    const name = (await readManifest(dir))?.files['/images/a.png'] ?? '';
    const app = testApp({ settings, assetsDirectory: dir });
    const response = await app.request(`/game-assets/${name}`, { headers: { host: '127.0.0.1' } });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('cache-control') ?? '', /immutable/);
    assert.equal((await app.request('/game-assets/manifest.json', { headers: { host: '127.0.0.1' } })).status, 404);
  });
});
