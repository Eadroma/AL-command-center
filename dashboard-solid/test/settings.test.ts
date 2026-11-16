/** settings.json: schema, file location, loading states, environment priority, atomic writes. */
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { toSettingsResponse } from '../server/routes/settings.ts';
import { appDirectory, settingsFile } from '../server/settings/paths.ts';
import { applyEnvironment, loadSettings, saveSettings } from '../server/settings/store.ts';
import { settingsSchema } from '../shared/settings.ts';

const root = path.resolve(import.meta.dirname, '..');
const minimal = { version: 1, account: { mcpToken: 'secret-token' }, game: { region: 'EU', server: 'III' } };
let directory = '';

before(async () => { directory = await mkdtemp(path.join(os.tmpdir(), 'alcc-settings-')); });
after(async () => { await rm(directory, { recursive: true, force: true }); });

describe('settingsSchema', () => {
  it('accepts settings.example.json as shipped', async () => {
    const example: unknown = JSON.parse(await readFile(path.join(root, 'settings.example.json'), 'utf8'));
    assert.equal(settingsSchema.safeParse(example).success, true);
  });

  it('fills defaults for sections an older file does not have', () => {
    const settings = settingsSchema.parse(minimal);
    assert.equal(settings.dashboard.port, 9320);
    assert.equal(settings.deploy.enabled, true);
    assert.equal(settings.market.enabled, false);
  });
});

describe('settingsFile', () => {
  it('uses the application folder, never the code folder', () => {
    assert.equal(appDirectory({ LOCALAPPDATA: 'C:\\Users\\x\\AppData\\Local' }, 'win32'), path.join('C:\\Users\\x\\AppData\\Local', 'ALCC'));
    assert.match(settingsFile({}, 'linux'), /alcc[\\/]settings\.json$/);
  });

  it('lets ALCC_SETTINGS point elsewhere', () => {
    assert.equal(settingsFile({ ALCC_SETTINGS: path.join(directory, 'custom.json') }), path.join(directory, 'custom.json'));
  });
});

describe('loadSettings', () => {
  it('reports a missing file without throwing', async () => {
    const state = await loadSettings(path.join(directory, 'absent.json'));
    assert.equal(state.status, 'missing');
  });

  it('reports invalid JSON and invalid values as codes, never sentences', async () => {
    const broken = path.join(directory, 'broken.json');
    await writeFile(broken, '{ not json');
    assert.deepEqual(await loadSettings(broken), { status: 'invalid', file: broken, issues: [{ path: '', code: 'invalid_json' }] });

    const wrong = path.join(directory, 'wrong.json');
    await writeFile(wrong, JSON.stringify({ ...minimal, dashboard: { port: 80 } }));
    const state = await loadSettings(wrong);
    assert.ok(state.status === 'invalid');
    assert.ok(state.issues.some((issue) => issue.path === 'dashboard.port' && issue.code === 'too_small'));
  });
});

describe('applyEnvironment', () => {
  const settings = settingsSchema.parse(minimal);

  it('lets environment variables win over the file', () => {
    const merged = applyEnvironment(settings, { AL_MCP_TOKEN: 'from-env', ALCC_PORT: '9321' });
    assert.equal(merged.account.mcpToken, 'from-env');
    assert.equal(merged.dashboard.port, 9321);
  });

  it('keeps the file values when the variables are absent or empty', () => {
    const merged = applyEnvironment(settings, { AL_MCP_TOKEN: '', ALCC_PORT: '' });
    assert.equal(merged.account.mcpToken, 'secret-token');
    assert.equal(merged.dashboard.port, 9320);
  });
});

describe('saveSettings', () => {
  it('writes a valid file atomically and leaves no temporary file', async () => {
    const file = path.join(directory, 'nested', 'settings.json');
    await saveSettings(file, minimal);
    assert.equal((await loadSettings(file)).status, 'ready');
    assert.deepEqual((await readdir(path.dirname(file))).filter((name) => name.endsWith('.tmp')), []);
  });

  it('refuses invalid settings and keeps the previous file', async () => {
    const file = path.join(directory, 'keep.json');
    await saveSettings(file, minimal);
    await assert.rejects(saveSettings(file, { ...minimal, version: 2 }));
    assert.equal((await loadSettings(file)).status, 'ready');
  });
});

describe('toSettingsResponse', () => {
  it('never exposes the token', () => {
    const response = toSettingsResponse({ status: 'ready', file: 'x', settings: settingsSchema.parse(minimal) });
    assert.doesNotMatch(JSON.stringify(response), /secret-token/);
    assert.ok(response.status === 'ready' && response.settings.hasToken);
  });
});
