/**
 * Supply screen model (pure, tested without a browser).
 * Reservations: one list per character of the pieces it must keep, whether a loadout asks for them (worn when that
 * style is active) or the kit does (brought by the merchant, always worn). Scripts never sell or bank either kind.
 * Each piece says where it is, from the last reported bags, equipment and bank; unknown stays unknown.
 */
import type { GearSlot } from '../../../shared/loadouts.ts';
import { GEAR_SLOTS } from '../../../shared/loadouts.ts';
import type { Profile, ProfileCharacter } from '../../../shared/profile.ts';
import { field, list, record, text, truthy } from '../../../shared/raw.ts';
import type { CharacterStock, Stock } from '../../../shared/stock.ts';
import type { ConsumableMode, ConsumableRule, ConsumableSource, KitRule } from '../../profile/seller-draft.ts';

export interface ReservedPiece {
  readonly character: string;
  readonly slot: GearSlot;
  readonly item: string;
  readonly minLevel: number;
  /** Loadout styles that wear it, in loadout order. */
  readonly styles: readonly string[];
  /** The kit rule for this slot, when the merchant brings this piece. */
  readonly kit: KitRule | null;
}

export type Place =
  | { readonly kind: 'worn' }
  | { readonly kind: 'bag' }
  | { readonly kind: 'bank'; readonly pack: string }
  | { readonly kind: 'other'; readonly holder: string }
  | { readonly kind: 'missing' }
  | { readonly kind: 'unknown' };

/** A stored number, 0 when absent or not a number. */
const numberOr0 = (value: unknown): number => { const number = Number(value); return Number.isFinite(number) ? number : 0; };

const isSlot = (value: unknown): value is GearSlot => GEAR_SLOTS.some((slot) => slot === value);

/** Characters the merchant supplies: everyone but merchants, in roster order. */
export function suppliedCharacters(profile: Profile): ProfileCharacter[] {
  return profile.characters.filter((character) => character.ctype !== 'merchant');
}

export function kitRules(profile: Profile): KitRule[] {
  return list(field(field(profile['seller'], 'kit'), 'rules')).flatMap((rule): KitRule[] => {
    const slot = field(rule, 'slot');
    return isSlot(slot) ? [{ character: text(field(rule, 'character')), slot, item: text(field(rule, 'item')), minLevel: numberOr0(field(rule, 'minLevel')), shiny: truthy(field(rule, 'shiny')) }] : [];
  });
}

export function boardEnabled(profile: Profile, board: 'kit' | 'consumables'): boolean {
  const value = field(field(profile['seller'], board), 'enabled');
  // An absent board is on by default, as in dashboard-v2.
  return value === undefined || truthy(value);
}

/** The pieces a character keeps: its loadout gear (merged across styles) and its kit, in slot order. */
export function reservedPieces(profile: Profile, character: string): ReservedPiece[] {
  const pieces = new Map<string, { slot: GearSlot; item: string; minLevel: number; styles: string[]; kit: KitRule | null }>();
  const entry = (slot: GearSlot, item: string): { slot: GearSlot; item: string; minLevel: number; styles: string[]; kit: KitRule | null } => {
    const key = `${slot}:${item}`;
    const known = pieces.get(key) ?? { slot, item, minLevel: 0, styles: [], kit: null };
    pieces.set(key, known);
    return known;
  };
  const board = record(field(field(profile['farming'], 'loadouts'), character));
  for (const [style, loadout] of Object.entries(board)) {
    for (const rule of list(field(loadout, 'gear'))) {
      const slot = field(rule, 'slot');
      const item = text(field(rule, 'item'));
      if (isSlot(slot) && item !== '') {
        const piece = entry(slot, item);
        piece.minLevel = Math.max(piece.minLevel, numberOr0(field(rule, 'minLevel')));
        piece.styles.push(style);
      }
    }
  }
  for (const rule of kitRules(profile).filter((kit) => kit.character === character)) {
    const piece = entry(rule.slot, rule.item);
    piece.minLevel = Math.max(piece.minLevel, rule.minLevel);
    piece.kit = rule;
  }
  return [...pieces.values()]
    .sort((a, b) => (a.slot === b.slot ? a.item.localeCompare(b.item) : GEAR_SLOTS.indexOf(a.slot) - GEAR_SLOTS.indexOf(b.slot)))
    .map((piece) => ({ character, ...piece }));
}

const fits = (piece: ReservedPiece) => (item: { readonly name: string; readonly level: number }): boolean => item.name === piece.item && item.level >= piece.minLevel;

function holds(stock: CharacterStock, piece: ReservedPiece): boolean {
  return stock.inventory.some(fits(piece)) || stock.equipment.some(fits(piece));
}

/**
 * Where the piece is: worn in its slot, in the owner's bags (or worn elsewhere), in the bank, held by someone else.
 * Missing only when the owner's and the bank's contents are both known; otherwise unknown.
 */
export function placeOf(piece: ReservedPiece, stock: Stock): Place {
  const owner = stock.characters.find((character) => character.name === piece.character);
  if (owner?.equipment.some((item) => item.slot === piece.slot && fits(piece)(item) && (piece.kit?.shiny !== true || item.shiny)) === true) {
    return { kind: 'worn' };
  }
  if (owner !== undefined && holds(owner, piece)) {
    return { kind: 'bag' };
  }
  const banked = stock.bank?.items.find(fits(piece));
  if (banked !== undefined) {
    return { kind: 'bank', pack: banked.pack };
  }
  const holder = stock.characters.find((character) => character.name !== piece.character && holds(character, piece));
  if (holder !== undefined) {
    return { kind: 'other', holder: holder.name };
  }
  return owner === undefined || stock.bank === null ? { kind: 'unknown' } : { kind: 'missing' };
}

const MODES: readonly ConsumableMode[] = ['carry', 'elixir'];
const SOURCES: readonly ConsumableSource[] = ['mule', 'bank', 'either'];

export function consumableRules(profile: Profile): ConsumableRule[] {
  return list(field(field(profile['seller'], 'consumables'), 'rules')).map((rule): ConsumableRule => {
    const mode = MODES.find((value) => value === field(rule, 'mode')) ?? 'carry';
    const source = SOURCES.find((value) => value === field(rule, 'source')) ?? 'either';
    return {
      character: text(field(rule, 'character')), item: text(field(rule, 'item')),
      minQty: Number(field(rule, 'minQty')), targetQty: Number(field(rule, 'targetQty')), maxQty: Number(field(rule, 'maxQty')), mode, source,
    };
  });
}

export type StockLevel = 'unknown' | 'low' | 'healthy' | 'excess';

/** How many the character holds (bags and equipment, as the merchant counts them), or null without telemetry. */
export function heldQuantity(stock: Stock, character: string, item: string): number | null {
  const owner = stock.characters.find((entry) => entry.name === character);
  if (owner === undefined) {
    return null;
  }
  return [...owner.inventory, ...owner.equipment].filter((entry) => entry.name === item).reduce((total, entry) => total + entry.quantity, 0);
}

export function stockLevel(rule: ConsumableRule, held: number | null): StockLevel {
  if (held === null) {
    return 'unknown';
  }
  if (held < rule.minQty) {
    return 'low';
  }
  return held > rule.maxQty ? 'excess' : 'healthy';
}

/** Slots where the kit forces one piece and a loadout wants another: the character would keep swapping. */
export function conflictingSlots(pieces: readonly ReservedPiece[]): ReadonlySet<GearSlot> {
  const kit = new Map(pieces.filter((piece) => piece.kit !== null).map((piece) => [piece.slot, piece.item]));
  return new Set(pieces.filter((piece) => piece.styles.length > 0 && kit.has(piece.slot) && kit.get(piece.slot) !== piece.item).map((piece) => piece.slot));
}
