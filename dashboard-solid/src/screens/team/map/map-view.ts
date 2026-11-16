/**
 * Party map model (pure, tested without a browser): which maps are occupied, the camera, and the trails.
 * The camera never moves on its own: telemetry updates only move it while the player follows a character.
 */
import type { MapTerrain } from '../../../../shared/game.ts';
import type { CharacterLive } from '../../../../shared/telemetry.ts';

export const TRAIL_MS = 10 * 60_000;
/** Two points further apart in time than this are not joined: the character was not seen moving between them. */
export const TRAIL_GAP_MS = 20_000;
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 8;

export type Bounds = MapTerrain['bounds'];

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

/** Where the camera looks: a world point at the centre of the view, and a zoom over the "whole map" scale. */
export interface Camera {
  readonly center: Point;
  readonly zoom: number;
}

/** The map area on screen: world bounds and the canvas size in CSS pixels. */
export interface Viewport {
  readonly bounds: Bounds;
  readonly view: Size;
}

/** Everything needed to turn a world point into a screen point. */
export interface Projection {
  readonly camera: Camera;
  readonly scale: number;
  readonly view: Size;
}

export interface Placed {
  readonly name: string;
  readonly map: string;
  readonly point: Point;
}

/** Live or stale characters with a known position; never-seen ones have none. */
export function placedCharacters(characters: readonly CharacterLive[]): Placed[] {
  return characters.flatMap((character) =>
    character.map !== null && character.x !== null && character.y !== null ? [{ name: character.name, map: character.map, point: { x: character.x, y: character.y } }] : []);
}

/** Occupied maps in a stable order (by name), so the map buttons do not move between packets. */
export function occupiedMaps(placed: readonly Placed[]): string[] {
  return [...new Set(placed.map((entry) => entry.map))].sort((a, b) => a.localeCompare(b));
}

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

export function fitCamera(bounds: Bounds): Camera {
  return { center: { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 }, zoom: 1 };
}

/** Screen pixels per world unit. */
export function viewScale(bounds: Bounds, view: Size, zoom: number): number {
  const fit = Math.min(view.width / (bounds.maxX - bounds.minX), view.height / (bounds.maxY - bounds.minY));
  return fit * zoom;
}

export function toScreen(point: Point, { camera, scale, view }: Projection): Point {
  return { x: (point.x - camera.center.x) * scale + view.width / 2, y: (point.y - camera.center.y) * scale + view.height / 2 };
}

/** Zooms around a screen point (the cursor), keeping the world point under it in place. */
export function zoomAt(camera: Camera, { bounds, view }: Viewport, { factor, anchor }: { readonly factor: number; readonly anchor: Point }): Camera {
  const zoom = clampZoom(camera.zoom * factor);
  const before = viewScale(bounds, view, camera.zoom);
  const after = viewScale(bounds, view, zoom);
  const world = { x: camera.center.x + (anchor.x - view.width / 2) / before, y: camera.center.y + (anchor.y - view.height / 2) / before };
  return { zoom, center: { x: world.x - (anchor.x - view.width / 2) / after, y: world.y - (anchor.y - view.height / 2) / after } };
}

export function panBy(camera: Camera, scale: number, delta: Point): Camera {
  return { ...camera, center: { x: camera.center.x - delta.x / scale, y: camera.center.y - delta.y / scale } };
}

/**
 * Trail of one character on one map over the last 10 minutes, as separate polylines: a map change (door,
 * teleport) or a gap in telemetry breaks the line instead of drawing a straight jump across the map.
 */
export function trailSegments(positions: CharacterLive['positions'], map: string, now: number): Point[][] {
  const segments: Point[][] = [[]];
  let previousAt: number | null = null;
  for (const position of positions) {
    const onMap = position.map === map;
    const joined = onMap && previousAt !== null && position.at - previousAt < TRAIL_GAP_MS;
    if (!joined) {
      segments.push([]);
    }
    if (onMap && now - position.at <= TRAIL_MS) {
      segments.at(-1)?.push({ x: position.x, y: position.y });
    }
    previousAt = onMap ? position.at : null;
  }
  return segments.filter((segment) => segment.length > 1);
}

/** Bounds around the characters when a map has no terrain: positions still show, on plain ground. */
export function boundsAround(points: readonly Point[]): Bounds {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const margin = 300;
  return { minX: Math.min(...xs) - margin, minY: Math.min(...ys) - margin, maxX: Math.max(...xs) + margin, maxY: Math.max(...ys) + margin };
}
