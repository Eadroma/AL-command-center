/**
 * What each character carries and wears, and the latest bank snapshot, as the scripts last reported them.
 * Used to say where a reserved piece or a consumable is. A character without telemetry is simply absent: unknown,
 * never "empty".
 */
import { z } from 'zod';

const itemSchema = z.object({
  name: z.string().max(80),
  level: z.number().int().min(0).max(20),
  quantity: z.number().int().positive(),
});

export const equippedItemSchema = itemSchema.extend({ slot: z.string().max(40), shiny: z.boolean() });
export const bagItemSchema = itemSchema.extend({ slot: z.number().int().min(0), locked: z.boolean() });
export const bankItemSchema = itemSchema.extend({ pack: z.string().max(40), slot: z.number().int().min(0) });

export const characterStockSchema = z.object({
  name: z.string(),
  /** When the script reported it. */
  at: z.number(),
  equipment: z.array(equippedItemSchema).readonly(),
  inventory: z.array(bagItemSchema).readonly(),
});

export const bankStockSchema = z.object({
  /** The character whose script took the snapshot (only one is open at a time, the bank is shared). */
  owner: z.string(),
  at: z.number(),
  items: z.array(bankItemSchema).readonly(),
});

export const stockSchema = z.object({
  characters: z.array(characterStockSchema).readonly(),
  bank: bankStockSchema.nullable(),
});

export type EquippedItem = z.infer<typeof equippedItemSchema>;
export type BagItem = z.infer<typeof bagItemSchema>;
export type BankItem = z.infer<typeof bankItemSchema>;
export type CharacterStock = z.infer<typeof characterStockSchema>;
export type BankStock = z.infer<typeof bankStockSchema>;
export type Stock = z.infer<typeof stockSchema>;
