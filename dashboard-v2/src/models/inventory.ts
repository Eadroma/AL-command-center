import type { Catalog, InventoryItem, PartyMember } from '../types';

export interface ItemCategoryGroup<T> {
  category: string;
  items: T[];
}

export const EQUIPMENT_SLOTS = [
  // Adventure Land's 4 × 4 equipment layout, read from left to right.
  { id: 'earring1', label: 'Earring 1' },
  { id: 'helmet', label: 'Helmet' },
  { id: 'earring2', label: 'Earring 2' },
  { id: 'cape', label: 'Cape' },
  { id: 'mainhand', label: 'Main Hand' },
  { id: 'chest', label: 'Chest' },
  { id: 'offhand', label: 'Off Hand' },
  { id: 'amulet', label: 'Amulet' },
  { id: 'ring1', label: 'Ring 1' },
  { id: 'pants', label: 'Pants' },
  { id: 'ring2', label: 'Ring 2' },
  { id: 'orb', label: 'Orb' },
  { id: 'belt', label: 'Belt' },
  { id: 'gloves', label: 'Gloves' },
  { id: 'shoes', label: 'Shoes' },
  { id: 'elixir', label: 'Elixir' },
] as const;

export type EquipmentSlotId = typeof EQUIPMENT_SLOTS[number]['id'];

/** Categorize item name using the sprite catalog and common AL item conventions. */
export function categorizeItem(name: string, catalog?: Catalog): string {
  const meta = catalog?.items.find(entry => entry.id === name);
  if (name.startsWith('hpot') || name.startsWith('mpot')) return 'Potions';
  if (name.startsWith('elixir') || name.includes('elixir')) return 'Elixirs';
  if (name.startsWith('scroll') || name.startsWith('cscroll') || name.includes('scroll')) return 'Scrolls';
  if (meta?.exchange) return 'Exchangeables';
  if (['stand0', 'stand1', 'tracker', 'computer', 'supercomputer'].includes(name)) return 'Utility';
  if (name.startsWith('gem') || name.startsWith('essence') || ['leather', 'cloth', 'wood', 'feather0', 'seashell'].includes(name)) return 'Materials';
  if (['fireblade', 'ololipop', 'glolipop', 'firebow', 'bow', 'staff', 'dagger', 'sword', 'axe', 'scythe', 'wand', 'mace', 'lmace', 'vstaff', 'crossbow', 'frostbow'].some(k => name.includes(k))) return 'Weapons';
  if (['shield', 'coat', 'gloves', 'pants', 'helmet', 'shoes', 'boots', 'wcap', 'wattire', 'wbreeches', 'wshoes', 'wgloves', 'harmor', 'hboots', 'hhelmet', 'hpants', 'hgloves', 'cape', 'wingedboots'].some(k => name.includes(k))) return 'Armor';
  if (['ring', 'earring', 'amulet', 'belt', 'orb', 'ringsj', 'hpbelt', 'hpamulet', 'vitring', 'dexring', 'strring', 'intring', 'dexamulet', 'stramulet', 'intamulet'].some(k => name.includes(k))) return 'Accessories';
  return 'Other';
}

/** Filter inventory items by search query and category. */
export function filterInventoryItems(
  items: InventoryItem[],
  catalog: Catalog,
  filters: { search?: string; category?: string }
): InventoryItem[] {
  const query = filters.search?.trim().toLowerCase() ?? '';
  const categoryFilter = filters.category?.trim() ?? '';

  return items.filter(item => {
    const meta = catalog.items.find(entry => entry.id === item.name);
    const displayName = (meta?.name ?? item.name).toLowerCase();
    const matchesSearch = !query || item.name.toLowerCase().includes(query) || displayName.includes(query);
    if (!matchesSearch) return false;

    if (categoryFilter) {
      const cat = categorizeItem(item.name, catalog);
      if (cat !== categoryFilter) return false;
    }

    return true;
  });
}

/** Compute overall party wealth and slot capacity summary. */
export function computePartyWealth(members: PartyMember[] | null) {
  if (!members || members.length === 0) {
    return {
      totalGold: 0,
      totalOccupiedSlots: 0,
      totalCapacity: 0,
      totalEquipment: 0,
      activeCharacters: 0,
    };
  }

  let totalGold = 0;
  let totalOccupiedSlots = 0;
  let totalEquipment = 0;
  let activeCharacters = 0;

  for (const m of members) {
    if (m.gold !== null) totalGold += m.gold;
    if (m.inventory) totalOccupiedSlots += m.inventory.length;
    if (m.equipment) totalEquipment += m.equipment.length;
    if (m.status !== 'offline' && m.status !== 'disabled') activeCharacters++;
  }

  return {
    totalGold,
    totalOccupiedSlots,
    totalCapacity: members.length * 42,
    totalEquipment,
    activeCharacters,
  };
}
