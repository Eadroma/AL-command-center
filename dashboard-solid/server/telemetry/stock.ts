/**
 * Bags, equipment and bank snapshot, read from our telemetry packets and from the v2 relay (same field names).
 * Each section is validated on its own: a malformed section is ignored, the rest of the packet still counts.
 */
import { z } from 'zod';
import type { BankStock, CharacterStock, Stock } from '../../shared/stock.ts';

const name = z.string().max(80);
const level = z.number().int().min(0).max(20).catch(0);
const quantity = z.number().int().positive().catch(1);

export const stockSections = {
  inventory: z.array(z.looseObject({ slot: z.number().int().min(0), name, level, quantity, locked: z.boolean().catch(false) })).max(200).optional().catch(undefined),
  equipment: z.array(z.looseObject({ slot: z.string().max(40), name, level, quantity, shiny: z.boolean().catch(false) })).max(60).optional().catch(undefined),
  bank: z.array(z.looseObject({ pack: z.string().max(40), slot: z.number().int().min(0), name, level, quantity })).max(1000).optional().catch(undefined),
  /** Our packets date the snapshot with bankCapturedAt, v2's view with bankAt. */
  bankCapturedAt: z.number().optional().catch(undefined),
  bankAt: z.number().optional().catch(undefined),
};

const sectionsSchema = z.looseObject(stockSections);

/** What one character reported, or null when it reported neither bags nor equipment. */
export function characterStockOf(character: string, source: unknown, at: number): CharacterStock | null {
  const parsed = sectionsSchema.safeParse(source);
  if (!parsed.success || (parsed.data.inventory === undefined && parsed.data.equipment === undefined)) {
    return null;
  }
  const { inventory = [], equipment = [] } = parsed.data;
  return {
    name: character,
    at,
    inventory: inventory.map((item) => ({ slot: item.slot, name: item.name, level: item.level, quantity: item.quantity, locked: item.locked })),
    equipment: equipment.map((item) => ({ slot: item.slot, name: item.name, level: item.level, quantity: item.quantity, shiny: item.shiny })),
  };
}

/** The bank snapshot a character sent, or null (scripts only send one while their bank is known). */
export function bankStockOf(owner: string, source: unknown, fallbackAt: number): BankStock | null {
  const parsed = sectionsSchema.safeParse(source);
  if (!parsed.success || parsed.data.bank === undefined) {
    return null;
  }
  const items = parsed.data.bank.map((item) => ({ pack: item.pack, slot: item.slot, name: item.name, level: item.level, quantity: item.quantity }));
  return { owner, at: parsed.data.bankCapturedAt ?? parsed.data.bankAt ?? fallbackAt, items };
}

/** Newest report per character, and the newest bank snapshot, whichever source it came from. */
export function mergeStock(...sources: readonly Stock[]): Stock {
  const characters = new Map<string, CharacterStock>();
  let bank: BankStock | null = null;
  for (const source of sources) {
    for (const character of source.characters) {
      const known = characters.get(character.name);
      if (known === undefined || character.at > known.at) {
        characters.set(character.name, character);
      }
    }
    if (source.bank !== null && (bank === null || source.bank.at > bank.at)) {
      ({ bank } = source);
    }
  }
  return { characters: [...characters.values()].sort((a, b) => a.name.localeCompare(b.name)), bank };
}
