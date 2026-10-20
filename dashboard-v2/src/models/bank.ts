import type { BankItem, Catalog, DeploymentsResponse } from '../types';

export interface BankSnapshot {
  owner: string;
  items: BankItem[];
  capturedAt?: number;
  live: boolean;
}

export interface BankFilters {
  search: string;
  category: string;
}

/** Empty arrays are valid snapshots: they prove the bank was observed with no occupied slots. */
export function bankSnapshots(deployments?: DeploymentsResponse): BankSnapshot[] {
  if (!deployments) return [];
  return Object.entries(deployments.characters)
    .flatMap(([owner, deployment]) => {
      const telemetry = deployment.telemetry;
      return telemetry && Array.isArray(telemetry.bank)
        ? [{ owner, items: telemetry.bank, capturedAt: telemetry.bankAt, live: telemetry.live }]
        : [];
    })
    .sort((left, right) => (right.capturedAt ?? 0) - (left.capturedAt ?? 0) || left.owner.localeCompare(right.owner));
}

/** Search item IDs, display names and pack names while keeping a stable display order. */
export function filterBankItems(items: BankItem[], catalog: Catalog, filters: BankFilters): BankItem[] {
  const query = filters.search.trim().toLocaleLowerCase();
  const names = new Map(catalog.items.map(item => [item.id, item.name]));
  return items.filter(item => {
    const category = item.category || 'Other';
    const searchable = `${item.name} ${names.get(item.name) ?? ''} ${item.pack}`.toLocaleLowerCase();
    return (!filters.category || category === filters.category) && searchable.includes(query);
  }).sort((left, right) => {
    const leftCategory = left.category || 'Other';
    const rightCategory = right.category || 'Other';
    return leftCategory.localeCompare(rightCategory)
      || (names.get(left.name) ?? left.name).localeCompare(names.get(right.name) ?? right.name)
      || right.level - left.level
      || left.pack.localeCompare(right.pack)
      || left.slot - right.slot;
  });
}

export function groupBankItems(items: BankItem[]): Array<{ category: string; items: BankItem[] }> {
  const groups = new Map<string, BankItem[]>();
  for (const item of items) {
    const category = item.category || 'Other';
    const group = groups.get(category) ?? [];
    group.push(item);
    groups.set(category, group);
  }
  return [...groups].map(([category, groupedItems]) => ({ category, items: groupedItems }));
}

const BANK_CATEGORY_ORDER = ['Armor', 'Accessories', 'Weapons', 'Elixirs', 'Potions', 'Scrolls', 'Materials', 'Exchangeables', 'Other'];

/** Estimate how many occupied positions differ from the deterministic bank order. */
export function bankSortPreview(items: BankItem[]): { occupied: number; misplaced: number; packs: number } {
  const current = [...items].sort((a, b) => Number(a.pack.replace('items', '')) - Number(b.pack.replace('items', '')) || a.slot - b.slot);
  const desired = [...items].sort((a, b) => {
    const ac = BANK_CATEGORY_ORDER.indexOf(a.category || 'Other');
    const bc = BANK_CATEGORY_ORDER.indexOf(b.category || 'Other');
    return (ac < 0 ? 999 : ac) - (bc < 0 ? 999 : bc)
      || a.name.localeCompare(b.name)
      || b.level - a.level;
  });
  const misplaced = current.reduce((count, item, index) => {
    const wanted = desired[index];
    return count + (wanted && item.name === wanted.name && item.level === wanted.level ? 0 : 1);
  }, 0);
  return { occupied: items.length, misplaced, packs: new Set(items.map(item => item.pack)).size };
}
