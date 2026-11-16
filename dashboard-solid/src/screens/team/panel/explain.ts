/**
 * "Why is it doing this?" in one answer (pure, tested without a browser). A simplified port of dashboard-v2's
 * decision explanation: blockers the script reports come first, then what it is busy with. Stale data never
 * explains a live decision. Free texts are the script's own words; the UI quotes them.
 */
import type { CharacterLive } from '../../../../shared/telemetry.ts';

type Destination = NonNullable<CharacterLive['insight']['destination']>;

export type Explanation =
  | { readonly kind: 'never' }
  | { readonly kind: 'stale'; readonly lastSeen: number }
  | { readonly kind: 'disconnected' }
  | { readonly kind: 'dead' }
  | { readonly kind: 'safetyHold'; readonly reason: string }
  | { readonly kind: 'suspended'; readonly task: string; readonly reason: string }
  | { readonly kind: 'waitingTeam'; readonly ready: readonly string[] }
  | { readonly kind: 'routeRecovery'; readonly seconds: number; readonly attempts: number; readonly destination: Destination | null }
  | { readonly kind: 'blocked'; readonly reason: string }
  | { readonly kind: 'mission'; readonly monster: string; readonly phase: string; readonly leader: boolean }
  | { readonly kind: 'combat'; readonly reason: string }
  | { readonly kind: 'travelling'; readonly destination: Destination }
  | { readonly kind: 'reported'; readonly state: string }
  | { readonly kind: 'unknown' };

const WARNINGS: ReadonlySet<Explanation['kind']> = new Set(['never', 'stale', 'disconnected', 'dead', 'safetyHold', 'suspended', 'waitingTeam', 'routeRecovery', 'blocked']);

const QUOTING: ReadonlySet<Explanation['kind']> = new Set(['safetyHold', 'suspended', 'blocked', 'mission', 'combat']);

/** True when the explanation quotes the script's own words. */
export function quotesScript(explanation: Explanation): boolean {
  return QUOTING.has(explanation.kind);
}

/** True when the explanation is a problem to look at, not normal activity. */
export function isWarning(explanation: Explanation): boolean {
  return WARNINGS.has(explanation.kind);
}

const STUCK_MOVEMENT = new Set(['stalled', 'recovering', 'blocked']);

type Rule = (live: CharacterLive) => Explanation | null;

/** Things that stop the character, most serious first. */
const BLOCKERS: readonly Rule[] = [
  ({ insight }) => (insight.connected === false ? { kind: 'disconnected' } : null),
  ({ hp, insight }) => (hp === 0 || insight.blockedBy === 'dead' ? { kind: 'dead' } : null),
  ({ insight }) => (insight.danger === null ? null : { kind: 'safetyHold', reason: insight.danger }),
  ({ insight }) => (insight.hold === null ? null : { kind: 'suspended', task: insight.hold.task, reason: insight.hold.reason }),
  ({ insight }) => (insight.coordination?.canEngage === false ? { kind: 'waitingTeam', ready: insight.coordination.ready } : null),
  ({ insight }) => (insight.movement !== null && STUCK_MOVEMENT.has(insight.movement.state)
    ? { kind: 'routeRecovery', seconds: Math.floor(insight.movement.stalledForMs / 1000), attempts: insight.movement.attempts, destination: insight.destination }
    : null),
  ({ insight }) => (insight.blockedBy === null ? null : { kind: 'blocked', reason: insight.blockedBy }),
];

function blocker(live: CharacterLive): Explanation | null {
  for (const rule of BLOCKERS) {
    const found = rule(live);
    if (found !== null) {
      return found;
    }
  }
  return null;
}

/** What it is busy with when nothing blocks it. */
function activity(live: CharacterLive): Explanation {
  const { insight } = live;
  const mission = insight.coordination;
  if (mission !== null && mission.monster !== null) {
    return { kind: 'mission', monster: mission.monster, phase: mission.phase ?? '', leader: mission.role === 'leader' };
  }
  if (insight.combat !== null && live.target !== null) {
    return { kind: 'combat', reason: insight.combat };
  }
  if (insight.destination !== null) {
    return { kind: 'travelling', destination: insight.destination };
  }
  return live.activity === null ? { kind: 'unknown' } : { kind: 'reported', state: live.activity };
}

export function explain(live: CharacterLive): Explanation {
  if (live.freshness === 'never' || live.lastSeen === null) {
    return { kind: 'never' };
  }
  if (live.freshness === 'stale') {
    return { kind: 'stale', lastSeen: live.lastSeen };
  }
  return blocker(live) ?? activity(live);
}
