import { expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { ast, sourceDir, initialProfile, scripts } from '../server/scripts';
import { setUpgradeRule, setUpgradeNpcPurchase } from '../src/models/merchant';
const source = fs.readFileSync(path.join(sourceDir, 'eadrosell-merchant-v2.js'), 'utf8');
const functions = ast(source).body.filter((entry: any) => entry.type === 'FunctionDeclaration' && ['upgrade_npc_destination', 'next_upgrade_purchase', 'purchase_upgrade_base', 'save_upgrade_purchase_state'].includes(entry.id.name)).map((entry: any) => source.slice(entry.start, entry.end)).join('\n');
function context() {
  const data: any = { character: { name: 'EadroSell', rip: false, map: 'main', gold: 10000 }, G: { items: { coat: { upgrade: true, g: 1000 } }, npcs: { basics: { role: 'merchant', items: ['coat'] } }, maps: { main: { npcs: [{ id: 'basics', position: [10, 20] }] } } }, upgrade_purchase_state: {}, cc_upgrade_enabled: () => true, cc_upgrade_rules: () => [{ item: 'coat', maxLevel: 7, buyNpc: true }], cc_upgrade_gold_min: () => 5000, free_slots: () => 3, item_count: (name: string) => name === 'scroll0' ? 1 : 0, upgrade_scroll_for: () => 'scroll0', near_point: () => true, set_message: () => {}, game_log: () => {}, sleep: async () => {}, buy: async () => ({ success: true }) };
  data.exchange_space_pause = false;
  vm.createContext(data); vm.runInContext(functions, data); return data;
}
it('buys only opted-in, NPC-upgradeable items and preserves the post-purchase reserve', () => {
  const c = context(); expect(c.next_upgrade_purchase().item).toBe('coat');
  c.character.gold = 5500; expect(c.next_upgrade_purchase()).toBeNull();
  c.character.gold = 10000; c.item_count = () => 1; expect(c.next_upgrade_purchase()).toBeNull();
  c.item_count = (name: string) => name === 'scroll0' ? 1 : 0;
  c.cc_upgrade_rules = () => [{ item: 'coat', maxLevel: 7, buyNpc: false }]; expect(c.next_upgrade_purchase()).toBeNull();
});
it('holds an unconfirmed purchase instead of buying another copy', async () => {
  const c = context(); let buys = 0; c.buy = async () => { buys++; };
  await c.purchase_upgrade_base(c.next_upgrade_purchase());
  expect(buys).toBe(1); expect(c.upgrade_purchase_state.coat.pending).toBe(true);
  expect(c.next_upgrade_purchase()).toBeNull();
});
it('preserves the checkbox when editing the upgrade target', () => {
  const p = setUpgradeNpcPurchase(setUpgradeRule(initialProfile(scripts()), 'coat', 7), 'coat', true);
  expect(setUpgradeRule(p, 'coat', 8).seller.upgrade.rules.find(rule => rule.item === 'coat')).toMatchObject({ buyNpc: true, maxLevel: 8 });
});
it('purchases remotely without requiring NPC proximity or changing the open stand', async () => {
  const c = context(); c.character.stand = true; c.near_point = () => false;
  let buys = 0;
  c.buy = async () => { buys++; c.item_count = () => 1; return { success: true }; };
  await c.purchase_upgrade_base(c.next_upgrade_purchase());
  expect(buys).toBe(1); expect(c.character.stand).toBe(true);
  expect(c.upgrade_purchase_state.coat).toBeUndefined();
});
