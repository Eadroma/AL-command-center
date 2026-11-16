/**
 * Camera state of the party map. Following is explicit: the camera tracks a character only after the player asks,
 * and any manual move (drag, keys, choosing another map) stops it. Zoom is kept while following.
 */
import type { Accessor } from 'solid-js';
import { createMemo, createSignal } from 'solid-js';
import type { Bounds, Camera, Placed, Point, Viewport } from './map-view.ts';
import { clampZoom, fitCamera, panBy, viewScale, zoomAt } from './map-view.ts';

const FOLLOW_ZOOM = 3;

export interface MapCamera {
  readonly activeMap: Accessor<string | null>;
  readonly following: Accessor<string | null>;
  readonly camera: (bounds: Bounds) => Camera;
  readonly chooseMap: (map: string) => void;
  readonly toggleFollow: (name: string) => void;
  readonly pan: (viewport: Viewport, delta: Point) => void;
  readonly zoom: (viewport: Viewport, factor: number, anchor: Point) => void;
  readonly fit: () => void;
}

export function createMapCamera(placed: Accessor<readonly Placed[]>, maps: Accessor<readonly string[]>): MapCamera {
  const [chosenMap, setChosenMap] = createSignal<string | null>(null);
  const [following, setFollowing] = createSignal<string | null>(null);
  // The manual camera belongs to one map; on another map the view starts from "whole map".
  const [manual, setManual] = createSignal<{ readonly map: string; readonly camera: Camera } | null>(null);

  const followed = createMemo(() => placed().find((entry) => entry.name === following()));
  const activeMap = createMemo(() => followed()?.map ?? chosenMap() ?? maps()[0] ?? null);
  const current = (bounds: Bounds): Camera => {
    const own = manual();
    return own !== null && own.map === activeMap() ? own.camera : fitCamera(bounds);
  };
  const camera = (bounds: Bounds): Camera => {
    const target = followed();
    return target === undefined ? current(bounds) : { center: target.point, zoom: current(bounds).zoom };
  };
  const store = (next: Camera): void => {
    const map = activeMap();
    if (map !== null) {
      setManual({ map, camera: next });
    }
  };

  return {
    activeMap,
    following,
    camera,
    chooseMap: (map) => { setFollowing(null); setChosenMap(map); },
    toggleFollow: (name) => {
      const target = placed().find((entry) => entry.name === name);
      if (following() === name || target === undefined) {
        setFollowing(null);
        return;
      }
      setFollowing(name);
      setChosenMap(target.map);
      const zoom = manual()?.map === target.map ? manual()?.camera.zoom ?? 1 : 1;
      setManual({ map: target.map, camera: { center: target.point, zoom: Math.max(zoom, FOLLOW_ZOOM) } });
    },
    pan: (viewport, delta) => {
      const from = camera(viewport.bounds);
      setFollowing(null);
      store(panBy(from, viewScale(viewport.bounds, viewport.view, from.zoom), delta));
    },
    zoom: (viewport, factor, anchor) => {
      const from = camera(viewport.bounds);
      // While following, zoom on the character so it stays centred.
      store(following() === null ? zoomAt(from, viewport, { factor, anchor }) : { ...from, zoom: clampZoom(from.zoom * factor) });
    },
    fit: () => { setFollowing(null); setManual(null); },
  };
}
