/**
 * Telemetry routes. POST /api/telemetry receives the game scripts' packets (the only route open to
 * https://adventure.land, see security.ts) and answers with the commands still awaiting a receipt.
 * GET /api/team/live returns the merged team state, the same one /live pushes; GET /api/stock the bags, equipment
 * and bank snapshot (fetched on demand: too large to push every second).
 */
import type { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { TELEMETRY_PATH } from '../security.ts';
import type { TeamFeed } from '../telemetry/feed.ts';
import type { TelemetryStore } from '../telemetry/store.ts';

export interface TelemetryRouteOptions {
  readonly store: TelemetryStore;
  readonly feed: TeamFeed;
}

export function telemetryRoutes(app: Hono, { store, feed }: TelemetryRouteOptions): void {
  // Bank snapshots and expedition history make large packets; same bound as dashboard-v2.
  app.post(TELEMETRY_PATH, bodyLimit({ maxSize: 1_000_000, onError: (context) => context.json({ error: { code: 'telemetry.tooLarge' } }, 413) }), async (context) => {
    const body: unknown = await context.req.json().catch(() => null);
    const result = store.ingest(body);
    if (!result.ok) {
      return context.json({ error: { code: result.code } }, result.code === 'telemetry.unknownTicket' ? 403 : 400);
    }
    return context.json({ ok: true, accepted: result.accepted, commands: result.commands });
  });

  app.get('/api/team/live', (context) => context.json(feed.snapshot()));

  app.get('/api/stock', (context) => context.json(feed.stock()));
}
