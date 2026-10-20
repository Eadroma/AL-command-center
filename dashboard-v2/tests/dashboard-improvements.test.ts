import { describe, expect, it } from 'vitest';
import { initialProfile, scripts } from '../server/scripts';
import { applyTeamComposition } from '../src/models/team-composition';
import { injectedSettings, settingsChanges } from '../server/deployment-preview';
import { calibrateLoot } from '../src/models/loot-calibration';
import type { PerformanceBucket } from '../src/types';

describe('team composition staging', () => {
  it('stages solo and restores the three farmers without modifying gear or the original profile', () => {
    const profile = initialProfile(scripts());
    const solo = applyTeamComposition(profile, 'solo', 'Droma');
    expect(solo.characters.filter(row => row.enabled && row.ctype !== 'merchant').map(row => row.name)).toEqual(['Droma']);
    expect(solo.characters.find(row => row.name === 'Droma')?.follow).toBe('');
    expect(solo.seller.teamSupervisor.soloGuard).toBe(true);
    expect(solo.events.enabled).toBe(false);
    const team = applyTeamComposition(solo, 'team', 'Droma');
    expect(team.characters.filter(row => row.enabled && row.ctype !== 'merchant')).toHaveLength(3);
    expect(team.characters.find(row => row.ctype === 'priest')?.follow).toBe('Eadroma');
    expect(team.seller.teamSupervisor.soloGuard).toBe(false);
    expect(team.farming.loadouts).toEqual(profile.farming.loadouts);
    const cave = applyTeamComposition(team, 'cave', 'Droma');
    expect(cave.farming.dailyDungeon).toBe(true);
    expect(cave.seller.teamSupervisor.characters).not.toContain('EadroSell');
    expect(profile.characters.find(row => row.name === 'Eadroma')?.enabled).toBe(true);
  });
});

describe('deployment preview', () => {
  it('compares generated settings without executing game source', () => {
    const before = injectedSettings('var CONFIG={"NAME":"Droma","PARTY":["Eadroma"]}; throw Error("must not execute");');
    const after = injectedSettings('var CONFIG={"NAME":"Droma","PARTY":[]}; var __ALCC={"eventsEnabled":false};');
    expect(settingsChanges(before, after)).toEqual([
      { key: 'CONFIG.PARTY', before: ['Eadroma'], after: [] },
      { key: '__ALCC', before: undefined, after: { eventsEnabled: false } },
    ]);
    expect(injectedSettings('var CONFIG={value:someFunction()};')).toEqual({});
  });
});

describe('loot calibration', () => {
  const row: PerformanceBucket = { character: 'Droma', at: 0, elapsedMs: 300000, damage: 1000, healing: 0, kills: 100, deaths: 1, attacks: 100, movingMs: 60000, combatMs: 200000, xp: 1000, gold: 100, lootGold: 10000, lootElapsedMs: 300000, farmContext: { monster: 'crab', participants: ['Droma'] } };
  it('requires sufficient coverage and exact composition and target', () => {
    expect(calibrateLoot([row], 'ghost', ['Droma'], 2400)).toBeNull();
    expect(calibrateLoot([row], 'crab', ['Droma', 'Aedroma'], 2400)).toBeNull();
    expect(calibrateLoot([{ ...row, lootElapsedMs: 10000 }], 'crab', ['Droma'], 2400)).toBeNull();
    expect(calibrateLoot([{ ...row, farmContext: undefined }], 'crab', ['Droma'], 2400)).toBeNull();
    expect(calibrateLoot([row], 'crab', ['Droma'], 2400)).toMatchObject({ goldPerHour: 120000, killsPerHour: 1200, efficiency: 50, movingPercent: 20, observedMinutes: 5 });
  });
});
