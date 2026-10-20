import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { publicFiles } from '../tools/repository-files.mjs';
import { audit } from '../tools/audit-public.mjs';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'al-public-test-'));
  t.after(() => {
    if (!path.resolve(root).startsWith(path.join(os.tmpdir(), 'al-public-test-'))) throw Error('Unexpected temporary path');
    fs.rmSync(root, { recursive: true, force: true });
  });
  return { root, write(file, text = 'example') { const dest = path.join(root, file); fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, text); } };
}
test('publication allowlist excludes local credentials, generated files and unrelated projects', t => {
  const f = fixture(t);
  for (const file of ['README.md', 'code/farmer.js', 'dashboard-v2/vitest.config.ts', 'dashboard-v2/tests/setup.ts']) f.write(file);
  for (const file of ['.cursor/mcp.json', 'sites/personal/index.html', 'data/profile.json', 'backups/code.js', 'dashboard-v2/.tmp/private.json', 'dashboard-v2/node_modules/x/index.js', 'dashboard-v2/docs/account.png', 'dashboard-v2/credentials.json']) f.write(file);
  assert.deepEqual(publicFiles(f.root), ['README.md', 'code/farmer.js', 'dashboard-v2/tests/setup.ts', 'dashboard-v2/vitest.config.ts']);
});
test('scanner reports a secret location without disclosing its contents', t => {
  const f = fixture(t), value = 'ghp_' + 'a'.repeat(40);
  f.write('code/farmer.js', `const value = '${value}';\n`);
  const result = audit(f.root);
  assert.equal(result.findings[0].type, 'credential');
  assert.equal(result.findings[0].file, 'code/farmer.js');
  assert.equal(JSON.stringify(result).includes(value), false);
});
