// Keep CODE slots standalone for browser, Mainframe and caracAL.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const marker = '// BEGIN GENERATED COMBAT';
const shared = fs.readFileSync(path.join(root, 'combat/formation.js'), 'utf8');
for (const name of ['eadroma-warrior', 'aedroma-priest', 'droma-ranger', 'tonerre-mage']) {
  const file = path.join(root, 'code', name + '.js');
  const source = fs.readFileSync(file, 'utf8').split(marker)[0].trimEnd();
  fs.writeFileSync(file, source + '\n\n' + marker + '\n' + shared + '\n// END GENERATED COMBAT\n');
}
