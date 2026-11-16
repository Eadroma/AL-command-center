/**
 * The builder speaks dashboard-v2's English (kept identical so its output can be compared with v2's byte for byte).
 * The UI recognises each known message and shows it in the current language; an unknown one is shown as sent.
 */
import { t } from '../i18n/i18n.ts';

type Translate = (parts: readonly string[]) => string;

const at = (parts: readonly string[], index: number): string => parts[index] ?? '';

/** Order matters: the first pattern that matches wins (specific shapes before the generic ones). */
const RULES: readonly (readonly [RegExp, Translate])[] = [
  [/^The profile has no (\w+) section yet: import it from dashboard v2\.$/, (p) => t('builder.missingSection', { section: at(p, 1) })],
  [/^Missing script: (.*)$/, (p) => t('builder.missingScript', { script: at(p, 1) })],
  [/^(.+) is not compatible with (.+)\.$/, (p) => t('builder.incompatible', { script: at(p, 1), name: at(p, 2) })],
  [/^Crypt scripts do not support upgrade\/combine jobs\.$/, () => t('builder.cryptJob')],
  [/^Unknown setting (.+) in (.+)\.$/, (p) => t('builder.unknownSetting', { key: at(p, 1), file: at(p, 2) })],
  [/^(.+) is managed by the party controls\.$/, (p) => t('builder.managedSetting', { key: at(p, 1) })],
  [/^Invalid setting key (.+)$/, (p) => t('builder.settingShape', { key: at(p, 1) })],
  [/^([\w.[\]]+) must be (?:an array|an object|a non-negative number|between 0 and 1|\w+)\.$/, (p) => t('builder.settingShape', { key: at(p, 1) })],
  [/^Invalid ([\w.[\]]+)$/, (p) => t('builder.settingShape', { key: at(p, 1) })],
  [/^Automation requires a v2 farmer script for (.+)\.$/, (p) => t('builder.automationNeedsV2', { name: at(p, 1) })],
  [/^Commercial objectives require an enabled v2 merchant\.$/, () => t('builder.goalsNeedMerchant')],
  [/^No craft recipe for (.+)\.$/, (p) => t('builder.noRecipe', { item: at(p, 1) })],
  [/^Commercial goal (.+) conflicts with /, (p) => t('builder.goalConflict', { item: at(p, 1) })],
  [/^(.+) cannot be upgraded /, (p) => t('builder.notUpgradeable', { item: at(p, 1) })],
  [/^(.+) cannot be compounded\.$/, (p) => t('builder.notCompoundable', { item: at(p, 1) })],
  [/^(.+) cannot be both exchanged at Xyn and listed on the player stand\.$/, (p) => t('builder.exchangeAndStand', { item: at(p, 1) })],
  [/^(.+) \+(\d+) is below its upgrade target; /, (p) => t('builder.belowUpgradeTarget', { item: at(p, 1), level: at(p, 2) })],
  [/^(.+) \+(\d+) cannot be both a stand buy order and a sell listing\.$/, (p) => t('builder.buyAndSell', { item: at(p, 1), level: at(p, 2) })],
  [/^(.+) is also in PONTY_ITEMS /, (p) => t('builder.standAndPonty', { item: at(p, 1) })],
  [/^(.+) is on both Gabriel and Xyn lists /, (p) => t('builder.npcAndExchange', { item: at(p, 1) })],
  [/^(.+) is on both Gabriel and upgrade lists /, (p) => t('builder.npcAndUpgrade', { item: at(p, 1) })],
  [/^(.+) is reserved for the stand /, (p) => t('builder.npcAndStand', { item: at(p, 1) })],
  [/^(.+) is bought from Ponty and also listed on the stand /, (p) => t('builder.pontyAndStand', { item: at(p, 1) })],
  [/^Generated only; not uploaded or started\.$/, () => t('builder.generatedOnly')],
  [/^Profile edits require rebuilding and restarting CODE\.$/, () => t('builder.rebuildAfterEdits')],
  [/^Merchant team auto-start is paused\.$/, () => t('builder.supervisorPaused')],
  [/^Merchant will start_character (.+) into their CC_\* CODE slots /, (p) => t('builder.supervisorStarts', { names: at(p, 1).split(' + ').join(', ') })],
  [/^No farmer TEAM_SLOTS configured /, () => t('builder.supervisorEmpty')],
  [/^Cave of Many Dreams: /, () => t('builder.dailyCave')],
  [/^Crypt retains its own target /, () => t('builder.cryptOwnRoute')],
  [/^Stand-sell uses its own /, () => t('builder.standSellOwn')],
  [/^Stand rules apply when the merchant reaches /, () => t('builder.standRules')],
  [/^Kit board: /, () => t('builder.kitBoard')],
  [/^Consumables: mule tops farmers up /, () => t('builder.consumablesBoard')],
  [/^Give & keep: /, () => t('builder.giftsBoard')],
  [/^Unknown character\.$/, () => t('builder.unknownCharacter')],
];

export function builderMessage(message: string): string {
  for (const [pattern, translate] of RULES) {
    const match = pattern.exec(message);
    if (match !== null) {
      return translate([...match]);
    }
  }
  return message;
}
