import { describe, expect, it } from 'vitest';
import { categorizeItem, filterInventoryItems, computePartyWealth, EQUIPMENT_SLOTS } from '../src/models/inventory';
import type { Catalog, InventoryItem, PartyMember } from '../src/types';

const catalog: Catalog = {
  assets: {},
  monsters: [],
  items: [
    { id: 'fireblade', name: 'Fire Blade', upgrade: true, exchange: false },
    { id: 'hpot1', name: 'Large HP Potion', upgrade: false, exchange: false },
    { id: 'gem0', name: 'Gem Fragment', upgrade: false, exchange: true },
    { id: 'shield', name: 'Wooden Shield', upgrade: true, exchange: false },
    { id: 'ringsj', name: 'Ring of Stupidity', upgrade: true, exchange: false },
  ],
};

describe('inventory categorization and models', () => {
  it('correctly categorizes items by type and name conventions', () => {
    expect(categorizeItem('fireblade', catalog)).toBe('Weapons');
    expect(categorizeItem('hpot1', catalog)).toBe('Potions');
    expect(categorizeItem('elixir_damage', catalog)).toBe('Elixirs');
    expect(categorizeItem('scroll0', catalog)).toBe('Scrolls');
    expect(categorizeItem('gem0', catalog)).toBe('Exchangeables');
    expect(categorizeItem('shield', catalog)).toBe('Armor');
    expect(categorizeItem('ringsj', catalog)).toBe('Accessories');
    expect(categorizeItem('stand0', catalog)).toBe('Utility');
    expect(categorizeItem('unknown_junk', catalog)).toBe('Other');
  });

  it('filters inventory items by search query and category', () => {
    const items: InventoryItem[] = [
      { slot: 0, name: 'fireblade', level: 8, quantity: 1, locked: false, bound: false, upgradeable: true, sellable: true },
      { slot: 1, name: 'hpot1', level: 0, quantity: 500, locked: false, bound: false, upgradeable: false, sellable: true },
      { slot: 2, name: 'shield', level: 4, quantity: 1, locked: true, bound: false, upgradeable: true, sellable: false },
    ];

    expect(filterInventoryItems(items, catalog, { search: 'blade' })).toHaveLength(1);
    expect(filterInventoryItems(items, catalog, { search: 'Fire Blade' })).toHaveLength(1);
    expect(filterInventoryItems(items, catalog, { category: 'Potions' })).toHaveLength(1);
    expect(filterInventoryItems(items, catalog, { category: 'Armor' })).toHaveLength(1);
    expect(filterInventoryItems(items, catalog, { search: 'blade', category: 'Potions' })).toHaveLength(0);
  });

  it('computes party wealth and equipment totals accurately', () => {
    const members: PartyMember[] = [
      {
        name: 'Eadroma',
        class: 'warrior',
        skin: 'mwarrior2',
        status: 'online',
        hp: 3200, maxHp: 3200, mp: 500, maxMp: 800,
        gold: 1500000,
        xp: 12000,
        freeSlots: 40,
        inventory: [
          { slot: 0, name: 'fireblade', level: 8, quantity: 1, locked: false, bound: false, upgradeable: true, sellable: true },
          { slot: 1, name: 'hpot1', level: 0, quantity: 200, locked: false, bound: false, upgradeable: false, sellable: true },
        ],
        equipment: [
          { slot: 'mainhand', name: 'fireblade', level: 8, quantity: 1 },
          { slot: 'chest', name: 'harmor', level: 7, quantity: 1 },
        ],
        stand: [],
        hunt: null,
        map: 'main',
        level: 80,
        target: 'crab',
        runtime: 'browser',
        deploymentStage: 'Running',
      },
      {
        name: 'EadroSell',
        class: 'merchant',
        skin: 'mmerchant',
        status: 'town',
        hp: 800, maxHp: 800, mp: 600, maxMp: 600,
        gold: 5000000,
        xp: 5000,
        freeSlots: 35,
        inventory: [],
        equipment: [],
        stand: [
          { slot: 1, name: 'ololipop', level: 0, quantity: 1, price: 1200000, buy: false },
        ],
        hunt: null,
        map: 'main',
        level: 60,
        target: null,
        runtime: 'browser',
        deploymentStage: 'Running',
      },
    ];

    const wealth = computePartyWealth(members);
    expect(wealth.totalGold).toBe(6500000);
    expect(wealth.totalOccupiedSlots).toBe(2);
    expect(wealth.totalCapacity).toBe(84);
    expect(wealth.totalEquipment).toBe(2);
    expect(wealth.activeCharacters).toBe(2);
  });

  it('defines standard equipment slots correctly', () => {
    expect(EQUIPMENT_SLOTS.map(slot => slot.id)).toEqual([
      'earring1', 'helmet', 'earring2', 'cape',
      'mainhand', 'chest', 'offhand', 'amulet',
      'ring1', 'pants', 'ring2', 'orb',
      'belt', 'gloves', 'shoes', 'elixir',
    ]);
    expect(new Set(EQUIPMENT_SLOTS.map(slot => slot.id)).size).toBe(16);
  });
});
