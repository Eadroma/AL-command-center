import { expect, it } from 'vitest';
import { initialProfile, scripts } from '../server/scripts';
import { inspectMerchantItem } from '../src/models/merchant-inspection';
import type { Catalog, InventoryItem } from '../src/types';
const catalog = { recipes: { wingedboots: { ingredients: [{ item: 'shoes', quantity: 1, level: 0 }, { item: 'feather0', quantity: 20, level: 0 }] } } } as unknown as Catalog;
const item = (name: string, level = 0, quantity = 1): InventoryItem => ({ name, level, quantity, slot: 0, locked: false, bound: false, upgradeable: false, sellable: true });
it('explains intermediate compound deposits, active trios and locked stock', () => {
  const profile = initialProfile(scripts());
  profile.seller.compound = { enabled: true, checkBankOnDeposit: true, rules: [{ item: 'lantern', maxLevel: 3 }] };
  const lantern = item('lantern', 1);
  expect(inspectMerchantItem(profile, catalog, lantern, [lantern])[0].action).toBe('Deposit');
  expect(inspectMerchantItem(profile, catalog, lantern, [lantern, lantern, lantern])[0].action).toBe('Keep for compound');
  expect(inspectMerchantItem(profile, catalog, { ...lantern, locked: true }, [lantern])[0].action).toBe('Protected');
});
it('releases NPC shoes until feathers can support crafting', () => {
  const profile = initialProfile(scripts());
  profile.seller.craft.enabled = true;
  profile.seller.craft.rules = [{ item: 'wingedboots' }];
  profile.seller.npcEnabled = true;
  profile.seller.npcItems = ['shoes'];
  expect(inspectMerchantItem(profile, catalog, item('shoes'), [item('feather0', 0, 19)])[0].action).toBe('Sell to NPC');
  expect(inspectMerchantItem(profile, catalog, item('shoes'), [item('feather0', 0, 20)])[0].action).toBe('Keep craft material');
});
