/**
 * The map canvas: fetches and paints the active map's terrain, redraws on every camera or telemetry change,
 * and turns drag, wheel and arrow keys into camera moves.
 */
import type { Accessor, JSX, Resource } from 'solid-js';
import { createEffect, createResource, createSignal, onCleanup, Show } from 'solid-js';
import type { MapTerrain } from '../../../../shared/game.ts';
import { mapTerrainSchema } from '../../../../shared/game.ts';
import type { ApiResult } from '../../../api/http.ts';
import { apiGet } from '../../../api/http.ts';
import { t } from '../../../i18n/i18n.ts';
import type { CharacterCardModel } from '../team-view.ts';
import type { Frame, MapMarker } from './map-draw.ts';
import { drawFrame } from './map-draw.ts';
import type { MapCamera } from './map-camera.ts';
import type { Placed, Point, Size, Viewport } from './map-view.ts';
import { boundsAround } from './map-view.ts';
import type { TerrainCanvas } from './terrain-canvas.ts';
import { loadImage, renderTerrain } from './terrain-canvas.ts';

export interface MapStageProps {
  readonly cards: readonly CharacterCardModel[];
  readonly placed: Accessor<readonly Placed[]>;
  readonly camera: MapCamera;
  readonly now: number;
}

const PALETTE = ['--gold', '--mp', '--herb', '--hp', '--text'] as const;
const PAN_STEP = 80;
export const ZOOM_STEP = 1.5;

function okValue<T>(result: ApiResult<T> | undefined): T | undefined {
  return result?.ok === true ? result.value : undefined;
}

async function loadSprites(joined: string): Promise<Map<string, HTMLImageElement | null>> {
  const urls = joined.split('\n').filter((url) => url !== '');
  return new Map(await Promise.all(urls.map(async (url) => [url, await loadImage(url)] as const)));
}

function markersFor(props: MapStageProps, sprites: ReadonlyMap<string, HTMLImageElement | null> | undefined, style: CSSStyleDeclaration): MapMarker[] {
  return props.cards.map((card, index) => ({
    live: card.live, frame: card.sprite, followed: props.camera.following() === card.name,
    sprite: card.sprite === null ? null : sprites?.get(card.sprite.url) ?? null,
    color: style.getPropertyValue(PALETTE[index % PALETTE.length] ?? '--gold').trim(),
  }));
}

/** Drag-to-pan with pointer capture, so the drag continues outside the canvas. */
function dragHandlers(pan: (delta: Point) => void): Pick<JSX.CanvasHTMLAttributes<HTMLCanvasElement>, 'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel'> {
  let last: Point | null = null;
  return {
    onPointerDown: (event) => { event.currentTarget.setPointerCapture(event.pointerId); last = { x: event.clientX, y: event.clientY }; },
    onPointerMove: (event) => {
      if (last !== null) {
        pan({ x: event.clientX - last.x, y: event.clientY - last.y });
        last = { x: event.clientX, y: event.clientY };
      }
    },
    onPointerUp: () => { last = null; },
    onPointerCancel: () => { last = null; },
  };
}

/** Follows the canvas size and turns the wheel into zoom around the cursor, until the canvas is removed. */
function watchCanvas(element: HTMLCanvasElement, on: { readonly resize: (size: Size) => void; readonly zoom: (factor: number, anchor: Point) => void }): void {
  const observer = new ResizeObserver(([entry]) => {
    if (entry !== undefined) {
      on.resize({ width: entry.contentRect.width, height: entry.contentRect.height });
    }
  });
  observer.observe(element);
  // Not passive, so the page does not scroll while zooming the map.
  const onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    on.zoom(event.deltaY < 0 ? 1.25 : 0.8, { x: event.offsetX, y: event.offsetY });
  };
  element.addEventListener('wheel', onWheel, { passive: false });
  onCleanup(() => { observer.disconnect(); element.removeEventListener('wheel', onWheel); });
}

function keyActions(pan: (delta: Point) => void, zoom: (factor: number) => void): Readonly<Record<string, () => void>> {
  return {
    ArrowLeft: () => { pan({ x: PAN_STEP, y: 0 }); },
    ArrowRight: () => { pan({ x: -PAN_STEP, y: 0 }); },
    ArrowUp: () => { pan({ x: 0, y: PAN_STEP }); },
    ArrowDown: () => { pan({ x: 0, y: -PAN_STEP }); },
    '+': () => { zoom(ZOOM_STEP); },
    '-': () => { zoom(1 / ZOOM_STEP); },
  };
}

function MapTools(props: { readonly zoom: (factor: number) => void; readonly fit: () => void }): JSX.Element {
  return (
    <div class="party-map-tools">
      <button type="button" aria-label={t('map.zoomIn')} onClick={() => { props.zoom(ZOOM_STEP); }}>+</button>
      <button type="button" aria-label={t('map.zoomOut')} onClick={() => { props.zoom(1 / ZOOM_STEP); }}>-</button>
      <button type="button" onClick={() => { props.fit(); }}>{t('map.fit')}</button>
    </div>
  );
}

function paint(context: CanvasRenderingContext2D | null, frame: Frame): void {
  if (context !== null) {
    drawFrame(context, frame);
  }
}

interface MapAssets {
  readonly terrain: Resource<ApiResult<MapTerrain>>;
  readonly terrainValue: () => MapTerrain | undefined;
  readonly painted: Resource<TerrainCanvas | null>;
  readonly sprites: Resource<Map<string, HTMLImageElement | null>>;
}

/** Terrain of the active map (fetched, then painted once) and the character sprite sheets. */
function createMapAssets(props: MapStageProps): MapAssets {
  const [terrain] = createResource(() => props.camera.activeMap(), (map) => apiGet(`/api/game/maps/${encodeURIComponent(map)}`, mapTerrainSchema));
  const terrainValue = (): MapTerrain | undefined => okValue(terrain());
  const [painted] = createResource(terrainValue, renderTerrain);
  // Keyed by the joined URLs so a new packet with the same sprites does not reload them.
  const [sprites] = createResource(() => [...new Set(props.cards.flatMap((card) => (card.sprite === null ? [] : [card.sprite.url])))].join('\n'), loadSprites);
  return { terrain, terrainValue, painted, sprites };
}

export function MapStage(props: MapStageProps): JSX.Element {
  const [size, setSize] = createSignal<Size>({ width: 0, height: 0 });
  const { terrain, terrainValue, painted, sprites } = createMapAssets(props);
  const onMap = (): readonly Placed[] => props.placed().filter((entry) => entry.map === props.camera.activeMap());
  const viewport = (): Viewport => ({ bounds: terrainValue()?.bounds ?? boundsAround(onMap().map((entry) => entry.point)), view: size() });
  const zoom = (factor: number, anchor: Point = { x: size().width / 2, y: size().height / 2 }): void => { props.camera.zoom(viewport(), factor, anchor); };
  const pan = (delta: Point): void => { props.camera.pan(viewport(), delta); };
  let canvas: HTMLCanvasElement | undefined;

  createEffect(() => {
    const map = props.camera.activeMap();
    const { bounds, view } = viewport();
    if (canvas !== undefined && map !== null && view.width > 0) {
      // Backing store in device pixels, drawing in CSS pixels: sharp on high-density screens.
      const ratio = window.devicePixelRatio;
      canvas.width = Math.round(view.width * ratio);
      canvas.height = Math.round(view.height * ratio);
      const context = canvas.getContext('2d');
      context?.setTransform(ratio, 0, 0, ratio, 0, 0);
      const style = getComputedStyle(canvas);
      paint(context, {
        map, bounds, view, camera: props.camera.camera(bounds), terrain: painted() ?? null, markers: markersFor(props, sprites(), style), now: props.now,
        ground: style.getPropertyValue('--ground').trim(), ink: style.getPropertyValue('--text').trim(),
      });
    }
  });

  return (
    <div class="party-map-stage slot">
      <canvas
        ref={(element) => { canvas = element; watchCanvas(element, { resize: setSize, zoom }); }}
        tabindex="0"
        role="img"
        aria-label={t('map.canvasLabel', { map: terrainValue()?.name ?? props.camera.activeMap() ?? '', names: onMap().map((entry) => entry.name).join(', ') })}
        {...dragHandlers(pan)}
        onKeyDown={(event) => {
          const action = keyActions(pan, zoom)[event.key];
          if (action !== undefined) {
            event.preventDefault();
            action();
          }
        }}
      />
      <MapTools zoom={zoom} fit={() => { props.camera.fit(); }} />
      <Show when={terrain()?.ok === false}>
        <p class="party-map-note">{t('map.noTerrain')}</p>
      </Show>
    </div>
  );
}
