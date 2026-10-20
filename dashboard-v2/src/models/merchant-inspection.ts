import type { Catalog, InventoryItem, Profile } from '../types';

export interface RuleDecision { panel: string; action: string; reason: string; }
/** Editor preview: remote ownership, in-flight transactions and server queues remain runtime checks. */
export function inspectMerchantItem(profile: Profile, catalog: Catalog, item: Pick<InventoryItem, 'name' | 'level' | 'locked' | 'bound'>, inventory: InventoryItem[]): RuleDecision[] {
  const seller = profile.seller;
  const decisions: RuleDecision[] = [];
  const add = (panel: string, action: string, reason: string) => decisions.push({ panel, action, reason });
  if (item.locked || item.bound) return [{ panel: 'merchant-kit', action: 'Protected', reason: 'Locked or bound item; production and automatic deposits exclude it.' }];
  const compound = seller.compound.enabled && seller.compound.rules.find(rule => rule.item === item.name);
  if (compound) {
    const copies = inventory.filter(part => part.name === item.name && part.level === item.level && !part.locked && !part.bound).length;
    const bank = item.level >= compound.maxLevel || item.level > 0 && copies < 3;
    add('merchant-compound', bank ? 'Deposit' : 'Keep for compound', bank ? `Intermediate or finished result; target +${compound.maxLevel}.` : `${copies}/3 copies at +${item.level}; target +${compound.maxLevel}.`);
    return decisions;
  }
  const upgrade = seller.upgrade.enabled && seller.upgrade.rules.find(rule => rule.item === item.name);
  if (upgrade) { add('merchant-up', item.level >= upgrade.maxLevel ? 'Deposit' : 'Upgrade', `Target +${upgrade.maxLevel}; carried stock takes priority over purchases.`); return decisions; }
  const crafts = seller.craft.enabled ? seller.craft.rules : [];
  for (const rule of crafts) {
    if (rule.item === item.name) { add('merchant-craft', 'Keep craft result', rule.item); return decisions; }
    const recipe = catalog.recipes?.[rule.item];
    if (!recipe?.ingredients.some(part => part.item === item.name && part.level === item.level)) continue;
    const ready = recipe.ingredients.every(part => part.item === 'shoes' && part.level === 0 || inventory.filter(stock => stock.name === part.item && stock.level === part.level).reduce((n, stock) => n + stock.quantity, 0) >= part.quantity);
    if (item.name !== 'shoes' || item.level !== 0 || ready) { add('merchant-craft', 'Keep craft material', `Reserved for ${rule.item}${ready ? '; materials ready' : '; collecting materials'}.`); return decisions; }
  }
  if (seller.npcEnabled && seller.npcItems.includes(item.name)) add('merchant-npc', 'Sell to NPC', 'Configured NPC sale; does not require travel.');
  if (seller.exchange.enabled && seller.exchange.items.includes(item.name)) add('merchant-ex', 'Exchange', `Minimum ${seller.exchange.minimum[item.name] ?? 1}; actual recipe batch also applies.`);
  if (seller.listings.some(row => row.item === item.name && row.level === item.level)) add('merchant-stand', 'Stand listing', 'Reserved for the configured player listing.');
  if (seller.bankDeposit.enabled && seller.bankDeposit.items.includes(item.name)) add('bank', 'Bank allowlist', 'Configured deposit; sale, exchange and equipment protections still apply. Manage the allowlist on Bank.');
  return decisions.length ? decisions : [{ panel: 'merchant-kit', action: 'No explicit operation', reason: 'Check equipment delivery, gifts and runtime protections before changing this item.' }];
}
