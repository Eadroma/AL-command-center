import type { PerformanceBucket } from '../types';

const columns = [
  'time_utc', 'character', 'terrain', 'server', 'observed_ms', 'damage', 'healing',
  'kills', 'deaths', 'attacks', 'moving_ms', 'combat_ms', 'xp', 'balance_gains',
  'loot_gold', 'loot_observed_ms', 'loot_gold_per_hour',
];

/** Quote text and neutralize spreadsheet formulas without altering numeric values. */
function cell(value: string | number | undefined): string {
  if (value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  const safe = /^[\s]*[=+@-]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** Export only the supplied measurements. Missing legacy loot values remain blank. */
export function performanceCsv(buckets: PerformanceBucket[]): string {
  const rows = [...buckets].sort((left, right) => left.at - right.at || left.character.localeCompare(right.character));
  const lines = rows.map(row => [
    new Date(row.at).toISOString(), row.character, row.map, row.server,
    row.elapsedMs, row.damage, row.healing, row.kills, row.deaths, row.attacks,
    row.movingMs, row.combatMs, row.xp, row.gold, row.lootGold, row.lootElapsedMs,
    row.lootElapsedMs && row.lootGold !== undefined ? row.lootGold * 3_600_000 / row.lootElapsedMs : undefined,
  ].map(cell).join(','));
  return '\uFEFF' + [columns.join(','), ...lines].join('\r\n') + '\r\n';
}
