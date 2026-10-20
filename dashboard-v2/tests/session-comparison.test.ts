import { describe, expect, it } from 'vitest';
import { measurementDifference, sessionMeasurement } from '../src/models/session-comparison';
import type { PerformanceBucket } from '../src/types';
const bucket: PerformanceBucket = { character: 'Droma', at: 0, elapsedMs: 60000, damage: 0, healing: 0, kills: 1, deaths: 1, attacks: 1, movingMs: 30000, combatMs: 40000, xp: 100, gold: 999999, economyElapsedMs: 60000, netLootGold: 1000, consumablesGold: 100, consumed: 2, unpriced: 0 };
describe('session comparison', () => {
  it('uses matched loot costs rather than wallet movements and preserves overlapping combat/movement', () => {
    expect(sessionMeasurement([bucket])).toMatchObject({ netPerHour: 54000, costPerHour: 6000, consumedPerHour: 120, xpPerHour: 6000, deathsPerHour: 60, movementPercent: 50, combatPercent: 40000 / 60000 * 100, short: true });
  });
  it('weights multiple characters by observed time rather than summing hourly rates', () => {
    expect(sessionMeasurement([bucket, { ...bucket, character: 'Aedroma', elapsedMs: 120000, economyElapsedMs: 120000 }])).toMatchObject({ netPerHour: 36000, coverage: 1, characters: ['Aedroma', 'Droma'] });
  });
  it('keeps unknown costs unavailable and excludes legacy coverage from the net denominator', () => {
    expect(sessionMeasurement([{ ...bucket, unpriced: 1 }])).toMatchObject({ netPerHour: null, costPerHour: null });
    const legacy = { ...bucket, economyElapsedMs: undefined, netLootGold: undefined, consumablesGold: undefined, consumed: undefined };
    expect(sessionMeasurement([bucket, legacy])).toMatchObject({ netPerHour: 54000, coverage: .5 });
    expect(sessionMeasurement([legacy])?.netPerHour).toBeNull();
  });
  it('does not manufacture a comparison when measurements are unavailable', () => {
    expect(sessionMeasurement([])).toBeNull();
    expect(measurementDifference(null, 1)).toBeNull();
    expect(measurementDifference(100, 80)).toBe(-20);
  });
  it('excludes unmatched economic amounts rather than only excluding their duration', () => {
    const unmatched = { ...bucket, economyElapsedMs: 0, netLootGold: 999999, consumablesGold: 10000, consumed: 100, unpriced: 5 };
    expect(sessionMeasurement([bucket, unmatched])).toMatchObject({ netPerHour: 54000, costPerHour: 6000, consumedPerHour: 120, unpriced: 0, coverage: .5 });
  });
});
