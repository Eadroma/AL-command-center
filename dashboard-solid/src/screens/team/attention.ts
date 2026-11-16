/**
 * What needs the player's attention, computed from live state (pure, tested without a browser).
 * Each signal has a stable key; dismissing stores the key, so the same incident stays hidden but a new one
 * (another death, another silence) shows again. Low HP cannot be dismissed: it clears when HP recovers.
 */
import type { JobState } from '../../../shared/game.ts';
import type { TeamLive } from '../../../shared/telemetry.ts';
import { percent } from './team-view.ts';

export const RECENT_DEATH_MS = 30 * 60_000;
export const LOW_HP_PERCENT = 30;

export type Severity = 'danger' | 'warning' | 'info';

export type Signal =
  | { readonly kind: 'death'; readonly key: string; readonly severity: 'danger'; readonly character: string; readonly at: number; readonly reason: string }
  | { readonly kind: 'lowHp'; readonly key: string; readonly severity: 'danger'; readonly character: string; readonly percent: number }
  | { readonly kind: 'silent'; readonly key: string; readonly severity: 'warning'; readonly character: string; readonly at: number }
  | { readonly kind: 'never'; readonly key: string; readonly severity: 'info'; readonly character: string }
  | { readonly kind: 'gameData'; readonly key: string; readonly severity: 'warning'; readonly at: number };

const severityRank: Record<Severity, number> = { danger: 0, warning: 1, info: 2 };

export function isDismissable(signal: Signal): boolean {
  return signal.kind !== 'lowHp';
}

type CharacterLive = TeamLive['characters'][number];

function deathSignals(character: CharacterLive, now: number): Signal[] {
  return character.failures
    .filter((failure) => now - failure.at <= RECENT_DEATH_MS)
    .map((failure): Signal => ({ kind: 'death', key: `death:${character.name}:${String(failure.at)}`, severity: 'danger', character: character.name, at: failure.at, reason: failure.reason }));
}

function stateSignal(character: CharacterLive): Signal | null {
  const name = character.name;
  const hp = percent(character.hp, character.maxHp);
  if (character.freshness === 'live') {
    return hp !== null && hp < LOW_HP_PERCENT ? { kind: 'lowHp', key: `lowHp:${name}`, severity: 'danger', character: name, percent: hp } : null;
  }
  if (character.freshness === 'never') {
    return { kind: 'never', key: `never:${name}`, severity: 'info', character: name };
  }
  return character.lastSeen === null ? null : { kind: 'silent', key: `silent:${name}:${String(character.lastSeen)}`, severity: 'warning', character: name, at: character.lastSeen };
}

function characterSignals(team: TeamLive | null, now: number): Signal[] {
  return (team?.characters ?? []).flatMap((character): Signal[] => {
    const state = stateSignal(character);
    return state === null ? deathSignals(character, now) : [...deathSignals(character, now), state];
  });
}

export interface AttentionInput {
  readonly team: TeamLive | null;
  readonly job: JobState | null;
  readonly dismissed: ReadonlySet<string>;
  readonly now: number;
}

function bySeverityThenKey(a: Signal, b: Signal): number {
  const rank = severityRank[a.severity] - severityRank[b.severity];
  return rank === 0 ? a.key.localeCompare(b.key) : rank;
}

export function attentionSignals({ team, job, dismissed, now }: AttentionInput): Signal[] {
  const gameData: Signal[] = job?.status === 'failed' && job.finishedAt !== null
    ? [{ kind: 'gameData', key: `gameData:${job.finishedAt}`, severity: 'warning', at: Date.parse(job.finishedAt) }] : [];
  return [...characterSignals(team, now), ...gameData]
    .filter((signal) => !isDismissable(signal) || !dismissed.has(signal.key))
    .sort(bySeverityThenKey);
}
