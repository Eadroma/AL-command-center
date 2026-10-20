import fs from 'node:fs';
import path from 'node:path';

// Publication is an allowlist: an unrelated local project cannot slip into an export.
const roots = ['code', 'combat', 'tests', 'tools', 'docs', '.github'];
const rootFiles = ['README.md', 'CONTRIBUTING.md', 'SECURITY.md', 'THIRD_PARTY_NOTICES.md', '.gitignore', '.gitattributes', '.editorconfig', '.nvmrc', 'package.json'];
const appFiles = ['README.md', 'CONTRIBUTING.md', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'index.html', 'tsconfig.json', 'tsconfig.app.json', 'tsconfig.node.json', 'vite.config.ts', 'vitest.config.ts', '.gitignore', '.oxlintrc.json'];
const excluded = new Set(['node_modules', '.git', 'dist', 'dist-ssr', '.tmp', '.vitest', 'coverage', 'data', 'code-backups', 'bundles', '.cursor', '.local-archive', '.release']);
export function publicFiles(root) {
  const files = [];
  function walk(relative) {
    const absolute = path.join(root, relative);
    if (!fs.existsSync(absolute)) return;
    const info = fs.lstatSync(absolute);
    if (info.isSymbolicLink()) throw Error(`Symlink excluded from publication: ${relative}`);
    if (info.isDirectory()) {
      for (const name of fs.readdirSync(absolute).sort()) if (!excluded.has(name)) walk(path.posix.join(relative, name));
      return;
    }
    if (/(?:^|\/)(?:\.env(?:\..*)?|credentials\.json|telemetry\.json|deployments\.json)$/.test(relative)) return;
    if (/\.(?:log|sqlite(?:-shm|-wal)?|db|tsbuildinfo)$/.test(relative)) return;
    // Historical screenshots can contain account data; publish only explicitly reviewed images.
    if (/(?:^|\/)docs\//.test(relative) && !/\.(?:md|txt)$/.test(relative)) return;
    if (relative.startsWith('tools/') && !/\.(?:mjs|cjs|js)$/.test(relative)) return;
    files.push(relative);
  }
  for (const name of rootFiles) walk(name);
  for (const name of roots) walk(name);
  for (const name of appFiles) walk(`dashboard-v2/${name}`);
  for (const name of ['src', 'shared', 'server', 'tests', 'examples', 'docs', 'public']) walk(`dashboard-v2/${name}`);
  return [...new Set(files)].sort();
}
