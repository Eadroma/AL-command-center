import { describe, expect, it } from 'vitest';
import { initialProfile, scripts } from '../server/scripts';
import { ensureSellerBoards } from '../shared/schema';
import {
  addBuyOrder,
  addCraftRule,
  addExchangeItem,
  addNpcItem,
  addPontyItem,
  addStandListing,
  removeBuyOrder,
  removeCraftRule,
  removeConsumableRule,
  removeExchangeItem,
  removeGiftRule,
  removeKitRule,
  removeNpcItem,
  removePontyItem,
  removeStandListing,
  removeUpgradeRule,
  setConsumableRule,
  setGiftRule,
  setKitRule,
  setSellerBoardEnabled,
  setTeamSupervisorCharacters,
  setTeamSupervisorEnabled,
  setSoloGuardEnabled,
  toggleSupervisedCharacter,
  setUpgradeRule,
  updateBuyOrder,
} from '../src/models/merchant';
import { consumableStockStatus } from '../src/models/consumables';
import { merchantPlan } from '../src/models/merchant-planner';
import type { PartyMember } from '../src/types/party';

describe('merchant profile transformations', () => {
  it('pauses the last supervised target and clears solo guard when expanding the team', () => {
    const profile = initialProfile(scripts());
    profile.seller.teamSupervisor = { enabled: true, characters: ['Droma'], soloGuard: true };
    const paused = toggleSupervisedCharacter(profile, 'Droma', false);
    expect(paused.seller.teamSupervisor).toEqual({ enabled: false, characters: ['Droma'], soloGuard: true });
    const resumed = setTeamSupervisorEnabled(paused, true);
    expect(resumed.seller.teamSupervisor.characters).toEqual(['Droma']);
    const expanded = toggleSupervisedCharacter(resumed, 'Eadroma', true);
    expect(expanded.seller.teamSupervisor.characters).toEqual(['Droma', 'Eadroma']);
    expect(expanded.seller.teamSupervisor.soloGuard).toBe(false);
    expect(profile.seller.teamSupervisor.characters).toEqual(['Droma']);
  });
  it('mirrors merchant runtime lanes and reports live blockers', () => {
    const profile = initialProfile(scripts());
    profile.seller.standEnabled = true;
    profile.seller.craft.enabled = true;
    profile.seller.craft.reserveGold = 1_000_000;
    const members = [
      { name: 'EadroSell', class: 'merchant', status: 'online', gold: 500_000, intent: { state: 'stand open' } },
      { name: 'Eadroma', class: 'warrior', status: 'offline' },
    ] as PartyMember[];
    const plan = merchantPlan(profile, members);
    expect(plan).toHaveLength(7);
    expect(plan.find(task => task.id === 'stand')).toMatchObject({ state: 'active', cadenceMs: 1500 });
    expect(plan.find(task => task.id === 'craft')).toMatchObject({ state: 'blocked', blocker: expect.stringContaining('reserve') });
    expect(plan.find(task => task.id === 'team')?.detail).toContain('1 offline');
  });

  it('blocks enabled planner lanes when merchant telemetry is stale', () => {
    const plan = merchantPlan(initialProfile(scripts()), []);
    expect(plan.filter(task => task.state !== 'disabled').every(task => task.state === 'blocked')).toBe(true);
  });
  it('updates board switches without mutating the profile', () => {
    const profile = initialProfile(scripts());
    const changed = setSellerBoardEnabled(profile, 'kit', false);
    expect(changed.seller.kit.enabled).toBe(false);
    expect(profile.seller.kit.enabled).toBe(true);
  });

  it('configures the merchant team supervisor without mutating the profile', () => {
    const profile = initialProfile(scripts());
    const rangerOnly = setTeamSupervisorCharacters(profile, ['Droma']);
    const guarded = setSoloGuardEnabled(rangerOnly, true);
    const disabled = setTeamSupervisorEnabled(guarded, false);
    expect(rangerOnly.seller.teamSupervisor.characters).toEqual(['Droma']);
    expect(guarded.seller.teamSupervisor.soloGuard).toBe(true);
    expect(disabled.seller.teamSupervisor.enabled).toBe(false);
    expect(profile.seller.teamSupervisor).toEqual({ enabled: true, characters: [], soloGuard: false });
  });

  it('replaces unique kit and consumable keys and removes exact rules', () => {
    const profile = initialProfile(scripts());
    const geared = setKitRule(profile, { character: 'Eadroma', slot: 'mainhand', item: 'fireblade', minLevel: 7, shiny: false });
    const replaced = setKitRule(geared, { character: 'Eadroma', slot: 'mainhand', item: 'ololipop', minLevel: 8, shiny: true });
    expect(replaced.seller.kit.rules).toEqual([{ character: 'Eadroma', slot: 'mainhand', item: 'ololipop', minLevel: 8, shiny: true }]);
    expect(removeKitRule(replaced, 'Eadroma', 'mainhand').seller.kit.rules).toEqual([]);

    const supplied = setConsumableRule(profile, { character: 'Eadroma', item: 'mpot1', minQty: 500, targetQty: 1000, maxQty: 2000, mode: 'carry', source: 'either' });
    const topped = setConsumableRule(supplied, { character: 'Eadroma', item: 'mpot1', minQty: 1000, targetQty: 2000, maxQty: 3000, mode: 'carry', source: 'mule' });
    expect(topped.seller.consumables.rules[0]).toMatchObject({ minQty: 1000, targetQty: 2000, maxQty: 3000 });
    expect(removeConsumableRule(topped, 'Eadroma', 'mpot1').seller.consumables.rules).toEqual([]);
  });

  it('classifies live consumable stock against min and max thresholds', () => {
    const rule = { character: 'Eadroma', item: 'mpot1', minQty: 500, targetQty: 1000, maxQty: 2000, mode: 'carry', source: 'either' } as const;
    const member = (quantity: number) => ({
      name: 'Eadroma', status: 'online', inventory: [{ slot: 0, name: 'mpot1', level: 0, quantity, locked: false, bound: false, upgradeable: false, sellable: false }],
    } as PartyMember);
    expect(consumableStockStatus(rule, member(200)).level).toBe('low');
    expect(consumableStockStatus(rule, member(1200)).level).toBe('healthy');
    expect(consumableStockStatus(rule, member(2500)).level).toBe('excess');
    expect(consumableStockStatus(rule, undefined).level).toBe('unknown');
  });

  it('migrates legacy consumable thresholds and managed buy orders', () => {
    const legacy = structuredClone(initialProfile(scripts())) as unknown as { seller: Record<string, any> };
    legacy.seller.consumables.rules = [{ character: 'Eadroma', item: 'mpot1', minQty: 1000, mode: 'carry', source: 'either' }];
    legacy.seller.buy.enabled = true;
    legacy.seller.buy.managed = false;
    legacy.seller.buy.orders = [{ item: 'monstertoken', level: 0, price: 500000, quantity: 10 }];
    delete legacy.seller.craft;
    const migrated = ensureSellerBoards(legacy);
    expect(migrated.seller.consumables.rules[0]).toMatchObject({ minQty: 1000, targetQty: 1000, maxQty: 2000 });
    expect(migrated.seller.buy.managed).toBe(true);
    expect(migrated.seller.craft).toMatchObject({ enabled: true, reserveGold: 1000000, rules: [{ item: 'wingedboots' }] });
  });

  it('keeps distinct gift levels', () => {
    const profile = initialProfile(scripts());
    const first = setGiftRule(profile, { character: 'Droma', item: 'firebow', level: 7, quantity: 1 });
    const second = setGiftRule(first, { character: 'Droma', item: 'firebow', level: 8, quantity: 1 });
    expect(second.seller.gifts.rules).toHaveLength(2);
    expect(removeGiftRule(second, 'Droma', 'firebow', 7).seller.gifts.rules).toEqual([{ character: 'Droma', item: 'firebow', level: 8, quantity: 1 }]);
  });

  it('manages NPC, exchange, upgrade, ponty, and stand configurations immutably', () => {
    const profile = initialProfile(scripts());

    // NPC
    const withNpc = addNpcItem(profile, 'wshoes');
    expect(withNpc.seller.npcItems).toContain('wshoes');
    expect(removeNpcItem(withNpc, 'wshoes').seller.npcItems).not.toContain('wshoes');

    // Exchange
    const withEx = addExchangeItem(profile, 'candycane', 20);
    expect(withEx.seller.exchange.items).toContain('candycane');
    expect(withEx.seller.exchange.minimum.candycane).toBe(20);
    expect(removeExchangeItem(withEx, 'candycane').seller.exchange.items).not.toContain('candycane');

    // Upgrade
    const withUp = setUpgradeRule(profile, 'hpants', 8);
    expect(withUp.seller.upgrade.rules.find(r => r.item === 'hpants')?.maxLevel).toBe(8);
    expect(removeUpgradeRule(withUp, 'hpants').seller.upgrade.rules.some(r => r.item === 'hpants')).toBe(false);

    // Craft
    const withCraft = addCraftRule(profile, 'fireblade');
    expect(withCraft.seller.craft.rules).toContainEqual({ item: 'fireblade' });
    expect(removeCraftRule(withCraft, 'fireblade').seller.craft.rules.some(r => r.item === 'fireblade')).toBe(false);

    // Ponty
    const withPonty = addPontyItem(profile, 'fireblade');
    expect(withPonty.seller.ponty.items).toContain('fireblade');
    expect(removePontyItem(withPonty, 'fireblade').seller.ponty.items).not.toContain('fireblade');

    // Stand
    const withStand = addStandListing(profile, { item: 'ololipop', level: 0, price: 1500000 });
    expect(withStand.seller.listings.some(l => l.item === 'ololipop' && l.price === 1500000)).toBe(true);
    expect(removeStandListing(withStand, 'ololipop', 0).seller.listings.some(l => l.item === 'ololipop')).toBe(false);

    // Buy Orders
    const withBuy = addBuyOrder(profile, { item: 'tshirt9', level: 0, price: 10000000, quantity: 5 });
    expect(withBuy.seller.buy.orders.some(o => o.item === 'tshirt9')).toBe(true);
    const editedBuy = updateBuyOrder(withBuy, { item: 'tshirt9', level: 0 }, { item: 'tshirt9', level: 2, price: 12000000, quantity: 8 });
    expect(editedBuy.seller.buy.orders).toContainEqual({ item: 'tshirt9', level: 2, price: 12000000, quantity: 8 });
    expect(editedBuy.seller.buy.orders.some(o => o.item === 'tshirt9' && o.level === 0)).toBe(false);
    expect(removeBuyOrder(withBuy, 'tshirt9', 0).seller.buy.orders.some(o => o.item === 'tshirt9')).toBe(false);
  });
});
