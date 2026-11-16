/**
 * `pnpm start`: builds the UI when it has never been built, then runs the server, which serves it.
 * Run `pnpm build` after pulling changes to rebuild.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

if (!existsSync(path.join(root, 'dist', 'index.html'))) {
  process.stdout.write('First start: building the interface…\n');
  const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
  const build = spawnSync(process.execPath, [viteBin, 'build'], { cwd: root, stdio: 'inherit' });
  if (build.status !== 0) {
    process.exit(build.status ?? 1);
  }
}

const server = spawnSync(process.execPath, ['server/index.ts'], { cwd: root, stdio: 'inherit' });
process.exit(server.status ?? 0);
