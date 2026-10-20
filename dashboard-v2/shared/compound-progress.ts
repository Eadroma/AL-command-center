import { z } from 'zod';
export const compoundProgressSchema = z.array(z.object({
  item: z.string().min(1).max(80), attempts: z.number().int().nonnegative(),
  successes: z.number().int().nonnegative(), destroyed: z.number().int().nonnegative(),
  unconfirmed: z.number().int().nonnegative(), scrollGold: z.number().finite().nonnegative(),
  updatedAt: z.number().finite().nonnegative(),
})).max(100);
export type CompoundProgress = z.infer<typeof compoundProgressSchema>;
