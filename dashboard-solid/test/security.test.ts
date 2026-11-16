/** Local-mode guards: Host, Origin, CSRF token and the telemetry exception. */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Hono } from 'hono';
import { CSRF_HEADER, GAME_ORIGIN, hostnameOf, localGuards, TELEMETRY_PATH } from '../server/security.ts';
import type { SettingsHolder } from '../server/settings/holder.ts';
import { missingSettings, testApp } from './helpers/fakes.ts';

const token = 'test-token';
const local = { host: '127.0.0.1:9321' };

function guardedApp(): Hono {
  const app = new Hono();
  app.use('*', localGuards(token));
  app.get('/api/read', (context) => context.json({ ok: true }));
  app.post('/api/write', (context) => context.json({ ok: true }));
  app.post(TELEMETRY_PATH, (context) => context.json({ ok: true }));
  return app;
}

async function codeOf(response: Response): Promise<unknown> {
  const body: unknown = await response.json();
  return typeof body === 'object' && body !== null && 'code' in body ? body.code : undefined;
}

describe('hostnameOf', () => {
  it('drops the port, keeps IPv6 brackets', () => {
    assert.equal(hostnameOf('127.0.0.1:5173'), '127.0.0.1');
    assert.equal(hostnameOf('[::1]:9321'), '[::1]');
    assert.equal(hostnameOf(undefined), '');
  });
});

describe('Host check', () => {
  it('rejects a foreign Host (DNS rebinding)', async () => {
    const response = await guardedApp().request('/api/read', { headers: { host: 'evil.example' } });
    assert.equal(response.status, 403);
    assert.equal(await codeOf(response), 'http.forbiddenHost');
  });

  it('accepts loopback names on any port (direct or through Vite)', async () => {
    for (const host of ['127.0.0.1:9321', 'localhost:5173', '[::1]:9321']) {
      assert.equal((await guardedApp().request('/api/read', { headers: { host } })).status, 200, host);
    }
  });
});

describe('writes', () => {
  it('need the CSRF token', async () => {
    const response = await guardedApp().request('/api/write', { method: 'POST', headers: local });
    assert.equal(response.status, 403);
    assert.equal(await codeOf(response), 'http.invalidCsrf');
  });

  it('refuse a foreign Origin even with the token', async () => {
    const headers = { ...local, origin: 'https://evil.example', [CSRF_HEADER]: token };
    const response = await guardedApp().request('/api/write', { method: 'POST', headers });
    assert.equal(await codeOf(response), 'http.forbiddenOrigin');
  });

  it('pass with the token from the dashboard origin, or without Origin (local tools)', async () => {
    const fromDashboard = { ...local, origin: 'http://127.0.0.1:5173', [CSRF_HEADER]: token };
    assert.equal((await guardedApp().request('/api/write', { method: 'POST', headers: fromDashboard })).status, 200);
    assert.equal((await guardedApp().request('/api/write', { method: 'POST', headers: { ...local, [CSRF_HEADER]: token } })).status, 200);
  });
});

describe('telemetry exception', () => {
  it('accepts adventure.land without the CSRF token and sends CORS headers', async () => {
    const response = await guardedApp().request(TELEMETRY_PATH, { method: 'POST', headers: { ...local, origin: GAME_ORIGIN } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), GAME_ORIGIN);
  });

  it('answers the preflight', async () => {
    const response = await guardedApp().request(TELEMETRY_PATH, { method: 'OPTIONS', headers: { ...local, origin: GAME_ORIGIN } });
    assert.equal(response.status, 204);
    assert.match(response.headers.get('access-control-allow-methods') ?? '', /POST/);
  });

  it('rejects other origins', async () => {
    const response = await guardedApp().request(TELEMETRY_PATH, { method: 'POST', headers: { ...local, origin: 'https://evil.example' } });
    assert.equal(response.status, 403);
  });
});

describe('real app', () => {
  const settings: SettingsHolder = {
    state: () => ({ status: 'missing', file: 'x' }),
    check: () => Promise.resolve({ ok: false, error: { code: 'mcp.missingToken' } }),
    save: () => Promise.resolve({ ok: false, error: { code: 'mcp.missingToken' } }),
    client: missingSettings.client,
  };
  const app = testApp({ settings, csrfToken: token });

  it('hands the token to same-origin pages without any CORS header', async () => {
    const response = await app.request('/api/session', { headers: local });
    assert.deepEqual(await response.json(), { csrfToken: token });
    assert.equal(response.headers.get('access-control-allow-origin'), null);
  });

  it('guards every route', async () => {
    assert.equal((await app.request('/api/settings', { headers: { host: 'evil.example' } })).status, 403);
  });
});
