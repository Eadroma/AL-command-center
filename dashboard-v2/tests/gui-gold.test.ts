import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.resolve(import.meta.dirname, '../../code/gui.js'), 'utf8');

function sourceFunction(name: string) {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`${name} missing`);
  const body = source.indexOf('{', start);
  let depth = 0;
  for (let index = body; index < source.length; index++) {
    if (source[index] === '{') depth++;
    if (source[index] === '}' && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`${name} is incomplete`);
}

function partyCount(parent: object, character = { name: 'Droma', owner: 'account' }) {
  return vm.runInNewContext(`(${sourceFunction('countPartyChars')})()`, { parent, character });
}

describe('in-game gold meter', () => {
  it('uses a multiplier of one when Lone Wolf has no party object', () => {
    expect(partyCount({ entities: {} })).toBe(1);
    expect(partyCount({ party: {}, entities: {} })).toBe(1);
  });

  it('counts only controlled characters present in the current party', () => {
    expect(partyCount({
      party: { Droma: {}, Aedroma: {}, Stranger: {} },
      entities: { Aedroma: { owner: 'account' }, Stranger: { owner: 'other' } },
    })).toBe(2);
  });

  it('removes the previous loot listener with the EventEmitter API on reload', () => {
    expect(source).toContain('character.removeListener("loot", prev.onLoot)');
  });
});
