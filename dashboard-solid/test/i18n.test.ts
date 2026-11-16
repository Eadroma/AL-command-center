/** Dictionary key helpers and locale formatting. */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { findUnusedKeys, findUntranslated, flattenKeys } from '../scripts/lib/i18n-keys.ts';
import { formatAgo, formatGold, formatPercent } from '../src/i18n/format.ts';

describe('flattenKeys', () => {
  it('lists dotted leaf keys, functions included', () => {
    assert.deepEqual(flattenKeys({ a: 'x', b: { c: 'y', d: () => 'z' } }), ['a', 'b.c', 'b.d']);
  });
});

describe('findUnusedKeys', () => {
  const keys = ['common.loading', 'common.unknown', 'languages.fr', 'languages.en'];

  it('keeps keys called literally', () => {
    assert.deepEqual(findUnusedKeys(keys, ["t('common.loading')", 't( \'common.unknown\' )']), ['languages.fr', 'languages.en']);
  });

  it('treats a template key as using its whole prefix', () => {
    assert.deepEqual(findUnusedKeys(keys, ['t(`languages.${code}`)']), ['common.loading', 'common.unknown']);
  });
});

describe('findUntranslated', () => {
  it('reports identical texts outside the allowlist', () => {
    const english = { a: 'Same', b: 'Hello', languages: { fr: 'Français' } };
    const french = { a: 'Same', b: 'Bonjour', languages: { fr: 'Français' } };
    assert.deepEqual(findUntranslated(english, french, ['languages.']), ['a']);
  });
});

describe('format', () => {
  it('groups gold the way each language expects', () => {
    assert.equal(formatGold(1_250_000, 'en'), '1,250,000');
    assert.match(formatGold(1_250_000, 'fr'), /^1\s250\s000$/u);
  });

  it('formats percentages', () => {
    assert.equal(formatPercent(82, 'en'), '82%');
    assert.match(formatPercent(82, 'fr'), /^82\s%$/u);
  });

  it('picks the largest fitting time unit', () => {
    assert.equal(formatAgo(3, 'en'), '3 seconds ago');
    assert.equal(formatAgo(120, 'fr'), 'il y a 2 minutes');
    assert.equal(formatAgo(7200, 'en'), '2 hours ago');
  });
});
