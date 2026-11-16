/** Script catalogue as the UI sees it: no source, no CONFIG, only what screens need to explain a choice. */
import { z } from 'zod';

export const scriptSummarySchema = z.object({
  id: z.string(),
  label: z.string(),
  ctype: z.string(),
  kind: z.enum(['farm', 'crypt', 'utility']),
  /** Target pinned by the script itself (CONFIG.FIXED_FARM): the profile's targets do not apply. */
  fixedFarm: z.string().nullable(),
});

export const scriptsResponseSchema = z.object({
  scripts: z.array(scriptSummarySchema).readonly(),
  /** Monsters the warrior fights with its single-target weapon: a new target starts in Mono style, others in AOE. */
  monoTargets: z.array(z.string()).readonly(),
});

export type ScriptSummary = z.infer<typeof scriptSummarySchema>;
export type ScriptsResponse = z.infer<typeof scriptsResponseSchema>;
