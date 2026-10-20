import { expect, it } from 'vitest';
import { farmingSessions } from '../src/models/farming-sessions';
import type { PerformanceBucket } from '../src/types';
const row: PerformanceBucket = { character: 'Droma', at: 0, elapsedMs: 300000, damage: 0, healing: 0, kills: 10, deaths: 0, attacks: 10, movingMs: 60000, combatMs: 240000, xp: 1000, gold: 999999, lootGold: 10000, lootElapsedMs: 300000, map: 'main', server: 'EU III', farmContext: { monster: 'crab', participants: ['Droma'] } };
it('groups consecutive observations while splitting targets, teams and offline gaps', () => {
  const sessions = farmingSessions([row, { ...row, at: 300000 }, { ...row, at: 600000, farmContext: { monster: 'ghost', participants: ['Droma'] } }, { ...row, at: 1800000 }]);
  expect(sessions).toHaveLength(3);
  expect(sessions.at(-1)).toMatchObject({ samples: 2, lootPerHour: 120000, kills: 20, elapsedMs: 600000 });
  expect(farmingSessions([row, { ...row, at: 300000, farmContext: { monster: 'crab', participants: ['Droma', 'Aedroma'] } }])).toHaveLength(2);
});
it('keeps different characters separate and unknown economic coverage unavailable', () => {
  expect(farmingSessions([row, { ...row, character: 'Aedroma' }])).toHaveLength(2);
  expect(farmingSessions([{ ...row, lootGold: undefined, lootElapsedMs: undefined }])[0]).toMatchObject({ lootPerHour: null, netPerHour: null });
  expect(farmingSessions([])).toEqual([]);
  expect(farmingSessions([row, { ...row, at: 300000, lootGold: 999999, lootElapsedMs: 0 }])[0].lootPerHour).toBe(120000);
});
it('does not invent ordering between mixed contexts sharing a bucket timestamp', () => {
  const segments = farmingSessions([row, { ...row, farmContext: undefined }, { ...row, at: 300000 }, { ...row, at: 300000, farmContext: undefined }]);
  expect(segments).toHaveLength(2);
  expect(segments.every(segment => segment.samples === 2)).toBe(true);
});
