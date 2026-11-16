/** Barre Enregistrer → Prévisualiser → Déployer. Déployer écrit dans les emplacements CODE du jeu. */
import type { RawDictionary } from '../en/index.ts';

export const bar = {
  label: 'Étapes du déploiement',
  save: 'Enregistrer',
  preview: 'Prévisualiser',
  deploy: 'Déployer',
  saveAction: 'Enregistrer le profil',
  discard: 'Annuler',
  previewAction: (params: { readonly revision: number }): string => `Prévisualiser la révision ${params.revision}`,
  deployAction: (params: { readonly count: number }): string => (params.count === 1 ? 'Déployer 1 personnage' : `Déployer ${params.count} personnages`),
  confirm: (params: { readonly revision: number; readonly count: number }): string => `Écrire la révision ${params.revision} dans les emplacements CODE de ${params.count} personnages actifs et les recharger ?`,
  confirmAction: 'Déployer',
  cancel: 'Annuler',
  working: 'En cours…',
  blocker: {
    noProfile: 'Crée ou importe d’abord un profil.',
    unsaved: 'Enregistre ou annule d’abord tes modifications.',
    notPreviewed: 'Prévisualise la révision enregistrée avant de la déployer.',
    locked: 'Déployer est verrouillé tant que le dashboard v2 reste seul à déployer (deploy.enabled dans settings.json).',
    busy: 'Attends la fin de l’opération en cours.',
  },
  deployed: (params: { readonly names: string }): string => `Déployés : ${params.names}. La télémétrie confirme chaque démarrage quelques secondes plus tard.`,
  failed: (params: { readonly count: number }): string => (params.count === 1 ? '1 personnage n’a pas été déployé :' : `${params.count} personnages n’ont pas été déployés :`),
  nothingDeployed: 'Rien n’a été déployé.',
} satisfies RawDictionary['bar'];
