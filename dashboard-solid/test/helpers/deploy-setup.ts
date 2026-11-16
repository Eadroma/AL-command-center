/**
 * Shared setup of the deployment tests: the anonymised builder fixture profile, game facts, settings pointing at a
 * fake game, and a deploy service (previewed or not). Bundles are built from the real ../code folder.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { createCatalogue } from '../../server/builder/catalogue.ts';
import type { GameFacts } from '../../server/builder/validate.ts';
import { createDeployService } from '../../server/deploy/service.ts';
import type { DeployService } from '../../server/deploy/service.ts';
import { memoryDeploymentFile } from '../../server/deploy/state-file.ts';
import { openProfileStore } from '../../server/profile/store.ts';
import type { SettingsHolder } from '../../server/settings/holder.ts';
import { createTelemetryStore } from '../../server/telemetry/store.ts';
import type { Profile } from '../../shared/profile.ts';
import { profileSchema } from '../../shared/profile.ts';
import type { FakeGame } from './fake-game.ts';
import { missingSettings } from './fakes.ts';

const fixtures = path.join(import.meta.dirname, '..', 'fixtures', 'builder');
export const codeDirectory = path.resolve(import.meta.dirname, '..', '..', '..', 'code');
export const profile: Profile = z.object({ profile: profileSchema }).parse(JSON.parse(await readFile(path.join(fixtures, 'current.json'), 'utf8'))).profile;
const lists = z.object({ upgradeable: z.array(z.string()), compoundable: z.array(z.string()), recipes: z.array(z.string()) }).parse(JSON.parse(await readFile(path.join(fixtures, 'game-facts.json'), 'utf8')));
export const facts: GameFacts = { upgradeable: (item) => lists.upgradeable.includes(item), compoundable: (item) => lists.compoundable.includes(item), hasRecipe: (item) => lists.recipes.includes(item) };
export const enabled = profile.characters.filter((character) => character.enabled).map((character) => character.name);

export function settingsFor(game: FakeGame, deployEnabled: boolean): SettingsHolder {
  const base = missingSettings.state();
  return {
    ...missingSettings,
    state: () => ({
      status: 'ready', file: base.file,
      settings: {
        version: 1, account: { mcpUrl: 'https://adventure.land/mcp', mcpToken: 'fake' }, game: { region: 'EU', server: 'III', runtime: 'browser', codeDirectory: '../code' },
        dashboard: { mode: 'local', publicUrl: '', host: '127.0.0.1', port: 9321, dataDirectory: '', language: 'fr', theme: 'night' },
        gameData: { autoUpdate: true, checkEveryHours: 24, docsEveryDays: 7 }, market: { enabled: false, refreshMinutes: 15 },
        deploy: { enabled: deployEnabled }, migration: { relayV2Url: '' },
      },
    }),
    client: () => game.client,
  };
}

export interface Setup {
  readonly service: DeployService;
  readonly revision: number;
  readonly profiles: ReturnType<typeof openProfileStore>;
}

export interface SetupOptions {
  readonly dataRoot: string;
  readonly deployEnabled?: boolean;
  readonly profile?: Profile;
}

export function unpreviewed(game: FakeGame, options: SetupOptions): Setup {
  const profiles = openProfileStore(':memory:');
  const created = profiles.write(options.profile ?? profile, null, 'test');
  assert.ok(created.ok);
  const service = createDeployService({
    settings: settingsFor(game, options.deployEnabled ?? true), profiles, telemetry: createTelemetryStore([], () => undefined),
    scripts: createCatalogue(codeDirectory), facts: () => facts, codeDirectory, dataRoot: options.dataRoot, file: memoryDeploymentFile(),
  });
  return { service, revision: created.saved.revision, profiles };
}

/** A service whose saved revision was previewed (Save → Preview → Deploy); the preview's read-only calls are forgotten. */
export async function setup(game: FakeGame, options: SetupOptions): Promise<Setup> {
  const ready = unpreviewed(game, options);
  assert.ok((await ready.service.preview(ready.revision)).ok);
  game.calls.splice(0);
  return ready;
}
