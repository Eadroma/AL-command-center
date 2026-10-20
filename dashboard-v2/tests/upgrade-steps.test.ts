import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { expect, it } from 'vitest';
import { ast, sourceDir, scripts, initialProfile } from '../server/scripts';
import { adaptSource } from '../server/builder';
import { profileSchema } from '../shared/schema';
const source = fs.readFileSync(path.join(sourceDir, 'eadrosell-merchant-v2.js'), 'utf8');
const helpers = ['upgrade_step_for', 'upgrade_scroll_for', 'upgrade_material_slot', 'upgrade_attempt_cost', 'upgrade_attempt_allowed', 'upgrade_supply_reserved', 'should_upgrade', 'locate_upgrade_item'];
function setup() {
  const rule: any = { item: 'sword', maxLevel: 9, steps: { 8: { scroll: 'scroll2', offering: 'offeringp' } } };
  const c: any = { character: { name: 'Merchant', gold: 1000000, items: [{ name: 'sword', level: 8 }, { name: 'scroll2' }, { name: 'offeringp' }] }, G: { items: { sword: { upgrade: true }, scroll2: { g: 1000 }, offeringp: { g: 200 } } }, CONFIG: { NEVER_UPGRADE: {} }, __ALCC: { upgrade: { enabled: true, minGold: 0, rules: [rule] } }, cc_upgrade_rules: () => [rule], cc_upgrade_enabled: () => true, cc_upgrade_gold_min: () => 0, item_grade: () => 2 };
  vm.createContext(c);
  const declarations = (text: string, names: string[]) => ast(text).body.filter((n: any) => n.type === 'FunctionDeclaration' && names.includes(n.id.name)).map((n: any) => text.slice(n.start, n.end)).join('\n');
  vm.runInContext(declarations(source, helpers), c);
  return { c, rule, declarations };
}
it('uses source-level keys, compatible automatic defaults, and holds disabled/incompatible steps', () => {
  const { c, rule } = setup(); const item = c.character.items[0];
  expect(c.upgrade_scroll_for(item)).toBe('scroll2');
  rule.steps[8].scroll = 'scroll0'; expect(c.upgrade_scroll_for(item)).toBeNull();
  rule.steps[8] = { scroll: 'auto', offering: 'none' }; c.item_grade = () => 3;
  expect(c.upgrade_scroll_for(item)).toBe('scroll3');
  rule.steps[8].enabled = false; expect(c.upgrade_attempt_allowed(item)).toBe(false);
});
it('requires the exact unlocked offering and counts it in the production budget', () => {
  const { c } = setup(); const item = c.character.items[0];
  expect(c.upgrade_attempt_cost(item)).toBe(1200);
  expect(c.locate_upgrade_item(true)).toBe(0);
  c.character.items[2].l = true; expect(c.locate_upgrade_item(true)).toBe(-1);
  c.character.items[2] = { name: 'offering' }; expect(c.upgrade_attempt_allowed(item)).toBe(false);
  c.character.items[2] = { name: 'offeringp' }; c.UpgradeProduction = { allowed: (_: string, cost: number) => cost <= 1100 };
  expect(c.upgrade_attempt_allowed(item)).toBe(false);
  expect(c.upgrade_supply_reserved('offeringp')).toBe(true);
});
it('passes the offering slot and combined cost to a single stationary attempt', async () => {
  const { c, declarations } = setup(); const attempts: unknown[][] = [], costs: number[] = [];
  Object.assign(c, { merchant_work_next: () => 'upgrade', upgrade_idle_ready: () => true, find_compound_set: () => null, item_count: () => 1, ensure_mass_buff: async () => {}, set_message: () => {}, game_log: () => {}, next_upgrade_purchase: () => null, upgrade: async (...args: unknown[]) => { attempts.push(args); return { success: true }; }, UpgradeProduction: { allowed: () => true, begin: (_: string, cost: number) => { costs.push(cost); return {}; }, settle: () => {} } });
  const stop = Error('stop'); c.sleep = async () => { throw stop; };
  vm.runInContext(declarations(source, ['upgradeLoop']), c);
  await expect(c.upgradeLoop()).rejects.toBe(stop);
  expect(attempts).toEqual([[0, 1, 2]]); expect(costs).toEqual([1200]);
});
it('keeps per-level rules in profiles and enforces them in the injected merchant predicate', () => {
  const { c, rule, declarations } = setup(); const list = scripts(), profile = initialProfile(list);
  profile.seller.upgrade.rules = [rule];
  expect(profileSchema.parse(profile).seller.upgrade.rules[0].steps?.['8'].offering).toBe('offeringp');
  const script = list.find(script => script.id === 'eadrosell-merchant-v2')!;
  const merchant = profile.characters.find(character => character.ctype === 'merchant')!;
  merchant.script = script.id;
  const { code } = adaptSource(source, profile, merchant, script);
  vm.runInContext(declarations(code, ['should_upgrade']), c);
  expect(c.should_upgrade(c.character.items[0])).toBe(true);
  c.character.items[2] = null; expect(c.should_upgrade(c.character.items[0])).toBe(false);
});

it('holds an unconfirmed scroll purchase and accepts a late inventory receipt', async () => {
  const { c, declarations } = setup(); let purchases = 0;
  c.character.items[1] = null;
  Object.assign(c, { upgrade_purchase_state: {}, save_upgrade_purchase_state: () => {}, set_message: () => {}, game_log: () => {}, sleep: async () => {}, buy: async () => { purchases++; return {}; } });
  vm.runInContext(declarations(source, ['purchase_upgrade_scroll']), c);
  await c.purchase_upgrade_scroll('scroll2'); await c.purchase_upgrade_scroll('scroll2');
  expect(purchases).toBe(1); expect(c.upgrade_attempt_allowed(c.character.items[0])).toBe(false);
  c.character.items[1] = { name: 'scroll2' };
  expect(c.upgrade_attempt_allowed(c.character.items[0])).toBe(true);
  expect(c.upgrade_purchase_state.scroll2).toBeUndefined();
});
