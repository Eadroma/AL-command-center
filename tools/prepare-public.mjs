import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { publicFiles } from './repository-files.mjs';
import { audit } from './audit-public.mjs';

const root = path.resolve(import.meta.dirname, '..');
const destination = path.resolve(root, process.argv[2] || '.release/public-candidate');
if (!destination.startsWith(path.join(root, '.release') + path.sep)) throw Error('Export must be a new directory inside .release/.');
if (fs.existsSync(destination)) throw Error('Destination already exists. Choose a new directory; exports never overwrite or delete files.');
const files = publicFiles(root), result = audit(root, files);
if (result.findings.length) { console.error(JSON.stringify(result, null, 2)); process.exit(1); }
fs.mkdirSync(destination, { recursive: true });
const manifest = [];
for (const file of files) {
  const source = path.join(root, file), output = path.join(destination, file);
  fs.mkdirSync(path.dirname(output), { recursive: true }); fs.copyFileSync(source, output);
  manifest.push({ file, bytes: fs.statSync(output).size, sha256: crypto.createHash('sha256').update(fs.readFileSync(output)).digest('hex') });
}
fs.writeFileSync(path.join(destination, 'PUBLIC-MANIFEST.json'), JSON.stringify({ schema: 1, files: manifest }, null, 2) + '\n');
console.log(JSON.stringify({ destination: path.relative(root, destination), files: result.files, bytes: result.bytes, note: 'Local review candidate only. Licensing review is separate; nothing was published.' }, null, 2));
