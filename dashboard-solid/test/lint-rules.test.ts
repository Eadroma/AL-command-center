/**
 * Guards the lint configuration itself: the deliberately wrong fixture must keep triggering every rule below.
 * If a plugin update silently disables a rule, this test fails.
 */
import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';
import { ESLint } from 'eslint';

const root = path.resolve(import.meta.dirname, '..');
const fixture = path.join(root, 'src', '__lint-fixture__', 'Violations.tsx');

const expectedRules = [
  'import-x/no-restricted-paths',
  '@typescript-eslint/no-explicit-any',
  'import-x/no-default-export',
  'solid/no-destructure',
  '@typescript-eslint/no-floating-promises',
  'no-restricted-syntax',
  '@typescript-eslint/strict-boolean-expressions',
  'no-console',
  '@typescript-eslint/no-non-null-assertion',
  'eqeqeq',
  '@typescript-eslint/consistent-type-assertions',
  'i18next/no-literal-string',
  'solid/prefer-show',
  'solid/prefer-for',
];

describe('lint rules', { timeout: 120_000 }, () => {
  it('reports every expected rule on the fixture', async () => {
    const eslint = new ESLint({ cwd: root, ignore: false });
    const [result] = await eslint.lintFiles([fixture]);
    assert.ok(result !== undefined, 'the fixture was not linted');
    const reported = new Set(result.messages.map((message) => message.ruleId));
    const missing = expectedRules.filter((rule) => !reported.has(rule));
    assert.deepEqual(missing, [], `rules no longer reported: ${missing.join(', ')}`);
    assert.equal(result.messages.length, 18, 'the fixture should produce exactly 18 findings');
  });
});
