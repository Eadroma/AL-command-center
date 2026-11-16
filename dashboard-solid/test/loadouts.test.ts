/** Loadouts: catalogue icons, reading a loadout from the profile, skills, slot filtering. */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { GameData } from '../server/game-data/data-js.ts';
import { iconFrame, loadoutCatalogue } from '../server/game-data/loadout-catalogue.ts';
import type { Profile } from '../shared/profile.ts';
import { boards, GRID, itemsFor, readLoadout, toggleSkill } from '../src/screens/loadouts/loadout-view.ts';
import { GEAR_SLOTS } from '../shared/loadouts.ts';

const data: GameData = {
  version: 1, monsters: {}, maps: {}, classes: {}, sprites: {}, tilesets: {},
  imagesets: { pack_20: { file: '/images/tiles/items/pack_20vt8.png', size: 20, rows: 64, columns: 16 }, skills: { file: '/images/tiles/items/skills_20v6.png', size: 20, rows: 13, columns: 16 } },
  positions: { fireblade: ['', 1, 8], skill_taunt: ['skills', 1, 1], hidden: ['nowhere', 0, 0] },
  items: { fireblade: { name: 'Fiery Blade', type: 'weapon' }, candle: { name: 'Candleward', type: 'shield' }, hpot1: { name: 'Potion', type: 'pot' }, hidden: { name: 'Hidden', type: 'ring' } },
  skills: { taunt: { name: 'Taunt', skin: 'skill_taunt' } },
};
const assets = { '/images/tiles/items/pack_20vt8.png': '/game-assets/p.png', '/images/tiles/items/skills_20v6.png': '/game-assets/s.png' };

describe('loadout catalogue', () => {
  it('cuts item and skill icons from the game image sets', () => {
    assert.deepEqual(iconFrame(data, assets, 'fireblade'), { url: '/game-assets/p.png', sheetWidth: 320, sheetHeight: 1280, x: 20, y: 160, width: 20, height: 20 });
    assert.equal(iconFrame(data, assets, 'hidden'), null);
    assert.equal(iconFrame(data, assets, 'nothing'), null);
  });

  it('lists wearable items only, and the scripts\' skills per class', () => {
    const catalogue = loadoutCatalogue(data, assets);
    assert.deepEqual(catalogue.items.map((item) => item.key), ['candle', 'fireblade', 'hidden']);
    assert.deepEqual(catalogue.skills['warrior']?.slice(0, 2).map((skill) => [skill.key, skill.name, skill.icon !== null]), [['taunt', 'Taunt', true], ['charge', 'charge', false]]);
  });
});

const profile: Profile = {
  name: 'Party', server: { region: 'EU', name: 'III' },
  characters: [
    { name: 'Hero', ctype: 'warrior', enabled: true, runtime: 'browser', script: '', follow: '', events: false, job: 'hunt', farmMonster: '', overrides: {} },
    { name: 'Shop', ctype: 'merchant', enabled: true, runtime: 'browser', script: '', follow: '', events: false, job: 'hunt', farmMonster: '', overrides: {} },
  ],
  farming: { loadouts: { Hero: { Lucky: { gear: [] }, tank: { gear: [] }, aoe: { base: 'aoe', gear: [{ slot: 'mainhand', item: 'fireblade', minLevel: 7 }, { slot: 'nope', item: 'x' }], skills: ['taunt'] } } } },
};

describe('loadout view', () => {
  it('lists characters with loadouts, AOE / Mono / Tank first, then custom ones', () => {
    assert.deepEqual(boards(profile), [{ character: 'Hero', ctype: 'warrior', styles: ['aoe', 'tank', 'Lucky'] }]);
  });

  it('reads gear by slot, skipping unknown slots, with skills and base', () => {
    const view = readLoadout(profile, 'Hero', 'aoe');
    assert.deepEqual([view.base, [...view.gear], view.skills], ['aoe', [['mainhand', { item: 'fireblade', minLevel: 7 }]], ['taunt']]);
    assert.deepEqual(readLoadout(profile, 'Hero', 'Lucky'), { base: null, gear: new Map(), skills: [] });
  });

  it('keeps the skill order and filters items by slot; the grid holds every slot once', () => {
    assert.deepEqual(toggleSkill(['taunt', 'warcry'], 'charge', true), ['taunt', 'warcry', 'charge']);
    assert.deepEqual(toggleSkill(['taunt', 'warcry'], 'taunt', false), ['warcry']);
    const items = loadoutCatalogue(data, assets).items;
    assert.deepEqual(itemsFor('offhand', items).map((item) => item.key), ['candle', 'fireblade']);
    assert.deepEqual(itemsFor('mainhand', items).map((item) => item.key), ['fireblade']);
    assert.deepEqual(GRID.flat().filter((slot) => slot !== null).toSorted(), [...GEAR_SLOTS].toSorted());
  });
});
