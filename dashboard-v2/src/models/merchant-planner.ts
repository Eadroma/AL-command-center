import type { Profile } from '../../shared/schema';
import type { PartyMember } from '../types';

export type MerchantTaskState = 'active' | 'ready' | 'blocked' | 'disabled' | 'idle';
export interface MerchantTask { id: string; label: string; cadenceMs: number; state: MerchantTaskState; detail: string; blocker?: string; }

const hasIntent = (intent: string, terms: string[]) => terms.some(term => intent.includes(term));

/** Mirror the merchant's seven concurrent loops as an operator-readable plan. */
export function merchantPlan(profile: Profile, members?: PartyMember[] | null): MerchantTask[] {
  const merchant = members?.find(member => member.class === 'merchant');
  const live = merchant?.status === 'online' || merchant?.status === 'town';
  const intent = String(merchant?.intent?.state || '').toLowerCase();
  const enabledFarmers = profile.characters.filter(character => character.enabled && character.ctype !== 'merchant');
  const selected = profile.seller.teamSupervisor.characters;
  const farmers = selected.length ? enabledFarmers.filter(character => selected.includes(character.name)) : enabledFarmers;
  const offline = farmers.filter(character => members?.find(member => member.name === character.name)?.status === 'offline');
  const commonBlocker = live ? undefined : 'Merchant telemetry is offline or stale.';

  const task = (id: string, label: string, cadenceMs: number, enabled: boolean, terms: string[], detail: string, blocker?: string): MerchantTask => ({
    id, label, cadenceMs, detail,
    state: !enabled ? 'disabled' : commonBlocker || blocker ? 'blocked' : hasIntent(intent, terms) ? 'active' : 'ready',
    blocker: enabled ? commonBlocker || blocker : undefined,
  });

  const supplyRules = (profile.seller.kit.enabled ? profile.seller.kit.rules.length : 0)
    + (profile.seller.consumables.enabled ? profile.seller.consumables.rules.length : 0)
    + (profile.seller.gifts.enabled ? profile.seller.gifts.rules.length : 0);
  const townRules = (profile.seller.npcEnabled ? profile.seller.npcItems.length : 0)
    + (profile.seller.exchange.enabled ? profile.seller.exchange.items.length : 0);
  const gold = merchant?.gold;
  const craftBlocked = gold != null && gold <= profile.seller.craft.reserveGold ? `Gold reserve reached (${profile.seller.craft.reserveGold.toLocaleString()}).` : undefined;
  const upgradeBlocked = gold != null && gold <= profile.seller.upgrade.minGold ? `Upgrade reserve reached (${profile.seller.upgrade.minGold.toLocaleString()}).` : undefined;

  return [
    task('team', 'Team supervisor', 8000, profile.seller.teamSupervisor.enabled && farmers.length > 0, ['start '], `${farmers.length} farmer slots watched${offline.length ? ` · ${offline.length} offline` : ''}`),
    task('service', 'Kit & supplies', 2000, supplyRules > 0, ['deliver', 'supply', 'gift', 'mluck'], `${supplyRules} delivery rules`),
    task('stock', 'Potion & scroll stock', 2500, true, ['stock '], 'Maintains merchant and farmer consumables'),
    task('town', 'Town logistics', 2000, townRules > 0, ['sell gabriel', 'exchange xyn', 'bank'], `${profile.seller.npcItems.length} NPC items · ${profile.seller.exchange.items.length} exchange items`),
    task('craft', 'Craft queue', 2000, profile.seller.craft.enabled && profile.seller.craft.rules.length > 0, ['craft '], `${profile.seller.craft.rules.length} recipes · one item per pass`, craftBlocked),
    task('upgrade', 'Upgrade & compound', 8000, profile.seller.upgrade.enabled && profile.seller.upgrade.rules.length > 0, ['upgrade ', 'compound '], `${profile.seller.upgrade.rules.length} upgrade targets`, upgradeBlocked),
    task('stand', 'Player stand', 1500, profile.seller.standEnabled, ['stand open', 'walk stand', 'town stand'], `${profile.seller.listings.length} sales · ${profile.seller.buy.orders.length} buy orders`),
  ];
}
