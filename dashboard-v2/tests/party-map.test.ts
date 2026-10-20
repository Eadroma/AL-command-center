import { describe, expect, it } from 'vitest';
import { createTerrainGroup, groupPartyPositions, projectPartyPosition } from '../src/models/party-map';
import type { PartyMember } from '../src/types';

const member = (name: string, map: string | null, x: number | null, y: number | null, status: PartyMember['status'] = 'online'): PartyMember => ({
  name, class: 'warrior', skin: null, status, hp: 1, maxHp: 1, mp: 1, maxMp: 1,
  gold: 0, xp: 0, freeSlots: 42, inventory: [], equipment: [], stand: [], hunt: null,
  map, x, y, level: 1, target: null, runtime: 'browser', script: 'test', deploymentStage: 'Running',
});

describe('party live map', () => {
  it('groups only fresh coordinates by map', () => {
    const groups = groupPartyPositions([
      member('Tank', 'main', 100, 200), member('Priest', 'main', 150, 160),
      member('Ranger', 'cave', 1200, -800), member('Shop', 'main', 0, 0, 'offline'),
    ]);
    expect(groups.map(group => [group.map, group.members.map(entry => entry.name)])).toEqual([
      ['cave', ['Ranger']], ['main', ['Tank', 'Priest']],
    ]);
  });

  it('projects game coordinates into a stable radar viewport', () => {
    const [group] = groupPartyPositions([member('Tank', 'main', 100, 200)]);
    expect(projectPartyPosition(100, 200, group.bounds)).toEqual({ left: 50, top: 50 });
  });

  it('uses official map bounds when rendered terrain metadata is available', () => {
    const maps = { main: { src: '/assets/maps/main.png', minX: -1000, maxX: 2000, minY: -500, maxY: 1500 } };
    const [group] = groupPartyPositions([member('Tank', 'main', 500, 500)], maps);
    expect(group.asset).toEqual(maps.main);
    expect(group.bounds).toEqual(maps.main);
    expect(projectPartyPosition(500, 500, group.bounds)).toEqual({ left: 50, top: 50 });
  });

  it('keeps north at the top and south at the bottom, including town spawn and beach positions', () => {
    const bounds = { minX: -1616, maxX: 2320, minY: -1040, maxY: 2232 };
    expect(projectPartyPosition(bounds.minX, bounds.minY, bounds)).toEqual({ left: 0, top: 0 });
    expect(projectPartyPosition(bounds.maxX, bounds.maxY, bounds)).toEqual({ left: 100, top: 100 });
    expect(projectPartyPosition(0, 0, bounds).top).toBeCloseTo(31.7848, 3);
    expect(projectPartyPosition(-1200, -100, bounds).top).toBeLessThan(projectPartyPosition(-1200, 500, bounds).top);
  });
  it('creates an inspectable empty terrain from the map catalog', () => {
    const cave = { src: '/assets/maps/cave.png', minX: -600, maxX: 1960, minY: -1488, maxY: 256 };
    expect(createTerrainGroup('cave', cave)).toEqual({ map: 'cave', members: [], bounds: cave, asset: cave });
  });
});
