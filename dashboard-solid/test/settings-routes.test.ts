/** Settings screen backend: token test, save rules and HTTP contract, with a fake game API. */
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { createMcpClient } from '../server/mcp/client.ts';
import { CSRF_HEADER } from '../server/security.ts';
import { createSettingsHolder } from '../server/settings/holder.ts';
import type { SettingsHolder } from '../server/settings/holder.ts';
import { testApp } from './helpers/fakes.ts';

const goodToken = 'good-token';

/** Answers like adventure.land/mcp_api for the two read-only methods. */
const fakeFetch: typeof fetch = (input, init) => {
  const body: unknown = JSON.parse(typeof init?.body === 'string' ? init.body : '{}');
  const token = typeof body === 'object' && body !== null && 'token' in body ? body.token : undefined;
  if (token !== goodToken) {
    return Promise.resolve(Response.json({ failed: true, reason: 'invalid_token' }));
  }
  const url = input instanceof Request ? input.url : input.toString();
  if (url.endsWith('mainframe_list_characters')) {
    return Promise.resolve(Response.json({ success: true, characters: [{ character: 'Eadroma', level: 73, class: 'warrior' }] }));
  }
  return Promise.resolve(Response.json({ success: true, servers: [{ region: 'EU', name: 'III', online: true, players: 12 }] }));
};

const update = { mcpToken: goodToken, region: 'EU', server: 'III', runtime: 'browser', language: 'fr', port: 9321 } as const;
let directory = '';

before(async () => { directory = await mkdtemp(path.join(os.tmpdir(), 'alcc-routes-')); });
after(async () => { await rm(directory, { recursive: true, force: true }); });

async function holderFor(name: string, environment: NodeJS.ProcessEnv = {}): Promise<{ holder: SettingsHolder; file: string }> {
  const file = path.join(directory, name);
  const holder = await createSettingsHolder({
    file, environment, runningPort: () => 9321,
    createClient: (mcpUrl, token) => createMcpClient({ mcpUrl, token, fetch: fakeFetch }),
  });
  return { holder, file };
}

describe('settings holder', () => {
  it('lists characters and servers for a valid token', async () => {
    const { holder } = await holderFor('a.json');
    const result = await holder.check(goodToken);
    assert.ok(result.ok);
    assert.deepEqual(result.value.characters, [{ name: 'Eadroma', level: 73, className: 'warrior' }]);
  });

  it('writes nothing when the token is rejected or the server does not exist', async () => {
    const { holder, file } = await holderFor('b.json');
    assert.deepEqual(await holder.save({ ...update, mcpToken: 'bad' }), { ok: false, error: { code: 'mcp.rejected', detail: 'invalid_token' } });
    assert.deepEqual(await holder.save({ ...update, server: 'IX' }), { ok: false, error: { code: 'settings.unknownServer' } });
    await assert.rejects(readFile(file));
  });

  it('saves, then keeps the saved token when the form leaves it empty', async () => {
    const { holder, file } = await holderFor('c.json');
    assert.ok((await holder.save(update)).ok);
    const second = await holder.save({ ...update, mcpToken: '', language: 'en' });
    assert.ok(second.ok && !second.restartRequired);
    const saved = await readFile(file, 'utf8');
    assert.match(saved, /good-token/);
    assert.match(saved, /"language": "en"/);
  });

  it('never copies AL_MCP_TOKEN into the file', async () => {
    const { holder, file } = await holderFor('d.json', { AL_MCP_TOKEN: goodToken });
    assert.ok((await holder.save({ ...update, mcpToken: '' })).ok);
    assert.doesNotMatch(await readFile(file, 'utf8'), /good-token/);
  });
});

describe('settings routes', () => {
  const headers = { host: '127.0.0.1:9321', 'content-type': 'application/json', [CSRF_HEADER]: 'csrf' };

  it('validates the body at the boundary', async () => {
    const { holder } = await holderFor('e.json');
    const app = testApp({ settings: holder });
    const response = await app.request('/api/settings', { method: 'PUT', headers, body: JSON.stringify({ ...update, port: 80 }) });
    assert.equal(response.status, 400);
  });

  it('returns translated-ready error codes and the saved state without the token', async () => {
    const { holder } = await holderFor('f.json');
    const app = testApp({ settings: holder });
    const rejected = await app.request('/api/settings/test', { method: 'POST', headers, body: JSON.stringify({ mcpToken: 'bad' }) });
    assert.equal(rejected.status, 422);
    const saved = await app.request('/api/settings', { method: 'PUT', headers, body: JSON.stringify(update) });
    assert.equal(saved.status, 200);
    assert.doesNotMatch(await saved.text(), /good-token/);
  });
});
