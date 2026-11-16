/**
 * Front-facing character frames cut from the game's sprite sheets.
 * A character sheet is a grid of skins (G.sprites[sheet].matrix); each skin cell holds 3 animation frames
 * by 4 directions. The front view is the middle frame of the first row (measured on 2026-10-26:
 * 312×288 sheets, 4×2 skins, 26×36 frames).
 * Layered cosmetics (armour, hair…) cannot be drawn as one frame; the UI then uses a class representative,
 * as dashboard-v2 did.
 */
import type { CharacterSprites, SpriteFrame } from '../../shared/game.ts';
import type { GameData } from './data-js.ts';

const FRAMES_PER_SKIN_X = 3;
const FRAMES_PER_SKIN_Y = 4;

/** Representative full skins per class, the same choice as dashboard-v2. */
export const CLASS_SKINS: Readonly<Record<string, string>> = {
  warrior: 'mwarrior2', priest: 'fpriest', ranger: 'mranger2', mage: 'mmage', rogue: 'mrogue', merchant: 'mmerchant', paladin: 'mpaladin',
};

interface SheetSize {
  readonly width: number;
  readonly height: number;
}

type Sheet = GameData['sprites'][string];

/** Front frames of every skin in one full-skin sheet; nothing for layered cosmetics or unknown sizes. */
function sheetFrames(sheet: Sheet, url: string, size: SheetSize): [string, SpriteFrame][] {
  const matrix = sheet['matrix'];
  const layered = typeof sheet['type'] === 'string' && sheet['type'] !== 'full';
  const rows: unknown[][] = Array.isArray(matrix) && !layered ? matrix.filter((row): row is unknown[] => Array.isArray(row)) : [];
  const columns = rows[0]?.length ?? 0;
  if (columns === 0) {
    return [];
  }
  const width = size.width / columns / FRAMES_PER_SKIN_X;
  const height = size.height / rows.length / FRAMES_PER_SKIN_Y;
  return rows.flatMap((row, rowIndex) => row.flatMap((skin, columnIndex): [string, SpriteFrame][] =>
    typeof skin === 'string' && skin !== ''
      ? [[skin, { url, sheetWidth: size.width, sheetHeight: size.height, x: (columnIndex * FRAMES_PER_SKIN_X + 1) * width, y: rowIndex * FRAMES_PER_SKIN_Y * height, width, height }]]
      : []));
}

export function characterSprites(data: GameData, assetUrls: Readonly<Record<string, string>>, sheetSize: (url: string) => SheetSize | null): CharacterSprites {
  const skins: Record<string, SpriteFrame> = {};
  for (const sheet of Object.values(data.sprites)) {
    const url = sheet.file === undefined ? undefined : assetUrls[sheet.file.split('?')[0] ?? ''];
    const size = url === undefined ? null : sheetSize(url);
    if (url !== undefined && size !== null) {
      Object.assign(skins, Object.fromEntries(sheetFrames(sheet, url, size)));
    }
  }
  const classes = Object.fromEntries(Object.entries(CLASS_SKINS).flatMap(([className, skin]) => {
    const frame = skins[skin];
    return frame === undefined ? [] : [[className, frame]];
  }));
  return { skins, classes };
}
