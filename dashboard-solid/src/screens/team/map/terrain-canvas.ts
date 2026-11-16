/**
 * Draws a map terrain once into an offscreen canvas, the way the game lays tiles (see shared/game.ts mapTerrainSchema).
 * The party map then only copies this canvas when the camera moves, instead of thousands of tiles per frame.
 */
import type { MapTerrain } from '../../../../shared/game.ts';

// shortcut: one canvas per map at up to 4096 px a side (≈ 50 MB for "main"); tile it if phones run short of memory.
const MAX_SIDE = 4096;

const images = new Map<string, Promise<HTMLImageElement | null>>();

/** Loads each image once per page; a missing image resolves to null and its tiles are skipped. */
export function loadImage(url: string): Promise<HTMLImageElement | null> {
  const cached = images.get(url);
  if (cached !== undefined) {
    return cached;
  }
  const loading = new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image();
    image.onload = () => { resolve(image); };
    image.onerror = () => { resolve(null); };
    image.src = url;
  });
  images.set(url, loading);
  return loading;
}

export interface TerrainCanvas {
  readonly canvas: HTMLCanvasElement;
  /** Canvas pixels per world unit (1, or less for maps larger than MAX_SIDE). */
  readonly scale: number;
}

type Tile = NonNullable<MapTerrain['tiles'][number]>;

function drawTile(context: CanvasRenderingContext2D, { tile, image }: Drawable, at: { readonly x: number; readonly y: number }): void {
  context.drawImage(image, tile.x, tile.y, tile.width, tile.height, at.x, at.y, tile.width, tile.height);
}

type Loaded = ReadonlyMap<string, HTMLImageElement>;

interface Drawable {
  readonly tile: Tile;
  readonly image: HTMLImageElement;
}

/** A tile with its loaded image, or null when either is missing (its cells stay empty). */
function drawable(terrain: MapTerrain, loaded: Loaded, index: number | null): Drawable | null {
  const tile = index === null ? null : terrain.tiles[index] ?? null;
  const image = tile?.url === null || tile === null ? undefined : loaded.get(tile.url);
  return tile === null || image === undefined ? null : { tile, image };
}

function fillDefault(context: CanvasRenderingContext2D, terrain: MapTerrain, loaded: Loaded): void {
  const found = drawable(terrain, loaded, terrain.defaultTile);
  if (found === null) {
    return;
  }
  const { tile, image } = found;
  const pattern = context.createPattern(cropped(image, tile), 'repeat');
  if (pattern !== null) {
    context.fillStyle = pattern;
    // The game aligns the default tile on multiples of its size; the context is already translated to minX/minY.
    const { minX, minY, maxX, maxY } = terrain.bounds;
    context.fillRect(Math.floor(minX / tile.width) * tile.width, Math.floor(minY / tile.height) * tile.height, maxX - minX + tile.width * 2, maxY - minY + tile.height * 2);
  }
}

function cropped(image: HTMLImageElement, tile: Tile): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = tile.width;
  canvas.height = tile.height;
  canvas.getContext('2d')?.drawImage(image, tile.x, tile.y, tile.width, tile.height, 0, 0, tile.width, tile.height);
  return canvas;
}

export async function renderTerrain(terrain: MapTerrain): Promise<TerrainCanvas | null> {
  const urls = [...new Set(terrain.tiles.flatMap((tile) => (typeof tile?.url === 'string' ? [tile.url] : [])))];
  const loaded = new Map((await Promise.all(urls.map(async (url) => [url, await loadImage(url)] as const)))
    .flatMap(([url, image]) => (image === null ? [] : [[url, image] as const])));
  const { minX, minY, maxX, maxY } = terrain.bounds;
  const scale = Math.min(1, MAX_SIDE / Math.max(maxX - minX, maxY - minY));
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil((maxX - minX) * scale);
  canvas.height = Math.ceil((maxY - minY) * scale);
  const context = canvas.getContext('2d');
  if (context === null) {
    return null;
  }
  context.imageSmoothingEnabled = false;
  context.scale(scale, scale);
  context.translate(-minX, -minY);
  fillDefault(context, terrain, loaded);
  for (const [index, x1, y1, x2, y2] of terrain.rects) {
    const found = drawable(terrain, loaded, index);
    if (found === null) {
      continue;
    }
    for (let x = x1; x <= x2; x += found.tile.width) {
      for (let y = y1; y <= y2; y += found.tile.height) {
        drawTile(context, found, { x, y });
      }
    }
  }
  return { canvas, scale };
}
