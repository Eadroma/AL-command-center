import { describe, expect, it } from 'vitest';
import type { Catalog } from '../shared/schema';
import { assessSurvival, damageMultiplier, expectedGoldPerKill, farmableLootMonsters, simulateLoot } from '../src/models/loot-simulator';

const catalog: Catalog = {
  scripts: [], importedAt: '', sourceDirectory: '', assets: {},
  goldDrops: { base: 0.64, random: 0.8, x10: 1 / 32, x50: 1 / 480 },
  items: [{ id: 'shell', name: 'Shell', goldValue: 100, stackSize: 9999 }],
  monsters: [{ id: 'crab', name: 'Crab', hp: 400, xp: 500, respawn: 10, baseGold: 30, drops: [{ rate: 0.1, item: 'shell' }] }],
};

describe('loot simulator', () => {
  it('keeps only script-supported regular mobs and removes bosses and events', () => {
    const source = {
      ...catalog,
      scripts: [{ id: 'eadroma-warrior-v2', filename: 'warrior.js', label: 'Warrior', ctype: 'warrior', kind: 'farm', bytes: 1, hash: 'x', config: {}, variables: { HUNT_ALLOW: { crab: 1, phoenix: 1, jr: 1, crabxx: 1, unknown: 1 } } }],
      monsters: [
        catalog.monsters[0],
        { id: 'phoenix', name: 'Phoenix', hp: 160000 },
        { id: 'jr', name: 'Jr.', hp: 3200 },
        { id: 'crabxx', name: 'Giga Crab', hp: 960000 },
        { id: 'notallowed', name: 'Not Allowed', hp: 100 },
      ],
    } satisfies Catalog;
    expect(farmableLootMonsters(source).map(monster => monster.id)).toEqual(['crab']);
  });
  it('caps damage throughput at spawn capacity', () => {
    const result = simulateLoot({ catalog, monster: catalog.monsters[0], teamDps: 800, efficiencyPercent: 100, spawnCount: 2, luckPercent: 100, goldMultiplierPercent: 100, homeServer: false });
    expect(result.dpsLimitedKills).toBe(7200);
    expect(result.killsPerHour).toBe(720);
    expect(result.xpPerHour).toBe(360_000);
    expect(result.drops[0].unitsPerHour).toBe(72);
    expect(result.drops[0].npcGoldPerHour).toBe(4320);
  });

  it('applies efficiency, luck and optional home-server drops', () => {
    const monster = { ...catalog.monsters[0], respawn: 0, drops: [...(catalog.monsters[0].drops ?? []), { rate: 0.05, item: 'shell', homeServer: true }] };
    const away = simulateLoot({ catalog, monster, teamDps: 100, efficiencyPercent: 50, spawnCount: 1, luckPercent: 200, goldMultiplierPercent: 100, homeServer: false });
    const home = simulateLoot({ catalog, monster, teamDps: 100, efficiencyPercent: 50, spawnCount: 1, luckPercent: 200, goldMultiplierPercent: 100, homeServer: true });
    expect(away.killsPerHour).toBe(450);
    expect(away.drops).toHaveLength(1);
    expect(home.drops).toHaveLength(2);
  });

  it('applies gold multiplier only to direct chest gold', () => {
    const base = simulateLoot({ catalog, monster: catalog.monsters[0], teamDps: 100, efficiencyPercent: 100, spawnCount: 1, luckPercent: 100, goldMultiplierPercent: 100, homeServer: false });
    const boosted = simulateLoot({ catalog, monster: catalog.monsters[0], teamDps: 100, efficiencyPercent: 100, spawnCount: 1, luckPercent: 100, goldMultiplierPercent: 250, homeServer: false });
    expect(boosted.directGoldPerHour).toBeCloseTo(base.directGoldPerHour * 2.5);
    expect(boosted.npcGoldPerHour).toBe(base.npcGoldPerHour);
  });

  it('matches the server expectation for base and jackpot rolls', () => {
    const expected = (1 + 30 * (0.64 + 0.8 / 2)) * (1 + 9 / 32) * (1 + 49 / 480);
    expect(expectedGoldPerKill(catalog.monsters[0], catalog)).toBeCloseTo(expected);
  });

  it('mirrors defense mitigation and warns when kill time exceeds survival', () => {
    expect(damageMultiplier(100)).toBeCloseTo(.9);
    const risk = assessSurvival({ monster: { ...catalog.monsters[0], attack: 1000, frequency: 1, damageType: 'physical' }, killSeconds: 20, tank: { name: 'Tank', maxHp: 5000, armor: 100, resistance: 0 }, healingPerSecond: 100 });
    expect(risk.warning).toBe(true);
    expect(risk.incomingHit).toBeCloseTo(900);
    expect(risk.survivalSeconds).toBeCloseTo(6.25);
  });
});
