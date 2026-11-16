/** Deployment preview (writes nothing), CODE history and rollback, telemetry stripping, against a fake game. */
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { createCatalogue } from '../server/builder/catalogue.ts';
import { withoutTelemetry } from '../server/deploy/history.ts';
import { createDeployService } from '../server/deploy/service.ts';
import { memoryDeploymentFile } from '../server/deploy/state-file.ts';
import { openProfileStore } from '../server/profile/store.ts';
import { createTelemetryStore } from '../server/telemetry/store.ts';
import type { Profile } from '../shared/profile.ts';
import { codeDirectory, enabled, facts, profile, settingsFor, setup } from './helpers/deploy-setup.ts';
import { fakeGame, WRITE_METHODS } from './helpers/fake-game.ts';

let dataRoot = '';
before(async () => { dataRoot = await mkdtemp(path.join(os.tmpdir(), 'alcc-deploy-')); });
after(async () => { await rm(dataRoot, { recursive: true, force: true }); });

describe('deployment preview', () => {
  const [hero = ''] = enabled;

  it('builds and compares without writing anything, even while deployment is locked', async () => {
    const game = fakeGame({ online: enabled });
    const deployer = await setup(game, { dataRoot });
    const deployed = await deployer.service.deploy(hero, deployer.revision, false);
    assert.ok(deployed.ok);
    game.calls.length = 0;
    const locked = createDeployService({
      settings: settingsFor(game, false), profiles: profileStoreWith({ ...profile, name: 'Renamed party' }), telemetry: createTelemetryStore([], () => undefined),
      scripts: createCatalogue(codeDirectory), facts: () => facts, codeDirectory, dataRoot, file: memoryDeploymentFile(),
    });
    const outcome = await locked.preview(1);
    assert.ok(outcome.ok, outcome.ok ? '' : outcome.error.code);
    assert.ok(!game.calls.some((call) => WRITE_METHODS.has(call.method)));
    const heroPreview = outcome.result.characters.find((entry) => entry.name === hero);
    assert.deepEqual([heroPreview?.comparison, heroPreview?.sourceChanged], ['slot', false]);
    assert.deepEqual(heroPreview?.changes.map((change) => change.key), ['__ALCC.profile']);
    const others = outcome.result.characters.filter((entry) => entry.name !== hero);
    assert.ok(others.every((entry) => entry.comparison === 'noSlot' && entry.changes.length > 0));
  });

  it('refuses an outdated revision', async () => {
    const { service, revision } = await setup(fakeGame(), { dataRoot });
    assert.deepEqual(await service.preview(revision + 1), { ok: false, error: { code: 'deploy.staleProfile' } });
  });
});

describe('history and rollback', () => {
  const [hero = ''] = enabled;

  it('restores a backup with a fresh telemetry ticket, after backing up what it replaces', async () => {
    const game = fakeGame({ online: [hero], slots: { 50: { name: `CC_${hero}`, version: 1, code: 'var CONFIG = {"NAME":"old"};' } } });
    const { service, revision } = await setup(game, { dataRoot });
    assert.ok((await service.deploy(hero, revision, false)).ok);
    const history = await service.history();
    const original = history.find((entry) => entry.character === hero && entry.slot === '50');
    assert.ok(original !== undefined);
    const count = history.length;
    const restored = await service.rollback(original.id);
    assert.deepEqual([restored.ok, restored.ok ? restored.deployment.stage : null], [true, 'rollbackRequested']);
    const code = game.slots.get('50')?.code ?? '';
    assert.ok(code.startsWith('var CONFIG = {"NAME":"old"};') && code.includes('"http://127.0.0.1:9321/api/telemetry"'));
    assert.equal((await service.history()).length, count + 1);
    assert.equal(game.calls.at(-1)?.method, 'browser_code_reload');
  });

  it('refuses a rollback while deployment is locked, and an unknown backup', async () => {
    const game = fakeGame({ online: [hero] });
    const locked = await setup(game, { dataRoot, deployEnabled: false });
    assert.deepEqual(await locked.service.rollback('00000000-0000-0000-0000-000000000000'), { ok: false, error: { code: 'deploy.disabled' } });
    const open = await setup(game, { dataRoot });
    assert.deepEqual(await open.service.rollback('00000000-0000-0000-0000-000000000000'), { ok: false, error: { code: 'deploy.unknownBackup' } });
    assert.deepEqual(game.calls, []);
  });
});

describe('telemetry stripping', () => {
  it('removes only our own reporter, for the right character', () => {
    const reporter = `\n; (function(){\n var endpoint="http://127.0.0.1:9320/api/telemetry", ticket="${'b'.repeat(64)}", expected="Hero";\n})();\n`;
    assert.equal(withoutTelemetry(`var a = 1;${reporter}`, 'Hero'), 'var a = 1;\n; ');
    assert.equal(withoutTelemetry(`var a = 1;${reporter}`, 'Other'), `var a = 1;${reporter}`);
    const foreign = 'var a = 1;\n(function(){ var endpoint="https://evil.example/collect", ticket="x", expected="Hero"; })();';
    assert.equal(withoutTelemetry(foreign, 'Hero'), foreign);
  });
});

function profileStoreWith(value: Profile): ReturnType<typeof openProfileStore> {
  const store = openProfileStore(':memory:');
  store.write(value, null, 'test');
  return store;
}
