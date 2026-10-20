import type { PartyMember } from '../types/party';

export interface PartyMapBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface GameMapAsset extends PartyMapBounds {
  src: string;
}

export interface PartyMapGroup {
  map: string;
  members: Array<PartyMember & { x: number; y: number }>;
  bounds: PartyMapBounds;
  asset?: GameMapAsset;
}

/** Build an empty terrain view so operators can inspect maps without a character on them. */
export function createTerrainGroup(map: string, asset: GameMapAsset): PartyMapGroup {
  return { map, members: [], bounds: asset, asset };
}

/** Group fresh character coordinates and use official terrain bounds when available. */
export function groupPartyPositions(members: PartyMember[], maps: Record<string, GameMapAsset> = {}): PartyMapGroup[] {
  const groups = new Map<string, Array<PartyMember & { x: number; y: number }>>();
  for (const member of members) {
    if (!member.map || !Number.isFinite(member.x) || !Number.isFinite(member.y)) continue;
    if (member.status === 'offline' || member.status === 'disabled') continue;
    const positioned = member as PartyMember & { x: number; y: number };
    groups.set(member.map, [...(groups.get(member.map) ?? []), positioned]);
  }

  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([map, positioned]) => {
    const asset = maps[map];
    if (asset) return { map, members: positioned, bounds: asset, asset };

    const xs = positioned.map(member => member.x);
    const ys = positioned.map(member => member.y);
    const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
    const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
    const spanX = Math.max(600, Math.max(...xs) - Math.min(...xs) + 240);
    const spanY = Math.max(420, Math.max(...ys) - Math.min(...ys) + 240);
    return {
      map,
      members: positioned,
      bounds: {
        minX: centerX - spanX / 2,
        maxX: centerX + spanX / 2,
        minY: centerY - spanY / 2,
        maxY: centerY + spanY / 2,
      },
    };
  });
}

export function projectPartyPosition(x: number, y: number, bounds: PartyMapBounds) {
  return {
    left: ((x - bounds.minX) / (bounds.maxX - bounds.minX)) * 100,
    // Game terrain is rendered from minY at the top, with Y increasing downward.
    top: ((y - bounds.minY) / (bounds.maxY - bounds.minY)) * 100,
  };
}
