import type { Profile } from '../../shared/schema';

export interface ConfigIssue {
  id: string;
  severity: 'error' | 'warning' | 'info';
  scope: string;
  message: string;
}

/** Cross-board checks that schemas cannot express without losing useful flexibility. */
export function validateDashboardConfig(profile: Profile): ConfigIssue[] {
  const issues: ConfigIssue[] = [];
  const add = (severity: ConfigIssue['severity'], scope: string, id: string, message: string) => issues.push({ severity, scope, id: `${scope}:${id}`, message });
  const banked = new Set(profile.seller.bankDeposit.enabled ? profile.seller.bankDeposit.items : []);
  const stand = new Set(profile.seller.listings.map(row => row.item));
  const upgraded = new Set(profile.seller.upgrade.enabled ? profile.seller.upgrade.rules.map(row => row.item) : []);
  const npcSold = new Set(profile.seller.npcEnabled ? profile.seller.npcItems : []);
  const exchanged = new Set(profile.seller.exchange.enabled ? profile.seller.exchange.items : []);
  const loadoutItems = new Set(Object.values(profile.farming.loadouts).flatMap(board => Object.values(board).flatMap(style => style.gear.map(row => row.item))));

  for (const item of banked) {
    if (stand.has(item)) add('warning', 'Bank', item, `${item} is also a player-stand listing. The merchant will reserve it from recurring bank deposits.`);
    if (upgraded.has(item)) add('warning', 'Bank', `${item}:upgrade`, `${item} is also an upgrade target. It stays with the merchant until the target is reached.`);
    if (npcSold.has(item)) add('error', 'Bank', `${item}:npc`, `${item} is also in Gabriel sales. Remove it from one of the two lists to make the intended destination explicit.`);
    if (exchanged.has(item)) add('error', 'Bank', `${item}:exchange`, `${item} is also in Xyn exchanges. Remove it from one of the two lists to make the intended destination explicit.`);
    if (loadoutItems.has(item)) add('warning', 'Bank', `${item}:loadout`, `${item} belongs to a combat loadout and must remain available to the farming team.`);
  }
  for (const order of profile.seller.buy.orders) {
    if (profile.seller.listings.some(row => row.item === order.item && row.level === order.level)) add('error', 'Stand', `${order.item}:${order.level}`, `${order.item} +${order.level} is configured as both a buy and sell order.`);
  }
  const elixirCharacters = new Set<string>();
  for (const rule of profile.seller.consumables.rules) {
    if (rule.minQty > rule.targetQty || rule.targetQty > rule.maxQty) add('error', 'Consumables', `${rule.character}:${rule.item}`, `${rule.character} · ${rule.item} must use minimum ≤ target ≤ maximum.`);
    if (!profile.characters.some(character => character.name === rule.character && character.enabled)) add('warning', 'Consumables', `${rule.character}:${rule.item}:offline`, `${rule.character} is disabled or missing, so this delivery cannot complete.`);
    if (rule.mode === 'elixir') {
      if (elixirCharacters.has(rule.character)) add('error', 'Consumables', `${rule.character}:multiple-elixirs`, `${rule.character} has multiple automatic elixirs. Only one elixir slot can be active.`);
      elixirCharacters.add(rule.character);
    }
  }
  for (const [character, board] of Object.entries(profile.farming.loadouts)) {
    for (const [style, loadout] of Object.entries(board)) {
      const slots = new Set<string>();
      for (const gear of loadout.gear) {
        if (slots.has(gear.slot)) add('error', 'Loadouts', `${character}:${style}:${gear.slot}`, `${character} ${style} overrides ${gear.slot} more than once.`);
        slots.add(gear.slot);
      }
    }
  }
  if (!issues.length) add('info', 'Profile', 'valid', 'No cross-board conflict detected.');
  const rank: Record<ConfigIssue['severity'], number> = { error: 0, warning: 1, info: 2 };
  return issues.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
