/** Merchant supply: stock reports, reservations (loadouts + kit) and where each piece is, consumable rules and levels. */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createTelemetryStore } from '../server/telemetry/store.ts';
import { bankStockOf, characterStockOf, mergeStock } from '../server/telemetry/stock.ts';
import { mapV2Stock } from '../server/telemetry/v2-relay.ts';
import type { Profile } from '../shared/profile.ts';
import { record } from '../shared/raw.ts';
import type { Stock } from '../shared/stock.ts';
import type { Draft } from '../src/profile/draft.ts';
import { removeConsumableRule, removeKitRule, setBoardEnabled, setConsumableRule, setKitRule } from '../src/profile/seller-draft.ts';
import { conflictingSlots, consumableRules, heldQuantity, placeOf, reservedPieces, stockLevel } from '../src/screens/merchant/supply-view.ts';

const report = {
  inventory: [{ slot: 0, name: 'hpot1', level: 0, quantity: 150, locked: false }, { slot: 3, name: 'ringsj', level: 2, quantity: 1, locked: false }],
  equipment: [{ slot: 'mainhand', name: 'firestaff', level: 7, quantity: 1 }, { slot: 'elixir', name: 'elixirluck', level: 0, quantity: 1 }],
};

describe('stock reports', () => {
  it('reads bags and equipment, and ignores a malformed section without losing the other', () => {
    assert.deepEqual(characterStockOf('Hero', report, 5)?.equipment[0], { slot: 'mainhand', name: 'firestaff', level: 7, quantity: 1, shiny: false });
    const broken = characterStockOf('Hero', { ...report, inventory: 'oops' }, 5);
    assert.deepEqual([broken?.inventory.length, broken?.equipment.length], [0, 2]);
    assert.equal(characterStockOf('Hero', { stats: {} }, 5), null);
  });

  it('keeps the last bank snapshot a script sent and the newest report of each source', () => {
    let now = 1_000_000;
    const store = createTelemetryStore([], () => undefined, () => now);
    const { ticket } = store.createSession('Seller');
    const stats = { hp: 1, max_hp: 1, mp: 1, max_mp: 1, level: 80, gold: 1, map: 'bank', target: '' };
    store.ingest({ ticket, character: 'Seller', sequence: 1, stats, ...report, bank: [{ pack: 'items0', slot: 4, name: 'wbook0', level: 0, quantity: 1 }], bankCapturedAt: 999 });
    now += 2000;
    store.ingest({ ticket, character: 'Seller', sequence: 2, stats, ...report });
    const stock = store.stock();
    assert.deepEqual([stock.bank?.owner, stock.bank?.at, stock.bank?.items[0]?.name, stock.characters[0]?.at], ['Seller', 999, 'wbook0', 1_002_000]);
    const older: Stock = { characters: [{ name: 'Seller', at: 1, inventory: [], equipment: [] }], bank: { owner: 'Other', at: 5000, items: [] } };
    const merged = mergeStock(stock, older);
    assert.deepEqual([merged.characters[0]?.at, merged.bank?.owner], [1_002_000, 'Other']);
  });

  it('reads the v2 relay view (bankAt) the same way', () => {
    const stock = mapV2Stock({ characters: { Hero: { telemetry: { lastSeen: 7, ...report, bank: [], bankAt: 6 } }, Off: { telemetry: null } } });
    assert.deepEqual([stock?.characters.map((entry) => entry.name), stock?.bank?.at], [['Hero'], 6]);
    assert.equal(bankStockOf('Hero', report, 1), null);
  });
});

const profile: Profile = {
  name: 'Team', server: { region: 'EU', name: 'III' },
  characters: [
    { name: 'Mage', ctype: 'mage', enabled: true, runtime: 'browser', script: '', follow: '', events: false, job: 'hunt', farmMonster: '', overrides: {} },
    { name: 'Seller', ctype: 'merchant', enabled: true, runtime: 'browser', script: '', follow: '', events: false, job: 'hunt', farmMonster: '', overrides: {} },
  ],
  farming: { loadouts: { Mage: {
    aoe: { gear: [{ slot: 'mainhand', item: 'firestaff', minLevel: 7 }, { slot: 'ring1', item: 'ringsj', minLevel: 3 }], skills: [] },
    mono: { gear: [{ slot: 'mainhand', item: 'firestaff', minLevel: 8 }], skills: [] },
  } } },
  seller: { npcEnabled: true, kit: { enabled: true, rules: [{ character: 'Mage', slot: 'orb', item: 'orbg', minLevel: 0, shiny: false }] }, consumables: { enabled: true, rules: [] }, gifts: { enabled: true, rules: [] } },
};
const draft: Draft = { revision: 3, profile };

describe('reservations', () => {
  it('merges loadout styles and the kit into one list per character, in slot order', () => {
    const pieces = reservedPieces(profile, 'Mage');
    assert.deepEqual(pieces.map((piece) => [piece.slot, piece.item, piece.minLevel, piece.styles.join('+'), piece.kit !== null]), [
      ['mainhand', 'firestaff', 8, 'aoe+mono', false], ['ring1', 'ringsj', 3, 'aoe', false], ['orb', 'orbg', 0, '', true],
    ]);
  });

  it('flags a slot where the kit and a loadout want different pieces', () => {
    assert.deepEqual([...conflictingSlots(reservedPieces(profile, 'Mage'))], []);
    const fighting = setKitRule(draft, { character: 'Mage', slot: 'mainhand', item: 'wand', minLevel: 0, shiny: false });
    assert.deepEqual([...conflictingSlots(reservedPieces(fighting.profile, 'Mage'))], ['mainhand']);
    const same = setKitRule(draft, { character: 'Mage', slot: 'mainhand', item: 'firestaff', minLevel: 9, shiny: false });
    assert.deepEqual([...conflictingSlots(reservedPieces(same.profile, 'Mage'))], []);
  });

  it('says where each piece is, and unknown when bags or bank are not reported', () => {
    const [staff, ring, orb] = reservedPieces(profile, 'Mage');
    assert.ok(staff !== undefined && ring !== undefined && orb !== undefined);
    const mage = characterStockOf('Mage', report, 1);
    const seller = characterStockOf('Seller', { inventory: [{ slot: 0, name: 'orbg', level: 0, quantity: 1 }], equipment: [] }, 1);
    assert.ok(mage !== null && seller !== null);
    const bank = { owner: 'Seller', at: 1, items: [{ pack: 'items1', slot: 0, name: 'ringsj', level: 4, quantity: 1 }] };
    // Worn at +7 but the mono style asks for +8: too low to count, and no other copy anywhere.
    assert.deepEqual(placeOf(staff, { characters: [mage, seller], bank }), { kind: 'missing' });
    assert.deepEqual(placeOf(ring, { characters: [mage], bank }), { kind: 'bank', pack: 'items1' });
    assert.deepEqual(placeOf(orb, { characters: [mage, seller], bank }), { kind: 'other', holder: 'Seller' });
    assert.deepEqual(placeOf(staff, { characters: [mage], bank: null }), { kind: 'unknown' });
    assert.deepEqual(placeOf(ring, { characters: [], bank: null }), { kind: 'unknown' });
  });

  it('adds, replaces in place and removes kit pieces; other seller keys keep their order', () => {
    const added = setKitRule(draft, { character: 'Mage', slot: 'ring1', item: 'ringsj', minLevel: 22, shiny: true });
    const replaced = setKitRule(added, { character: 'Mage', slot: 'orb', item: 'orbofsc', minLevel: 1, shiny: false });
    assert.deepEqual(record(replaced.profile['seller'])['kit'], { enabled: true, rules: [
      { character: 'Mage', slot: 'orb', item: 'orbofsc', minLevel: 1, shiny: false }, { character: 'Mage', slot: 'ring1', item: 'ringsj', minLevel: 15, shiny: true },
    ] });
    assert.deepEqual(Object.keys(record(replaced.profile['seller'])), ['npcEnabled', 'kit', 'consumables', 'gifts']);
    assert.equal(reservedPieces(removeKitRule(replaced, 'Mage', 'orb').profile, 'Mage').some((piece) => piece.slot === 'orb'), false);
    assert.equal(reservedPieces(profile, 'Mage').length, 3, 'the saved profile is never mutated');
  });
});

describe('consumables', () => {
  const rule = { character: 'Mage', item: 'hpot1', minQty: 100, targetQty: 200, maxQty: 400, mode: 'carry', source: 'either' } as const;

  it('keeps minimum ≤ target ≤ maximum, one rule per character and item, edited in place', () => {
    const first = setConsumableRule(draft, rule);
    const second = setConsumableRule(setConsumableRule(first, { ...rule, item: 'mpot1' }), { ...rule, targetQty: 300 });
    assert.deepEqual(consumableRules(second.profile).map((entry) => [entry.item, entry.targetQty]), [['hpot1', 300], ['mpot1', 200]]);
    assert.equal(setConsumableRule(draft, { ...rule, minQty: 500 }), draft);
    assert.equal(setConsumableRule(draft, { ...rule, targetQty: 2.5 }), draft);
    assert.deepEqual(consumableRules(removeConsumableRule(second, 'Mage', 'hpot1').profile).map((entry) => entry.item), ['mpot1']);
    assert.equal(record(record(setBoardEnabled(draft, 'consumables', false).profile['seller'])['consumables'])['enabled'], false);
  });

  it('counts bags and equipment like the merchant does, and rates the stock', () => {
    const stock: Stock = { characters: [characterStockOf('Mage', report, 1) ?? { name: 'Mage', at: 1, inventory: [], equipment: [] }], bank: null };
    assert.equal(heldQuantity(stock, 'Mage', 'hpot1'), 150);
    assert.equal(heldQuantity(stock, 'Mage', 'elixirluck'), 1);
    assert.equal(heldQuantity(stock, 'Other', 'hpot1'), null);
    assert.deepEqual([stockLevel(rule, null), stockLevel(rule, 50), stockLevel(rule, 150), stockLevel(rule, 401)], ['unknown', 'low', 'healthy', 'excess']);
  });
});
