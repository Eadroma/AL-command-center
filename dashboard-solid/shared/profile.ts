/**
 * The team profile: who plays, how, and what each automation does. Same shape and field names as dashboard-v2's
 * profile, so it imports without loss and the builder can keep producing the same CONFIG.
 * Only the parts this dashboard already edits are validated strictly; the other sections (automation, farming,
 * events, seller) are kept exactly as they are until their own screens exist.
 */
import { z } from 'zod';

const key = z.string().regex(/^[\w-]+$/).max(80);

export const CHARACTER_TYPES = ['warrior', 'priest', 'ranger', 'mage', 'rogue', 'merchant', 'paladin'] as const;

export const profileCharacterSchema = z.looseObject({
  name: key,
  ctype: z.enum(CHARACTER_TYPES),
  enabled: z.boolean(),
  runtime: z.enum(['browser', 'caracal']),
  /** Script id from the code catalogue; '' until one is chosen. */
  script: z.union([key, z.literal('')]),
  /** Name of the character it follows; '' for none. */
  follow: z.string().max(80),
  /** Takes part in game events. */
  events: z.boolean(),
  job: z.enum(['hunt', 'upgrade', 'combine']),
  farmMonster: z.union([key, z.literal('')]).default(''),
  /** Per-character CONFIG values, applied by the builder. */
  overrides: z.record(z.string(), z.unknown()),
});

export const profileSchema = z.looseObject({
  name: z.string().trim().min(1).max(70),
  server: z.object({ region: z.enum(['EU', 'US', 'ASIA']), name: z.enum(['I', 'II', 'III', 'IV', 'V', 'PVP']) }),
  characters: z.array(profileCharacterSchema).max(20),
}).superRefine((profile, context) => {
  const names = profile.characters.map((character) => character.name);
  if (new Set(names).size !== names.length) {
    context.addIssue({ code: 'custom', path: ['characters'], message: 'profile.duplicateCharacter' });
  }
});

/** The saved profile with its revision: a save must name the revision it started from. */
export const savedProfileSchema = z.object({
  revision: z.number().int().positive(),
  updatedAt: z.string(),
  /** Where it came from: created here, or imported from dashboard-v2 (with v2's revision). */
  origin: z.string().max(80),
  profile: profileSchema,
});

export const profileStateSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('missing') }),
  z.object({ status: z.literal('ready'), saved: savedProfileSchema }),
]);

export const profileSaveSchema = z.object({ revision: z.number().int().positive(), profile: profileSchema });

/** Creating or importing names the revision it replaces (null when there is no profile yet). */
export const profileReplaceSchema = z.object({ revision: z.number().int().positive().nullable() });

export type Profile = z.infer<typeof profileSchema>;
export type ProfileCharacter = z.infer<typeof profileCharacterSchema>;
export type SavedProfile = z.infer<typeof savedProfileSchema>;
export type ProfileState = z.infer<typeof profileStateSchema>;
