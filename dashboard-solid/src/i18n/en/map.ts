/** Party map on the Team screen. */
export const map = {
  title: 'Party map',
  maps: 'Occupied maps',
  noPositions: 'No position received yet: characters appear here as soon as their scripts report.',
  noTerrain: 'Terrain unavailable for this map: positions are shown on plain ground.',
  canvasLabel: (params: { readonly map: string; readonly names: string }): string => `Map ${params.map}: ${params.names}`,
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  fit: 'Whole map',
  follow: 'Follow a character',
  following: (params: { readonly name: string }): string => `Following ${params.name}`,
  help: 'Drag or use the arrow keys to move, wheel or + / − to zoom. Choose a character to follow it; moving the map stops following. Lines show the last 10 minutes.',
};
