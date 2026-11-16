/** Sprite zoom for a square box (pure, tested without a browser). */
import type { SpriteFrame } from '../../shared/game.ts';

/** Zoom that fits the frame in the box: whole numbers up to 3× for small sprites, a fraction for large ones. */
export function fitScale(frame: Pick<SpriteFrame, 'width' | 'height'>, box: number): number {
  const fit = box / Math.max(frame.width, frame.height);
  return fit >= 1 ? Math.min(3, Math.floor(fit)) : fit;
}
