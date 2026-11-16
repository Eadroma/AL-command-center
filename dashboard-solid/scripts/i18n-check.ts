/**
 * `pnpm i18n:check`: fails on dictionary keys no source file uses, warns on French texts identical to English.
 * Missing or extra keys are already compile errors (`satisfies` in each language file).
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { en } from '../src/i18n/en/index.ts';
import { fr } from '../src/i18n/fr/index.ts';
import { findUnusedKeys, findUntranslated, flattenKeys } from './lib/i18n-keys.ts';

/** Texts that are legitimately identical in every language. */
const identicalAllowed = ['languages.', 'settings.port', 'settings.stepOptions', 'classes.mage', 'classes.paladin'];

const sourceRoot = path.resolve(import.meta.dirname, '..', 'src');
const sources = readdirSync(sourceRoot, { recursive: true, encoding: 'utf8' })
  // Dictionaries define keys; every other file, i18n helpers included, may use them.
  .filter((file) => /\.tsx?$/.test(file) && !/^i18n[\\/](en|fr)[\\/]/.test(file) && !file.startsWith('__lint-fixture__'))
  .map((file) => readFileSync(path.join(sourceRoot, file), 'utf8'));

const unused = findUnusedKeys(flattenKeys(en), sources);
const untranslated = findUntranslated(en, fr, identicalAllowed);

for (const key of untranslated) {
  console.warn(`warning: "${key}" is identical in English and French`);
}
if (unused.length > 0) {
  console.error(`error: ${unused.length} unused key(s): ${unused.join(', ')}`);
  process.exit(1);
}
console.log(`i18n: ${flattenKeys(en).length} keys, all used, ${untranslated.length} identical text(s).`);
