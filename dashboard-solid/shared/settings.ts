/**
 * settings.json schema, shared by the server (validation, storage) and the UI (form types).
 * Sections other than `account` and `game` have defaults, so an older or partial file stays valid.
 * The MCP token never reaches the UI: it only sees `hasToken` in PublicSettings.
 */
import { z } from 'zod';

const portSchema = z.number().int().min(1024).max(65_535);

export const settingsSchema = z.object({
  version: z.literal(1),
  account: z.object({
    mcpUrl: z.url().default('https://adventure.land/mcp'),
    mcpToken: z.string().default(''),
  }),
  game: z.object({
    region: z.string().min(1),
    server: z.string().min(1),
    runtime: z.enum(['browser', 'mainframe']).default('browser'),
    codeDirectory: z.string().min(1).default('../code'),
  }),
  dashboard: z.object({
    mode: z.enum(['local', 'hosted']).default('local'),
    publicUrl: z.union([z.literal(''), z.url()]).default(''),
    host: z.string().min(1).default('127.0.0.1'),
    port: portSchema.default(9320),
    dataDirectory: z.string().default(''),
    language: z.enum(['fr', 'en']).default('fr'),
    theme: z.enum(['night', 'day']).default('night'),
  }).prefault({}),
  gameData: z.object({
    autoUpdate: z.boolean().default(true),
    checkEveryHours: z.number().int().min(1).default(24),
    docsEveryDays: z.number().int().min(1).default(7),
  }).prefault({}),
  market: z.object({
    enabled: z.boolean().default(false),
    refreshMinutes: z.number().int().min(5).default(15),
  }).prefault({}),
  deploy: z.object({
    enabled: z.boolean().default(true),
  }).prefault({}),
  migration: z.object({
    /** dashboard-v2 address to relay live telemetry from while v2 still runs the scripts; '' = off. */
    relayV2Url: z.union([z.literal(''), z.url()]).default(''),
  }).prefault({}),
});

export type Settings = z.infer<typeof settingsSchema>;

/** One validation problem, as a stable code the UI translates (never a sentence). */
export interface SettingsIssue {
  readonly path: string;
  readonly code: string;
}

export type SettingsState =
  | { readonly status: 'missing'; readonly file: string }
  | { readonly status: 'invalid'; readonly file: string; readonly issues: readonly SettingsIssue[] }
  | { readonly status: 'ready'; readonly file: string; readonly settings: Settings };

/** What the Settings screen sends. An empty token means "keep the saved one". */
export const settingsUpdateSchema = z.object({
  mcpToken: z.string().trim(),
  region: z.string().min(1),
  server: z.string().min(1),
  runtime: z.enum(['browser', 'mainframe']),
  language: z.enum(['fr', 'en']),
  port: portSchema,
});

export type SettingsUpdate = z.infer<typeof settingsUpdateSchema>;

/** What the UI may know about the settings: never the token, only whether one is saved. */
export const publicSettingsSchema = z.object({
  hasToken: z.boolean(),
  region: z.string(),
  server: z.string(),
  runtime: z.enum(['browser', 'mainframe']),
  mode: z.enum(['local', 'hosted']),
  language: z.enum(['fr', 'en']),
  theme: z.enum(['night', 'day']),
  deployEnabled: z.boolean(),
  marketEnabled: z.boolean(),
  port: z.number(),
});

export type PublicSettings = z.infer<typeof publicSettingsSchema>;

const settingsIssueSchema = z.object({ path: z.string(), code: z.string() });

/** Settings as the UI sees them (GET /api/settings). */
export const settingsResponseSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('missing'), file: z.string() }),
  z.object({ status: z.literal('invalid'), file: z.string(), issues: z.array(settingsIssueSchema).readonly() }),
  z.object({ status: z.literal('ready'), file: z.string(), settings: publicSettingsSchema }),
]);

export type SettingsResponse = z.infer<typeof settingsResponseSchema>;

/** PUT /api/settings success body. */
export const settingsSavedSchema = z.object({ restartRequired: z.boolean(), settings: settingsResponseSchema });

export function toPublicSettings(settings: Settings): PublicSettings {
  return {
    hasToken: settings.account.mcpToken !== '',
    region: settings.game.region,
    server: settings.game.server,
    runtime: settings.game.runtime,
    mode: settings.dashboard.mode,
    language: settings.dashboard.language,
    theme: settings.dashboard.theme,
    deployEnabled: settings.deploy.enabled,
    marketEnabled: settings.market.enabled,
    port: settings.dashboard.port,
  };
}
