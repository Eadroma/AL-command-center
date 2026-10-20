import type { PerformanceBucket } from '../types';

/** Pair loot and replacement costs over identical observed intervals, excluding legacy coverage. */
export function farmingProfit(buckets: PerformanceBucket[]) {
  const groups = new Map<string, PerformanceBucket[]>();
  for (const bucket of buckets) {
    const key = JSON.stringify([bucket.character, bucket.farmContext?.monster ?? '', bucket.farmContext ?? {}, bucket.map ?? '', bucket.server ?? '']);
    groups.set(key, [...(groups.get(key) ?? []), bucket]);
  }
  return [...groups.entries()].map(([id, rows]) => {
    const valid = rows.filter(row => (row.economyElapsedMs ?? 0) > 0);
    const elapsedMs = valid.reduce((sum, row) => sum + (row.economyElapsedMs ?? 0), 0);
    const lootGold = valid.reduce((sum, row) => sum + (row.netLootGold ?? 0), 0);
    const cost = valid.reduce((sum, row) => sum + (row.consumablesGold ?? 0), 0);
    const unpriced = valid.reduce((sum, row) => sum + (row.unpriced ?? 0), 0);
    const resale = valid.filter(row => row.npcSalesElapsedMs === row.economyElapsedMs);
    const resaleElapsedMs = resale.reduce((sum,row) => sum + (row.npcSalesElapsedMs ?? 0),0);
    const resaleGold = resale.reduce((sum,row) => sum + (row.npcSalesGold ?? 0),0);
    const first = rows[0];
    return { id, character: first.character, monster: first.farmContext?.monster || 'Unattributed', participants: first.farmContext?.participants ?? [], map: first.map || 'Unknown', server: first.server || 'Unknown', elapsedMs,
      coverage: rows.reduce((sum, row) => sum + row.elapsedMs, 0), lootGold, cost, unpriced,
      build: first.farmContext?.build, effects: first.farmContext?.effects ?? [], goldMultiplier: first.farmContext?.goldMultiplier,
      reliability: elapsedMs < 300000 ? 'Short sample' : elapsedMs < 1800000 ? 'Collecting · under 30 min' : unpriced ? 'Incomplete prices' : '30+ min observed',
      movementPercent: rows.reduce((n,r)=>n+r.movingMs,0) / Math.max(1,rows.reduce((n,r)=>n+r.elapsedMs,0)) * 100,
      deaths: rows.reduce((n,r)=>n+r.deaths,0),
      resalePerHour: resaleElapsedMs ? resaleGold * 3_600_000 / resaleElapsedMs : null,
      combinedNetPerHour: elapsedMs && resaleElapsedMs === elapsedMs && !unpriced ? (lootGold + resaleGold - cost) * 3_600_000 / elapsedMs : null,
      consumed: valid.reduce((sum, row) => sum + (row.consumed ?? 0), 0),
      lootPerHour: elapsedMs ? lootGold * 3_600_000 / elapsedMs : null,
      costPerHour: elapsedMs ? cost * 3_600_000 / elapsedMs : null,
      netPerHour: elapsedMs && !unpriced ? (lootGold - cost) * 3_600_000 / elapsedMs : null,
    };
  }).sort((a, b) => (b.netPerHour ?? -Infinity) - (a.netPerHour ?? -Infinity));
}
