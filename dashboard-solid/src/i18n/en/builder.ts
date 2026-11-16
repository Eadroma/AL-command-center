/** Builder validation messages and bundle warnings (see src/deploy/builder-messages.ts). */
interface Item {
  readonly item: string;
}
interface ItemLevel {
  readonly item: string;
  readonly level: string;
}

export const builder = {
  missingSection: (params: { readonly section: string }): string => `The profile has no ${params.section} section yet: import it from dashboard v2.`,
  missingScript: (params: { readonly script: string }): string => (params.script === '' ? 'A character has no script chosen.' : `The script ${params.script} is missing from the code folder.`),
  incompatible: (params: { readonly script: string; readonly name: string }): string => `${params.script} does not suit ${params.name}'s class.`,
  cryptJob: 'Crypt scripts only hunt: they cannot upgrade or combine.',
  unknownSetting: (params: { readonly key: string; readonly file: string }): string => `${params.file} has no ${params.key} setting.`,
  managedSetting: (params: { readonly key: string }): string => `${params.key} is set by the team settings, not per character.`,
  settingShape: (params: { readonly key: string }): string => `The ${params.key} setting does not have the expected shape.`,
  automationNeedsV2: (params: { readonly name: string }): string => `The automations need a v2 script for ${params.name}.`,
  goalsNeedMerchant: 'Production goals need an enabled merchant running the v2 script.',
  noRecipe: (params: Item): string => `There is no recipe for ${params.item}.`,
  goalConflict: (params: Item): string => `${params.item} is a production goal: do not exchange, upgrade, list or bank it until the goal is reached.`,
  notUpgradeable: (params: Item): string => `${params.item} cannot be upgraded.`,
  notCompoundable: (params: Item): string => `${params.item} cannot be combined.`,
  exchangeAndStand: (params: Item): string => `${params.item} cannot be both exchanged at Xyn and listed on the stand.`,
  belowUpgradeTarget: (params: ItemLevel): string => `${params.item} +${params.level} is below its upgrade target: list it at the target level or higher.`,
  buyAndSell: (params: ItemLevel): string => `${params.item} +${params.level} cannot be both bought and sold on the stand.`,
  standAndPonty: (params: Item): string => `${params.item} is also on the Ponty list: Ponty tours may keep buying it.`,
  npcAndExchange: (params: Item): string => `${params.item} is on both the Gabriel and Xyn lists: exchanging wins, the NPC sale skips it.`,
  npcAndUpgrade: (params: Item): string => `${params.item} is on both the Gabriel and upgrade lists: upgrading wins, the NPC sale skips it.`,
  npcAndStand: (params: Item): string => `${params.item} is kept for the stand: the NPC sale skips the listed levels.`,
  pontyAndStand: (params: Item): string => `${params.item} is bought from Ponty and listed on the stand: watch the stock.`,
  generatedOnly: 'Built only: nothing was sent or started.',
  rebuildAfterEdits: 'After a profile change, the CODE must be built and restarted again.',
  supervisorPaused: 'The merchant does not start the team (paused).',
  supervisorStarts: (params: { readonly names: string }): string => `The merchant starts ${params.names} in their CC_ slots when they are not running.`,
  supervisorEmpty: 'No farmer for the merchant to start: enable some farmers.',
  dailyCave: 'Cave of Many Dreams: the group meets at Dorr when the daily visit is available (one per account; a live world event comes first). Rebuild all three farmers.',
  cryptOwnRoute: 'The crypt script keeps its own target and route: team farming and events do not apply.',
  standSellOwn: 'The stand-sell script uses its own settings: the team merchant rules do not apply.',
  standRules: 'Stand rules apply once the merchant reaches its idle shop phase. Listings outside the list are removed when there is bag space; buy orders use the last eight stand slots.',
  kitBoard: 'Kit: the merchant delivers the pieces from bag or bank; farmers wear them on their gear tick.',
  consumablesBoard: 'Consumables: the merchant tops farmers up from bag or bank; elixirs are drunk automatically.',
  giftsBoard: 'Gifts: the merchant hands the items over, and farmers keep them.',
  unknownCharacter: 'This character is not in the profile.',
};
