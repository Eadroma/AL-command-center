import { standSpotBounds } from '../../shared/schema';
/** The town crop uses world coordinates directly; no whole-map scaling offsets. */
export function clampStandSpot(x: number, y: number) {
  const b = standSpotBounds;
  return { map: 'main' as const, x: Math.round(Math.max(b.minX, Math.min(b.maxX, x))), y: Math.round(Math.max(b.minY, Math.min(b.maxY, y))) };
}
