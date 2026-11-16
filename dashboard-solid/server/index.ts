/**
 * Server entry point, run directly by Node 24 type stripping (`node server/index.ts`).
 * Serves the API, the `/live` WebSocket and, when built, the UI. Shuts down cleanly on SIGINT/SIGTERM.
 */
import path from 'node:path';
import { serve, upgradeWebSocket } from '@hono/node-server';
import { WebSocketServer } from 'ws';
import { createApp } from './app.ts';
import { distDirectory, resolvePort } from './config.ts';
import { createGameDataJob } from './game-data/job.ts';
import { createGameDataService } from './game-data/service.ts';
import { gameDataDirectory } from './game-data/store.ts';
import { describeListenError } from './listen-error.ts';
import { createMcpClient } from './mcp/client.ts';
import { createCsrfToken } from './security.ts';
import { createSettingsHolder } from './settings/holder.ts';
import { createCatalogue } from './builder/catalogue.ts';
import { createDeployService } from './deploy/service.ts';
import { deploymentFile } from './deploy/state-file.ts';
import { openProfileStore } from './profile/store.ts';
import { createTeamFeed } from './telemetry/feed.ts';
import { readSessions, writeSessions } from './telemetry/sessions-file.ts';
import { createTelemetryStore } from './telemetry/store.ts';
import { dataRootFor, settingsFile } from './settings/paths.ts';

let port = resolvePort(process.env);
const settings = await createSettingsHolder({
  file: settingsFile(process.env),
  environment: process.env,
  createClient: (mcpUrl, token) => createMcpClient({ mcpUrl, token }),
  runningPort: () => port,
});
const settingsState = settings.state();
if (settingsState.status === 'ready' && settingsState.settings.dashboard.mode === 'hosted') {
  // Hosted mode needs authentication and HTTPS, which do not exist yet: refuse rather than expose the token.
  process.stderr.write('ALCC cannot start: dashboard.mode "hosted" is not available yet. Use "local".\n');
  process.exit(1);
}
// Without valid settings the server still starts on the default port, so the UI can show the Settings screen.
if (settingsState.status === 'ready') {
  port = settingsState.settings.dashboard.port;
}
const ready = settingsState.status === 'ready' ? settingsState.settings : null;
const dataRoot = dataRootFor(ready, process.env);
const assetsDirectory = path.join(dataRoot, 'game-assets');
const gameData = await createGameDataService({ data: gameDataDirectory(dataRoot), assets: assetsDirectory });
const job = await createGameDataJob({
  service: gameData,
  directory: gameDataDirectory(dataRoot),
  checkEveryHours: ready?.gameData.checkEveryHours ?? 24,
  log: (line) => { process.stdout.write(`ALCC ${line}\n`); },
});
const sessionsFile = path.join(dataRoot, 'telemetry', 'sessions.json');
const telemetry = createTelemetryStore(await readSessions(sessionsFile), (sessions) => { void writeSessions(sessionsFile, sessions); });
const feed = createTeamFeed({ store: telemetry, relayV2Url: ready?.migration.relayV2Url ?? '' });
feed.start();
const profiles = openProfileStore(path.join(dataRoot, 'profile.sqlite'));
// game.codeDirectory is relative to this dashboard's folder (../code = the repository's code/ folder).
const codeDirectory = path.resolve(import.meta.dirname, '..', ready?.game.codeDirectory ?? '../code');
const scripts = createCatalogue(codeDirectory);
const deploy = createDeployService({
  settings, profiles, telemetry, scripts, facts: () => gameData.facts(), codeDirectory, dataRoot,
  file: deploymentFile(path.join(dataRoot, 'deployments.json')),
});
const app = createApp({
  distDirectory: process.env['ALCC_SERVE_UI'] === '0' ? null : distDirectory,
  settings,
  gameData,
  job,
  telemetry,
  feed,
  attentionFile: path.join(dataRoot, 'attention.json'),
  profiles,
  deploy,
  scripts,
  assetsDirectory,
  csrfToken: createCsrfToken(),
});

// Catch up at start (the dashboard is not always running), then every 6 hours; never delays the start.
if (ready?.gameData.autoUpdate ?? true) {
  void job.run('startup');
  job.schedule(6 * 3_600_000);
}

// Each /live connection receives the team state at once, then on every change.
app.get('/live', upgradeWebSocket(() => {
  let unsubscribe: (() => void) | null = null;
  return {
    onOpen: (_event, socket) => {
      socket.send(JSON.stringify({ type: 'hello' }));
      unsubscribe = feed.subscribe((team) => { socket.send(JSON.stringify({ type: 'team', team })); });
    },
    onClose: () => { unsubscribe?.(); },
  };
}));

const webSocketServer = new WebSocketServer({ noServer: true });
const server = serve({
  fetch: app.fetch,
  port,
  hostname: '127.0.0.1',
  // @ts-expect-error -- @types/ws declares `noServer?: boolean | undefined`, @hono/node-server 2.1 expects `noServer?: boolean` (exactOptionalPropertyTypes). Remove when either package aligns.
  websocket: { server: webSocketServer },
});

server.once('listening', () => {
  process.stdout.write(`ALCC listening on http://127.0.0.1:${port} (settings: ${settingsState.status}, ${settingsState.file})\n`);
});
server.once('error', (error: NodeJS.ErrnoException) => {
  process.stderr.write(`ALCC cannot start: ${describeListenError(error, port)}\n`);
  process.exit(1);
});

function shutdown(signal: string): void {
  process.stdout.write(`${signal} received, closing\n`);
  webSocketServer.close();
  server.close(() => { process.exit(0); });
  setTimeout(() => { process.exit(1); }, 5000).unref();
}

process.once('SIGINT', () => { shutdown('SIGINT'); });
process.once('SIGTERM', () => { shutdown('SIGTERM'); });
