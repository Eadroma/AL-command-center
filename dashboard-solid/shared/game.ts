/** Game data projections sent to the UI. The full `G` object never leaves the server. */
import { z } from 'zod';

export const gameStatusSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('empty') }),
  z.object({
    status: z.literal('ready'),
    version: z.number(),
    fetchedAt: z.string(),
    checkedAt: z.string(),
    items: z.number(),
    monsters: z.number(),
    maps: z.number(),
  }),
]);

export const itemSummarySchema = z.object({
  key: z.string(),
  name: z.string(),
  type: z.string().nullable(),
  npcPrice: z.number().nullable(),
});

export const itemSearchSchema = z.object({ items: z.array(itemSummarySchema).readonly() });

const recordChangesSchema = z.object({
  added: z.array(z.string()).readonly(),
  removed: z.array(z.string()).readonly(),
  changed: z.array(z.string()).readonly(),
});

/** One update's differences, newest first in GET /api/game/changes. */
export const changeReportSchema = z.object({
  at: z.string(),
  fromVersion: z.number(),
  toVersion: z.number(),
  items: recordChangesSchema,
  monsters: recordChangesSchema,
  maps: recordChangesSchema,
});

export const jobStateSchema = z.object({
  status: z.enum(['idle', 'running', 'succeeded', 'failed']),
  trigger: z.enum(['startup', 'schedule', 'manual', 'cli']).nullable(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  durationMs: z.number().nullable(),
  /** Short English log lines, the same ones the server prints. */
  summary: z.array(z.string()).readonly(),
});

/** One frame of a sprite sheet, in sheet pixels. */
export const spriteFrameSchema = z.object({
  url: z.string(),
  sheetWidth: z.number(),
  sheetHeight: z.number(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

/** Front-facing character frames: by full skin, and one representative per class for layered cosmetics. */
export const characterSpritesSchema = z.object({
  skins: z.record(z.string(), spriteFrameSchema),
  classes: z.record(z.string(), spriteFrameSchema),
});

export const dismissedSchema = z.object({ dismissed: z.array(z.string()).readonly() });

export type GameStatus = z.infer<typeof gameStatusSchema>;
export type SpriteFrame = z.infer<typeof spriteFrameSchema>;
export type CharacterSprites = z.infer<typeof characterSpritesSchema>;
export type RecordChanges = z.infer<typeof recordChangesSchema>;
export type ChangeReport = z.infer<typeof changeReportSchema>;
export type JobState = z.infer<typeof jobStateSchema>;
export type ItemSummary = z.infer<typeof itemSummarySchema>;

/** One tile of a map tileset, already resolved to a URL served by this server (null: image not mirrored). */
export const terrainTileSchema = z.object({ url: z.string().nullable(), x: z.number(), y: z.number(), width: z.number(), height: z.number() });

/**
 * What the UI needs to draw a map like the game does (js/game.js): the default tile fills the bounds, then each rect
 * [tile, x1, y1, x2, y2] repeats its tile from (x1, y1) to (x2, y2) inclusive — a single tile has x2 = x1, y2 = y1.
 * Object groups come last, ordered by their bottom edge, as the game layers them above the ground.
 */
export const mapTerrainSchema = z.object({
  id: z.string(),
  name: z.string(),
  bounds: z.object({ minX: z.number(), minY: z.number(), maxX: z.number(), maxY: z.number() }),
  tiles: z.array(terrainTileSchema.nullable()).readonly(),
  defaultTile: z.number().nullable(),
  rects: z.array(z.tuple([z.number(), z.number(), z.number(), z.number(), z.number()])).readonly(),
});

export type MapTerrain = z.infer<typeof mapTerrainSchema>;

/** A monster as farming screens show it: name, HP, XP, and the maps where it spawns. */
export const monsterSummarySchema = z.object({
  key: z.string(),
  name: z.string(),
  hp: z.number(),
  xp: z.number().nullable(),
  maps: z.array(z.string()).readonly(),
  /** Front frame cropped to the monster's real size; null when its sheet is not mirrored yet. */
  sprite: spriteFrameSchema.nullable(),
});

export const monstersSchema = z.object({ monsters: z.array(monsterSummarySchema).readonly() });

export type MonsterSummary = z.infer<typeof monsterSummarySchema>;
