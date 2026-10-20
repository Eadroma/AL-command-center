import type { Profile } from '../../shared/schema';

type Seller = Profile['seller'];
export type SellerBoard = 'kit' | 'consumables' | 'gifts';
export type KitRule = Seller['kit']['rules'][number];
export type ConsumableRule = Seller['consumables']['rules'][number];
export type GiftRule = Seller['gifts']['rules'][number];
export type CraftRule = Seller['craft']['rules'][number];

/** Immutable seller-board transformations shared by the Merchant page. */
export function setSellerBoardEnabled(profile: Profile, board: SellerBoard, enabled: boolean): Profile {
  return { ...profile, seller: { ...profile.seller, [board]: { ...profile.seller[board], enabled } } };
}

export function setKitRule(profile: Profile, rule: KitRule): Profile {
  const rules = [...profile.seller.kit.rules.filter(entry => !(entry.character === rule.character && entry.slot === rule.slot)), rule];
  return { ...profile, seller: { ...profile.seller, kit: { ...profile.seller.kit, rules } } };
}

export function removeKitRule(profile: Profile, character: string, slot: string): Profile {
  const rules = profile.seller.kit.rules.filter(entry => !(entry.character === character && entry.slot === slot));
  return { ...profile, seller: { ...profile.seller, kit: { ...profile.seller.kit, rules } } };
}

export function setConsumableRule(profile: Profile, rule: ConsumableRule): Profile {
  const rules = [...profile.seller.consumables.rules.filter(entry => !(entry.character === rule.character && entry.item === rule.item)), rule];
  return { ...profile, seller: { ...profile.seller, consumables: { ...profile.seller.consumables, rules } } };
}

export function removeConsumableRule(profile: Profile, character: string, item: string): Profile {
  const rules = profile.seller.consumables.rules.filter(entry => !(entry.character === character && entry.item === item));
  return { ...profile, seller: { ...profile.seller, consumables: { ...profile.seller.consumables, rules } } };
}

export function setGiftRule(profile: Profile, rule: GiftRule): Profile {
  const rules = [...profile.seller.gifts.rules.filter(entry => !(entry.character === rule.character && entry.item === rule.item && entry.level === rule.level)), rule];
  return { ...profile, seller: { ...profile.seller, gifts: { ...profile.seller.gifts, rules } } };
}

export function removeGiftRule(profile: Profile, character: string, item: string, level: number): Profile {
  const rules = profile.seller.gifts.rules.filter(entry => !(entry.character === character && entry.item === item && entry.level === level));
  return { ...profile, seller: { ...profile.seller, gifts: { ...profile.seller.gifts, rules } } };
}

export function setNpcEnabled(profile: Profile, enabled: boolean): Profile {
  return { ...profile, seller: { ...profile.seller, npcEnabled: enabled } };
}

export function addNpcItem(profile: Profile, item: string): Profile {
  if (profile.seller.npcItems.includes(item)) return profile;
  return { ...profile, seller: { ...profile.seller, npcItems: [...profile.seller.npcItems, item] } };
}

export function removeNpcItem(profile: Profile, item: string): Profile {
  return { ...profile, seller: { ...profile.seller, npcItems: profile.seller.npcItems.filter(i => i !== item) } };
}

export function setExchangeEnabled(profile: Profile, enabled: boolean): Profile {
  return { ...profile, seller: { ...profile.seller, exchange: { ...profile.seller.exchange, enabled } } };
}

export function addExchangeItem(profile: Profile, item: string, minQty = 1): Profile {
  const items = profile.seller.exchange.items.includes(item)
    ? profile.seller.exchange.items
    : [...profile.seller.exchange.items, item];
  const minimum = { ...profile.seller.exchange.minimum, [item]: minQty };
  return { ...profile, seller: { ...profile.seller, exchange: { ...profile.seller.exchange, items, minimum } } };
}

export function removeExchangeItem(profile: Profile, item: string): Profile {
  const items = profile.seller.exchange.items.filter(i => i !== item);
  const minimum = { ...profile.seller.exchange.minimum };
  delete minimum[item];
  return { ...profile, seller: { ...profile.seller, exchange: { ...profile.seller.exchange, items, minimum } } };
}

export function setUpgradeEnabled(profile: Profile, enabled: boolean): Profile {
  return { ...profile, seller: { ...profile.seller, upgrade: { ...profile.seller.upgrade, enabled } } };
}

export function setUpgradeMinGold(profile: Profile, minGold: number): Profile {
  return { ...profile, seller: { ...profile.seller, upgrade: { ...profile.seller.upgrade, minGold } } };
}

export function setUpgradeRule(profile: Profile, item: string, maxLevel: number): Profile {
  const previous = profile.seller.upgrade.rules.find(rule => rule.item === item);
  const rules = [...profile.seller.upgrade.rules.filter(r => r.item !== item), { ...previous, item, maxLevel }];
  return { ...profile, seller: { ...profile.seller, upgrade: { ...profile.seller.upgrade, rules } } };
}

export function removeUpgradeRule(profile: Profile, item: string): Profile {
  const rules = profile.seller.upgrade.rules.filter(r => r.item !== item);
  return { ...profile, seller: { ...profile.seller, upgrade: { ...profile.seller.upgrade, rules } } };
}

export function setUpgradeNpcPurchase(profile: Profile, item: string, buyNpc: boolean): Profile {
  return { ...profile, seller: { ...profile.seller, upgrade: { ...profile.seller.upgrade, rules: profile.seller.upgrade.rules.map(rule => rule.item === item ? { ...rule, buyNpc } : rule) } } };
}

export function setCraftEnabled(profile: Profile, enabled: boolean): Profile {
  return { ...profile, seller: { ...profile.seller, craft: { ...profile.seller.craft, enabled } } };
}

export function setCraftReserveGold(profile: Profile, reserveGold: number): Profile {
  return { ...profile, seller: { ...profile.seller, craft: { ...profile.seller.craft, reserveGold } } };
}

export function addCraftRule(profile: Profile, item: string): Profile {
  if (profile.seller.craft.rules.some(rule => rule.item === item)) return profile;
  return { ...profile, seller: { ...profile.seller, craft: { ...profile.seller.craft, rules: [...profile.seller.craft.rules, { item }] } } };
}

export function removeCraftRule(profile: Profile, item: string): Profile {
  return { ...profile, seller: { ...profile.seller, craft: { ...profile.seller.craft, rules: profile.seller.craft.rules.filter(rule => rule.item !== item) } } };
}

export function setPontyEnabled(profile: Profile, enabled: boolean): Profile {
  return { ...profile, seller: { ...profile.seller, ponty: { ...profile.seller.ponty, enabled } } };
}

export function setPontyMinGold(profile: Profile, minGold: number): Profile {
  return { ...profile, seller: { ...profile.seller, ponty: { ...profile.seller.ponty, minGold } } };
}

export function addPontyItem(profile: Profile, item: string): Profile {
  if (profile.seller.ponty.items.includes(item)) return profile;
  return { ...profile, seller: { ...profile.seller, ponty: { ...profile.seller.ponty, items: [...profile.seller.ponty.items, item] } } };
}

export function removePontyItem(profile: Profile, item: string): Profile {
  return { ...profile, seller: { ...profile.seller, ponty: { ...profile.seller.ponty, items: profile.seller.ponty.items.filter(i => i !== item) } } };
}

export function setBankDepositEnabled(profile: Profile, enabled: boolean): Profile {
  return { ...profile, seller: { ...profile.seller, bankDeposit: { ...profile.seller.bankDeposit, enabled } } };
}

export function setBankDepositItems(profile: Profile, items: string[]): Profile {
  return { ...profile, seller: { ...profile.seller, bankDeposit: { ...profile.seller.bankDeposit, items: [...new Set(items)] } } };
}

export function setTeamSupervisorEnabled(profile: Profile, enabled: boolean): Profile {
  return { ...profile, seller: { ...profile.seller, teamSupervisor: { ...profile.seller.teamSupervisor, enabled } } };
}

export function setTeamSupervisorCharacters(profile: Profile, characters: string[]): Profile {
  return { ...profile, seller: { ...profile.seller, teamSupervisor: { ...profile.seller.teamSupervisor, characters: [...new Set(characters)] } } };
}

export function setSoloGuardEnabled(profile: Profile, soloGuard: boolean): Profile {
  return { ...profile, seller: { ...profile.seller, teamSupervisor: { ...profile.seller.teamSupervisor, soloGuard } } };
}

/** Legacy empty selections mean all enabled farmers. Keep that expansion in one place. */
export function supervisedCharacters(profile: Profile): string[] {
  const selected = profile.seller.teamSupervisor.characters;
  return selected.length ? selected : profile.characters
    .filter(character => character.enabled && character.ctype !== 'merchant')
    .map(character => character.name);
}

/** Removing the last target pauses startup while retaining the target for a later resume. */
export function toggleSupervisedCharacter(profile: Profile, name: string, selected: boolean): Profile {
  const names = supervisedCharacters(profile);
  const next = selected ? [...new Set([...names, name])] : names.filter(entry => entry !== name);
  if (!next.length) return setTeamSupervisorEnabled(profile, false);
  const updated = setTeamSupervisorCharacters(profile, next);
  return next.length === 1 ? updated : setSoloGuardEnabled(updated, false);
}

export function setStandEnabled(profile: Profile, enabled: boolean): Profile {
  return { ...profile, seller: { ...profile.seller, standEnabled: enabled } };
}

export function addStandListing(profile: Profile, listing: { item: string; level: number; price: number; bankReserve?: number }): Profile {
  const existing = profile.seller.listings.find(l => l.item === listing.item && l.level === listing.level);
  const listings = [...profile.seller.listings.filter(l => !(l.item === listing.item && l.level === listing.level)), { ...existing, ...listing }];
  return { ...profile, seller: { ...profile.seller, listings } };
}

export function removeStandListing(profile: Profile, item: string, level: number): Profile {
  const listings = profile.seller.listings.filter(l => !(l.item === item && l.level === level));
  return { ...profile, seller: { ...profile.seller, listings } };
}

export function setBuyOrdersEnabled(profile: Profile, enabled: boolean): Profile {
  return { ...profile, seller: { ...profile.seller, buy: { ...profile.seller.buy, enabled, managed: profile.seller.buy.managed || enabled } } };
}

export function setBuyBudget(profile: Profile, budget: number): Profile {
  return { ...profile, seller: { ...profile.seller, buy: { ...profile.seller.buy, budget } } };
}

export function setBuyReserveGold(profile: Profile, reserveGold: number): Profile {
  return { ...profile, seller: { ...profile.seller, buy: { ...profile.seller.buy, reserveGold } } };
}

export function addBuyOrder(profile: Profile, order: { item: string; level: number; price: number; quantity: number }): Profile {
  const orders = [...profile.seller.buy.orders.filter(o => !(o.item === order.item && o.level === order.level)), order];
  return { ...profile, seller: { ...profile.seller, buy: { ...profile.seller.buy, managed: true, orders } } };
}

/** Replace an order even when its level (part of the unique key) changes. */
export function updateBuyOrder(profile: Profile, original: { item: string; level: number }, order: { item: string; level: number; price: number; quantity: number }): Profile {
  let replaced = false;
  const orders = profile.seller.buy.orders.flatMap(current => {
    if (current.item === original.item && current.level === original.level) {
      replaced = true;
      return [order];
    }
    if (current.item === order.item && current.level === order.level) return [];
    return [current];
  });
  if (!replaced) orders.push(order);
  return { ...profile, seller: { ...profile.seller, buy: { ...profile.seller.buy, managed: true, orders } } };
}

export function removeBuyOrder(profile: Profile, item: string, level: number): Profile {
  const orders = profile.seller.buy.orders.filter(o => !(o.item === item && o.level === level));
  return { ...profile, seller: { ...profile.seller, buy: { ...profile.seller.buy, orders } } };
}
