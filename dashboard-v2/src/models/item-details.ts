import { canonicalItemId } from '../../shared/schema';
import type { Catalog, Profile } from '../types';
export interface ItemRuleLink { id: string; label: string; detail: string; enabled: boolean; }
/** Configuration references, not runtime ownership or a prediction of execution order. */
export function itemRuleLinks(item: string, profile?: Profile, catalog?: Catalog): ItemRuleLink[] {
  if (!profile) return [];
  const id = canonicalItemId(item), seller = profile.seller, rows: ItemRuleLink[] = [];
  const same = (value: string) => canonicalItemId(value) === id;
  const add = (panel: string, label: string, detail: string, enabled: boolean) => rows.push({id:panel,label,detail,enabled});
  seller.listings.filter(r => same(r.item)).forEach(r => add('merchant-stand','Stand sale',`+${r.level} · ${r.price.toLocaleString()} gold`,seller.standEnabled));
  seller.buy.orders.filter(r => same(r.item)).forEach(r => add('merchant-buy','Buy wishlist',`+${r.level} ×${r.quantity} · ${r.price.toLocaleString()} gold/unit`,seller.buy.enabled));
  seller.upgrade.rules.filter(r => same(r.item)).forEach(r => add('merchant-up','Upgrade',`Target +${r.maxLevel}`,seller.upgrade.enabled));
  seller.compound.rules.filter(r => same(r.item)).forEach(r => add('merchant-compound','Compound',`Target +${r.maxLevel}`,seller.compound.enabled));
  seller.craft.rules.forEach(r => {
    if(same(r.item)) add('merchant-craft','Craft output',r.item,seller.craft.enabled);
    catalog?.recipes?.[r.item]?.ingredients.filter(p => same(p.item)).forEach(p => add('merchant-craft','Craft ingredient',`${p.quantity} × +${p.level} for ${r.item}`,seller.craft.enabled));
  });
  if(seller.npcItems.some(same)) add('merchant-npc','NPC sale','Configured allowlist',seller.npcEnabled);
  if(seller.exchange.items.some(same)) add('merchant-ex','Exchange',`Minimum stack ${seller.exchange.minimum[id] ?? 1}`,seller.exchange.enabled);
  if(seller.bankDeposit.items.some(same)) add('bank','Bank deposit','Recurring allowlist',seller.bankDeposit.enabled);
  if(seller.ponty.items.some(same)) add('merchant-ponty','Ponty purchase','Configured item',seller.ponty.enabled);
  seller.kit.rules.filter(r => same(r.item)).forEach(r => add('merchant-kit','Kit reservation',`${r.character} · ${r.slot} ≥ +${r.minLevel}`,seller.kit.enabled));
  seller.gifts.rules.filter(r => same(r.item)).forEach(r => add('merchant-gifts','Gift reservation',`${r.character} · +${r.level} ×${r.quantity}`,seller.gifts.enabled));
  seller.consumables.rules.filter(r => same(r.item)).forEach(r => add('merchant-cons','Consumable supply',r.character,seller.consumables.enabled));
  return rows;
}
export function itemLoadoutReservations(item: string, profile?: Profile) {
  const wanted = canonicalItemId(item);
  return Object.entries(profile?.farming.loadouts ?? {}).flatMap(([character,board]) => Object.entries(board).flatMap(([style,build]) => build.gear.filter(r => canonicalItemId(r.item) === wanted).map(r => ({character,style,slot:r.slot,minLevel:r.minLevel}))));
}
