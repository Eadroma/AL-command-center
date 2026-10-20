import type { PerformanceBucket } from '../types';

export interface PerformanceSummary {
  lootGoldPerHour: number | null; lootElapsedMs: number;
  character: string; elapsedMs: number; damage: number; healing: number; kills: number; deaths: number; xp: number; gold: number;
  dps: number; hps: number; killsPerHour: number; xpPerHour: number; goldPerHour: number; movementPercent: number; buckets: PerformanceBucket[];
}
const rate = (value: number, milliseconds: number) => milliseconds > 0 ? value * 3_600_000 / milliseconds : 0;
const perSecond = (value: number, milliseconds: number) => milliseconds > 0 ? value * 1000 / milliseconds : 0;

export function performanceSummaries(buckets: PerformanceBucket[]): PerformanceSummary[] {
  const groups = new Map<string, PerformanceBucket[]>();
  for (const bucket of buckets) groups.set(bucket.character, [...(groups.get(bucket.character) ?? []), bucket]);
  return [...groups.entries()].map(([character, rows]) => {
    const total = rows.reduce((sum, row) => ({
      elapsedMs: sum.elapsedMs + row.elapsedMs, damage: sum.damage + row.damage, healing: sum.healing + row.healing,
      kills: sum.kills + row.kills, deaths: sum.deaths + row.deaths, xp: sum.xp + row.xp, gold: sum.gold + row.gold,
      movingMs: sum.movingMs + row.movingMs, combatMs: sum.combatMs + row.combatMs,
    }), { elapsedMs: 0, damage: 0, healing: 0, kills: 0, deaths: 0, xp: 0, gold: 0, movingMs: 0, combatMs: 0 });
    const lootElapsedMs = rows.reduce((sum, row) => sum + (row.lootElapsedMs ?? 0), 0);
    const lootGold = rows.reduce((sum, row) => sum + (row.lootGold ?? 0), 0);
    return { character, ...total, lootElapsedMs, lootGoldPerHour: lootElapsedMs ? rate(lootGold, lootElapsedMs) : null, dps: perSecond(total.damage, total.elapsedMs), hps: perSecond(total.healing, total.elapsedMs), killsPerHour: rate(total.kills, total.elapsedMs), xpPerHour: rate(total.xp, total.elapsedMs), goldPerHour: rate(total.gold, total.elapsedMs), movementPercent: total.elapsedMs ? Math.min(100, total.movingMs * 100 / total.elapsedMs) : 0, buckets: rows.sort((a, b) => a.at - b.at) };
  }).sort((a, b) => b.damage - a.damage);
}
