/**
 * Live state of each character as the UI sees it, whatever the source (our telemetry endpoint,
 * or the dashboard-v2 relay during the migration). Unknown values stay null, never guessed.
 */
import { z } from 'zod';

export const FRESH_FOR_MS = 20_000;

const positionSchema = z.object({ at: z.number(), map: z.string(), x: z.number(), y: z.number() });

/** A death reported by the script, with its own diagnosis (e.g. "healer out of range"). */
export const failureSchema = z.object({ at: z.number(), reason: z.string().max(80), details: z.string().max(240) });

const pointSchema = z.object({ map: z.string(), x: z.number(), y: z.number() });

/**
 * What the script says about its own decisions, used to explain "why" in the character panel.
 * Free texts (blockedBy, reasons, lastAction) are the script's own words, shown as-is.
 */
export const insightSchema = z.object({
  /** When the reported activity started. */
  since: z.number().nullable(),
  destination: pointSchema.nullable(),
  blockedBy: z.string().nullable(),
  movement: z.object({ state: z.string(), stalledForMs: z.number(), attempts: z.number(), lastAction: z.string() }).nullable(),
  /** Game socket as the script sees it; null when not reported. */
  connected: z.boolean().nullable(),
  /** Reason of an active safety hold (too much danger, death budget…). */
  danger: z.string().nullable(),
  /** Latest combat decision: "Target out of range", "Attack / heal cooldown"… */
  combat: z.string().nullable(),
  /** A task the script suspended on purpose, with why. */
  hold: z.object({ task: z.string(), reason: z.string() }).nullable(),
  coordination: z.object({
    role: z.enum(['leader', 'follower']),
    monster: z.string().nullable(),
    phase: z.string().nullable(),
    ready: z.array(z.string()).readonly(),
    canEngage: z.boolean(),
  }).nullable(),
  /** Name of the running script (known through the v2 relay; our own deployments will set it). */
  script: z.string().nullable(),
});

export const logLineSchema = z.object({ at: z.number(), message: z.string().max(500) });

export const characterLiveSchema = z.object({
  name: z.string(),
  source: z.enum(['telemetry', 'v2']),
  /** live: a packet in the last 20 s; stale: older; never: nothing received yet. */
  freshness: z.enum(['live', 'stale', 'never']),
  lastSeen: z.number().nullable(),
  level: z.number().nullable(),
  hp: z.number().nullable(),
  maxHp: z.number().nullable(),
  mp: z.number().nullable(),
  maxMp: z.number().nullable(),
  map: z.string().nullable(),
  x: z.number().nullable(),
  y: z.number().nullable(),
  server: z.string().nullable(),
  target: z.string().nullable(),
  skin: z.string().nullable(),
  /** What the script says it is doing (set_message), e.g. "Hunting bigbird". */
  activity: z.string().nullable(),
  gold: z.number().nullable(),
  positions: z.array(positionSchema).readonly(),
  failures: z.array(failureSchema).readonly(),
  insight: insightSchema,
  /** Latest script log lines, oldest first (at most 20). */
  logs: z.array(logLineSchema).readonly(),
});

export const teamLiveSchema = z.object({
  at: z.number(),
  characters: z.array(characterLiveSchema).readonly(),
});

/** Messages on the /live WebSocket. */
export const liveMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('hello') }),
  z.object({ type: z.literal('team'), team: teamLiveSchema }),
]);

export type CharacterLive = z.infer<typeof characterLiveSchema>;
export type Failure = z.infer<typeof failureSchema>;
export type Insight = z.infer<typeof insightSchema>;
export type LogLine = z.infer<typeof logLineSchema>;
export type TeamLive = z.infer<typeof teamLiveSchema>;
export type LiveMessage = z.infer<typeof liveMessageSchema>;

export function freshnessOf(lastSeen: number | null, now: number): CharacterLive['freshness'] {
  if (lastSeen === null) {
    return 'never';
  }
  return now - lastSeen <= FRESH_FOR_MS ? 'live' : 'stale';
}
