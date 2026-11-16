/** Shared test doubles for services the app needs but a given test does not exercise. */
import os from 'node:os';
import path from 'node:path';
import type { Hono } from 'hono';
import type { AppOptions } from '../../server/app.ts';
import { createApp } from '../../server/app.ts';
import type { DeployService } from '../../server/deploy/service.ts';
import type { GameDataJob } from '../../server/game-data/job.ts';
import type { GameDataService } from '../../server/game-data/service.ts';
import type { SettingsHolder } from '../../server/settings/holder.ts';
import { openProfileStore } from '../../server/profile/store.ts';
import { createTeamFeed } from '../../server/telemetry/feed.ts';
import { createTelemetryStore } from '../../server/telemetry/store.ts';

export const emptyGameData: GameDataService = {
  status: () => ({ status: 'empty' }),
  searchItems: () => [],
  refresh: () => Promise.resolve({ status: 'failed', code: 'gameData.unreachable', meta: null }),
  isStale: () => true,
  refreshImages: () => Promise.resolve(null),
  hasImages: () => false,
  assetUrls: () => ({}),
  directories: () => ({ data: '.', assets: '.' }),
  characterSprites: () => Promise.resolve({ skins: {}, classes: {} }),
  terrain: () => null,
  facts: () => null,
  monsters: () => Promise.resolve([]),
  loadoutCatalogue: () => null,
};

export const idleJob: GameDataJob = {
  state: () => ({ status: 'idle', trigger: null, startedAt: null, finishedAt: null, durationMs: null, summary: [] }),
  run: () => Promise.resolve('busy'),
  isRunning: () => false,
  schedule: () => () => undefined,
};

export const idleDeploy: DeployService = {
  state: () => ({ enabled: false, characters: {}, previewedRevision: null }),
  deploy: () => Promise.resolve({ ok: false, error: { code: 'deploy.disabled' } }),
  deployParty: () => Promise.resolve({ ok: false, error: { code: 'deploy.disabled' } }),
  control: () => Promise.resolve({ ok: false, error: { code: 'deploy.disabled' } }),
  preview: () => Promise.resolve({ ok: false, error: { code: 'deploy.noProfile' } }),
  history: () => Promise.resolve([]),
  rollback: () => Promise.resolve({ ok: false, error: { code: 'deploy.disabled' } }),
};

export const missingSettings: SettingsHolder = {
  state: () => ({ status: 'missing', file: 'x' }),
  check: () => Promise.resolve({ ok: false, error: { code: 'mcp.missingToken' } }),
  save: () => Promise.resolve({ ok: false, error: { code: 'mcp.missingToken' } }),
  client: () => ({ call: () => Promise.resolve({ ok: false, error: { code: 'mcp.missingToken' } }) }),
};

/** The real app with harmless defaults; each test overrides only what it exercises. */
export function testApp(overrides: Partial<AppOptions> = {}): Hono {
  const telemetry = overrides.telemetry ?? createTelemetryStore([], () => undefined);
  return createApp({
    distDirectory: null,
    settings: missingSettings,
    gameData: emptyGameData,
    job: idleJob,
    telemetry,
    feed: createTeamFeed({ store: telemetry, relayV2Url: '' }),
    assetsDirectory: '.',
    attentionFile: path.join(os.tmpdir(), `alcc-attention-${String(process.pid)}.json`),
    profiles: openProfileStore(':memory:'),
    deploy: idleDeploy,
    scripts: () => [],
    csrfToken: 'csrf',
    ...overrides,
  });
}
