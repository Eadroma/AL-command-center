/** What the loadout screen shows, read from the profile draft (pure: tested without a browser). */
import type { Profile } from '../../../shared/profile.ts';
import type { BaseStyle, CatalogueEntry, GearSlot } from '../../../shared/loadouts.ts';
import { BASE_STYLES, GEAR_SLOTS, SLOT_TYPES } from '../../../shared/loadouts.ts';
import { field, list, record, strings, text } from '../../../shared/raw.ts';

/** The game's character sheet: four columns, jewellery around the armour, weapons on each side. */
export const GRID: readonly (readonly (GearSlot | null)[])[] = [
  ['earring1', 'helmet', 'earring2', 'amulet'],
  ['mainhand', 'chest', 'offhand', 'cape'],
  ['ring1', 'pants', 'ring2', 'orb'],
  ['belt', 'shoes', 'gloves', null],
];

export interface Worn {
  readonly item: string;
  readonly minLevel: number;
}

export interface LoadoutView {
  readonly base: BaseStyle | null;
  readonly gear: ReadonlyMap<GearSlot, Worn>;
  readonly skills: readonly string[];
}

/** Characters of the profile that have loadouts, in the profile's order, with their style names (AOE, Mono, Tank first). */
export function boards(profile: Profile): { readonly character: string; readonly ctype: string; readonly styles: string[] }[] {
  const loadouts = record(record(profile['farming'])['loadouts']);
  return profile.characters.filter((character) => Object.hasOwn(loadouts, character.name)).map((character) => {
    const styles = Object.keys(record(loadouts[character.name]));
    const rank = (style: string): number => { const index = BASE_STYLES.findIndex((base) => base === style); return index < 0 ? BASE_STYLES.length : index; };
    return { character: character.name, ctype: character.ctype, styles: styles.toSorted((a, b) => rank(a) - rank(b)) };
  });
}

export function readLoadout(profile: Profile, character: string, style: string): LoadoutView {
  const loadout = field(field(field(profile['farming'], 'loadouts'), character), style);
  const base = BASE_STYLES.find((entry) => entry === field(loadout, 'base')) ?? null;
  const gear = new Map<GearSlot, Worn>();
  for (const rule of list(field(loadout, 'gear'))) {
    const slot = GEAR_SLOTS.find((entry) => entry === field(rule, 'slot'));
    const minLevel = Number(field(rule, 'minLevel'));
    if (slot !== undefined) {
      gear.set(slot, { item: text(field(rule, 'item')), minLevel: Number.isFinite(minLevel) ? minLevel : 0 });
    }
  }
  return { base, gear, skills: strings(field(loadout, 'skills')) };
}

/** Skills after switching one on or off: the existing order is kept, a new skill goes last. */
export function toggleSkill(skills: readonly string[], skill: string, on: boolean): string[] {
  if (!on) {
    return skills.filter((entry) => entry !== skill);
  }
  return skills.includes(skill) ? [...skills] : [...skills, skill];
}

/** The items that fit a slot. */
export function itemsFor(slot: GearSlot, items: readonly CatalogueEntry[]): CatalogueEntry[] {
  return items.filter((item) => SLOT_TYPES[slot].includes(item.type));
}
