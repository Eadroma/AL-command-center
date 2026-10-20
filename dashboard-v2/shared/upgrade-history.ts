import { z } from 'zod';
export const upgradeActionSchema = z.object({
  id: z.string().max(80), item: z.string().max(80), runId: z.string().max(80), kind: z.enum(['upgrade', 'purchase']),
  level: z.number().int().min(0).max(20), target: z.number().int().min(0).max(20), cost: z.number().nonnegative(), at: z.number().nonnegative(),
  outcome: z.enum(['pending', 'success', 'destroyed', 'not_executed']), before: z.string().max(2000), after: z.string().max(2000).optional(), resolvedAt: z.number().optional(), manual: z.boolean().optional(), automatic: z.boolean().optional(),
});
export const upgradeHistorySchema = z.object({ startedAt: z.number(), entries: z.array(upgradeActionSchema).max(60), totals: z.array(z.object({ item: z.string().max(80), level: z.number(), kind: z.enum(['upgrade', 'purchase']), attempts: z.number().nonnegative(), successes: z.number().nonnegative(), destroyed: z.number().nonnegative(), cost: z.number().nonnegative(), pendingCost: z.number().nonnegative().default(0) })).max(500) });
export const upgradeProductionRowsSchema = z.array(z.object({ item: z.string().max(80), runId: z.string().max(80), spent: z.number().nonnegative(), produced: z.number().nonnegative(), quantity: z.number().positive(), budget: z.number().nonnegative(), pending: z.boolean(), reviewReason: z.string().max(200).optional(), reviewAt: z.number().nonnegative().optional(), action: upgradeActionSchema.optional(), unbounded: z.boolean().optional() })).max(500);
export const upgradeResolutionSchema = z.object({ item: z.string().min(1).max(80), runId: z.string().min(1).max(80), actionId: z.string().min(1).max(80), outcome: z.enum(['success', 'destroyed', 'not_executed', 'keep_cost_resume']), verified: z.literal(true) });
export type UpgradeHistory = z.infer<typeof upgradeHistorySchema>;
export type UpgradeResolution = z.infer<typeof upgradeResolutionSchema>;
