import { describe, expect, it } from 'vitest';
import { profileSchema } from '../shared/schema';
import { loadoutCompliance } from '../src/models/loadout-compliance';
import type { DeploymentsResponse } from '../src/types';

const profile = profileSchema.parse({
  name: 'Gear', server: { region: 'EU', name: 'I' },
  characters: [{ name: 'Tank', ctype: 'warrior', enabled: true, runtime: 'browser', script: 'tank', follow: '', events: true, job: 'hunt', overrides: {} }],
  farming: { defaultMonster: 'goo', hunts: false, allowedHunts: [], rareVisits: false, loadouts: { Tank: { aoe: { gear: [
    { slot: 'mainhand', item: 'fireblade', minLevel: 7 },
    { slot: 'offhand', item: 'ololipop0', minLevel: 7 },
    { slot: 'helmet', item: 'hhelmet', minLevel: 7 },
    { slot: 'shoes', item: 'wingedboots', minLevel: 8 },
  ], skills: [] } } } },
  events: { enabled: true, allowed: [] }, seller: { npcEnabled: false, npcItems: [], standEnabled: false, listings: [] },
});
const deployments = { characters: { Tank: { telemetry: { live: true, equipment: [
  { slot: 'mainhand', name: 'fireblade', level: 8, quantity: 1 },
  { slot: 'gloves', name: 'ololipop', level: 7, quantity: 1 },
], inventory: [
  { slot: 4, name: 'hhelmet', level: 7, quantity: 1, locked: false, bound: false, upgradeable: true, sellable: true },
  { slot: 5, name: 'wingedboots', level: 6, quantity: 1, locked: false, bound: false, upgradeable: true, sellable: true },
] } } } } as unknown as DeploymentsResponse;

describe('loadout compliance', () => {
  it('classifies equipped, wrong-slot, bag-ready and under-level gear', () => {
    expect(loadoutCompliance(profile, deployments).map(check => [check.item, check.status])).toEqual([
      ['fireblade', 'equipped'], ['ololipop', 'wrong-slot'], ['hhelmet', 'available'], ['wingedboots', 'low-level'],
    ]);
  });

  it('keeps configured requirements visible while telemetry is offline', () => {
    const rows = loadoutCompliance(profile, { characters: { Tank: { telemetry: { live: false } } } } as unknown as DeploymentsResponse);
    expect(rows.every(row => row.status === 'offline')).toBe(true);
  });
});
