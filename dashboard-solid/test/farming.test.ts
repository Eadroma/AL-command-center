/** Farming targets: monster summaries, scripts that pin their target, and how a typed monster is recognised. */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ScriptInfo } from '../server/builder/catalogue.ts';
import type { GameData } from '../server/game-data/data-js.ts';
import { cropToMonster, monsterSummaries } from '../server/game-data/monsters.ts';
import { scriptsResponse } from '../server/routes/scripts.ts';
import { filterChoices, resolveChoice } from '../src/ui/choices.ts';
import { fitScale } from '../src/ui/frame-scale.ts';

const data: GameData = {
  version: 1, items: {}, classes: {}, imagesets: {}, positions: {}, sprites: {}, tilesets: {},
  monsters: { crab: { name: 'Tiny Crab', hp: 400, xp: 500 }, bigbird: { name: 'Hawk', hp: 32000, xp: 30000 }, phoenix: { name: 'Phoenix', hp: 300000 } },
  maps: {
    main: { name: 'Mainland', monsters: [{ type: 'crab', count: 8 }, { type: 'bigbird', count: 1 }] },
    beach: { name: 'Beach', monsters: [{ type: 'crab', count: 2 }] },
    old_main: { name: 'Old Town', ignore: true, monsters: [{ type: 'bigbird', count: 1 }] },
  },
};

function script(id: string, config: Record<string, unknown>, ctype: ScriptInfo['ctype'] = 'ranger'): ScriptInfo {
  return { id, filename: `${id}.js`, label: id, ctype, kind: 'farm', bytes: 0, hash: '', config, variables: {} };
}

describe('monster summaries', () => {
  it('lists every monster by name with its spawn maps, retired maps left out', () => {
    assert.deepEqual(monsterSummaries(data, {}), [
      { key: 'bigbird', name: 'Hawk', hp: 32000, xp: 30000, maps: ['main'], sprite: null },
      { key: 'phoenix', name: 'Phoenix', hp: 300000, xp: null, maps: [], sprite: null },
      { key: 'crab', name: 'Tiny Crab', hp: 400, xp: 500, maps: ['main', 'beach'], sprite: null },
    ]);
  });

  it('recognises a monster by key or exact name, in any case', () => {
    const monsters = monsterSummaries(data, {});
    assert.equal(resolveChoice('crab', monsters)?.key, 'crab');
    assert.equal(resolveChoice('  tiny CRAB ', monsters)?.key, 'crab');
    assert.equal(resolveChoice('crabs', monsters), null);
  });
});

describe('monster sprites', () => {
  const cell = { url: '/game-assets/a.png', sheetWidth: 720, sheetHeight: 512, x: 60, y: 0, width: 60, height: 64 };

  it('crops a monster to its real size, centred and on the bottom of its cell, like the game', () => {
    assert.deepEqual(cropToMonster(cell, [24, 20]), { ...cell, x: 78, y: 44, width: 24, height: 20 });
    assert.deepEqual(cropToMonster(cell, [24, 20, -4]), { ...cell, x: 74, y: 44, width: 24, height: 20 });
    assert.deepEqual(cropToMonster(cell, undefined), cell);
  });

  it('gives each monster the frame of its skin', () => {
    const [hawk] = monsterSummaries({ ...data, dimensions: { bigbird: [24, 20] } }, { bigbird: cell });
    assert.deepEqual(hawk?.sprite, { ...cell, x: 78, y: 44, width: 24, height: 20 });
  });
});

describe('script summaries', () => {
  it('marks scripts that pin their own target, and the warrior\'s single-target picks', () => {
    const result = scriptsResponse([
      script('droma-ranger-crab-aoe-v2', { FIXED_FARM: true, DEFAULT_FARM: 'crab' }),
      script('droma-ranger-v2', { DEFAULT_FARM: 'bigbird' }),
      script('eadroma-warrior-v2', { WEAPONS: { pack: { bigbird: 'fireblade', goo: 'lolipop' } } }, 'warrior'),
    ]);
    assert.deepEqual(result.scripts.map((entry) => [entry.id, entry.fixedFarm]), [['droma-ranger-crab-aoe-v2', 'crab'], ['droma-ranger-v2', null], ['eadroma-warrior-v2', null]]);
    assert.deepEqual(result.monoTargets, ['bigbird']);
  });
});

describe('monster filter and sprite fit', () => {
  const monsters = monsterSummaries(data, {});

  it('puts names that start with the text first, then the ones that contain it', () => {
    const typed = (text: string): string[] => filterChoices(monsters, { text, current: '' }, 10).map((monster) => monster.key);
    assert.deepEqual(typed('cr'), ['crab']);
    assert.deepEqual(typed('a'), ['bigbird', 'crab']);
    assert.deepEqual(typed('bigb'), ['bigbird']);
    assert.deepEqual(typed('hawk'), ['bigbird']);
    assert.equal(filterChoices(monsters, { text: '', current: '' }, 2).length, 2);
    assert.equal(filterChoices(monsters, { text: 'Hawk', current: 'Hawk' }, 10).length, 3);
  });

  it('puts the exact name first among the names that start with the text', () => {
    const goos = monsterSummaries({ ...data, monsters: { goober: { name: 'Goober', hp: 1 }, goo: { name: 'Goo', hp: 1 } } }, {});
    assert.deepEqual(filterChoices(goos, { text: 'goo', current: '' }, 10).map((monster) => monster.key), ['goo', 'goober']);
  });

  it('zooms small sprites by whole steps and shrinks large ones into the box', () => {
    assert.equal(fitScale({ width: 23, height: 22 }, 48), 2);
    assert.equal(fitScale({ width: 10, height: 10 }, 48), 3);
    assert.equal(fitScale({ width: 96, height: 64 }, 48), 0.5);
  });
});
