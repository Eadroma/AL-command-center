/** Party map: terrain projected from G.geometry, camera maths, trails, and the map route. */
import assert from 'node:assert/strict';
import { EMPTY_INSIGHT } from '../server/telemetry/insight.ts';
import { describe, it } from 'node:test';
import type { GameData } from '../server/game-data/data-js.ts';
import { mapTerrain } from '../server/game-data/terrain.ts';
import type { CharacterLive } from '../shared/telemetry.ts';
import { fitCamera, occupiedMaps, placedCharacters, toScreen, trailSegments, TRAIL_GAP_MS, TRAIL_MS, viewScale, zoomAt } from '../src/screens/team/map/map-view.ts';
import { emptyGameData, testApp } from './helpers/fakes.ts';

function gameData(geometry: Record<string, unknown>): GameData {
  return {
    version: 1, items: {}, monsters: {}, classes: {}, positions: {}, imagesets: {}, sprites: {},
    maps: { town: { name: 'Town' }, ghost: { name: 'Ghost' } },
    tilesets: { ground: { file: '/images/tiles/map/ground.png?v=3' }, lost: {} },
    geometry,
  };
}

const assets = { '/images/tiles/map/ground.png': '/game-assets/abc.png' };

describe('mapTerrain', () => {
  const town = {
    min_x: -100, min_y: -50, max_x: 100, max_y: 50, default: 0,
    tiles: [['ground', 0, 0, 16], ['ground', 16, 0, 32, 48], ['lost', 0, 0, 8], null],
    placements: [[1, 10, 20], [0, -16, -16, 16, 0]],
    // The lower group (bottom 60 + 48) must come after the upper one (bottom 0 + 16).
    groups: [[[1, 0, 60]], [[0, 0, 0, null, null, 4]]],
  };

  it('resolves tiles to served URLs with height defaulting to width', () => {
    const terrain = mapTerrain(gameData({ town }), assets, 'town');
    assert.deepEqual(terrain?.tiles, [
      { url: '/game-assets/abc.png', x: 0, y: 0, width: 16, height: 16 },
      { url: '/game-assets/abc.png', x: 16, y: 0, width: 32, height: 48 },
      { url: null, x: 0, y: 0, width: 8, height: 8 },
      null,
    ]);
    assert.deepEqual(terrain.bounds, { minX: -100, minY: -50, maxX: 100, maxY: 50 });
    assert.equal(terrain.name, 'Town');
    assert.equal(terrain.defaultTile, 0);
  });

  it('turns placements into rects, then object groups ordered by their bottom edge', () => {
    assert.deepEqual(mapTerrain(gameData({ town }), assets, 'town')?.rects, [
      [1, 10, 20, 10, 20], [0, -16, -16, 16, 0], [0, 0, 0, 0, 0], [1, 0, 60, 0, 60],
    ]);
  });

  it('returns null for unknown maps, maps without geometry, inherited keys and malformed geometry', () => {
    const data = gameData({ town, ghost: { tiles: 'nope' } });
    assert.equal(mapTerrain(data, assets, 'nowhere'), null);
    assert.equal(mapTerrain(gameData({}), assets, 'town'), null);
    assert.equal(mapTerrain(data, assets, 'ghost'), null);
    assert.equal(mapTerrain(data, assets, 'constructor'), null);
    assert.equal(mapTerrain(data, assets, '__proto__'), null);
  });
});

describe('map route', () => {
  it('answers 404 with a code for a map without terrain', async () => {
    const response = await testApp({ gameData: { ...emptyGameData, terrain: () => null } }).request('/api/game/maps/nowhere', { headers: { host: '127.0.0.1:9321' } });
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: { code: 'game.unknownMap' } });
  });
});

function character(overrides: Partial<CharacterLive>): CharacterLive {
  return {
    name: 'A', source: 'telemetry', freshness: 'live', lastSeen: 0, level: null, hp: null, maxHp: null, mp: null, maxMp: null,
    map: null, x: null, y: null, server: null, target: null, skin: null, activity: null, gold: null, positions: [], failures: [], insight: EMPTY_INSIGHT, logs: [],
    ...overrides,
  };
}

describe('map view', () => {
  it('places only characters with a full position and lists their maps in a stable order', () => {
    const placed = placedCharacters([
      character({ name: 'B', map: 'town', x: 1, y: 2 }), character({ name: 'C', map: 'cave', x: 0, y: 0 }), character({ name: 'D', map: 'town', x: null, y: 2 }),
    ]);
    assert.deepEqual(placed.map((entry) => entry.name), ['B', 'C']);
    assert.deepEqual(occupiedMaps(placed), ['cave', 'town']);
  });

  it('fits the whole map, and zooming keeps the point under the cursor in place', () => {
    const bounds = { minX: 0, minY: 0, maxX: 400, maxY: 200 };
    const view = { width: 800, height: 400 };
    const camera = fitCamera(bounds);
    const scale = viewScale(bounds, view, 1);
    assert.deepEqual(toScreen({ x: 0, y: 0 }, { camera, scale, view }), { x: 0, y: 0 });
    const anchor = { x: 600, y: 100 };
    const zoomed = zoomAt(camera, { bounds, view }, { factor: 2, anchor });
    const world = { x: 300, y: 50 };
    assert.deepEqual(toScreen(world, { camera: zoomed, scale: viewScale(bounds, view, zoomed.zoom), view }), anchor);
    assert.equal(zoomAt(zoomed, { bounds, view }, { factor: 100, anchor }).zoom, 8);
  });

  it('breaks trails at map changes and telemetry gaps, and drops points older than 10 minutes', () => {
    const now = 1_000_000;
    const at = (seconds: number): number => now - TRAIL_MS + seconds * 1000;
    const positions = [
      { at: now - TRAIL_MS - 5000, map: 'town', x: -1, y: -1 },
      { at: at(1), map: 'town', x: 0, y: 0 },
      { at: at(2), map: 'town', x: 1, y: 0 },
      { at: at(3), map: 'cave', x: 9, y: 9 },
      { at: at(4), map: 'town', x: 2, y: 0 },
      { at: at(5), map: 'town', x: 3, y: 0 },
      { at: at(5) + TRAIL_GAP_MS, map: 'town', x: 4, y: 0 },
      { at: at(6) + TRAIL_GAP_MS, map: 'town', x: 5, y: 0 },
    ];
    assert.deepEqual(trailSegments(positions, 'town', now), [
      [{ x: 0, y: 0 }, { x: 1, y: 0 }],
      [{ x: 2, y: 0 }, { x: 3, y: 0 }],
      [{ x: 4, y: 0 }, { x: 5, y: 0 }],
    ]);
  });
});
