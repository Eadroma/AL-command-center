/** Événements : ceux que l'équipe rejoint, avec quel build et les boss surveillés. */
import type { RawDictionary } from '../en/index.ts';

const duration = (minutes: number): string => (minutes >= 60 ? `${String(minutes / 60)} h` : `${String(minutes)} min`);

export const events = {
  open: 'Événements',
  title: 'Événements et boss',
  intro: 'Pour quels événements et boss l’équipe quitte son farm, et avec quel build. Les changements s’appliquent au prochain déploiement.',
  close: 'Fermer',
  noProfile: 'Crée ou importe d’abord un profil.',
  master: 'Rejoindre les événements',
  masterHelp: 'Désactivé : chaque personnage continue de farmer, quels que soient les événements ci-dessous.',
  characters: 'Qui participe',
  charactersHelp: 'Un personnage désactivé ici ne part jamais pour un événement.',
  list: 'Événements autorisés',
  listHelp: 'Le build est le style de combat que les personnages prennent pour cet événement (AOE, Mono, Tank ou un de tes loadouts).',
  kindEvent: 'Événements',
  kindBoss: 'Boss',
  allow: (params: { readonly name: string }): string => `Autoriser ${params.name}`,
  build: (params: { readonly name: string }): string => `Build pour ${params.name}`,
  allowAll: 'Tout autoriser',
  allowNone: 'Tout interdire',
  name: { graveyard: 'Réveil du cimetière', goobrawl: 'Bagarre de Goos', abtesting: 'Test A/B' },
  checks: 'Boss surveillés',
  checksToggle: 'Vérifier les boss à intervalle régulier',
  checksHelp: 'Le groupe va voir chaque boss à l’intervalle choisi pour savoir s’il est apparu.',
  boss: 'Boss',
  every: 'Toutes les',
  duration,
  remove: (params: { readonly name: string }): string => `Retirer ${params.name}`,
  removeShort: 'Retirer',
  add: 'Ajouter un boss',
  noRules: 'Aucun boss surveillé pour l’instant.',
} satisfies RawDictionary['events'];
