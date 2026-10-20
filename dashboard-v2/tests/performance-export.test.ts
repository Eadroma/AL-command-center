import { describe, expect, it } from 'vitest';
import { performanceCsv } from '../src/models/performance-export';
import type { PerformanceBucket } from '../src/types';

const bucket: PerformanceBucket = {
  character: 'Droma', at: 0, map: 'main', server: 'EU III', elapsedMs: 10000,
  damage: 2000, healing: 0, kills: 3, deaths: 0, attacks: 4, movingMs: 1000,
  combatMs: 9000, xp: 100, gold: 40, lootGold: 50, lootElapsedMs: 10000,
};

describe('performance CSV export', () => {
  it('keeps legacy unknown values blank and preserves zero loot', () => {
    const legacy = { ...bucket, at: 1000, lootGold: undefined, lootElapsedMs: undefined };
    const rows = performanceCsv([legacy, { ...bucket, lootGold: 0 }]).split('\r\n');
    expect(rows[1]).toContain('"1970-01-01T00:00:00.000Z"');
    expect(rows[1]).toMatch(/,0,10000,0$/);
    expect(rows[2]).toMatch(/,40,,,$/);
    expect(legacy.at).toBe(1000);
  });
  it('quotes commas, quotes and formula-like text while exporting numeric rates', () => {
    const csv = performanceCsv([{ ...bucket, character: '=SUM(1,2)', server: 'EU "III"' }]);
    expect(csv).toContain('"\'=SUM(1,2)"');
    expect(csv).toContain('"EU ""III"""');
    expect(csv).toContain(',50,10000,18000\r\n');
    expect(csv.startsWith('\uFEFF')).toBe(true);
  });
});
