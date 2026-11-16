/**
 * `pnpm dev`: runs the Hono server (restarted on change by `node --watch`) and the Vite dev server together.
 * Vite relays /api and /live to the server. Stopping one process stops both.
 */
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import path from 'node:path';
import { resolvePort } from '../server/config.ts';
import { settingsFile } from '../server/settings/paths.ts';
import { applyEnvironment, loadSettings } from '../server/settings/store.ts';

// Same resolution as the server (environment, then settings.json, then default), passed to both processes
// so Vite never relays to another service on the default port (dashboard-v2 runs on 9320).
const loaded = await loadSettings(settingsFile(process.env));
const port = String(loaded.status === 'ready' ? applyEnvironment(loaded.settings, process.env).dashboard.port : resolvePort(process.env));
const environment = { ...process.env, ALCC_PORT: port, ALCC_SERVE_UI: '0' };
// Run Vite through Node directly: no shell, so paths with spaces ("Program Files") and arguments stay intact.
const viteBin = path.resolve(import.meta.dirname, '..', 'node_modules', 'vite', 'bin', 'vite.js');

function run(name: string, command: string, args: readonly string[]): ChildProcess {
  const child = spawn(command, args, { env: environment, stdio: ['ignore', 'pipe', 'pipe'] });
  const prefix = (chunk: Buffer): string => chunk.toString().replace(/^(?=.)/gm, `[${name}] `);
  child.stdout.on('data', (chunk: Buffer) => { process.stdout.write(prefix(chunk)); });
  child.stderr.on('data', (chunk: Buffer) => { process.stderr.write(prefix(chunk)); });
  return child;
}

const children = [
  run('api', process.execPath, ['--watch', 'server/index.ts']),
  run('ui', process.execPath, [viteBin]),
];

let stopping = false;
function stopAll(code: number): void {
  if (stopping) {
    return;
  }
  stopping = true;
  for (const child of children) {
    child.kill();
  }
  process.exitCode = code;
}

for (const child of children) {
  child.once('exit', (code) => { stopAll(code ?? 0); });
}
process.once('SIGINT', () => { stopAll(0); });
process.once('SIGTERM', () => { stopAll(0); });
