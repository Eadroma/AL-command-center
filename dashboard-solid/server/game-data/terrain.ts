/**
 * Map terrain projected from G.geometry for the party map. Geometry is validated here, map by map, rather than in
 * the data.js schema: a change in one map's shape must not reject the whole game data.
 */
import { z } from 'zod';
import type { MapTerrain } from '../../shared/game.ts';
import type { GameData } from './data-js.ts';

// [tile, x, y] or [tile, x1, y1, x2, y2]; extra fields (group display offsets) are ignored.
const placementSchema = z.array(z.number().nullable()).min(3);
const geometrySchema = z.looseObject({
  min_x: z.number(),
  min_y: z.number(),
  max_x: z.number(),
  max_y: z.number(),
  default: z.number().optional(),
  // [tileset, x, y, width, height = width]
  tiles: z.array(z.tuple([z.string(), z.number(), z.number(), z.number()], z.unknown()).nullable()),
  placements: z.array(placementSchema).default([]),
  groups: z.array(z.array(placementSchema)).default([]),
});

type Rect = MapTerrain['rects'][number];

function toRect(placement: readonly (number | null)[]): Rect {
  const [tile, x, y, x2, y2] = placement;
  const left = x ?? 0;
  const top = y ?? 0;
  return [tile ?? 0, left, top, x2 ?? left, y2 ?? top];
}

function tileOf(entry: z.infer<typeof geometrySchema>['tiles'][number], data: GameData, assets: Readonly<Record<string, string>>): MapTerrain['tiles'][number] {
  if (entry === null) {
    return null;
  }
  const [tileset, x, y, width] = entry;
  const height = typeof entry[4] === 'number' ? entry[4] : width;
  const file = data.tilesets[tileset]?.file?.split('?')[0];
  return { url: file === undefined ? null : assets[file] ?? null, x, y, width, height };
}

/** Bottom edge of an object group, the key the game sorts groups by. */
function groupBottom(group: readonly Rect[], tiles: MapTerrain['tiles']): number {
  return Math.max(...group.map(([tile, , , , y2]) => y2 + (tiles[tile]?.height ?? 0)));
}

export function mapTerrain(data: GameData, assets: Readonly<Record<string, string>>, id: string): MapTerrain | null {
  const known = Object.hasOwn(data.maps, id) && data.geometry !== undefined && Object.hasOwn(data.geometry, id);
  const geometry = geometrySchema.safeParse(known ? data.geometry?.[id] : undefined);
  if (!geometry.success) {
    return null;
  }
  const { min_x: minX, min_y: minY, max_x: maxX, max_y: maxY } = geometry.data;
  const tiles = geometry.data.tiles.map((entry) => tileOf(entry, data, assets));
  const groups = geometry.data.groups.map((group) => group.map(toRect));
  groups.sort((a, b) => groupBottom(a, tiles) - groupBottom(b, tiles));
  return {
    id, name: data.maps[id]?.name ?? id, bounds: { minX, minY, maxX, maxY }, tiles,
    defaultTile: geometry.data.default ?? null,
    rects: [...geometry.data.placements.map(toRect), ...groups.flat()],
  };
}
