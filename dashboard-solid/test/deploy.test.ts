/**
 * Deployment against a fake game (test/helpers/fake-game.ts): lock, Save → Preview → Deploy, slots, backups,
 * read-back check, partial failures, start / stop. Builds real bundles from ../code.
 */
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { CSRF_HEADER } from '../server/security.ts';
import { enabled, profile, setup, unpreviewed } from './helpers/deploy-setup.ts';
import { fakeGame, WRITE_METHODS } from './helpers/fake-game.ts';
import { testApp } from './helpers/fakes.ts';

let dataRoot = '';
before(async () => { dataRoot = await mkdtemp(path.join(os.tmpdir(), 'alcc-deploy-')); });
after(async () => { await rm(dataRoot, { recursive: true, force: true }); });

describe('deployment lock', () => {
  it('refuses every game action while deploy.enabled is false, without calling the game', async () => {
    const game = fakeGame({ online: enabled });
    const { service, revision } = await setup(game, { dataRoot, deployEnabled: false });
    const [hero = ''] = enabled;
    assert.deepEqual(await service.deploy(hero, revision, false), { ok: false, error: { code: 'deploy.disabled' } });
    assert.deepEqual(await service.deployParty(revision), { ok: false, error: { code: 'deploy.disabled' } });
    assert.deepEqual(await service.control(hero, 'stop'), { ok: false, error: { code: 'deploy.disabled' } });
    assert.deepEqual(game.calls, []);
  });
});

describe('deploying one character', () => {
  const [hero = ''] = enabled;

  it('writes a new CC_ slot in the highest free number, verifies it, then requests a reload', async () => {
    const game = fakeGame({ online: [hero], slots: { 100: { name: 'my farm', version: 3, code: 'x' } } });
    const { service, revision } = await setup(game, { dataRoot });
    const outcome = await service.deploy(hero, revision, false);
    assert.ok(outcome.ok, outcome.ok ? '' : outcome.error.code);
    assert.deepEqual([outcome.deployment.stage, outcome.deployment.slot, outcome.deployment.profileRevision], ['reloadRequested', '99', revision]);
    const saved = game.slots.get('99');
    assert.equal(saved?.name, `CC_${hero}`);
    assert.ok(saved.code.includes('__ALCC') && saved.code.includes('"http://127.0.0.1:9321/api/telemetry"'));
    assert.deepEqual(game.calls.map((call) => call.method), ['browser_code_status', 'list_codes', 'save_code', 'get_code', 'browser_code_reload']);
  });

  it('backs up an existing CC_ slot before replacing it', async () => {
    const game = fakeGame({ online: [hero], slots: { 42: { name: `CC_${hero}`, version: 7, code: 'old code' } } });
    const { service, revision } = await setup(game, { dataRoot });
    const outcome = await service.deploy(hero, revision, false);
    assert.ok(outcome.ok);
    assert.equal(outcome.deployment.slot, '42');
    const backups = await readdir(path.join(dataRoot, 'code-backups'));
    const contents = await Promise.all(backups.map(async (file) => readFile(path.join(dataRoot, 'code-backups', file), 'utf8')));
    assert.ok(contents.some((content) => content.includes('"old code"') && content.includes(`"character": "${hero}"`)));
  });

  it('stops before writing when the character is offline, or the profile changed, or two slots share the name', async () => {
    const offline = fakeGame();
    const first = await setup(offline, { dataRoot });
    assert.deepEqual(await first.service.deploy(hero, first.revision, false), { ok: false, error: { code: 'deploy.offline', detail: hero } });
    assert.deepEqual(await first.service.deploy(hero, first.revision + 1, false), { ok: false, error: { code: 'deploy.notPreviewed' } });
    const duplicates = fakeGame({ online: [hero], slots: { 1: { name: `CC_${hero}`, version: 1, code: '' }, 2: { name: `CC_${hero}`, version: 1, code: '' } } });
    const second = await setup(duplicates, { dataRoot });
    assert.deepEqual(await second.service.deploy(hero, second.revision, false), { ok: false, error: { code: 'deploy.duplicateSlots', detail: `CC_${hero}` } });
    assert.ok(![...offline.calls, ...duplicates.calls].some((call) => WRITE_METHODS.has(call.method)));
  });

  it('does not request a reload when the uploaded code does not read back identical', async () => {
    const game = fakeGame({ online: [hero] });
    game.corruptNextSave = true;
    const { service, revision } = await setup(game, { dataRoot });
    const outcome = await service.deploy(hero, revision, false);
    assert.deepEqual([outcome.ok, outcome.ok ? null : outcome.error.code], [false, 'deploy.verifyFailed']);
    assert.ok(!game.calls.some((call) => call.method === 'browser_code_reload'));
    assert.equal(service.state().characters[hero]?.stage, 'failed');
  });

  it('prepares an offline character without starting it', async () => {
    const game = fakeGame();
    const { service, revision } = await setup(game, { dataRoot });
    const outcome = await service.deploy(hero, revision, true);
    assert.deepEqual([outcome.ok, outcome.ok ? outcome.deployment.stage : null], [true, 'prepared']);
    assert.ok(!game.calls.some((call) => call.method === 'browser_code_reload' || call.method === 'browser_code_status'));
  });
});

describe('save, preview, deploy', () => {
  const [hero = ''] = enabled;

  it('refuses to deploy a revision that was not previewed', async () => {
    const game = fakeGame({ online: enabled });
    const { service, revision } = unpreviewed(game, { dataRoot });
    assert.deepEqual(await service.deployParty(revision), { ok: false, error: { code: 'deploy.notPreviewed' } });
    assert.deepEqual(await service.deploy(hero, revision, false), { ok: false, error: { code: 'deploy.notPreviewed' } });
    assert.equal(service.state().previewedRevision, null);
    assert.deepEqual(game.calls, []);
  });

  it('refuses a preview made before the profile was saved again', async () => {
    const game = fakeGame({ online: enabled });
    const { service, revision, profiles } = await setup(game, { dataRoot });
    assert.ok(profiles.write({ ...profile, name: 'Changed' }, revision, 'test').ok);
    assert.deepEqual(await service.deployParty(revision), { ok: false, error: { code: 'deploy.staleProfile' } });
    assert.ok(!game.calls.some((call) => WRITE_METHODS.has(call.method)));
  });
});

describe('deploying the team', () => {
  it('deploys every enabled character, merchant last, and lists the ones that failed', async () => {
    const [offline = '', ...others] = enabled;
    const game = fakeGame({ online: others });
    const { service, revision } = await setup(game, { dataRoot });
    const outcome = await service.deployParty(revision);
    assert.ok(outcome.ok);
    assert.deepEqual(outcome.result.failures, [{ character: offline, error: { code: 'deploy.offline', detail: offline } }]);
    assert.deepEqual([...outcome.result.deployed].sort(), [...others].sort());
    const merchant = profile.characters.find((character) => character.enabled && character.ctype === 'merchant')?.name;
    assert.equal(outcome.result.deployed.at(-1), merchant);
  });
});

describe('start and stop', () => {
  const [hero = ''] = enabled;

  it('starts the character\'s CC_ slot, stops it, and reports what the game says', async () => {
    const game = fakeGame({ online: [hero], slots: { 12: { name: `CC_${hero}`, version: 1, code: 'x' } } });
    const { service } = await setup(game, { dataRoot });
    const started = await service.control(hero, 'start');
    assert.deepEqual([started.ok, started.ok ? [started.deployment.stage, started.deployment.codeRunning] : null], [true, ['startRequested', true]]);
    assert.deepEqual(game.calls.find((call) => call.method === 'browser_code_start')?.args, { character: hero, slot: '12' });
    const stopped = await service.control(hero, 'stop');
    assert.deepEqual([stopped.ok, stopped.ok ? [stopped.deployment.stage, stopped.deployment.codeRunning] : null], [true, ['stopRequested', false]]);
  });

  it('cannot start a character that was never deployed', async () => {
    const { service } = await setup(fakeGame({ online: [hero] }), { dataRoot });
    assert.deepEqual(await service.control(hero, 'start'), { ok: false, error: { code: 'deploy.noSlot', detail: `CC_${hero}` } });
  });
});

describe('deployment routes', () => {
  const headers = { host: '127.0.0.1:9321', 'content-type': 'application/json', [CSRF_HEADER]: 'csrf' };

  it('answers 403 while deployment is locked and 400 for a malformed request', async () => {
    const app = testApp();
    const locked = await app.request('/api/deploy', { method: 'POST', headers, body: JSON.stringify({ character: 'Hero', revision: 1 }) });
    assert.deepEqual([locked.status, await locked.json()], [403, { error: { code: 'deploy.disabled' } }]);
    const malformed = await app.request('/api/control', { method: 'POST', headers, body: JSON.stringify({ character: 'Hero', action: 'explode' }) });
    assert.equal(malformed.status, 400);
    const state = await app.request('/api/deployments', { headers });
    assert.deepEqual(await state.json(), { enabled: false, characters: {}, previewedRevision: null });
  });
});
