/**
 * Game images referenced by G (imagesets = item and skill icons, sprites = characters and monsters,
 * tilesets = maps), with the checks that tell a real image from an error page.
 */
import type { GameData } from './data-js.ts';

export interface ImageRef {
  /** Path as the game writes it, without its cache-busting query: /images/tiles/items/pack_1a.png */
  readonly path: string;
  /** Query from G (`v=11`), used when falling back to adventure.land. */
  readonly query: string;
  /** Known for icon sheets: columns × size by rows × size. */
  readonly expected: { readonly width: number; readonly height: number } | null;
}

function expectedSize(entry: { readonly size?: number | undefined; readonly [key: string]: unknown }): ImageRef['expected'] {
  const { size, rows, columns } = entry;
  return typeof size === 'number' && typeof rows === 'number' && typeof columns === 'number' ? { width: columns * size, height: rows * size } : null;
}

/** Unique image files used by G, icon sheets first (they carry expected dimensions). */
export function collectImages(data: GameData): ImageRef[] {
  const images = new Map<string, ImageRef>();
  const add = (file: string | undefined, expected: ImageRef['expected']): void => {
    if (file === undefined || file === '') {
      return;
    }
    const [path = '', query = ''] = file.split('?');
    if (!images.has(path)) {
      images.set(path, { path, query, expected });
    }
  };
  for (const set of Object.values(data.imagesets)) {
    add(set.file, expectedSize(set));
  }
  for (const sheet of [...Object.values(data.sprites), ...Object.values(data.tilesets)]) {
    add(sheet.file, null);
  }
  return [...images.values()];
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Width and height from the PNG header, or null when the bytes are not a PNG (an HTML error page, for example). */
export function pngSize(bytes: Uint8Array): { readonly width: number; readonly height: number } | null {
  if (bytes.length < 24 || PNG_SIGNATURE.some((value, index) => bytes[index] !== value)) {
    return null;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

export type ImageCheck = 'ok' | 'notPng' | 'wrongSize';

export function checkImage(bytes: Uint8Array, expected: ImageRef['expected']): ImageCheck {
  const size = pngSize(bytes);
  if (size === null) {
    return 'notPng';
  }
  if (expected !== null && (size.width !== expected.width || size.height !== expected.height)) {
    return 'wrongSize';
  }
  return 'ok';
}

/** Local file names are content hashes; anything else is refused (no path traversal). */
export function isAssetFileName(name: string): boolean {
  return /^[0-9a-f]{40}\.png$|^s256-[0-9a-f]{64}\.png$/.test(name);
}
