import type { PerformanceBucket } from '../types';
import { performanceSummaries } from './performance';

/** Match observed target and exact game-party composition; never mix unknown history. */
export function calibrateLoot(buckets: PerformanceBucket[], monster: string, participants: string[], maximumKillsPerHour: number) {
  const names = [...participants].sort();
  if (!names.length) return null;
  const matching = buckets.filter(bucket => bucket.farmContext?.monster === monster
    && JSON.stringify([...bucket.farmContext.participants].sort()) === JSON.stringify(names)
    && names.includes(bucket.character));
  const summaries = performanceSummaries(matching);
  if (summaries.length !== names.length || summaries.some(row => row.lootElapsedMs < 300000)) return null;
  const killsPerHour = Math.max(...summaries.map(row => row.killsPerHour));
  return {
    goldPerHour: summaries.reduce((sum, row) => sum + (row.lootGoldPerHour ?? 0), 0),
    killsPerHour,
    observedMinutes: Math.floor(Math.min(...summaries.map(row => row.lootElapsedMs)) / 60000),
    deaths: summaries.reduce((sum, row) => sum + row.deaths, 0),
    movingPercent: summaries.reduce((sum, row) => sum + row.movementPercent, 0) / summaries.length,
    efficiency: maximumKillsPerHour > 0 ? Math.min(100, Math.max(1, Math.round(killsPerHour * 100 / maximumKillsPerHour))) : null,
  };
}
