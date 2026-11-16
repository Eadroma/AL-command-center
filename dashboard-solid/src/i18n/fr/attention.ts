/** Bandeau « À traiter » de l'écran Équipe. `reason` est le diagnostic du script, affiché tel quel. */
import type { RawDictionary } from '../en/index.ts';

export const attention = {
  title: 'À traiter',
  none: 'Rien à traiter : tous les personnages qui répondent vont bien.',
  death: (params: { readonly name: string; readonly ago: string; readonly reason: string }): string => `${params.name} est mort ${params.ago} (${params.reason}).`,
  lowHp: (params: { readonly name: string; readonly percent: number }): string => `${params.name} n’a plus que ${params.percent} % de vie.`,
  silent: (params: { readonly name: string; readonly ago: string }): string => `${params.name} ne répond plus : dernier signe ${params.ago}.`,
  never: (params: { readonly name: string }): string => `Rien reçu de ${params.name} pour l’instant.`,
  gameData: 'La dernière mise à jour des données du jeu a échoué. Les données précédentes restent utilisées.',
  show: 'Voir',
  dismiss: 'Masquer',
  retry: 'Mettre à jour',
} satisfies RawDictionary['attention'];
