/**
 * `pnpm game:update`: updates game data and images without starting the dashboard.
 * Shares the server's lock, so it waits for nothing and never runs at the same time as the server's job.
 * Exit code 0 = up to date or updated, 1 = failed, 2 = another update is running.
 * Sets process.exitCode instead of calling process.exit(): on Windows, exiting while fetch closes its
 * keep-alive sockets crashes Node (libuv assertion in src/win/async.c), seen on 2026-10-26.
 */
import path from 'node:path';
import { createGameDataJob } from '../server/game-data/job.ts';
import { createGameDataService } from '../server/game-data/service.ts';
import { gameDataDirectory } from '../server/game-data/store.ts';
import { dataRootFor, settingsFile } from '../server/settings/paths.ts';
import { loadSettings } from '../server/settings/store.ts';

const loaded = await loadSettings(settingsFile(process.env));
const dataRoot = dataRootFor(loaded.status === 'ready' ? loaded.settings : null, process.env);
const service = await createGameDataService({ data: gameDataDirectory(dataRoot), assets: path.join(dataRoot, 'game-assets') });
const job = await createGameDataJob({
  service,
  directory: gameDataDirectory(dataRoot),
  checkEveryHours: 24,
  log: (line) => { console.log(line); },
});

const result = await job.run('cli');
if (result === 'busy') {
  console.error('Another game data update is running (dashboard or another terminal). Try again in a minute.');
  process.exitCode = 2;
} else {
  console.log(`${result.status} in ${String(result.durationMs ?? 0)} ms — data folder: ${dataRoot}`);
  process.exitCode = result.status === 'failed' ? 1 : 0;
}
