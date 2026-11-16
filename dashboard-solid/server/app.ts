/**
 * HTTP application: guards, API routes, then the compiled UI with a single-page fallback.
 * Exports `AppType` so the UI client is typed end to end.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import type { ScriptInfo } from './builder/catalogue.ts';
import type { DeployService } from './deploy/service.ts';
import type { GameDataJob } from './game-data/job.ts';
import type { GameDataService } from './game-data/service.ts';
import type { ProfileStore } from './profile/store.ts';
import { accountRoutes, createAccountRoster } from './routes/account.ts';
import { attentionRoutes } from './routes/attention.ts';
import { deployRoutes } from './routes/deploy.ts';
import { gameRoutes } from './routes/game.ts';
import { profileRoutes } from './routes/profile.ts';
import { scriptRoutes } from './routes/scripts.ts';
import { settingsRoutes } from './routes/settings.ts';
import { telemetryRoutes } from './routes/telemetry.ts';
import { localGuards } from './security.ts';
import type { SettingsHolder } from './settings/holder.ts';
import type { TeamFeed } from './telemetry/feed.ts';
import type { TelemetryStore } from './telemetry/store.ts';

export interface AppOptions {
  /** Compiled UI directory; absent in development, where Vite serves the UI. */
  readonly distDirectory: string | null;
  readonly settings: SettingsHolder;
  readonly gameData: GameDataService;
  readonly job: GameDataJob;
  readonly telemetry: TelemetryStore;
  readonly feed: TeamFeed;
  /** File holding the dismissed attention signal keys. */
  readonly attentionFile: string;
  readonly profiles: ProfileStore;
  readonly deploy: DeployService;
  /** Script catalogue read from game.codeDirectory. */
  readonly scripts: () => readonly ScriptInfo[];
  /** Folder of the mirrored game images (content-addressed PNG files). */
  readonly assetsDirectory: string;
  /** Per-process token every write must carry (see security.ts). */
  readonly csrfToken: string;
}

export function createApp(options: AppOptions): Hono {
  const app = new Hono();
  app.use('*', localGuards(options.csrfToken));
  app.get('/api/health', (context) => context.json({ ok: true }));
  // No CORS header here: only pages served from this origin can read the token.
  app.get('/api/session', (context) => context.json({ csrfToken: options.csrfToken }));
  settingsRoutes(app, options.settings);
  const roster = createAccountRoster(options.settings);
  accountRoutes(app, roster);
  profileRoutes(app, { store: options.profiles, settings: options.settings, roster, scripts: options.scripts });
  gameRoutes(app, { gameData: options.gameData, job: options.job, assetsDirectory: options.assetsDirectory });
  telemetryRoutes(app, { store: options.telemetry, feed: options.feed });
  attentionRoutes(app, options.attentionFile);
  deployRoutes(app, options.deploy);
  scriptRoutes(app, options.scripts);

  const dist = options.distDirectory;
  if (dist !== null && existsSync(path.join(dist, 'index.html'))) {
    const root = path.relative(process.cwd(), dist);
    app.use('/*', serveStatic({ root }));
    app.get('*', serveStatic({ root, path: 'index.html' }));
  }
  return app;
}

export type AppType = ReturnType<typeof createApp>;
