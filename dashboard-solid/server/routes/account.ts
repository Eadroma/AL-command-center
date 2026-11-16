/**
 * Account characters (name, class, level) from the game, for the Team screen.
 * Reuses the Settings connection test with the saved token; cached 10 minutes, never exposes the token.
 */
import type { Hono } from 'hono';
import type { AccountCharacter, ApiError } from '../../shared/account.ts';
import type { SettingsHolder } from '../settings/holder.ts';

const CACHE_MS = 10 * 60_000;

type RosterResult = { readonly ok: true; readonly characters: readonly AccountCharacter[] } | { readonly ok: false; readonly error: ApiError };

export interface AccountRoster {
  readonly characters: () => Promise<RosterResult>;
}

export function createAccountRoster(settings: SettingsHolder, now: () => number = Date.now): AccountRoster {
  let cached: { readonly at: number; readonly result: Promise<RosterResult> } | null = null;
  return {
    characters: () => {
      if (cached === null || now() - cached.at > CACHE_MS) {
        const result = settings.check('').then((check): RosterResult => (check.ok ? { ok: true, characters: check.value.characters } : { ok: false, error: check.error }));
        cached = { at: now(), result };
        // A failure is not cached: the next request retries.
        void result.then((value) => { if (!value.ok) { cached = null; } });
      }
      return cached.result;
    },
  };
}

export function accountRoutes(app: Hono, roster: AccountRoster): void {
  app.get('/api/account/characters', async (context) => {
    const result = await roster.characters();
    return result.ok ? context.json({ characters: result.characters }) : context.json({ error: result.error }, 422);
  });
}
