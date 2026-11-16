/**
 * Profile routes. Saving never deploys. Every write names the revision it started from; a stale one gets 409 and
 * the UI reloads. Creating (cautious) or importing (v2) also names what it replaces, so a click in an old window
 * cannot wipe a newer profile.
 */
import type { Context, Hono } from 'hono';
import type { z } from 'zod';
import type { Profile } from '../../shared/profile.ts';
import { profileReplaceSchema, profileSaveSchema } from '../../shared/profile.ts';
import type { ProfileStore, WriteResult } from '../profile/store.ts';
import { cautiousProfile, fetchV2Profile } from '../profile/sources.ts';
import type { ScriptInfo } from '../builder/catalogue.ts';
import type { SettingsHolder } from '../settings/holder.ts';
import type { AccountRoster } from './account.ts';

export interface ProfileRouteOptions {
  readonly store: ProfileStore;
  /** Script catalogue, for the cautious profile's default scripts. */
  readonly scripts: () => readonly ScriptInfo[];
  readonly settings: SettingsHolder;
  readonly roster: AccountRoster;
  readonly fetch?: typeof fetch;
}

async function body<T>(context: Context, schema: z.ZodType<T>): Promise<T | null> {
  const parsed = schema.safeParse(await context.req.json().catch(() => null));
  return parsed.success ? parsed.data : null;
}

function answer(context: Context, result: WriteResult): Response {
  return result.ok ? context.json(result.saved) : context.json({ error: { code: result.code } }, 409);
}

const REGIONS = ['EU', 'US', 'ASIA'] as const;
const SERVERS = ['I', 'II', 'III', 'IV', 'V', 'PVP'] as const;

/** The home server from settings.json, if it is one a profile can name. */
function homeServer(settings: SettingsHolder): Profile['server'] | null {
  const state = settings.state();
  if (state.status !== 'ready') {
    return null;
  }
  const region = REGIONS.find((value) => value === state.settings.game.region);
  const name = SERVERS.find((value) => value === state.settings.game.server);
  return region === undefined || name === undefined ? null : { region, name };
}

export function profileRoutes(app: Hono, { store, settings, roster, scripts, fetch: fetchImpl }: ProfileRouteOptions): void {
  app.get('/api/profile', (context) => {
    const saved = store.read();
    return context.json(saved === null ? { status: 'missing' } : { status: 'ready', saved });
  });

  app.put('/api/profile', async (context) => {
    const input = await body(context, profileSaveSchema);
    return input === null ? context.json({ error: { code: 'profile.invalid' } }, 400) : answer(context, store.write(input.profile, input.revision, 'dashboard'));
  });

  app.post('/api/profile/cautious', async (context) => {
    const input = await body(context, profileReplaceSchema);
    const server = homeServer(settings);
    if (input === null || server === null) {
      return context.json({ error: { code: input === null ? 'profile.invalid' : 'profile.noServer' } }, 400);
    }
    const characters = await roster.characters();
    if (!characters.ok) {
      return context.json({ error: characters.error }, 422);
    }
    return answer(context, store.write(cautiousProfile(characters.characters, server, scripts()), input.revision, 'cautious'));
  });

  app.post('/api/profile/import-v2', async (context) => {
    const input = await body(context, profileReplaceSchema);
    if (input === null) {
      return context.json({ error: { code: 'profile.invalid' } }, 400);
    }
    const state = settings.state();
    const imported = await fetchV2Profile(state.status === 'ready' ? state.settings.migration.relayV2Url : '', fetchImpl);
    if (!imported.ok) {
      return context.json({ error: { code: imported.code, detail: imported.issues?.join('; ') } }, 422);
    }
    return answer(context, store.write(imported.profile, input.revision, `v2 revision ${String(imported.v2Revision)}`));
  });
}
