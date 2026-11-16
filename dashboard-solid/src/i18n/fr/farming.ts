/** Cibles de farm : la cible de l'équipe, celle de chaque personnage, les visites rares. */
import type { RawDictionary } from '../en/index.ts';

export const farming = {
  open: 'Farming',
  title: 'Cibles de farm',
  intro: 'Où l’équipe farme quand aucun événement ni aucune chasse ne l’emmène ailleurs. Les changements s’appliquent au prochain déploiement.',
  close: 'Fermer',
  team: 'Cible de l’équipe',
  teamHelp: 'Utilisée par chaque personnage qui n’a pas sa propre cible.',
  search: 'Monstre',
  searchHelp: 'Tape une partie du nom d’un monstre, puis choisis-le dans la liste.',
  unknown: 'Monstre inconnu : choisis-en un dans la liste.',
  stats: (params: { readonly hp: string; readonly xp: string; readonly maps: string }): string => `${params.hp} PV · ${params.xp} XP · ${params.maps}`,
  noXp: '?',
  noMaps: 'pas d’apparition fixe',
  rareVisits: 'Visites rares',
  rareVisitsHelp: 'Quand un monstre rare comme le Phénix apparaît à proximité, le groupe fait un détour pour lui.',
  characters: 'Par personnage',
  useTeam: 'Cible de l’équipe',
  own: 'Sa propre cible',
  fixed: (params: { readonly monster: string }): string => `Fixée par son script : ${params.monster}`,
  fixedHelp: 'Ce script farme toujours sa propre cible : la cible de l’équipe, les visites rares et les chasses ne s’appliquent pas.',
  noProfile: 'Crée ou importe d’abord un profil.',
  loading: 'Chargement des monstres…',
} satisfies RawDictionary['farming'];
