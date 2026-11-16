import type { PerformanceBucket } from '../types';

export type BossFilter = 'all' | 'regular' | 'bosses';
export interface TrackerItem { key: string; name: string; level: number; quantity: number }
export interface TrackerMonster { mtype: string; boss: boolean; kills: number; gold: number; items: TrackerItem[] }

const HOUR = 3_600_000;
const sortItems = (items: Map<string, number>) => [...items].map(([key, quantity]) => {
  const at = key.lastIndexOf('@');
  return { key, name: key.slice(0, at), level: Number(key.slice(at + 1)) || 0, quantity };
}).sort((a, b) => b.quantity - a.quantity || a.key.localeCompare(b.key));

/**
 * Team kills and loot per monster from measured buckets. Every party member gets
 * kill_credit for the same kill, so team kills are the per-slot maximum across
 * characters; loot shares are personal and add up. Only buckets reported by the
 * per-monster telemetry count, and their observed time is the rate basis.
 */
export function lootTracker(buckets: PerformanceBucket[], bosses: readonly string[], filter: BossFilter) {
  const elapsed = new Map<string, number>(), kills = new Map<string, number>();
  const gold = new Map<string, number>(), items = new Map<string, Map<string, number>>();
  for (const row of buckets) {
    if (!row.monsters) continue;
    const slot = `${row.at}|${row.character}`;
    elapsed.set(slot, (elapsed.get(slot) ?? 0) + row.elapsedMs);
    for (const [mtype, m] of Object.entries(row.monsters)) {
      const key = `${mtype}|${slot}`;
      kills.set(key, (kills.get(key) ?? 0) + m.kills);
      gold.set(mtype, (gold.get(mtype) ?? 0) + m.gold);
      const bag = items.get(mtype) ?? new Map<string, number>();
      for (const [item, quantity] of Object.entries(m.items)) bag.set(item, (bag.get(item) ?? 0) + quantity);
      items.set(mtype, bag);
    }
  }
  const maxBy = (values: Map<string, number>, group: (key: string) => string) => {
    const out = new Map<string, number>();
    for (const [key, value] of values) out.set(group(key), Math.max(out.get(group(key)) ?? 0, value));
    return out;
  };
  // Characters overlap in time: observed time per slot is the longest character coverage.
  const observedMs = [...maxBy(elapsed, key => key.split('|')[0]).values()].reduce((n, v) => n + v, 0);
  const teamKills = new Map<string, number>();
  for (const [key, value] of maxBy(kills, key => key.split('|').slice(0, 2).join('|'))) {
    const mtype = key.split('|')[0];
    teamKills.set(mtype, (teamKills.get(mtype) ?? 0) + value);
  }
  const monsters: TrackerMonster[] = [...new Set([...teamKills.keys(), ...gold.keys()])]
    .map(mtype => ({ mtype, boss: bosses.includes(mtype), kills: teamKills.get(mtype) ?? 0, gold: gold.get(mtype) ?? 0, items: sortItems(items.get(mtype) ?? new Map()) }))
    .filter(row => filter === 'all' || (filter === 'bosses') === row.boss)
    .filter(row => row.kills || row.gold || row.items.length)
    .sort((a, b) => b.kills - a.kills || b.gold - a.gold || a.mtype.localeCompare(b.mtype));
  const allItems = new Map<string, number>();
  for (const row of monsters) for (const it of row.items) allItems.set(it.key, (allItems.get(it.key) ?? 0) + it.quantity);
  const perHour = (value: number) => observedMs > 0 ? value * HOUR / observedMs : null;
  return {
    observedMs, monsters, items: sortItems(allItems), perHour,
    perDay: (value: number) => { const rate = perHour(value); return rate === null ? null : rate * 24; },
    totals: { kills: monsters.reduce((n, row) => n + row.kills, 0), gold: monsters.reduce((n, row) => n + row.gold, 0) },
  };
}
