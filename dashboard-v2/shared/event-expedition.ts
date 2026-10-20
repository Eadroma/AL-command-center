import { z } from 'zod';
export const expeditionBosses = ['mrgreen', 'mrpumpkin', 'crabxx', 'franky', 'icegolem', 'snowman', 'dragold', 'grinch', 'wabbit', 'pinkgoo', 'slenderman', 'tiger', 'phoenix', 'jr', 'greenjr'] as const;
export const eventExpeditionSchema = z.object({
  enabled: z.boolean().default(false),
  allowed: z.array(z.enum(expeditionBosses)).max(expeditionBosses.length).default(['mrgreen', 'mrpumpkin']),
  maxMinutes: z.number().int().min(2).max(60).default(20),
  maxDeaths: z.number().int().min(1).max(10).default(3),
});
const expeditionMetrics = z.object({ damage: z.number().nonnegative(), bossDamage: z.number().nonnegative(), bossHits: z.number().nonnegative(), healing: z.number().nonnegative(), lootGold: z.number().nonnegative(), attacks: z.number().nonnegative(), items: z.array(z.object({name:z.string().max(80),level:z.number().min(0).max(20),quantity:z.number().positive().max(999999999)})).max(40).optional() });
const expeditionParticipant = z.object({ name: z.string().max(40), online: z.boolean(), ready: z.boolean(), readinessReason: z.string().max(200).optional(), returned: z.boolean(), deaths: z.number().nonnegative(), metrics: expeditionMetrics.optional(), reportedAt: z.number().nonnegative().optional() });
export const expeditionSummarySchema = z.object({ id: z.string().max(80), event: z.string().max(80), phase: z.enum(['complete', 'blocked']), reason: z.string().max(200), startedAt: z.number().nonnegative(), finishedAt: z.number().nonnegative(), engagedAt: z.number().nonnegative().optional(), owned: z.array(z.string().max(40)).max(2), participants: z.array(expeditionParticipant).max(2) });
export const eventExpeditionStatusSchema = z.object({
  phase: z.enum(['idle', 'forming', 'engaging', 'returning', 'blocked', 'complete']),
  id: z.string().max(80), event: z.string().max(80), reason: z.string().max(200),
  startedAt: z.number().nonnegative(), updatedAt: z.number().nonnegative(),
  loneWolfDowntimeMs: z.number().nonnegative(),
  owned: z.array(z.string().max(40)).max(2),
  participants: z.array(expeditionParticipant).max(2),
  history: z.array(expeditionSummarySchema).max(10).optional(),
});
export type EventExpeditionStatus = z.infer<typeof eventExpeditionStatusSchema>;
