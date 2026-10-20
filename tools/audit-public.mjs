import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { publicFiles } from './repository-files.mjs';

export function audit(root, files = publicFiles(root)) {
  const findings = []; let bytes = 0;
  // Findings contain locations only, never matching secrets or surrounding text.
  const rules = [
    ['credential', /\bBearer\s+[A-Za-z0-9._~+\/-]{24,}/g],
    ['credential', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|sk-(?:proj-)?[A-Za-z0-9_-]{30,})/g],
    ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
    ['credential', /["'](?:token|password|session|ticket|AL_MCP_TOKEN)["']\s*[:=]\s*["']([A-Za-z0-9_./+\-=]{24,})["']/gi],
    ['personal-path', /(?:C:[\\/]Users[\\/]bouko|\/Users\/bouko|\/home\/bouko)/gi],
  ];
  for (const file of files) {
    const data = fs.readFileSync(path.join(root, file)); bytes += data.length;
    if (data.length > 50 * 1024 * 1024) findings.push({ file, type: 'large-file', line: 0 });
    if (!/\.(?:[cm]?js|tsx?|json|ya?ml|md|txt|html|css|scss|ps1|py|sql)$/.test(file) && !['.gitignore', '.gitattributes', '.editorconfig'].includes(path.basename(file))) continue;
    const text = data.toString('utf8');
    for (const [type, pattern] of rules) {
      pattern.lastIndex = 0;
      for (const match of text.matchAll(pattern)) {
        // Explicit test values are not credentials. Keep this exception narrow.
        if (match[1] && /^(?:test[-_]|example[-_]|placeholder[-_]|fake[-_])/i.test(match[1])) continue;
        findings.push({ file, type, line: text.slice(0, match.index).split('\n').length });
      }
    }
  }
  return { files: files.length, bytes, findings, scope: 'Explicit publication allowlist; pattern scan, not a proof that no secret exists.' };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(process.argv[2] || path.join(import.meta.dirname, '..'));
  const result = audit(root);
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.findings.length ? 1 : 0;
}
