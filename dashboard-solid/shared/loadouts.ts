/**
 * Loadouts: per character and per style (AOE, Mono, Tank, and custom ones), the gear to wear and the skills to use.
 * Same shape as dashboard-v2's profile (farming.loadouts), so the builder and scripts read them unchanged.
 */
import { z } from 'zod';
import { spriteFrameSchema } from './game.ts';

/** Equipment slots, in dashboard-v2's order (the order gear rules are written in). */
export const GEAR_SLOTS = ['mainhand', 'offhand', 'helmet', 'chest', 'pants', 'shoes', 'gloves', 'belt', 'amulet', 'ring1', 'ring2', 'earring1', 'earring2', 'cape', 'orb'] as const;
export type GearSlot = (typeof GEAR_SLOTS)[number];

export const BASE_STYLES = ['aoe', 'mono', 'tank'] as const;
export type BaseStyle = (typeof BASE_STYLES)[number];

/** The highest item level a gear rule can ask for (dashboard-v2's limit). */
export const MAX_MIN_LEVEL = 15;

/** Which item types fit each slot; a weapon also fits the offhand (dual wielding). */
export const SLOT_TYPES: Readonly<Record<GearSlot, readonly string[]>> = {
  mainhand: ['weapon'],
  offhand: ['shield', 'source', 'quiver', 'misc_offhand', 'weapon'],
  helmet: ['helmet'],
  chest: ['chest'],
  pants: ['pants'],
  shoes: ['shoes'],
  gloves: ['gloves'],
  belt: ['belt'],
  amulet: ['amulet'],
  ring1: ['ring'],
  ring2: ['ring'],
  earring1: ['earring'],
  earring2: ['earring'],
  cape: ['cape'],
  orb: ['orb'],
};

export const catalogueEntrySchema = z.object({
  key: z.string(),
  name: z.string(),
  type: z.string(),
  /** Item or skill icon from the game's image sets; null when the image is not mirrored. */
  icon: spriteFrameSchema.nullable(),
});

export const loadoutCatalogueSchema = z.object({
  /** Every item that can be worn, with its icon. */
  items: z.array(catalogueEntrySchema).readonly(),
  /** Every other item (potions, elixirs, scrolls…): what the merchant can keep a character supplied with. */
  supplies: z.array(catalogueEntrySchema).readonly(),
  /** Skills the scripts can use, per class. */
  skills: z.record(z.string(), z.array(catalogueEntrySchema).readonly()),
});

export type CatalogueEntry = z.infer<typeof catalogueEntrySchema>;
export type LoadoutCatalogue = z.infer<typeof loadoutCatalogueSchema>;
