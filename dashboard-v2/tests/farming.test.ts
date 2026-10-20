import { describe, expect, it } from 'vitest';
import { ensureFarmingBoards, profileSchema } from '../shared/schema';
import {
  defaultFarmStyle,
  isValidItemId,
  nearestBossInterval,
  setBossChecksEnabled,
  setBossRule,
  setCharacterFarmMonster,
  setDefaultMonster,
  setFarmStyle,
  setFarmingFlag,
  setHuntAllowed,
  setLoadoutGear,
  toggleLoadoutSkill,
} from '../src/models/farming';
import type { Catalog } from '../src/types';

const profile = profileSchema.parse({
  name: 'Farm', server: { region: 'EU', name: 'III' },
  characters: [
    { name: 'Tank', ctype: 'warrior', enabled: true, runtime: 'browser', script: 'tank', follow: '', events: true, job: 'hunt', overrides: {} },
    { name: 'Ranger', ctype: 'ranger', enabled: true, runtime: 'browser', script: 'ranger', follow: 'Tank', events: true, job: 'hunt', overrides: {} },
  ],
  farming: { defaultMonster: 'goo', hunts: true, allowedHunts: ['goo'], rareVisits: true, style: { goo: 'aoe' } },
  events: { enabled: true, allowed: [], style: {} },
  seller: { npcEnabled: false, npcItems: [], standEnabled: false, listings: [] },
});
const catalog = {
  scripts: [{ id: 'warrior', filename: '', label: '', ctype: 'warrior', kind: '', bytes: 0, hash: '', config: { WEAPONS: { pack: { stoneworm: 'fireblade' } } }, variables: {} }],
  items: [], monsters: [], assets: {}, importedAt: '', sourceDirectory: '',
} satisfies Catalog;

describe('farming profile transformations', () => {
  it('accepts new game item ids before the static catalog is refreshed', () => {
    expect(isValidItemId('cave_backstabber')).toBe(true);
    expect(isValidItemId('future-item_2')).toBe(true);
    expect(isValidItemId('not an item')).toBe(false);
  });

  it('resolves source weapon styles and seeds new targets without mutation', () => {
    expect(defaultFarmStyle('stoneworm', catalog)).toBe('mono');
    const changed = setDefaultMonster(profile, 'stoneworm', catalog);
    expect(changed.farming.defaultMonster).toBe('stoneworm');
    expect(changed.farming.style.stoneworm).toBe('mono');
    expect(profile.farming.defaultMonster).toBe('goo');
  });

  it('updates switches and independent character targets', () => {
    const paused = setFarmingFlag(profile, 'hunts', false);
    const routed = setCharacterFarmMonster(paused, 'Ranger', 'stoneworm', catalog);
    expect(routed.farming.hunts).toBe(false);
    expect(routed.characters[1].farmMonster).toBe('stoneworm');
    expect(profile.characters[1].farmMonster).toBe('');
  });

  it('deduplicates hunts, preserves styles when removed and accepts explicit styles', () => {
    const added = setHuntAllowed(profile, 'stoneworm', true, catalog);
    const repeated = setHuntAllowed(added, 'stoneworm', true, catalog);
    const styled = setFarmStyle(repeated, 'stoneworm', 'tank');
    const removed = setHuntAllowed(styled, 'stoneworm', false, catalog);
    expect(repeated.farming.allowedHunts.filter(id => id === 'stoneworm')).toHaveLength(1);
    expect(removed.farming.allowedHunts).not.toContain('stoneworm');
    expect(removed.farming.style.stoneworm).toBe('tank');
  });

  it('selects the closest boss interval and replaces rules without duplicates', () => {
    expect(nearestBossInterval(25920)).toBe(480);
    const enabled = setBossChecksEnabled(profile, false);
    const added = setBossRule(enabled, 'jr', 480);
    const replaced = setBossRule(added, 'jr', 240);
    expect(enabled.farming.bossChecks.enabled).toBe(false);
    expect(replaced.farming.bossChecks.rules.filter(rule => rule.boss === 'jr')).toEqual([{ boss: 'jr', everyMinutes: 240 }]);
    expect(setBossRule(replaced, 'jr', null).farming.bossChecks.rules).toEqual([{ boss: 'greenjr', everyMinutes: 240 }]);
  });

  it('manages one gear rule per slot and independent skill sets', () => {
    const geared = setLoadoutGear(profile, 'Tank', 'aoe', { slot: 'mainhand', item: 'ololipop', minLevel: 7 }, 'mainhand');
    const replaced = setLoadoutGear(geared, 'Tank', 'aoe', { slot: 'mainhand', item: 'fireblade', minLevel: 9 }, 'mainhand');
    const skilled = toggleLoadoutSkill(replaced, 'Tank', 'aoe', 'cleave');
    expect(skilled.farming.loadouts.Tank.aoe.gear).toEqual([{ slot: 'mainhand', item: 'fireblade', minLevel: 9 }]);
    expect(skilled.farming.loadouts.Tank.aoe.skills).toEqual(['cleave']);
    expect(toggleLoadoutSkill(skilled, 'Tank', 'aoe', 'cleave').farming.loadouts.Tank.aoe.skills).toEqual([]);
    expect(profile.farming.loadouts.Tank).toBeUndefined();
  });

  it('normalizes the legacy ololipop0 loadout id', () => {
    const legacy = structuredClone(profile) as unknown as { farming: Record<string, any> };
    legacy.farming.loadouts = { Tank: { aoe: { gear: [{ slot: 'mainhand', item: 'ololipop0', minLevel: 7 }], skills: [] } } };
    const migrated = ensureFarmingBoards(legacy);
    expect(migrated.farming.loadouts.Tank.aoe.gear[0].item).toBe('ololipop');
  });
});
