import { describe, expect, it } from 'vitest';
import { bankSnapshots, bankSortPreview, filterBankItems, groupBankItems } from '../src/models/bank';
import type { BankItem, Catalog, DeploymentsResponse } from '../src/types';

const items: BankItem[] = [
  { pack: 'items1', slot: 4, name: 'hpot1', level: 0, quantity: 100, category: 'Potions' },
  { pack: 'items0', slot: 2, name: 'fireblade', level: 7, quantity: 1, category: 'Weapons' },
  { pack: 'items0', slot: 1, name: 'mpot1', level: 0, quantity: 50, category: 'Potions' },
];
const catalog = { items: [
  { id: 'hpot1', name: 'High HP Potion' }, { id: 'mpot1', name: 'High MP Potion' }, { id: 'fireblade', name: 'Fire Blade' },
], monsters: [], scripts: [], assets: {}, importedAt: '', sourceDirectory: '' } satisfies Catalog;
const base = { configured: true, caracalAvailable: false, profileVersion: 1, profileServer: { region: 'EU', name: 'I' }, policy: {}, fleet: { ready: true, issues: [], summary: '' } };

describe('bank snapshots', () => {
  it('keeps empty snapshots and sorts newest captures first', () => {
    const deployments = { ...base, characters: {
      Old: { telemetry: { live: false, bank: items, bankAt: 10 } },
      Missing: { telemetry: { live: true } },
      Empty: { telemetry: { live: true, bank: [], bankAt: 20 } },
    } } satisfies DeploymentsResponse;
    expect(bankSnapshots(deployments).map(snapshot => [snapshot.owner, snapshot.items.length])).toEqual([['Empty', 0], ['Old', 3]]);
  });
  it('returns no snapshots while deployment data is unavailable', () => {
    expect(bankSnapshots()).toEqual([]);
  });
});

describe('bank filtering', () => {
  it('searches display names, IDs and packs while combining category filters', () => {
    expect(filterBankItems(items, catalog, { search: 'high hp', category: 'Potions' }).map(item => item.name)).toEqual(['hpot1']);
    expect(filterBankItems(items, catalog, { search: 'items0', category: 'Potions' }).map(item => item.name)).toEqual(['mpot1']);
    expect(filterBankItems(items, catalog, { search: 'fireblade', category: '' }).map(item => item.name)).toEqual(['fireblade']);
  });
  it('sorts groups and items without mutating the telemetry payload', () => {
    const filtered = filterBankItems(items, catalog, { search: '', category: '' });
    expect(filtered.map(item => item.name)).toEqual(['hpot1', 'mpot1', 'fireblade']);
    expect(items.map(item => item.name)).toEqual(['hpot1', 'fireblade', 'mpot1']);
    expect(groupBankItems(filtered).map(group => [group.category, group.items.length])).toEqual([['Potions', 2], ['Weapons', 1]]);
  });
});

describe('bank sort preview', () => {
  it('counts positions that differ from the deterministic category order', () => {
    expect(bankSortPreview(items)).toEqual({ occupied: 3, misplaced: 3, packs: 2 });
    expect(bankSortPreview([])).toEqual({ occupied: 0, misplaced: 0, packs: 0 });
  });
});
