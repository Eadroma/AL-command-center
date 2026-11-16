/** Loadouts : l'équipement et les compétences de chaque personnage selon le style de combat. */
import type { RawDictionary } from '../en/index.ts';

export const loadouts = {
  open: 'Loadouts',
  title: 'Loadouts',
  intro: 'Ce que porte chaque personnage et les compétences qu’il utilise, selon le style de combat. Le style d’une cible (AOE, Mono, Tank) choisit le loadout. Les changements s’appliquent au prochain déploiement.',
  close: 'Fermer',
  characters: 'Personnage',
  styles: 'Style de combat',
  style: { aoe: 'AOE', mono: 'Mono', tank: 'Tank' },
  gear: 'Équipement',
  gearHelp: 'Choisis un emplacement pour changer ce qu’il contient.',
  slot: {
    mainhand: 'Main droite', offhand: 'Main gauche', helmet: 'Casque', chest: 'Plastron', pants: 'Pantalon', shoes: 'Bottes', gloves: 'Gants', belt: 'Ceinture',
    amulet: 'Amulette', ring1: 'Anneau', ring2: 'Anneau', earring1: 'Boucle d’oreille', earring2: 'Boucle d’oreille', cape: 'Cape', orb: 'Orbe',
  },
  slotLabel: (params: { readonly slot: string; readonly item: string }): string => `${params.slot} : ${params.item}`,
  empty: 'vide',
  level: (params: { readonly level: number }): string => `+${params.level}`,
  item: 'Objet',
  itemHelp: 'Tape une partie du nom d’un objet, puis choisis-le dans la liste.',
  unknownItem: 'Cet objet ne va pas dans cet emplacement : choisis-en un dans la liste.',
  minLevel: 'Niveau minimum',
  minLevelHelp: 'Le personnage ne porte cet objet qu’à partir de ce niveau d’amélioration ; les exemplaires plus faibles ne lui sont pas gardés.',
  clear: 'Vider l’emplacement',
  skills: 'Compétences',
  skillsHelp: 'Compétences que le script utilise avec ce loadout.',
  base: 'Compte comme',
  baseHelp: 'Pour les loadouts personnalisés : le style d’après lequel le guerrier choisit son arme.',
  noLoadouts: 'Pas encore de loadout dans ce profil : ils viennent avec le profil du dashboard v2.',
  loading: 'Chargement des objets…',
  type: {
    weapon: 'Arme', shield: 'Bouclier', source: 'Source', quiver: 'Carquois', misc_offhand: 'Objet de main gauche', helmet: 'Casque', chest: 'Plastron',
    pants: 'Pantalon', shoes: 'Bottes', gloves: 'Gants', belt: 'Ceinture', amulet: 'Amulette', ring: 'Anneau', earring: 'Boucle d’oreille', cape: 'Cape', orb: 'Orbe',
  },
} satisfies RawDictionary['loadouts'];
