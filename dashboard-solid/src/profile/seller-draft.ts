/**
 * Draft edits of the merchant's settings (profile.seller). Same shapes as dashboard-v2, so the builder and the
 * scripts read them unchanged. Every other seller key keeps its value and its place.
 */
import type { GearSlot } from '../../shared/loadouts.ts';
import { MAX_MIN_LEVEL } from '../../shared/loadouts.ts';
import type { JsonRecord } from '../../shared/raw.ts';
import { field, list, record } from '../../shared/raw.ts';
import type { Draft } from './draft.ts';

/** A piece the merchant brings to a character, who then always wears it in that slot. */
export interface KitRule {
  readonly character: string;
  readonly slot: GearSlot;
  readonly item: string;
  readonly minLevel: number;
  readonly shiny: boolean;
}

export type ConsumableMode = 'carry' | 'elixir';
export type ConsumableSource = 'mule' | 'bank' | 'either';

/** Below minQty the merchant refills up to targetQty; above maxQty the stock is reported as excess. */
export interface ConsumableRule {
  readonly character: string;
  readonly item: string;
  readonly minQty: number;
  readonly targetQty: number;
  readonly maxQty: number;
  readonly mode: ConsumableMode;
  readonly source: ConsumableSource;
}

export type SupplyBoard = 'kit' | 'consumables';

/** dashboard-v2's limit for consumable quantities. */
export const MAX_QUANTITY = 999_999;

function updateBoard(draft: Draft, board: SupplyBoard, change: (board: JsonRecord) => JsonRecord): Draft {
  const seller = record(draft.profile['seller']);
  const current = record(seller[board]);
  return { ...draft, profile: { ...draft.profile, seller: { ...seller, [board]: change({ enabled: true, rules: [], ...current }) } } };
}

/** Replaces the rule `same` matches where it stands, or appends it. */
function placeRule(rules: readonly unknown[], rule: object, same: (entry: unknown) => boolean): unknown[] {
  const index = rules.findIndex(same);
  return index < 0 ? [...rules, rule] : rules.map((entry, position) => (position === index ? rule : entry));
}

export function setBoardEnabled(draft: Draft, board: SupplyBoard, enabled: boolean): Draft {
  return updateBoard(draft, board, (current) => ({ ...current, enabled }));
}

/** One kit piece per character and slot: a new piece for the same slot replaces the old one. */
export function setKitRule(draft: Draft, rule: KitRule): Draft {
  const clean: KitRule = { ...rule, minLevel: Math.min(MAX_MIN_LEVEL, Math.max(0, Math.round(rule.minLevel))) };
  const same = (entry: unknown): boolean => field(entry, 'character') === rule.character && field(entry, 'slot') === rule.slot;
  return updateBoard(draft, 'kit', (current) => ({ ...current, rules: placeRule(list(current['rules']), clean, same) }));
}

export function removeKitRule(draft: Draft, character: string, slot: string): Draft {
  return updateBoard(draft, 'kit', (current) => ({
    ...current, rules: list(current['rules']).filter((entry) => !(field(entry, 'character') === character && field(entry, 'slot') === slot)),
  }));
}

/** True when 1 ≤ minimum ≤ target ≤ maximum ≤ 999 999, whole numbers (what the profile schema accepts). */
export function quantitiesInOrder(rule: Pick<ConsumableRule, 'minQty' | 'targetQty' | 'maxQty'>): boolean {
  const values = [rule.minQty, rule.targetQty, rule.maxQty];
  return values.every((value) => Number.isInteger(value) && value >= 1 && value <= MAX_QUANTITY) && rule.minQty <= rule.targetQty && rule.targetQty <= rule.maxQty;
}

/** One rule per character and item; a rule with quantities out of order is refused (the draft is returned as is). */
export function setConsumableRule(draft: Draft, rule: ConsumableRule): Draft {
  if (!quantitiesInOrder(rule)) {
    return draft;
  }
  const same = (entry: unknown): boolean => field(entry, 'character') === rule.character && field(entry, 'item') === rule.item;
  return updateBoard(draft, 'consumables', (current) => ({ ...current, rules: placeRule(list(current['rules']), rule, same) }));
}

export function removeConsumableRule(draft: Draft, character: string, item: string): Draft {
  return updateBoard(draft, 'consumables', (current) => ({
    ...current, rules: list(current['rules']).filter((entry) => !(field(entry, 'character') === character && field(entry, 'item') === item)),
  }));
}
