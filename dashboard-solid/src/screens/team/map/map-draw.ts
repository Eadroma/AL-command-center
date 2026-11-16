/** Paints one frame of the party map: terrain, trails, then characters on top. Camera maths live in map-view.ts. */
import type { SpriteFrame } from '../../../../shared/game.ts';
import type { CharacterLive } from '../../../../shared/telemetry.ts';
import type { Bounds, Camera, Projection, Size } from './map-view.ts';
import { toScreen, trailSegments, viewScale } from './map-view.ts';
import type { TerrainCanvas } from './terrain-canvas.ts';

export interface MapMarker {
  readonly live: CharacterLive;
  readonly sprite: HTMLImageElement | null;
  readonly frame: SpriteFrame | null;
  readonly color: string;
  readonly followed: boolean;
}

export interface Frame {
  readonly map: string;
  readonly bounds: Bounds;
  readonly camera: Camera;
  readonly view: Size;
  readonly terrain: TerrainCanvas | null;
  readonly markers: readonly MapMarker[];
  readonly ground: string;
  readonly ink: string;
  readonly now: number;
}

function drawTerrain(context: CanvasRenderingContext2D, frame: Frame, projection: Projection): void {
  if (frame.terrain === null) {
    return;
  }
  const { minX, minY } = frame.bounds;
  const { canvas } = frame.terrain;
  const origin = toScreen({ x: minX, y: minY }, projection);
  const stretch = projection.scale / frame.terrain.scale;
  context.drawImage(canvas, origin.x, origin.y, canvas.width * stretch, canvas.height * stretch);
}

function drawTrails(context: CanvasRenderingContext2D, frame: Frame, projection: Projection): void {
  for (const marker of frame.markers) {
    context.strokeStyle = marker.color;
    // Farming loops pile up into a scribble over 10 minutes: keep trails faint so sprites stay readable.
    context.globalAlpha = marker.followed ? 0.85 : 0.45;
    context.lineWidth = marker.followed ? 2.5 : 1.5;
    for (const segment of trailSegments(marker.live.positions, frame.map, frame.now)) {
      context.beginPath();
      segment.forEach((point, index) => {
        const screen = toScreen(point, projection);
        if (index === 0) {
          context.moveTo(screen.x, screen.y);
        } else {
          context.lineTo(screen.x, screen.y);
        }
      });
      context.stroke();
    }
  }
  context.globalAlpha = 1;
}

function drawMarker(context: CanvasRenderingContext2D, frame: Frame & { readonly projection: Projection }, marker: MapMarker): void {
  const { x, y, map } = marker.live;
  if (x === null || y === null || map !== frame.map) {
    return;
  }
  const at = toScreen({ x, y }, frame.projection);
  context.fillStyle = marker.color;
  context.fillRect(at.x - 3, at.y - 3, 6, 6);
  if (marker.sprite !== null && marker.frame !== null) {
    const { frame: cut } = marker;
    context.drawImage(marker.sprite, cut.x, cut.y, cut.width, cut.height, at.x - cut.width / 2, at.y - cut.height - 4, cut.width, cut.height);
  }
  if (marker.followed) {
    context.strokeStyle = marker.color;
    context.lineWidth = 2;
    context.strokeRect(at.x - 18, at.y - 46, 36, 50);
  }
  context.font = '700 12px "Atkinson Hyperlegible Next", system-ui, sans-serif';
  context.textAlign = 'center';
  context.lineWidth = 3;
  context.strokeStyle = frame.ground;
  context.strokeText(marker.live.name, at.x, at.y + 16);
  context.fillStyle = frame.ink;
  context.fillText(marker.live.name, at.x, at.y + 16);
}

export function drawFrame(context: CanvasRenderingContext2D, frame: Frame): void {
  const projection: Projection = { camera: frame.camera, scale: viewScale(frame.bounds, frame.view, frame.camera.zoom), view: frame.view };
  context.imageSmoothingEnabled = false;
  context.fillStyle = frame.ground;
  context.fillRect(0, 0, frame.view.width, frame.view.height);
  drawTerrain(context, frame, projection);
  drawTrails(context, frame, projection);
  for (const marker of frame.markers) {
    drawMarker(context, { ...frame, projection }, marker);
  }
}
