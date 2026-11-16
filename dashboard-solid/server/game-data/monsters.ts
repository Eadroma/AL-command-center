/** Monster summaries for farming targets: name, HP, XP, and the maps where the game spawns them (G.maps[].monsters). */
import type { MonsterSummary, SpriteFrame } from '../../shared/game.ts';
import type { GameData } from './data-js.ts';
import { field, list, text } from '../../shared/raw.ts';

/** Maps that spawn each monster type, from the map definitions (ignored maps left out). */
function spawnMaps(data: GameData): Map<string, string[]> {
  const spawns = new Map<string, string[]>();
  for (const [id, map] of Object.entries(data.maps)) {
    if (field(map, 'ignore') === true) {
      continue;
    }
    for (const spawn of list(field(map, 'monsters'))) {
      const type = text(field(spawn, 'type'));
      const maps = spawns.get(type) ?? [];
      if (type !== '' && !maps.includes(id)) {
        spawns.set(type, [...maps, id]);
      }
    }
  }
  return spawns;
}

/**
 * The monster's own frame inside its sheet cell, as the game crops it (sprite_image, and dashboard-v2): G.dimensions
 * gives [width, height, x offset]; the frame is centred horizontally and sits on the cell's bottom.
 */
export function cropToMonster(cell: SpriteFrame, dimensions: unknown): SpriteFrame {
  const [width, height, offset] = list(dimensions).map(Number);
  if (width === undefined || height === undefined || !Number.isFinite(width) || !Number.isFinite(height)) {
    return cell;
  }
  const shift = offset !== undefined && Number.isFinite(offset) ? offset : 0;
  return { ...cell, x: cell.x + shift + (cell.width - width) / 2, y: cell.y + cell.height - height, width, height };
}

/** Every monster, sorted by name; the UI filters them (there are about 150). */
export function monsterSummaries(data: GameData, frames: Readonly<Record<string, SpriteFrame>>): MonsterSummary[] {
  const spawns = spawnMaps(data);
  const dimensions = data['dimensions'];
  return Object.entries(data.monsters)
    .map(([key, monster]) => {
      const skin = typeof monster['skin'] === 'string' ? monster['skin'] : key;
      const cell = Object.hasOwn(frames, skin) ? frames[skin] : undefined;
      return { key, name: monster.name, hp: monster.hp, xp: monster.xp ?? null, maps: spawns.get(key) ?? [], sprite: cell === undefined ? null : cropToMonster(cell, field(dimensions, skin)) };
    })
    .sort((a, b) => (a.name === b.name ? a.key.localeCompare(b.key) : a.name.localeCompare(b.name)));
}
