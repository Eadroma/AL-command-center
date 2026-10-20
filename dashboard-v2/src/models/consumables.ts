import type { Profile } from '../../shared/schema';
import type { PartyMember } from '../types/party';

export type ConsumableRule = Profile['seller']['consumables']['rules'][number];
export type ConsumableStockLevel = 'unknown' | 'low' | 'healthy' | 'excess';

export interface ConsumableStockStatus {
  rule: ConsumableRule;
  quantity: number | null;
  level: ConsumableStockLevel;
  message: string;
}

/** Sum every matching stack reported by live inventory telemetry. */
export function inventoryQuantity(member: PartyMember | undefined, item: string): number | null {
  if (!member || member.status === 'offline' || member.status === 'disabled') return null;
  return member.inventory
    .filter(entry => entry.name === item)
    .reduce((total, entry) => total + Math.max(1, entry.quantity || 1), 0);
}

/** Compare live stock with the saved trigger, refill target, and upper limit. */
export function consumableStockStatus(rule: ConsumableRule, member: PartyMember | undefined): ConsumableStockStatus {
  const quantity = inventoryQuantity(member, rule.item);
  if (quantity === null) return { rule, quantity, level: 'unknown', message: 'No live inventory' };
  if (quantity < rule.minQty) {
    return { rule, quantity, level: 'low', message: `${quantity} held · refill to ${rule.targetQty}` };
  }
  if (quantity > rule.maxQty) {
    return { rule, quantity, level: 'excess', message: `${quantity} held · maximum ${rule.maxQty}` };
  }
  return { rule, quantity, level: 'healthy', message: `${quantity} held · target ${rule.targetQty}` };
}

export function consumableStockStatuses(profile: Profile, members: PartyMember[] | null | undefined): ConsumableStockStatus[] {
  const byName = new Map((members ?? []).map(member => [member.name, member]));
  return profile.seller.consumables.rules.map(rule => consumableStockStatus(rule, byName.get(rule.character)));
}
