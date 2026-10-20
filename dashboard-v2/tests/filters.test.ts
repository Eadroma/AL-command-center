import { describe, expect, it } from 'vitest';
import { filterActivity, filterScripts } from '../src/models/filters';
import type { LogEntry, ScriptInfo } from '../src/types';

const entries: LogEntry[] = [
  { id: 1, timestamp: '', level: 'error', source: 'Mage', message: 'Connection lost' },
  { id: 2, timestamp: '', level: 'info', source: 'Mage', message: 'Connection restored' },
  { id: 3, timestamp: '', level: 'error', source: 'Warrior', message: 'Connection lost' },
];
const script: ScriptInfo = {
  id: 'mage', filename: 'mage-v2.js', label: 'Mage V2', ctype: 'mage', kind: 'farm',
  bytes: 1200, hash: 'example', config: { privateSetting: 'not searchable' }, variables: {},
};

describe('catalog and activity filtering', () => {
  it('combines all activity filters with case-insensitive trimmed search', () => {
    expect(filterActivity(entries, { search: ' CONNECTION ', level: 'error', source: 'Mage' }).map(entry => entry.id)).toEqual([1]);
    expect(entries.map(entry => entry.id)).toEqual([1, 2, 3]);
  });
  it('supports empty filters and excludes mismatched sources', () => {
    expect(filterActivity(entries, { search: '', level: '', source: '' })).toEqual(entries);
    expect(filterActivity(entries, { search: '', level: '', source: 'Unknown' })).toEqual([]);
  });
  it('searches script metadata and class without searching CONFIG contents', () => {
    expect(filterScripts([script], ' MAGE-V2 ', 'mage')).toEqual([script]);
    expect(filterScripts([script], 'farm', '')).toEqual([script]);
    expect(filterScripts([script], '', 'warrior')).toEqual([]);
    expect(filterScripts([script], 'not searchable', '')).toEqual([]);
  });
});
