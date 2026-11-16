/** Carte du groupe de l'écran Équipe. */
import type { RawDictionary } from '../en/index.ts';

export const map = {
  title: 'Carte du groupe',
  maps: 'Cartes occupées',
  noPositions: 'Aucune position reçue pour l’instant : les personnages apparaissent ici dès que leurs scripts répondent.',
  noTerrain: 'Terrain indisponible pour cette carte : les positions s’affichent sur un fond uni.',
  canvasLabel: (params: { readonly map: string; readonly names: string }): string => `Carte ${params.map} : ${params.names}`,
  zoomIn: 'Zoomer',
  zoomOut: 'Dézoomer',
  fit: 'Carte entière',
  follow: 'Suivre un personnage',
  following: (params: { readonly name: string }): string => `Suit ${params.name}`,
  help: 'Glisse ou utilise les flèches pour te déplacer, molette ou + / − pour zoomer. Choisis un personnage pour le suivre ; déplacer la carte arrête le suivi. Les traits montrent les 10 dernières minutes.',
} satisfies RawDictionary['map'];
