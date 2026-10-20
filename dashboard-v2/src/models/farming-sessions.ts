import type { PerformanceBucket } from '../types';
import { sessionMeasurement } from './session-comparison';

/** Bucket timestamps cannot order context changes inside one bucket. Group each
 * context's consecutive observations independently; these are measured segments,
 * not precise start/stop records. Gaps beyond two buckets start a new segment. */
export function farmingSessions(buckets: PerformanceBucket[]) {
  const groups: PerformanceBucket[][] = [];
  const latest = new Map<string, PerformanceBucket[]>();
  for (const row of [...buckets].sort((a, b) => a.at - b.at)) {
    const key = JSON.stringify([row.character, row.map, row.server, row.farmContext?.monster, [...(row.farmContext?.participants ?? [])].sort()]);
    const current = latest.get(key);
    const previous = current?.at(-1);
    const same = previous && row.at - previous.at <= 600000;
    if (same) current!.push(row);
    else { const next = [row]; groups.push(next); latest.set(key, next); }
  }
  return groups.map(rows => {
    const measurement = sessionMeasurement(rows)!;
    const lootMs = rows.reduce((n, row) => n + (row.lootElapsedMs ?? 0), 0);
    const loot = rows.filter(row => (row.lootElapsedMs ?? 0) > 0).reduce((n, row) => n + (row.lootGold ?? 0), 0);
    const first = rows[0];
    const participants = first.farmContext?.participants ?? [];
    const id = JSON.stringify([first.character, first.map, first.server, first.farmContext?.monster, [...participants].sort(), measurement.from]);
    return { ...measurement, id, participants, character: first.character, map: first.map, server: first.server, monster: first.farmContext?.monster, kills: rows.reduce((n, row) => n + row.kills, 0), lootMs, lootPerHour: lootMs > 0 ? loot * 3600000 / lootMs : null };
  }).sort((a, b) => b.to - a.to || a.character.localeCompare(b.character));
}
