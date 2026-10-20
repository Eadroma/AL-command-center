import { describe, expect, it } from 'vitest';
import { profileSchema } from '../shared/schema';
import { locateItems } from '../src/models/item-locator';
import type { Catalog, DeploymentsResponse, PartyMember } from '../src/types';

const catalog = { items: [{ id: 'fireblade', name: 'Fire Blade' }], monsters: [], scripts: [], assets: {} } as unknown as Catalog;
const member = {
  name: 'Eadroma', class: 'warrior', inventory: [{ slot: 2, name: 'fireblade', level: 7, quantity: 1 }],
  equipment: [{ slot: 'mainhand', name: 'fireblade', level: 8, quantity: 1 }], stand: [],
} as unknown as PartyMember;
const profile = profileSchema.parse({
  name: 'Test', server: { region: 'EU', name: 'I' },
  characters: [{ name: 'Eadroma', ctype: 'warrior', enabled: true, runtime: 'browser', script: 'test', follow: '', events: false, job: 'hunt', overrides: {} }],
  farming: { defaultMonster: 'goo', hunts: false, allowedHunts: [], rareVisits: false, loadouts: { Eadroma: { mono: { gear: [{ slot: 'mainhand', item: 'fireblade', minLevel: 7 }], skills: [] } } } },
  events: { enabled: false, allowed: [] },
  seller: { npcEnabled: false, npcItems: [], standEnabled: false, listings: [] },
});

describe('global item locator', () => {
  it('finds item ids and display names across bag, equipment and the newest bank snapshot', () => {
    const deployments = { characters: { Eadroma: { telemetry: { live: true, bankAt: 10, bank: [{ pack: 'items1', slot: 4, name: 'fireblade', level: 6, quantity: 2, category: 'Weapons' }] } } } } as unknown as DeploymentsResponse;
    const results = locateItems('fire blade', [member], catalog, deployments, profile);
    expect(results.map(result => result.kind)).toEqual(['equipment', 'bag', 'bank']);
    expect(results.every(result => result.reservations.includes('Combat loadout'))).toBe(true);
    expect(results.reduce((sum, result) => sum + result.quantity, 0)).toBe(4);
  });

  it('filters character holdings and rejects empty searches', () => {
    expect(locateItems('', [member], catalog)).toEqual([]);
    expect(locateItems('fireblade', [member], catalog, undefined, profile, 'SomeoneElse')).toEqual([]);
  });
});
