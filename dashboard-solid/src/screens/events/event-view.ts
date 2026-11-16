/** What the Events dialog shows, read from the profile (pure: tested without a browser). */
import { BASE_STYLES } from '../../../shared/loadouts.ts';
import type { Profile } from '../../../shared/profile.ts';
import { field, list, record, strings, text, truthy } from '../../../shared/raw.ts';
import { BOSS_CHECK_INTERVALS, WORLD_BOSSES } from '../../../shared/events.ts';
import type { BossRule } from '../../profile/event-draft.ts';

export interface EventsView {
  readonly enabled: boolean;
  readonly allowed: readonly string[];
  readonly styles: Readonly<Record<string, string>>;
  readonly checks: { readonly enabled: boolean; readonly rules: readonly BossRule[] };
}

const numberOr = (value: unknown, fallback: number): number => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);

export function readEvents(profile: Profile): EventsView {
  const events = profile['events'];
  const checks = field(profile['farming'], 'bossChecks');
  return {
    enabled: truthy(field(events, 'enabled')),
    allowed: strings(field(events, 'allowed')),
    styles: Object.fromEntries(Object.entries(record(field(events, 'style'))).map(([id, style]) => [id, text(style)])),
    checks: { enabled: truthy(field(checks, 'enabled')), rules: list(field(checks, 'rules')).map((rule) => ({ boss: text(field(rule, 'boss')), everyMinutes: numberOr(field(rule, 'everyMinutes'), 240) })) },
  };
}

/** AOE / Mono / Tank, then every custom loadout name of the team (the build an event can use). */
export function styleOptions(profile: Profile): string[] {
  const boards = Object.values(record(field(profile['farming'], 'loadouts')));
  return [...new Set([...BASE_STYLES, ...boards.flatMap((board) => Object.keys(record(board)))])];
}

/** A new rule for the first world boss not checked yet (or null when all are), every 4 hours. */
export function nextBossRule(rules: readonly BossRule[]): BossRule | null {
  const boss = WORLD_BOSSES.find((id) => !rules.some((rule) => rule.boss === id));
  return boss === undefined ? null : { boss, everyMinutes: 240 };
}

/** The rules with one replaced, or removed with null. */
export function replaceRule(rules: readonly BossRule[], index: number, rule: BossRule | null): BossRule[] {
  return rules.flatMap((entry, position) => {
    if (position !== index) {
      return [entry];
    }
    return rule === null ? [] : [rule];
  });
}

/** The selectable intervals, plus the current one if the profile holds another value. */
export function intervalsWith(current: number): number[] {
  return BOSS_CHECK_INTERVALS.includes(current) ? [...BOSS_CHECK_INTERVALS] : [...BOSS_CHECK_INTERVALS, current].toSorted((a, b) => a - b);
}
