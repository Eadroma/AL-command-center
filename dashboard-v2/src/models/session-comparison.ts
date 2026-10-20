import type { PerformanceBucket } from '../types';

/** Rates use accumulated character observation time, never a sum of hourly rates. */
export function sessionMeasurement(buckets: PerformanceBucket[]) {
  if (!buckets.length) return null;
  const sum = (key: keyof PerformanceBucket) => buckets.reduce((total, row) => total + (typeof row[key] === 'number' ? row[key] as number : 0), 0);
  const elapsedMs = sum('elapsedMs');
  const economyMs = sum('economyElapsedMs');
  const matchedSum = (key: 'netLootGold' | 'consumablesGold' | 'consumed' | 'unpriced') => buckets.filter(row => (row.economyElapsedMs ?? 0) > 0).reduce((total, row) => total + (row[key] ?? 0), 0);
  const rate = (value: number, duration = elapsedMs) => duration > 0 ? value * 3600000 / duration : null;
  const coverage = elapsedMs > 0 ? economyMs / elapsedMs : 0;
  const unpriced = matchedSum('unpriced');
  return {
    samples: buckets.length, characters: [...new Set(buckets.map(row => row.character))].sort(),
    from: Math.min(...buckets.map(row => row.at)), to: Math.max(...buckets.map(row => row.at)),
    elapsedMs, coverage, unpriced,
    netPerHour: economyMs > 0 && !unpriced ? rate(matchedSum('netLootGold') - matchedSum('consumablesGold'), economyMs) : null,
    costPerHour: economyMs > 0 && !unpriced ? rate(matchedSum('consumablesGold'), economyMs) : null,
    consumedPerHour: rate(matchedSum('consumed'), economyMs), xpPerHour: rate(sum('xp')),
    deaths: sum('deaths'), deathsPerHour: rate(sum('deaths')),
    movementPercent: elapsedMs > 0 ? Math.min(100, sum('movingMs') / elapsedMs * 100) : null,
    combatPercent: elapsedMs > 0 ? Math.min(100, sum('combatMs') / elapsedMs * 100) : null,
    short: elapsedMs < 300000,
  };
}
export type SessionMeasurement = NonNullable<ReturnType<typeof sessionMeasurement>>;

export function measurementDifference(a: number | null, b: number | null) {
  return a === null || b === null ? null : b - a;
}
