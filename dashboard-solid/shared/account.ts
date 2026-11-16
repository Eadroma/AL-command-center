/**
 * Account data returned by the Settings token test, shared by server and UI.
 * Schemas are the single source: types are inferred, and the UI validates what it receives.
 */
import { z } from 'zod';

export const accountCharacterSchema = z.object({
  name: z.string(),
  level: z.number(),
  className: z.string().nullable(),
});

export const gameServerSchema = z.object({
  region: z.string(),
  name: z.string(),
  online: z.boolean(),
  players: z.number(),
});

export const accountCheckSchema = z.object({
  characters: z.array(accountCharacterSchema).readonly(),
  servers: z.array(gameServerSchema).readonly(),
});

/** Error as the API returns it: a stable code, plus a short raw detail from the game when there is one. */
export const apiErrorSchema = z.object({
  code: z.string(),
  detail: z.string().optional(),
});

export const accountCharactersSchema = z.object({ characters: z.array(accountCharacterSchema).readonly() });

export type AccountCharacter = z.infer<typeof accountCharacterSchema>;
export type GameServer = z.infer<typeof gameServerSchema>;
export type AccountCheck = z.infer<typeof accountCheckSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
