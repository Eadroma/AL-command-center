/** Écran Équipe. */
import type { RawDictionary } from '../en/index.ts';

export const team = {
  title: 'Équipe',
  hp: 'Vie',
  mp: 'Mana',
  level: (params: { readonly level: number }): string => `niveau ${params.level}`,
  live: 'en direct',
  seenAgo: (params: { readonly ago: string }): string => `vu ${params.ago}`,
  idle: 'Aucune activité signalée',
  unknownMap: 'Carte inconnue',
  silent: (params: { readonly count: number }): string => (params.count <= 1 ? `${params.count} personnage sans télémétrie` : `${params.count} personnages sans télémétrie`),
  silentHelp: 'Rien n’a encore été reçu de ces personnages. S’ils tournent dans Chrome, ouvre l’onglet adventure.land et autorise l’accès au réseau local (icône à gauche de l’adresse), puis recharge le jeu.',
  empty: 'Aucun personnage ne s’est encore manifesté. Lance tes scripts dans le jeu : ils apparaissent ici en quelques secondes.',
  connectionOpen: 'En direct',
  connectionConnecting: 'Connexion…',
  connectionClosed: 'Hors ligne : reconnexion',
} satisfies RawDictionary['team'];
