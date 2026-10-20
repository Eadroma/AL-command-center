import type { PerformanceBucket } from '../types';
import { statisticsActivity, type StatisticsActivity } from '../../shared/statistics-activity';
export interface StatisticsScope { names: string[]; since: number; activity: StatisticsActivity }
export function filterStatistics(buckets: PerformanceBucket[], scope: StatisticsScope) {
  return buckets.filter(row => scope.names.includes(row.character) && row.at >= scope.since && (scope.activity === 'all' || statisticsActivity(row) === scope.activity));
}
/** Never combine sales, loot and costs collected over different intervals into a net rate. */
export function partyFarmingBalance(buckets: PerformanceBucket[], names: string[]) {
  return names.map(character => {
    const rows = buckets.filter(row => row.character === character);
    const elapsedMs = rows.reduce((sum, row) => sum + row.elapsedMs, 0);
    const matched = rows.filter(row => (row.economyElapsedMs ?? 0) > 0 && row.npcSalesElapsedMs === row.economyElapsedMs && row.netLootGold != null && row.npcSalesGold != null && row.consumablesGold != null);
    const measuredMs = matched.reduce((sum, row) => sum + (row.economyElapsedMs ?? 0), 0);
    const sum = (key: 'netLootGold' | 'npcSalesGold' | 'consumablesGold' | 'unpriced') => matched.reduce((total, row) => total + (row[key] ?? 0), 0);
    const loot = measuredMs ? sum('netLootGold') : null;
    const sales = measuredMs ? sum('npcSalesGold') : null;
    const cost = measuredMs ? sum('consumablesGold') : null;
    const unpriced = sum('unpriced');
    const net = loot != null && sales != null && cost != null && !unpriced ? loot + sales - cost : null;
    return { character, elapsedMs, measuredMs, loot, sales, cost, unpriced, net, netPerHour: net != null && measuredMs ? net * 3600000 / measuredMs : null,
      coverage: elapsedMs ? Math.min(100, measuredMs * 100 / elapsedMs) : 0,
      deaths: elapsedMs ? rows.reduce((sum, row) => sum + row.deaths, 0) : null,
      movingMs: elapsedMs ? rows.reduce((sum, row) => sum + row.movingMs, 0) : null,
      firstAt: rows.length ? Math.min(...rows.map(row => row.at)) : null,
      lastAt: rows.length ? Math.max(...rows.map(row => row.at)) : null,
    };
  });
}
