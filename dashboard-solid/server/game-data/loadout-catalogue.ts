/**
 * What the loadout and supply screens offer: every wearable item, every other item, and the skills the scripts support
 * per class, each with its icon. Icons are cells of the game's image sets: G.positions[skin] = [set, column, row] ('' = pack_20).
 */
import type { SpriteFrame } from '../../shared/game.ts';
import type { CatalogueEntry, LoadoutCatalogue } from '../../shared/loadouts.ts';
import { SLOT_TYPES } from '../../shared/loadouts.ts';
import { field, list, text } from '../../shared/raw.ts';
import type { GameData } from './data-js.ts';

/** Skills the scripts implement (dashboard-v2's list), per class. */
export const CLASS_SKILLS: Readonly<Record<string, readonly string[]>> = {
  warrior: ['taunt', 'charge', 'warcry', 'cleave', 'stomp', 'agitate'],
  priest: ['heal', 'partyheal', 'curse', 'darkblessing', 'absorb', 'revive'],
  ranger: ['3shot', '5shot', 'supershot', 'huntersmark', 'poisonarrow'],
  mage: ['cburst', 'energize', 'blink', 'reflection', 'burst'],
  rogue: ['fanofknives', 'mentalburst', 'rspeed'],
};

const WEARABLE = new Set(Object.values(SLOT_TYPES).flat());

/** The image set a position names ('' = pack_20), with its mirrored URL. */
function imageSet(data: GameData, assets: Readonly<Record<string, string>>, set: unknown): { readonly url: string; readonly size: number; readonly columns: number; readonly rows: number } | null {
  const name = text(set) === '' ? 'pack_20' : text(set);
  const entry = Object.hasOwn(data.imagesets, name) ? data.imagesets[name] : undefined;
  const url = assets[text(entry?.file).split('?')[0] ?? ''];
  const size = Number(entry?.size);
  return url === undefined || !Number.isFinite(size) ? null : { url, size, columns: Number(field(entry, 'columns')), rows: Number(field(entry, 'rows')) };
}

/** The icon cell of a skin, or null when its image set or image is unknown. */
export function iconFrame(data: GameData, assets: Readonly<Record<string, string>>, skin: string): SpriteFrame | null {
  const [set, column, row] = list(Object.hasOwn(data.positions, skin) ? data.positions[skin] : undefined);
  const sheet = imageSet(data, assets, set);
  if (sheet === null || typeof column !== 'number' || typeof row !== 'number') {
    return null;
  }
  const { url, size } = sheet;
  return { url, sheetWidth: sheet.columns * size, sheetHeight: sheet.rows * size, x: column * size, y: row * size, width: size, height: size };
}

function skinOf(entry: unknown, key: string): string {
  const skin = field(entry, 'skin');
  return typeof skin === 'string' && skin !== '' ? skin : key;
}

function entries(data: GameData, assets: Readonly<Record<string, string>>, keep: (type: string) => boolean): CatalogueEntry[] {
  return Object.entries(data.items)
    .filter(([, item]) => item.type !== undefined && keep(item.type) && field(item, 'ignore') !== true)
    .map(([key, item]): CatalogueEntry => ({ key, name: item.name, type: item.type ?? '', icon: iconFrame(data, assets, skinOf(item, key)) }))
    .sort((a, b) => (a.name === b.name ? a.key.localeCompare(b.key) : a.name.localeCompare(b.name)));
}

export function loadoutCatalogue(data: GameData, assets: Readonly<Record<string, string>>): LoadoutCatalogue {
  const items = entries(data, assets, (type) => WEARABLE.has(type));
  const supplies = entries(data, assets, (type) => !WEARABLE.has(type));
  const skillsData = data['skills'];
  const skills = Object.fromEntries(Object.entries(CLASS_SKILLS).map(([ctype, keys]) => [ctype, keys.map((key): CatalogueEntry => {
    const skill = field(skillsData, key);
    const name = text(field(skill, 'name'));
    return { key, name: name === '' ? key : name, type: 'skill', icon: iconFrame(data, assets, skinOf(skill, key)) };
  })]));
  return { items, supplies, skills };
}
