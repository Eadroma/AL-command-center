/** Messages de validation du builder et avertissements des bundles (voir src/deploy/builder-messages.ts). */
import type { RawDictionary } from '../en/index.ts';

interface Item {
  readonly item: string;
}
interface ItemLevel {
  readonly item: string;
  readonly level: string;
}

export const builder = {
  missingSection: (params: { readonly section: string }): string => `Le profil n’a pas encore de section ${params.section} : importe-la depuis le dashboard v2.`,
  missingScript: (params: { readonly script: string }): string => (params.script === '' ? 'Un personnage n’a pas de script choisi.' : `Le script ${params.script} est absent du dossier de code.`),
  incompatible: (params: { readonly script: string; readonly name: string }): string => `${params.script} ne convient pas à la classe de ${params.name}.`,
  cryptJob: 'Les scripts de crypte chassent seulement : ils ne peuvent ni améliorer ni combiner.',
  unknownSetting: (params: { readonly key: string; readonly file: string }): string => `${params.file} n’a pas de réglage ${params.key}.`,
  managedSetting: (params: { readonly key: string }): string => `${params.key} se règle au niveau de l’équipe, pas par personnage.`,
  settingShape: (params: { readonly key: string }): string => `Le réglage ${params.key} n’a pas la forme attendue.`,
  automationNeedsV2: (params: { readonly name: string }): string => `Les automatisations demandent un script v2 pour ${params.name}.`,
  goalsNeedMerchant: 'Les objectifs de production demandent un marchand actif avec le script v2.',
  noRecipe: (params: Item): string => `Il n’existe pas de recette pour ${params.item}.`,
  goalConflict: (params: Item): string => `${params.item} est un objectif de production : ne l’échange, ne l’améliore, ne le mets en vente ni ne le dépose tant que l’objectif n’est pas atteint.`,
  notUpgradeable: (params: Item): string => `${params.item} ne peut pas être amélioré.`,
  notCompoundable: (params: Item): string => `${params.item} ne peut pas être combiné.`,
  exchangeAndStand: (params: Item): string => `${params.item} ne peut pas être à la fois échangé chez Xyn et mis en vente sur le stand.`,
  belowUpgradeTarget: (params: ItemLevel): string => `${params.item} +${params.level} est sous son niveau d’amélioration visé : mets-le en vente au niveau visé ou plus.`,
  buyAndSell: (params: ItemLevel): string => `${params.item} +${params.level} ne peut pas être à la fois acheté et vendu sur le stand.`,
  standAndPonty: (params: Item): string => `${params.item} est aussi sur la liste Ponty : les tournées Ponty peuvent continuer à en acheter.`,
  npcAndExchange: (params: Item): string => `${params.item} est à la fois sur les listes Gabriel et Xyn : l’échange gagne, la vente au PNJ l’ignore.`,
  npcAndUpgrade: (params: Item): string => `${params.item} est à la fois sur les listes Gabriel et amélioration : l’amélioration gagne, la vente au PNJ l’ignore.`,
  npcAndStand: (params: Item): string => `${params.item} est gardé pour le stand : la vente au PNJ ignore les niveaux en vente.`,
  pontyAndStand: (params: Item): string => `${params.item} est acheté chez Ponty et mis en vente sur le stand : surveille le stock.`,
  generatedOnly: 'Construit seulement : rien n’a été envoyé ni démarré.',
  rebuildAfterEdits: 'Après une modification du profil, il faut reconstruire et redémarrer le CODE.',
  supervisorPaused: 'Le marchand ne démarre pas l’équipe (en pause).',
  supervisorStarts: (params: { readonly names: string }): string => `Le marchand démarre ${params.names} dans leurs emplacements CC_ quand ils ne tournent pas.`,
  supervisorEmpty: 'Aucun farmer à démarrer pour le marchand : active des farmers.',
  dailyCave: 'Grotte des Rêves : le groupe se retrouve chez Dorr quand la visite du jour est disponible (une par compte ; un événement mondial en cours passe avant). Reconstruis les trois farmers.',
  cryptOwnRoute: 'Le script de crypte garde sa propre cible et son trajet : le farm et les événements de l’équipe ne s’appliquent pas.',
  standSellOwn: 'Le script stand-sell utilise ses propres réglages : les règles du marchand de l’équipe ne s’appliquent pas.',
  standRules: 'Les règles du stand s’appliquent quand le marchand arrive à sa phase boutique. Les ventes hors liste sont retirées s’il reste de la place dans le sac ; les ordres d’achat utilisent les huit derniers emplacements du stand.',
  kitBoard: 'Équipement : le marchand livre les pièces depuis le sac ou la banque ; les farmers les portent à leur passage d’équipement.',
  consumablesBoard: 'Consommables : le marchand réapprovisionne les farmers depuis le sac ou la banque ; les élixirs sont bus automatiquement.',
  giftsBoard: 'Cadeaux : le marchand remet les objets, et les farmers les gardent.',
  unknownCharacter: 'Ce personnage n’est pas dans le profil.',
} satisfies RawDictionary['builder'];
