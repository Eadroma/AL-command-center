import { merchantStandBody } from '../server/builder';
import { expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { ast, sourceDir } from '../server/scripts';
import { eventExpeditionSchema, expeditionBosses } from '../shared/event-expedition';
import { profileSchema } from '../shared/schema';
import { initialProfile, scripts } from '../server/scripts';
const source = fs.readFileSync(path.join(sourceDir, 'eadrosell-merchant-v2.js'), 'utf8');
function load(names: string[], context: any) {
  vm.createContext(context);
  vm.runInContext(ast(source).body.filter((n: any) => n.type === 'FunctionDeclaration' && names.includes(n.id.name)).map((n: any) => source.slice(n.start, n.end)).join('\n'), context);
  return context;
}
it('supports all boss expeditions and rejects a duplicate task priority', () => {
  expect(eventExpeditionSchema.parse({ allowed: [...expeditionBosses] }).allowed).toContain('crabxx');
  expect(eventExpeditionSchema.parse({ allowed: ['franky', 'icegolem'] }).allowed).toHaveLength(2);
  const profile = initialProfile(scripts());
  profile.seller.workOrder = ['craft', 'craft', 'bank', 'exchange', 'compound', 'upgrade'];
  expect(profileSchema.safeParse(profile).success).toBe(false);
});
it('uses the first ready configured task and keeps an active exchange visit', () => {
  const c = load(['merchant_work_next'], { exchange_space_paused:()=>false, character: { items: [] }, __ALCC: { workOrder: ['upgrade', 'craft', 'bank', 'sell', 'exchange', 'compound'] }, craft_batch: null, bank_dump_active: false, production_trip: null, should_bank_item: () => false, cc_npc_enabled: () => true, locate_sell_item: () => 0, cc_exchange_enabled: () => true, free_slots: () => 10, locate_exchange_item: () => 0, next_craft_job: () => ({}), find_compound_set: () => null, cc_upgrade_enabled: () => true, locate_upgrade_item: () => 0, next_upgrade_purchase: () => null });
  expect(c.merchant_work_next()).toBe('upgrade');
  c.locate_upgrade_item = () => -1; expect(c.merchant_work_next()).toBe('craft');
  c.production_trip = 'exchange'; expect(c.merchant_work_next()).toBe('exchange');
});
it('plans bank ingredients and verified NPC bows for a bounded inventory batch', () => {
  const c = load(['next_craft_job', 'craft_shop_for'], { character: { gold: 1000000 }, G: { items: { bow: { g: 200 } }, npcs: { basics: { items: ['bow'] } }, craft: { pouchbow: { cost: 100, items: [[1, 'bow', 0], [1, 'pouch', 0]] } } }, craft_batch: null, craft_bank_retry: {}, cc_craft_enabled: () => true, cc_craft_rules: () => [{ item: 'pouchbow', useBank: true, batchSize: 50 }], item_count_level: () => 0, free_slots: () => 42, cc_craft_gold_reserve: () => 0 });
  const job = c.next_craft_job();
  expect(job.batch).toBe(20); expect(job.bank[0]).toEqual({ item: 'pouch', level: 0, quantity: 20 });
  expect(job.missing[0].quantity).toBe(20);
  c.cc_craft_rules = () => [{ item: 'pouchbow', useBank: false, batchSize: 50 }]; expect(c.next_craft_job()).toBeNull();
});
it('retrieves a bank stack into an empty slot and returns excess after a verified split', async () => {
  const items: any[] = [null, null, null];
  const bank: any = { items8: [{ name: 'pouch', q: 2500 }] };
  const actions: any[] = [];
  const c = load(['stock_craft_bank', 'item_count_level', 'each_bank_item'], { character: { map: 'bank', items, bank }, craft_bank_retry: {}, hold_stand: () => {}, bank_pack_floor: () => 'bank_b', free_slots: () => items.filter(i => !i).length, smart_move: async (map: string) => { c.character.map = map; }, bank_retrieve: async (pack: string, slot: number, destination: number) => { actions.push(['retrieve', pack, slot, destination]); items[destination] = bank[pack][slot]; bank[pack][slot] = null; }, split: async (slot: number, quantity: number) => { actions.push(['split', quantity]); items[slot].q -= quantity; items[items.findIndex(i => !i)] = { name: 'pouch', q: quantity }; }, bank_store: async (slot: number, pack: string, destination: number) => { bank[pack][destination] = items[slot]; items[slot] = null; }, game_log: () => {} });
  await c.stock_craft_bank({ item: 'pouchbow', batch: 20, bank: [{ item: 'pouch', level: 0, quantity: 20 }] });
  expect(c.character.map).toBe('bank_b'); expect(c.item_count_level('pouch', 0)).toBe(20); expect(bank.items8[0].q).toBe(2480);
  expect(actions[0]).toEqual(['retrieve', 'items8', 0, 0]); expect(actions[1]).toEqual(['split', 20]);
});

it('makes the stand manager yield to travel work before inspecting or posting listings', async () => {
 for(const task of ['craft','bank','exchange']) {
  const run=vm.runInNewContext(`(async function(){${merchantStandBody}})`,{merchant_work_next:()=>task});
  expect(await run()).toBe(false);
 }
});
