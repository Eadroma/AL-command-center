import { describe, expect, it } from 'vitest';
import { lootTracker } from '../src/models/loot-tracker';
import type { PerformanceBucket } from '../src/types';

const bucket = (character: string, at: number, monsters: PerformanceBucket['monsters'], elapsedMs = 300_000): PerformanceBucket => ({
  character, at, elapsedMs, monsters, damage: 0, healing: 0, kills: 0, deaths: 0, attacks: 0, movingMs: 0, combatMs: 0, xp: 0, gold: 0,
});

describe('loot tracker', () => {
  // Two 5-minute slots, three characters each crediting the same kills.
  const buckets = [
    bucket('Eadroma', 0, { bscorpion: { kills: 2, gold: 1000, items: { 'stramulet@0': 1 } }, crab: { kills: 5, gold: 50, items: {} } }),
    bucket('Aedroma', 0, { bscorpion: { kills: 2, gold: 1000, items: {} } }),
    bucket('Droma', 0, { bscorpion: { kills: 1, gold: 1000, items: { 'gem0@0': 2 } } }),
    bucket('Eadroma', 300_000, { bscorpion: { kills: 1, gold: 500, items: {} } }),
    bucket('Eadroma', 600_000, undefined), // pre-feature history is not a rate basis
  ];
  it('counts each team kill once but adds every loot share', () => {
    const t = lootTracker(buckets, ['bscorpion'], 'all');
    expect(t.observedMs).toBe(600_000);
    expect(t.monsters.map(m => [m.mtype, m.kills, m.gold])).toEqual([['crab', 5, 50], ['bscorpion', 3, 3500]]);
    expect(t.items).toEqual([{ key: 'gem0@0', name: 'gem0', level: 0, quantity: 2 }, { key: 'stramulet@0', name: 'stramulet', level: 0, quantity: 1 }]);
  });
  it('projects hourly and daily rates from observed time', () => {
    const t = lootTracker(buckets, ['bscorpion'], 'bosses');
    expect(t.totals).toEqual({ kills: 3, gold: 3500 });
    expect(t.perHour(3)).toBe(18);
    expect(t.perDay(3)).toBe(432);
  });
  it('filters boss kills and loot in or out', () => {
    expect(lootTracker(buckets, ['bscorpion'], 'bosses').monsters.map(m => m.mtype)).toEqual(['bscorpion']);
    expect(lootTracker(buckets, ['bscorpion'], 'regular').monsters.map(m => m.mtype)).toEqual(['crab']);
    expect(lootTracker([], ['bscorpion'], 'all').perHour(1)).toBe(null);
  });
});
