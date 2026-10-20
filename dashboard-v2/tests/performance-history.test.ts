import { describe, expect, it } from 'vitest';
import { PerformanceHistory, type PerformanceSample } from '../server/performance-history';
import { performanceSummaries } from '../src/models/performance';

const sample = (at: number, sessionId: string, damage: number, kills: number, xp: number, gold: number): PerformanceSample => ({
  at, sessionId, character: 'Eadroma', stats: { xp, gold, level: 70 },
  combat: { damageDealt: damage, healing: damage / 2, kills, deaths: 0, attacks: kills * 2, movingMs: at / 4, combatMs: at / 2 },
});

describe('performance history', () => {
  it('retains activity during movement without a selected monster', () => {
    const history = new PerformanceHistory(undefined, () => 600000);
    const farmContext = {monster:'',activity:'farming',participants:['Eadroma']};
    history.record({...sample(500000,'one',0,0,0,0),farmContext});
    history.record({...sample(505000,'one',0,0,0,0),farmContext});
    expect(history.view(1).buckets[0].farmContext).toEqual(farmContext);
  });
  it('rebases after a telemetry outage instead of inflating hourly rates', () => {
    const history = new PerformanceHistory(undefined, () => 600_000);
    history.record({ ...sample(400_000, 'one', 0, 0, 0, 0), loot: { gold: 0 } });
    expect(history.record({ ...sample(500_000, 'one', 100000, 100, 10000, 10000), loot: { gold: 10000 } })).toBe(false);
    expect(history.record({ ...sample(505_000, 'one', 101000, 101, 10100, 10100), loot: { gold: 10100 } })).toBe(true);
    expect(history.view(1).buckets[0]).toMatchObject({ elapsedMs: 5000, damage: 1000, kills: 1, lootGold: 100, lootElapsedMs: 5000 });
  });

  it('ignores late samples without changing the current baseline', () => {
    const history = new PerformanceHistory(undefined, () => 600_000);
    history.record(sample(500_000, 'one', 100, 1, 100, 100));
    expect(history.record(sample(499_000, 'one', 0, 0, 0, 0))).toBe(false);
    history.record(sample(505_000, 'one', 200, 2, 200, 200));
    expect(history.view(1).buckets[0]).toMatchObject({ elapsedMs: 5000, damage: 100, kills: 1 });
  });
  it('separates terrain changes and server transitions within the same time bucket', () => {
    const history = new PerformanceHistory(undefined, () => 600_000);
    const point = (at: number, map: string, server: string) => {
      const row = sample(at, 'one', at, 1, 1, 1);
      row.stats.map = map; row.stats.server = server;
      return row;
    };
    history.record(point(500_000, 'main', 'EU III'));
    history.record(point(505_000, 'main', 'EU III'));
    history.record(point(510_000, 'cave', 'EU III'));
    history.record(point(515_000, 'cave', 'EU III'));
    history.record(point(520_000, 'cave', 'US I'));
    const buckets = history.view(1).buckets;
    expect(buckets).toHaveLength(4);
    expect(buckets.map(row => [row.map, row.server])).toEqual([
      ['main', 'EU III'], ['transition', 'EU III'], ['cave', 'EU III'], ['cave', 'transition'],
    ]);
    expect(buckets.reduce((sum, row) => sum + row.elapsedMs, 0)).toBe(20000);
  });
  it('measures loot independently of transfers and keeps legacy coverage separate', () => {
    const history = new PerformanceHistory(undefined, () => 600_000);
    history.record(sample(500_000, 'one', 0, 0, 0, 1000));
    history.record({ ...sample(505_000, 'one', 10, 1, 10, 1200), loot: { gold: 0 } });
    history.record({ ...sample(510_000, 'one', 20, 2, 20, 0), loot: { gold: 100 } });
    history.record({ ...sample(515_000, 'one', 30, 3, 30, 500000), loot: { gold: 200 } });
    const [summary] = performanceSummaries(history.view(1).buckets);
    expect(summary.lootElapsedMs).toBe(10000);
    expect(summary.lootGoldPerHour).toBe(72000);
    expect(summary.goldPerHour).toBeGreaterThan(summary.lootGoldPerHour!);
  });
  it('records deltas after a baseline and ignores CODE counter resets', () => {
    let now = 600_000;
    const history = new PerformanceHistory(undefined, () => now);
    expect(history.record(sample(500_000, 'one', 100, 2, 1000, 500))).toBe(false);
    expect(history.record(sample(505_000, 'one', 600, 4, 1400, 700))).toBe(true);
    expect(history.view(1).buckets[0]).toMatchObject({ damage: 500, healing: 250, kills: 2, xp: 400, gold: 200, elapsedMs: 5000 });
    expect(history.record(sample(510_000, 'two', 10, 0, 20, 100))).toBe(false);
    expect(history.view(1).buckets[0].damage).toBe(500);
  });

  it('derives actual rates from observed time', () => {
    const [row] = performanceSummaries([{ character: 'Eadroma', at: 0, elapsedMs: 10_000, damage: 20_000, healing: 5_000, kills: 4, deaths: 1, attacks: 8, movingMs: 2_000, combatMs: 5_000, xp: 1_000, gold: 100 }]);
    expect(row).toMatchObject({ dps: 2000, hps: 500, killsPerHour: 1440, xpPerHour: 360000, goldPerHour: 36000, movementPercent: 20 });
  });
});

it('records NPC resale with independent coverage, ignoring counter resets', () => {
 const h=new PerformanceHistory(undefined,()=>600000);
 const a={...sample(500000,'one',1,1,1,1),economy:{consumablesGold:0,consumed:0,unpriced:0,npcSalesGold:100}};
 h.record(a);h.record({...a,at:505000,economy:{...a.economy,npcSalesGold:300}});
 expect(h.view(1).buckets[0]).toMatchObject({npcSalesGold:200,npcSalesElapsedMs:5000});
 h.record({...a,at:510000,economy:{...a.economy,npcSalesGold:0}});
 expect(h.view(1).buckets[0]).toMatchObject({npcSalesGold:200,npcSalesElapsedMs:5000});
});
