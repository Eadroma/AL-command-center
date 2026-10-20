import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// No listening socket, account credential or game action: exercise local routes in-process.
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'al-dashboard-smoke-'));
process.env.ALCC_DATA_DIR = temporary;
process.env.AL_CODE_DIR = path.resolve(import.meta.dirname, '../code');
process.env.ALCC_CARACAL_DIR = path.join(temporary, 'no-caracal');
delete process.env.AL_MCP_TOKEN;
process.env.ALCC_DISABLE_LEGACY_CREDENTIALS = '1';
const { createServer } = await import('../dashboard-v2/server/index.ts');
let app;
try {
  app = await createServer();
  const headers = { host: `127.0.0.1:${process.env.ALCC_PORT || 9320}` };
  const health = await app.inject({ method: 'GET', url: '/api/health', headers });
  const bootstrap = await app.inject({ method: 'GET', url: '/api/bootstrap', headers });
  const page = await app.inject({ method: 'GET', url: '/', headers });
  const body = bootstrap.json();
  if (health.statusCode !== 200 || bootstrap.statusCode !== 200 || page.statusCode !== 200) throw Error('Dashboard routes failed the smoke check');
  if (body.profile.characters.some(c => c.enabled)) throw Error('Fresh profile unexpectedly enables a character');
  if (body.runtime.browser !== 'not-connected') throw Error('Smoke test unexpectedly found credentials');
  console.log(JSON.stringify({ health: 200, bootstrap: 200, ui: 200, activeCharacters: 0, credentials: false, scripts: body.catalog.scripts.length }));
} finally {
  await app?.close();
  // SQLite can remain open until process exit on Windows; leave only synthetic temp data.
}
