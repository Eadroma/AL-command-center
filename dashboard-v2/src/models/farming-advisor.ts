import type { Catalog, PerformanceBucket, Profile } from '../types';
import { farmableLootMonsters } from './loot-simulator';
import { sessionMeasurement } from './session-comparison';

/** Rank only attributed observations of the exact selected team; no simulated/legacy attribution. */
export function farmingRecommendations(buckets: PerformanceBucket[], participants: string[], catalog: Catalog, profile: Profile) {
  const team = [...new Set(participants)].sort().join('|');
  if (!team) return [];
  const allowed = new Set(farmableLootMonsters(catalog, profile).map(monster => monster.id));
  const groups = new Map<string, PerformanceBucket[]>();
  for (const row of buckets) {
    if (!participants.includes(row.character) || !row.farmContext || [...new Set(row.farmContext.participants)].sort().join('|') !== team || !allowed.has(row.farmContext.monster)) continue;
    const key = JSON.stringify([row.farmContext.monster, row.map ?? '', row.server ?? '']);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.entries()].map(([key, rows]) => {
    const measurement = sessionMeasurement(rows)!;
    const [monster, map, server] = JSON.parse(key) as string[];
    const observedCharacters = new Set(rows.map(row => row.character));
    return { key, monster, map, server, measurement, incompleteTeam: participants.some(name => !observedCharacters.has(name)), confidence: measurement.elapsedMs >= 3600000 * participants.length && measurement.coverage >= .95 && !measurement.unpriced ? 'Established sample' : 'Limited sample' };
  }).sort((a, b) => (b.measurement.netPerHour ?? -Infinity) - (a.measurement.netPerHour ?? -Infinity));
}
