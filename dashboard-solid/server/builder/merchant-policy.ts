/**
 * Stand, exchange, upgrade and NPC rules must not fight each other or the merchant's keep / unlist paths.
 * Errors block the build; warnings travel with the bundle. Port of dashboard-v2's merchantPolicy (same messages:
 * shown in the deployment preview until it gets translated codes).
 */
import type { Profile } from '../../shared/profile.ts';
import { field, list, recordOr, strings, text, truthy } from '../../shared/raw.ts';

export interface MerchantPolicy {
  readonly warnings: string[];
  readonly errors: string[];
}

interface Listing {
  readonly item: string;
  readonly level: number;
}

function listings(seller: unknown): Listing[] {
  return list(field(seller, 'listings')).map((rule) => ({ item: text(field(rule, 'item')), level: Number(field(rule, 'level')) }));
}

function standIssues(seller: unknown, policy: MerchantPolicy, ponty: ReadonlySet<string>): void {
  const exchange = field(seller, 'exchange');
  const upgrade = field(seller, 'upgrade');
  const exchanged = new Set(truthy(field(exchange, 'enabled')) ? strings(field(exchange, 'items')) : []);
  const buy = field(seller, 'buy');
  const buying = new Set(list(truthy(field(buy, 'enabled')) ? field(buy, 'orders') : []).map((order) => `${text(field(order, 'item'))}:${String(field(order, 'level'))}`));
  const targets = list(field(upgrade, 'rules'));
  for (const rule of listings(seller)) {
    if (exchanged.has(rule.item)) {
      policy.errors.push(`${rule.item} cannot be both exchanged at Xyn and listed on the player stand.`);
    }
    if (truthy(field(upgrade, 'enabled')) && targets.some((target) => field(target, 'item') === rule.item && rule.level < Number(field(target, 'maxLevel')))) {
      policy.errors.push(`${rule.item} +${String(rule.level)} is below its upgrade target; list it at the target level or above.`);
    }
    if (buying.has(`${rule.item}:${String(rule.level)}`)) {
      policy.errors.push(`${rule.item} +${String(rule.level)} cannot be both a stand buy order and a sell listing.`);
    }
    if (ponty.has(rule.item)) {
      policy.warnings.push(`${rule.item} is also in PONTY_ITEMS — Ponty tours may still buy more of it.`);
    }
  }
}

function npcIssues(seller: unknown, policy: MerchantPolicy): void {
  const exchange = field(seller, 'exchange');
  const upgrade = field(seller, 'upgrade');
  const exchanged = new Set(truthy(field(exchange, 'enabled')) ? strings(field(exchange, 'items')) : []);
  const upgraded = new Set(truthy(field(upgrade, 'enabled')) ? list(field(upgrade, 'rules')).map((rule) => text(field(rule, 'item'))) : []);
  const standOn = truthy(field(seller, 'standEnabled'));
  for (const item of strings(field(seller, 'npcItems'))) {
    if (exchanged.has(item)) {
      policy.warnings.push(`${item} is on both Gabriel and Xyn lists — exchange wins; NPC sales skip it.`);
    }
    if (upgraded.has(item)) {
      policy.warnings.push(`${item} is on both Gabriel and upgrade lists — upgrade wins; NPC sales skip it.`);
    }
    if (standOn && listings(seller).some((rule) => rule.item === item)) {
      policy.warnings.push(`${item} is reserved for the stand — NPC sales will skip matching levels.`);
    }
  }
}

export function merchantPolicy(profile: Profile): MerchantPolicy {
  const policy: MerchantPolicy = { warnings: [], errors: [] };
  const seller = profile['seller'];
  // PONTY_ITEMS is builder-managed: the bundle receives the profile list, not the script default.
  const pontyBoard = field(seller, 'ponty');
  const ponty = new Set(truthy(field(pontyBoard, 'enabled')) ? strings(field(pontyBoard, 'items')) : []);
  if (truthy(field(seller, 'standEnabled'))) {
    standIssues(seller, policy, ponty);
  }
  if (truthy(field(seller, 'npcEnabled'))) {
    npcIssues(seller, policy);
  }
  const tours = recordOr(pontyBoard, { enabled: true, items: [] });
  if (truthy(tours['enabled'])) {
    for (const item of strings(tours['items'])) {
      if (truthy(field(seller, 'standEnabled')) && listings(seller).some((rule) => rule.item === item)) {
        policy.warnings.push(`${item} is bought from Ponty and also listed on the stand — intentional but watch stock.`);
      }
    }
  }
  return policy;
}
