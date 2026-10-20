import { describe, expect, it } from 'vitest';
import { profileSchema } from '../shared/schema';
import { classifiedFailures, combatRows, compactMetric } from '../src/models/combat';
import type { CombatMetrics, DeploymentsResponse } from '../src/types';

const profile = profileSchema.parse({
  name: 'Combat', server: { region: 'EU', name: 'I' },
  characters: [
    { name: 'Tank', ctype: 'warrior', enabled: true, runtime: 'browser', script: 'tank', follow: '', events: true, job: 'hunt', overrides: {} },
    { name: 'Shop', ctype: 'merchant', enabled: true, runtime: 'browser', script: 'merchant', follow: '', events: false, job: 'hunt', overrides: {} },
    { name: 'Bench', ctype: 'priest', enabled: false, runtime: 'browser', script: 'priest', follow: '', events: true, job: 'hunt', overrides: {} },
  ],
  farming: { defaultMonster: 'goo', hunts: false, allowedHunts: [], rareVisits: false },
  events: { enabled: true, allowed: [] },
  seller: { npcEnabled: false, npcItems: [], standEnabled: false, listings: [] },
});
const metrics: CombatMetrics = { startedAt: 1_000, damageDealt: 900, damageTakenPhysical: 200, damageTakenMagical: 100, healing: 50, manaRestored: 20, kills: 3, deaths: 1, attacks: 10, potions: 2, movingMs: 4_000, combatMs: 10_000, healerCoverageMs: 7_500, kiteMoves: 4 };
const deployments = { configured: true, caracalAvailable: false, profileVersion: 1, profileServer: { region: 'EU', name: 'I' }, policy: {}, fleet: { ready: true, issues: [], summary: '' }, characters: {
  Tank: { telemetry: { live: true, combat: metrics, network: { pingMs: 42, socketConnected: true }, failures: [
    { at: 20, reason: 'burst', details: 'second' }, { at: 10, reason: 'range', details: 'first' },
  ] } },
} } satisfies DeploymentsResponse;

describe('combat view model', () => {
  it('maps enabled characters and calculates cumulative metrics', () => {
    const rows = combatRows(profile, deployments, 11_000);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ live: true, elapsedSeconds: 10, damagePerSecond: 90, damageTaken: 300, movementPercent: 40, coveragePercent: 75 });
    expect(rows.some(row => row.character.ctype === 'merchant')).toBe(false);
  });

  it('keeps missing reports explicit and avoids invalid ratios', () => {
    const rows = combatRows(profile, { ...deployments, characters: {} }, 11_000);
    expect(rows[0]).toMatchObject({ live: false, combat: undefined, damagePerSecond: 0, movementPercent: 0 });
  });

  it('sorts classified failures newest first without mutating telemetry', () => {
    const rows = combatRows(profile, deployments, 11_000);
    expect(classifiedFailures(rows, deployments).map(failure => failure.at)).toEqual([20, 10]);
    expect(deployments.characters.Tank.telemetry.failures?.map(failure => failure.at)).toEqual([20, 10]);
  });

  it('formats rounded HUD values', () => {
    expect(compactMetric(12.6)).toBe((13).toLocaleString());
  });

  it('caps timing percentages when telemetry intervals overlap', () => {
    const overlapping = { ...metrics, movingMs: 12_000, healerCoverageMs: 11_000, combatMs: 10_000 };
    const rows = combatRows(profile, {
      ...deployments,
      characters: { Tank: { telemetry: { live: true, combat: overlapping } } },
    }, 11_000);
    expect(rows[0]).toMatchObject({ movementPercent: 100, coveragePercent: 100 });
  });
});
