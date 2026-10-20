import type { Catalog, DeploymentsResponse, PartyMember, Profile } from '../types';
import { bankSnapshots } from './bank';

export type ItemLocationKind = 'bag' | 'equipment' | 'bank' | 'stand';

export interface ItemLocation {
  key: string;
  item: string;
  displayName: string;
  level: number;
  quantity: number;
  owner: string;
  kind: ItemLocationKind;
  location: string;
  reservations: string[];
}

function reservationsFor(item: string, profile?: Profile): string[] {
  if (!profile) return [];
  const labels = new Set<string>();
  const seller = profile.seller;
  if (seller.bankDeposit.enabled && seller.bankDeposit.items.includes(item)) labels.add('Bank deposit');
  if (seller.standEnabled && seller.listings.some(rule => rule.item === item)) labels.add('Stand sale');
  if (seller.buy.enabled && seller.buy.orders.some(rule => rule.item === item)) labels.add('Buy order');
  if (seller.npcEnabled && seller.npcItems.includes(item)) labels.add('NPC sale');
  if (seller.exchange.enabled && seller.exchange.items.includes(item)) labels.add('Exchange');
  if (seller.upgrade.enabled && seller.upgrade.rules.some(rule => rule.item === item)) labels.add('Upgrade');
  if (seller.craft.enabled && seller.craft.rules.some(rule => rule.item === item)) labels.add('Craft');
  if (seller.ponty.enabled && seller.ponty.items.includes(item)) labels.add('Ponty');
  if (seller.kit.enabled && seller.kit.rules.some(rule => rule.item === item)) labels.add('Kit');
  if (seller.consumables.enabled && seller.consumables.rules.some(rule => rule.item === item)) labels.add('Consumable');
  if (seller.gifts.enabled && seller.gifts.rules.some(rule => rule.item === item)) labels.add('Gift');
  for (const loadouts of Object.values(profile.farming.loadouts)) {
    if (Object.values(loadouts).some(loadout => loadout.gear.some(gear => gear.item === item))) {
      labels.add('Combat loadout');
      break;
    }
  }
  return [...labels];
}

/** Locate owned items across fresh character telemetry and the newest shared-bank snapshot. */
export function locateItems(
  query: string,
  members: PartyMember[] | null,
  catalog?: Catalog,
  deployments?: DeploymentsResponse,
  profile?: Profile,
  owner = 'all',
): ItemLocation[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle || !catalog) return [];
  const names = new Map(catalog.items.map(item => [item.id, item.name]));
  const matches = (item: string) => `${item} ${names.get(item) ?? ''}`.toLocaleLowerCase().includes(needle);
  const rows: ItemLocation[] = [];
  const add = (row: Omit<ItemLocation, 'displayName' | 'reservations'>) => {
    if (!matches(row.item)) return;
    rows.push({ ...row, displayName: names.get(row.item) ?? row.item, reservations: reservationsFor(row.item, profile) });
  };

  for (const member of members ?? []) {
    if (owner !== 'all' && member.name !== owner) continue;
    for (const item of member.inventory) add({
      key: `bag:${member.name}:${item.slot}`, item: item.name, level: item.level, quantity: item.quantity,
      owner: member.name, kind: 'bag', location: `Bag · slot ${item.slot}`,
    });
    for (const item of member.equipment) add({
      key: `equipment:${member.name}:${item.slot}`, item: item.name, level: item.level, quantity: item.quantity,
      owner: member.name, kind: 'equipment', location: `Equipment · ${item.slot}`,
    });
    for (const item of member.stand.filter(item => !item.buy)) add({
      key: `stand:${member.name}:${item.slot}`, item: item.name, level: item.level, quantity: item.quantity,
      owner: member.name, kind: 'stand', location: `Stand · slot ${item.slot}`,
    });
  }

  const bank = bankSnapshots(deployments)[0];
  if (bank && (owner === 'all' || owner === bank.owner)) {
    for (const item of bank.items) add({
      key: `bank:${item.pack}:${item.slot}`, item: item.name, level: item.level, quantity: item.quantity,
      owner: bank.owner, kind: 'bank', location: `Bank · ${item.pack} / slot ${item.slot}`,
    });
  }

  const kindOrder: Record<ItemLocationKind, number> = { bag: 0, equipment: 1, stand: 2, bank: 3 };
  return rows.sort((a, b) => a.displayName.localeCompare(b.displayName)
    || b.level - a.level
    || kindOrder[a.kind] - kindOrder[b.kind]
    || a.owner.localeCompare(b.owner));
}
