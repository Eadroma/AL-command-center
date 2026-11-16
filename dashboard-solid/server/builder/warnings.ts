/**
 * Warnings shipped with each generated bundle, as dashboard-v2 wrote them (same order and wording until the
 * deployment preview gets translated codes).
 */
import type { Profile, ProfileCharacter } from '../../shared/profile.ts';
import type { ScriptInfo } from './catalogue.ts';
import type { JsonRecord } from '../../shared/raw.ts';
import { field, list, record, recordOr, truthy } from '../../shared/raw.ts';

export interface WarningInput {
  readonly profile: Profile;
  readonly character: ProfileCharacter;
  readonly script: ScriptInfo;
  readonly config: JsonRecord;
  readonly policyWarnings: readonly string[];
  readonly consumables: JsonRecord;
}

function hasRules(board: JsonRecord): boolean {
  return truthy(board['enabled']) && list(board['rules']).length > 0;
}

function supervisorWarnings({ profile, script, config }: WarningInput): string[] {
  if (!script.id.startsWith('eadrosell-merchant')) {
    return [];
  }
  const kids = Object.keys(record(config['TEAM_SLOTS']));
  if (!truthy(field(field(profile['seller'], 'teamSupervisor'), 'enabled'))) {
    return ['Merchant team auto-start is paused.'];
  }
  return kids.length > 0
    ? [`Merchant will start_character ${kids.join(' + ')} into their CC_* CODE slots when they are not already running.`]
    : ['No farmer TEAM_SLOTS configured — enable farmers so the merchant can start them.'];
}

export function bundleWarnings(input: WarningInput): string[] {
  const { profile, character, script } = input;
  const seller = profile['seller'];
  const kit = recordOr(field(seller, 'kit'), { enabled: true, rules: [] });
  const gifts = recordOr(field(seller, 'gifts'), { enabled: true, rules: [] });
  const when = (condition: boolean, message: string): string[] => (condition ? [message] : []);
  return [
    'Generated only; not uploaded or started.',
    'Profile edits require rebuilding and restarting CODE.',
    ...input.policyWarnings,
    ...supervisorWarnings(input),
    ...when(truthy(field(profile['farming'], 'dailyDungeon')), 'Cave of Many Dreams: party gathers at Dorr when the daily visit is available. One visit per account; a live world event still wins. Rebuild all three farmers.'),
    ...when(script.kind === 'crypt', 'Crypt retains its own target and route; global open-world farming/event controls do not apply.'),
    ...when(script.id === 'stand-sell', 'Stand-sell uses its own merchant/item settings; party seller rules do not apply.'),
    ...when(character.ctype === 'merchant', 'Stand rules apply when the merchant reaches its idle-shop phase. Restocking, safety and gathering keep their existing priority. Existing sell listings outside the allowlist are removed when there is bag space; configured buy orders use the last eight slots of the available stand. Dashboard listings are never auto-unlisted by keep-gear.'),
    ...when(hasRules(kit), 'Kit board: mule delivers matching bag/bank pieces; farmers equip on their gear tick.'),
    ...when(hasRules(input.consumables), 'Consumables: mule tops farmers up from bag/bank; elixir mode auto-drinks on the farmer gear tick.'),
    ...when(hasRules(gifts), 'Give & keep: mule hands matching bag items to farmers; those item names stay in KEEP_ITEMS so they are not dumped back.'),
  ];
}
