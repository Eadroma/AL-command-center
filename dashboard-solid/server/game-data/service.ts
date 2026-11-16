/**
 * Game data at runtime: the validated snapshot kept in memory, refreshed from adventure.land,
 * and the small projections the UI is allowed to see.
 */
import { open } from 'node:fs/promises';
import path from 'node:path';
import type { CharacterSprites, GameStatus, ItemSummary, MapTerrain, MonsterSummary } from '../../shared/game.ts';
import type { LoadoutCatalogue } from '../../shared/loadouts.ts';
import type { GameData } from './data-js.ts';
import type { ImageManifest, SyncResult } from './image-sync.ts';
import { readManifest, syncImages } from './image-sync.ts';
import { pngSize } from './images.ts';
import { characterSprites } from './sprites.ts';
import type { GameDataMeta, UpdateResult } from './store.ts';
import { readGameData, readMeta, updateGameData } from './store.ts';
import { loadoutCatalogue } from './loadout-catalogue.ts';
import { monsterSummaries } from './monsters.ts';
import { mapTerrain } from './terrain.ts';
import type { GameFacts } from '../builder/validate.ts';
import { gameFacts } from '../builder/facts.ts';

export interface GameDataService {
  readonly status: () => GameStatus;
  readonly searchItems: (query: string, limit: number) => ItemSummary[];
  readonly refresh: () => Promise<UpdateResult>;
  /** True when there is no snapshot or the last check is older than `maxAgeHours`. */
  readonly isStale: (maxAgeHours: number, now?: Date) => boolean;
  /** Mirrors the images G references; skipped (null) when there is no game data yet. */
  readonly refreshImages: () => Promise<SyncResult | null>;
  readonly hasImages: () => boolean;
  /** Game image path (/images/…png) → URL served by this server (/game-assets/<hash>.png). */
  readonly assetUrls: () => Readonly<Record<string, string>>;
  readonly directories: () => GameDataDirectories;
  /** Front-facing character frames, computed once per image set. */
  readonly characterSprites: () => Promise<CharacterSprites>;
  /** Drawable terrain of one map; null for an unknown map or one without geometry. */
  readonly terrain: (id: string) => MapTerrain | null;
  /** Item facts the builder's validation needs; null before the first game data download. */
  readonly facts: () => GameFacts | null;
  /** Every monster for farming targets; empty before the first game data download. */
  readonly monsters: () => Promise<MonsterSummary[]>;
  /** Wearable items and class skills with their icons; null before the first game data download. */
  readonly loadoutCatalogue: () => LoadoutCatalogue | null;
}

export interface GameDataDirectories {
  readonly data: string;
  readonly assets: string;
}

export function assetUrls(manifest: ImageManifest | null): Record<string, string> {
  return Object.fromEntries(Object.entries(manifest?.files ?? {}).map(([gamePath, file]) => [gamePath, `/game-assets/${file}`]));
}

export function projectStatus(data: GameData | null, meta: GameDataMeta | null): GameStatus {
  if (data === null || meta === null) {
    return { status: 'empty' };
  }
  return {
    status: 'ready', version: meta.version, fetchedAt: meta.fetchedAt, checkedAt: meta.checkedAt,
    items: Object.keys(data.items).length, monsters: Object.keys(data.monsters).length, maps: Object.keys(data.maps).length,
  };
}

/** Case-insensitive search on key and name; exact key matches first. */
export function searchItems(data: GameData | null, query: string, limit: number): ItemSummary[] {
  if (data === null) {
    return [];
  }
  const needle = query.trim().toLowerCase();
  const matches = Object.entries(data.items).filter(([key, item]) => needle === '' || key.includes(needle) || item.name.toLowerCase().includes(needle));
  matches.sort(([a], [b]) => {
    const exactFirst = Number(b === needle) - Number(a === needle);
    return exactFirst !== 0 ? exactFirst : a.localeCompare(b);
  });
  return matches.slice(0, limit).map(([key, item]) => ({ key, name: item.name, type: item.type ?? null, npcPrice: item.g ?? null }));
}

/** Width and height of mirrored sprite sheets, read from their PNG headers. */
async function sheetSizes(directory: string, manifest: ImageManifest | null): Promise<Map<string, { width: number; height: number }>> {
  const sizes = new Map<string, { width: number; height: number }>();
  for (const file of Object.values(manifest?.files ?? {})) {
    const handle = await open(path.join(directory, file)).catch(() => null);
    if (handle === null) {
      continue;
    }
    const header = new Uint8Array(24);
    await handle.read(header, 0, 24, 0);
    await handle.close();
    const size = pngSize(header);
    if (size !== null) {
      sizes.set(`/game-assets/${file}`, size);
    }
  }
  return sizes;
}

export async function createGameDataService(directories: GameDataDirectories, fetchImpl: typeof fetch = fetch): Promise<GameDataService> {
  const directory = directories.data;
  let data = await readGameData(directory);
  let meta = await readMeta(directory);
  let manifest = await readManifest(directories.assets);
  let sprites: Promise<CharacterSprites> | null = null;
  /** Front frames of every full-skin sheet (characters and monsters), computed once per image set. */
  const frames = async (): Promise<CharacterSprites> => {
    sprites ??= sheetSizes(directories.assets, manifest).then((sizes) =>
      data === null ? { skins: {}, classes: {} } : characterSprites(data, assetUrls(manifest), (url) => sizes.get(url) ?? null));
    return sprites;
  };
  return {
    status: () => projectStatus(data, meta),
    searchItems: (query, limit) => searchItems(data, query, limit),
    refresh: async () => {
      const result = await updateGameData(directory, fetchImpl);
      if (result.status !== 'failed') {
        meta = result.meta;
        if (result.status !== 'unchanged' || data === null) {
          data = await readGameData(directory);
        }
      }
      return result;
    },
    isStale: (maxAgeHours, now = new Date()) => meta === null || now.getTime() - Date.parse(meta.checkedAt) > maxAgeHours * 3_600_000,
    refreshImages: async () => {
      if (data === null) {
        return null;
      }
      const result = await syncImages(directories.assets, data, fetchImpl);
      manifest = await readManifest(directories.assets);
      sprites = null;
      return result;
    },
    hasImages: () => manifest !== null,
    assetUrls: () => assetUrls(manifest),
    directories: () => directories,
    characterSprites: frames,
    terrain: (id) => (data === null ? null : mapTerrain(data, assetUrls(manifest), id)),
    facts: () => (data === null ? null : gameFacts(data)),
    monsters: async () => (data === null ? [] : monsterSummaries(data, (await frames()).skins)),
    loadoutCatalogue: () => (data === null ? null : loadoutCatalogue(data, assetUrls(manifest))),
  };
}
