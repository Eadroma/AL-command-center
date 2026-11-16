/** Team screen view model and character sprite cutting. */
import assert from 'node:assert/strict';
import { EMPTY_INSIGHT } from '../server/telemetry/insight.ts';
import { describe, it } from 'node:test';
import type { GameData } from '../server/game-data/data-js.ts';
import { characterSprites } from '../server/game-data/sprites.ts';
import { buildTeamView, percent } from '../src/screens/team/team-view.ts';
import type { CharacterLive } from '../shared/telemetry.ts';

function live(name: string, freshness: CharacterLive['freshness'], overrides: Partial<CharacterLive> = {}): CharacterLive {
  return {
    name, source: 'v2', freshness, lastSeen: freshness === 'never' ? null : 1000, level: 70, hp: 50, maxHp: 100, mp: 10, maxMp: 40,
    map: 'main', x: 0, y: 0, server: null, target: null, skin: null, activity: null, gold: null, positions: [], failures: [], insight: EMPTY_INSIGHT, logs: [], ...overrides,
  };
}

describe('percent', () => {
  it('rounds, clamps and refuses unknown or empty maxima', () => {
    assert.equal(percent(50, 200), 25);
    assert.equal(percent(250, 200), 100);
    assert.equal(percent(null, 200), null);
    assert.equal(percent(5, 0), null);
  });
});

describe('buildTeamView', () => {
  const team = { at: 0, characters: [live('Zed', 'stale', { lastSeen: 500 }), live('Amy', 'live'), live('Bob', 'never'), live('Cid', 'stale', { lastSeen: 900 })] };

  const roster = [{ name: 'Zed', level: 1, className: 'warrior' }, { name: 'Cid', level: 1, className: 'priest' }];

  it('keeps the account order, unlisted characters after by name, and folds characters never heard from', () => {
    const view = buildTeamView(team, roster, null);
    assert.deepEqual(view.reporting.map((card) => card.name), ['Zed', 'Cid', 'Amy']);
    assert.deepEqual(view.silent.map((card) => card.name), ['Bob']);
  });

  it('never reorders cards when freshness or packet times change', () => {
    const before = buildTeamView(team, roster, null).reporting.map((card) => card.name);
    const shuffled = { at: 1, characters: [live('Amy', 'stale', { lastSeen: 1 }), live('Cid', 'live', { lastSeen: 99_999 }), live('Zed', 'live', { lastSeen: 5 }), live('Bob', 'never')] };
    assert.deepEqual(buildTeamView(shuffled, roster, null).reporting.map((card) => card.name), before);
  });

  it('takes class from the account and prefers the skin sprite over the class one', () => {
    const frame = { url: '/a.png', sheetWidth: 312, sheetHeight: 288, x: 26, y: 0, width: 26, height: 36 };
    const sprites = { skins: { mranger2: frame }, classes: { warrior: { ...frame, x: 0 } } };
    const view = buildTeamView({ at: 0, characters: [live('Amy', 'live', { skin: 'marmor12b' }), live('Ray', 'live', { skin: 'mranger2' })] },
      [{ name: 'Amy', level: 73, className: 'warrior' }], sprites);
    assert.deepEqual(view.reporting.map((card) => [card.name, card.className, card.sprite?.x]), [['Amy', 'warrior', 0], ['Ray', null, 26]]);
  });
});

describe('characterSprites', () => {
  it('cuts the front frame of full skins and skips layered cosmetics', () => {
    const data = {
      version: 1, items: {}, monsters: {}, maps: {}, classes: {}, imagesets: {}, positions: {}, tilesets: {},
      sprites: {
        custom1: { file: '/images/c1.png?v=1', matrix: [['mwarrior2', 'mranger2', 'fpriest', 'x'], ['a', 'b', 'mmage', 'c']] },
        marmor12: { file: '/images/m.png', type: 'armor', matrix: [['marmor12a', 'marmor12b']] },
      },
    } satisfies GameData;
    const result = characterSprites(data, { '/images/c1.png': '/game-assets/c1.png', '/images/m.png': '/game-assets/m.png' }, () => ({ width: 312, height: 288 }));
    assert.deepEqual(result.skins['mranger2'], { url: '/game-assets/c1.png', sheetWidth: 312, sheetHeight: 288, x: 104, y: 0, width: 26, height: 36 });
    assert.deepEqual([result.skins['mmage']?.x, result.skins['mmage']?.y], [182, 144]);
    assert.equal(result.skins['marmor12b'], undefined);
    assert.deepEqual(Object.keys(result.classes).sort(), ['mage', 'priest', 'ranger', 'warrior']);
  });
});
