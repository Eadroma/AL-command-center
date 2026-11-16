/**
 * Where a first profile comes from: a cautious one built from the account's characters, or dashboard-v2's
 * current profile (read-only, through its GET /api/bootstrap).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { AccountCharacter } from '../../shared/account.ts';
import type { Profile, ProfileCharacter } from '../../shared/profile.ts';
import { CHARACTER_TYPES, profileSchema } from '../../shared/profile.ts';
import type { ScriptInfo } from '../builder/catalogue.ts';

/**
 * Builder sections of dashboard-v2's cautious first profile (everything off), extracted by tools/golden-v2.mts.
 * A cautious profile carries them so it can be previewed and built like an imported one.
 */
const CAUTIOUS_SECTIONS = z.record(z.string(), z.unknown()).parse(JSON.parse(readFileSync(path.join(import.meta.dirname, 'cautious-sections.json'), 'utf8')));

/** The usual script for a class: the farm script of that class, preferring the -v2 revision and the general one. */
export function defaultScript(ctype: ProfileCharacter['ctype'], scripts: readonly ScriptInfo[]): string {
  const rank = (script: ScriptInfo): number => Number(!script.id.endsWith('-v2')) * 2 + Number(/crab|crypt/.test(script.id));
  const candidates = scripts.filter((script) => script.ctype === ctype && script.kind === 'farm').toSorted((a, b) => (rank(a) === rank(b) ? a.id.localeCompare(b.id) : rank(a) - rank(b)));
  return candidates[0]?.id ?? '';
}

function typeOf(className: string | null): ProfileCharacter['ctype'] | null {
  return CHARACTER_TYPES.find((type) => type === className) ?? null;
}

/** Everything off: nothing runs until the player enables a character and deploys (same rule as dashboard-v2). */
export function cautiousProfile(characters: readonly AccountCharacter[], server: Profile['server'], scripts: readonly ScriptInfo[]): Profile {
  return {
    ...structuredClone(CAUTIOUS_SECTIONS),
    name: 'Main party',
    server,
    characters: characters.slice(0, 20).flatMap((character): ProfileCharacter[] => {
      const ctype = typeOf(character.className);
      return ctype === null ? [] : [{
        name: character.name, ctype, enabled: false, runtime: 'browser', script: defaultScript(ctype, scripts), follow: '', events: false,
        job: 'hunt', farmMonster: '', overrides: {},
      }];
    }),
  };
}

const bootstrapSchema = z.looseObject({ profile: z.unknown(), version: z.number() });

export type V2ImportResult =
  | { readonly ok: true; readonly profile: Profile; readonly v2Revision: number }
  | { readonly ok: false; readonly code: 'profile.v2Unreachable' | 'profile.v2Invalid' | 'profile.v2NotConfigured'; readonly issues?: readonly string[] };

export async function fetchV2Profile(baseUrl: string, fetchImpl: typeof fetch = fetch): Promise<V2ImportResult> {
  if (baseUrl === '') {
    return { ok: false, code: 'profile.v2NotConfigured' };
  }
  const body: unknown = await fetchImpl(new URL('/api/bootstrap', baseUrl), { signal: AbortSignal.timeout(10_000) })
    .then(async (response): Promise<unknown> => (response.ok ? response.json() : null))
    .catch(() => null);
  const bootstrap = bootstrapSchema.safeParse(body);
  if (!bootstrap.success) {
    return { ok: false, code: 'profile.v2Unreachable' };
  }
  const profile = profileSchema.safeParse(bootstrap.data.profile);
  return profile.success
    ? { ok: true, profile: profile.data, v2Revision: bootstrap.data.version }
    : { ok: false, code: 'profile.v2Invalid', issues: profile.error.issues.slice(0, 5).map((issue) => `${issue.path.join('.')}: ${issue.message}`) };
}
