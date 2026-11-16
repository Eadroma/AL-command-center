/** Builds one CharacterLive from game stats, shared by our telemetry and the v2 relay. */
import type { CharacterLive } from '../../shared/telemetry.ts';
import { freshnessOf } from '../../shared/telemetry.ts';

export interface StatsLike {
  readonly level: number;
  readonly hp: number;
  readonly max_hp: number;
  readonly mp: number;
  readonly max_mp: number;
  readonly gold: number;
  readonly map: string;
  readonly x: number;
  readonly y: number;
  readonly target: string;
  readonly server?: string | undefined;
  readonly skin?: string | undefined;
}

export interface LiveInput {
  readonly name: string;
  readonly source: CharacterLive['source'];
  readonly lastSeen: number | null;
  readonly stats: StatsLike | undefined;
  readonly activity: string | undefined;
  readonly positions: CharacterLive['positions'];
  readonly failures: CharacterLive['failures'];
  readonly insight: CharacterLive['insight'];
  readonly logs: CharacterLive['logs'];
  readonly now: number;
}

const unknownStats = {
  level: null, hp: null, maxHp: null, mp: null, maxMp: null, gold: null, map: null, x: null, y: null, server: null, target: null, skin: null,
} as const;

/** The game sends '' for "none"; the UI wants null. */
function blankToNull(value: string | undefined): string | null {
  return value === undefined || value === '' ? null : value;
}

function statsFields(stats: StatsLike | undefined): Pick<CharacterLive, keyof typeof unknownStats> {
  if (stats === undefined) {
    return unknownStats;
  }
  return {
    level: stats.level, hp: stats.hp, maxHp: stats.max_hp, mp: stats.mp, maxMp: stats.max_mp, gold: stats.gold,
    map: stats.map, x: stats.x, y: stats.y, server: blankToNull(stats.server), target: blankToNull(stats.target), skin: blankToNull(stats.skin),
  };
}

export function characterLive(input: LiveInput): CharacterLive {
  return {
    name: input.name,
    source: input.source,
    freshness: freshnessOf(input.lastSeen, input.now),
    lastSeen: input.lastSeen,
    ...statsFields(input.stats),
    activity: blankToNull(input.activity),
    positions: input.positions,
    failures: input.failures,
    insight: input.insight,
    logs: input.logs,
  };
}
