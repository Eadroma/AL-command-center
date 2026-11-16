/** Listbox keyboard rules (WAI-ARIA single-select). */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { listboxAction } from '../src/ui/listbox-keys.ts';

describe('listboxAction', () => {
  it('moves within bounds', () => {
    assert.deepEqual(listboxAction('ArrowDown', 0, 2), { kind: 'move', index: 1 });
    assert.deepEqual(listboxAction('ArrowDown', 1, 2), { kind: 'move', index: 1 });
    assert.deepEqual(listboxAction('ArrowUp', 0, 2), { kind: 'move', index: 0 });
    assert.deepEqual(listboxAction('End', 0, 5), { kind: 'move', index: 4 });
    assert.deepEqual(listboxAction('Home', 3, 5), { kind: 'move', index: 0 });
  });

  it('selects with Enter or Space, closes with Escape or Tab, ignores other keys', () => {
    assert.deepEqual(listboxAction('Enter', 0, 2), { kind: 'select' });
    assert.deepEqual(listboxAction(' ', 0, 2), { kind: 'select' });
    assert.deepEqual(listboxAction('Escape', 0, 2), { kind: 'close' });
    assert.deepEqual(listboxAction('Tab', 0, 2), { kind: 'close' });
    assert.deepEqual(listboxAction('a', 0, 2), { kind: 'none' });
  });
});
