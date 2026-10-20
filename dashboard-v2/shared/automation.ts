import { z } from 'zod';

const id = z.string().regex(/^[a-zA-Z0-9_-]+$/).max(80);
export const dangerDefaults = { enabled: false, maxAttackers: 4, retreatHpPercent: 25, resumeHpPercent: 70, requirePriest: false, healerRange: 200, action: 'hold' as const, maxDeaths: 0, runId: '', coordinatedRetreat: false };
export const dangerSchema = z.object({
  enabled: z.boolean().default(false),
  maxAttackers: z.number().int().min(1).max(30).default(4),
  retreatHpPercent: z.number().min(1).max(90).default(25),
  resumeHpPercent: z.number().min(2).max(100).default(70),
  requirePriest: z.boolean().default(false),
  healerRange: z.number().min(50).max(1000).default(200),
  action: z.enum(['hold', 'town']).default('hold'),
  maxDeaths: z.number().int().min(0).max(100).default(0),
  runId: z.union([id, z.literal('')]).default(''),
  coordinatedRetreat: z.boolean().default(false),
}).refine(value => value.resumeHpPercent > value.retreatHpPercent, 'Recovery HP must exceed retreat HP.');
export const lootGoalSchema = z.object({
  id, enabled: z.boolean(), item: id, quantity: z.number().int().min(1).max(999999),
  characters: z.array(id).min(1).max(20), action: z.enum(['notify', 'pause']),
  activityId: id.optional(),
});
export const activitySchema = z.object({
  id, name: z.string().trim().min(1).max(70), kind: z.enum(['farm', 'boss', 'cave']),
  monster: id, style: id, characters: z.array(id).min(1).max(20),
  hunts: z.boolean(), events: z.boolean(), dangers: dangerSchema,
  builds: z.record(id, id).default({}),
  consumables: z.array(id).max(20).default([]),
  contract: z.object({ items: z.array(id).min(1).max(10).refine(items => new Set(items).size === items.length, 'Contract items must be unique.'), quantity: z.number().int().min(1).max(999999), action: z.enum(['notify', 'pause']) }).optional(),
});
export const commercialGoalSchema = z.object({
  id, enabled: z.boolean(), item: id, quantity: z.number().int().min(1).max(9999),
  budget: z.number().int().min(0).max(2e12),
});
export const automationDefaults = { activities: [], lootGoals: [], dangers: dangerDefaults, commercialGoals: [], activeBuilds: {}, activeActivity: '', activeConsumables: [], combatGear: [] };
export const automationSchema = z.object({
  combatGear: z.array(z.object({ character: id, enabled: z.boolean(), combatItem: id.default('handofmidas'), combatMinLevel: z.number().int().min(0).max(15).default(0), movementItem: z.union([id, z.literal('')]).default(''), movementMinLevel: z.number().int().min(0).max(15).default(0) })).max(20).default([]),
  activeActivity: z.string().max(80).default(''),
  activeConsumables: z.array(id).max(20).default([]),
  activeBuilds: z.record(id, z.object({ monster: z.string().max(80), style: id })).default({}),
  activities: z.array(activitySchema).max(30).default([]),
  lootGoals: z.array(lootGoalSchema).max(30).default([]),
  dangers: dangerSchema.default(dangerDefaults),
  commercialGoals: z.array(commercialGoalSchema).max(30).default([]),
});
export const runtimePolicyStatusSchema = z.object({
  combatGear: z.object({ enabled: z.boolean(), phase: z.enum(['combat', 'travel']), status: z.string().max(180) }).optional(),
  diagnostic: z.object({ reason: z.string().max(180), since: z.number(), updatedAt: z.number(), target: z.string().max(80), source: z.enum(['observed', 'action']), durations: z.record(z.string().max(180), z.number().nonnegative()), actions: z.array(z.object({ at: z.number(), action: z.string().max(80), result: z.string().max(180) })).max(15) }),
  danger: z.object({ active: z.boolean(), reason: z.string().max(180), attackers: z.number(), hpPercent: z.number(), incomingDps: z.number(), healingDps: z.number(), action: z.string().max(40), deaths: z.number().int().nonnegative().optional(), deathLimit: z.number().int().nonnegative().optional() }),
  goals: z.array(z.object({ id: z.string().max(80), item: z.string().max(80), count: z.number().nonnegative(), target: z.number(), complete: z.boolean(), paused: z.boolean(), supported: z.boolean(), startedAt: z.number().optional() })).max(30),
  commerce: z.array(z.object({ id: z.string().max(80), item: z.string().max(80), held: z.number(), target: z.number(), spent: z.number(), budget: z.number(), state: z.string().max(100) })).max(30),
});
export type RuntimePolicyStatus = z.infer<typeof runtimePolicyStatusSchema>;
