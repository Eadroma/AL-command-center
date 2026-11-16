/**
 * Telemetry packet sent by the game scripts, compatible with dashboard-v2's instrumented bundles.
 * Validated loosely: the fields the dashboard uses are required, everything else v2 sends is accepted.
 */
import { z } from 'zod';
import { runtimeSections } from './insight.ts';

export const commandReceiptSchema = z.object({
  id: z.string().max(80),
  state: z.enum(['complete', 'failed', 'review']),
  message: z.string().max(180),
});

export const packetSchema = z.looseObject({
  ticket: z.string().regex(/^[0-9a-f]{64}$/),
  character: z.string().min(1).max(40),
  sequence: z.number().int().nonnegative(),
  stats: z.looseObject({
    hp: z.number(),
    max_hp: z.number(),
    mp: z.number(),
    max_mp: z.number(),
    level: z.number(),
    gold: z.number(),
    map: z.string().max(80),
    x: z.number().default(0),
    y: z.number().default(0),
    target: z.string().max(80),
    server: z.string().max(40).optional(),
    skin: z.string().max(80).default(''),
  }),
  ...runtimeSections,
  logs: z.array(z.string().max(500)).max(20).default([]),
  failures: z.array(z.object({ at: z.number(), reason: z.string().max(80), details: z.string().max(240) })).max(10).default([]),
  commandProtocol: z.literal(2).optional(),
  commandReceipts: z.array(commandReceiptSchema).max(200).optional(),
});

export type Packet = z.infer<typeof packetSchema>;
export type CommandReceipt = z.infer<typeof commandReceiptSchema>;
