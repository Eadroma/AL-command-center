/**
 * Migration relay: reads live telemetry from dashboard-v2 (GET /api/deployments), which still builds and runs
 * the game scripts. Read-only; enabled by settings.migration.relayV2Url. Removed after the cutover.
 */
import { z } from 'zod';
import type { Stock } from '../../shared/stock.ts';
import type { CharacterLive } from '../../shared/telemetry.ts';
import { insightOf, runtimeSections } from './insight.ts';
import { characterLive } from './live-state.ts';
import { bankStockOf, characterStockOf, mergeStock } from './stock.ts';

const viewSchema = z.looseObject({
  lastSeen: z.number().nullable().optional(),
  stats: z.looseObject({
    hp: z.number(), max_hp: z.number(), mp: z.number(), max_mp: z.number(), level: z.number(), gold: z.number(),
    map: z.string(), x: z.number(), y: z.number(), target: z.string(), server: z.string().optional(), skin: z.string().optional(),
  }).optional(),
  ...runtimeSections,
  logs: z.array(z.looseObject({ time: z.number(), message: z.string() })).optional().catch(undefined),
  positionHistory: z.array(z.looseObject({ at: z.number(), map: z.string(), x: z.number(), y: z.number() })).optional(),
  failures: z.array(z.looseObject({ at: z.number(), reason: z.string(), details: z.string() })).optional(),
});

const deploymentsSchema = z.looseObject({
  characters: z.record(z.string(), z.looseObject({ telemetry: viewSchema.nullable().optional(), script: z.string().optional() })),
});

type View = z.infer<typeof viewSchema> | undefined;

function positionsOf(view: View): CharacterLive['positions'] {
  return (view?.positionHistory ?? []).map((point) => ({ at: point.at, map: point.map, x: point.x, y: point.y }));
}

/** The last 20 lines, trimmed to our schema's limits: v2 keeps 100 and does not bound their length. */
function logsOf(view: View): CharacterLive['logs'] {
  return (view?.logs ?? []).slice(-20).map((line) => ({ at: line.time, message: line.message.slice(0, 500) }));
}

/** Trimmed to our schema's limits: v2 does not bound them. */
function failuresOf(view: View): CharacterLive['failures'] {
  return (view?.failures ?? []).map((failure) => ({ at: failure.at, reason: failure.reason.slice(0, 80), details: failure.details.slice(0, 240) }));
}

export function mapV2Deployments(body: unknown, now: number): CharacterLive[] | null {
  const parsed = deploymentsSchema.safeParse(body);
  if (!parsed.success) {
    return null;
  }
  return Object.entries(parsed.data.characters).map(([name, deployment]) => {
    const view = deployment.telemetry ?? undefined;
    return characterLive({
      name, source: 'v2', lastSeen: view?.lastSeen ?? null, stats: view?.stats, activity: view?.intent?.state, now,
      positions: positionsOf(view), failures: failuresOf(view), logs: logsOf(view),
      insight: insightOf(view ?? {}, deployment.script ?? null),
    });
  });
}

/** Bags, equipment and bank as v2 last received them (its view keeps the newest bank snapshot of each character). */
export function mapV2Stock(body: unknown): Stock | null {
  const parsed = deploymentsSchema.safeParse(body);
  if (!parsed.success) {
    return null;
  }
  const reports = Object.entries(parsed.data.characters).flatMap(([name, deployment]): Stock[] => {
    const view = deployment.telemetry;
    const lastSeen = view?.lastSeen ?? null;
    if (view === null || view === undefined || lastSeen === null) {
      return [];
    }
    const character = characterStockOf(name, view, lastSeen);
    return [{ characters: character === null ? [] : [character], bank: bankStockOf(name, view, lastSeen) }];
  });
  return mergeStock(...reports);
}

export interface V2Poll {
  readonly characters: CharacterLive[];
  readonly stock: Stock;
}

export async function pollV2(baseUrl: string, now: number, fetchImpl: typeof fetch = fetch): Promise<V2Poll | null> {
  try {
    const response = await fetchImpl(new URL('/api/deployments', baseUrl), { signal: AbortSignal.timeout(5000) });
    if (!response.ok) {
      return null;
    }
    const body: unknown = await response.json();
    const characters = mapV2Deployments(body, now);
    return characters === null ? null : { characters, stock: mapV2Stock(body) ?? { characters: [], bank: null } };
  } catch {
    return null;
  }
}
