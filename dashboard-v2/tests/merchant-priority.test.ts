import { expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { ast, sourceDir } from '../server/scripts';
const source = fs.readFileSync(path.join(sourceDir, 'eadrosell-merchant-v2.js'), 'utf8');
function load(names: string[], context: any) {
  context.merchant_work_next ??= () => names.includes('upgradeLoop') || names.includes('upgrade_idle_ready') ? 'upgrade' : context.cc_npc_enabled?.() && context.locate_sell_item?.() >= 0 ? 'sell' : 'exchange';
  context.exchange_space_paused ??= () => false;
  context.upgrade_material_slot ??= (name: string) => name === 'none' || !name ? -1 : 1;
  context.upgrade_step_for ??= () => ({ offering: 'none' });
  context.upgrade_attempt_allowed ??= () => true;
  context.upgrade_attempt_cost ??= () => 0;
  vm.createContext(context);
  vm.runInContext(ast(source).body.filter((n: any) => n.type === 'FunctionDeclaration' && names.includes(n.id.name)).map((n: any) => source.slice(n.start, n.end)).join('\n'), context);
  return context;
}
it('drains NPC sales before selecting an exchange trip and never reserves an upgrade trip', () => {
  let sales = 0, exchanges = 0;
  const c = load(['refresh_production_trip'], { character: { items: [] }, production_trip: null, chores_in_progress: false, bank_dump_active: false, should_bank_item: () => false, cc_exchange_enabled: () => true, free_slots: () => 5, locate_exchange_item: () => exchanges, cc_npc_enabled: () => true, locate_sell_item: () => sales });
  expect(c.refresh_production_trip()).toBeNull();
  sales = -1; expect(c.refresh_production_trip()).toBe('exchange');
  exchanges = -1; expect(c.refresh_production_trip()).toBeNull();
});
it('runs stationary upgrades only at the open stand after logistics, and yields to bank sort', () => {
  const c = load(['upgrade_idle_ready'], { character: { items: [], stand: true, q: {} }, chores_in_progress: false, bank_dump_active: false, smart: { moving: false }, should_bank_item: () => false, cc_npc_enabled: () => true, locate_sell_item: () => -1, refresh_production_trip: () => null, chores_pending: () => false, near_point: () => true, cc_stand_spot: () => ({}), cc_stand_enabled: () => true });
  expect(c.upgrade_idle_ready()).toBe(true);
  c.chores_pending = () => true; expect(c.upgrade_idle_ready()).toBe(false);
  c.chores_pending = () => false; c.character.stand = false; expect(c.upgrade_idle_ready()).toBe(false);
  c.character.stand = true; c.smart.moving = true; expect(c.upgrade_idle_ready()).toBe(false);
  c.smart.moving = false; c.ALCCBankSorter = { snapshot: () => ({ state: 'queued' }) }; expect(c.upgrade_idle_ready()).toBe(false);
});
it('sells an entire eligible stack remotely without closing or moving the stand', async () => {
  const stop = new Error('stop loop');
  const sold: number[][] = [], travel: string[] = [];
  const c = load(['townChoresLoop'], { production_trip: null, character: { items: [{ name: 'coat', q: 5 }], stand: true }, chores_in_progress: false, bank_dump_active: false, refresh_production_trip: () => null, should_bank_item: () => false, locate_sell_item: () => 0, cc_npc_enabled: () => true, set_message: () => {}, game_log: () => {}, sell: async (...args: number[]) => sold.push(args), close_stand: async () => travel.push('close'), walk_to: async () => travel.push('walk'), hold_stand: () => travel.push('hold'), sleep: async () => { throw stop; } });
  await expect(c.townChoresLoop()).rejects.toBe(stop);
  expect(sold).toEqual([[0, 5]]); expect(travel).toEqual([]); expect(c.character.stand).toBe(true);
});
it('retains Xyn ownership during the server timer and drains across new sale and bank rewards', () => {
  let slot = -1;
  const c = load(['refresh_production_trip'], { character: { items: [{}], q: { exchange: {} } }, production_trip: 'exchange', chores_in_progress: false, bank_dump_active: false, should_bank_item: () => true, cc_exchange_enabled: () => true, free_slots: () => 0, locate_exchange_item: () => slot, cc_npc_enabled: () => true, locate_sell_item: () => 0 });
  expect(c.refresh_production_trip()).toBe('exchange');
  c.character.q = {}; c.free_slots = () => 2; slot = 1;
  expect(c.refresh_production_trip()).toBe('exchange');
  slot = -1; expect(c.refresh_production_trip()).toBeNull();
});
it('does not retry an exchange remainder smaller than the actual recipe batch', () => {
  let amount = 45;
  const c = load(['locate_exchange_item'], { character: { items: [{ name: 'seashell' }] }, G: { items: { seashell: { e: 20 } } }, exchange_drain: {}, cc_exchange_items: () => ['seashell'], cc_exchange_min: () => ({ seashell: 40 }), item_count: () => amount, find_item: () => 0 });
  expect(c.locate_exchange_item()).toBe(0);
  amount = 25; expect(c.locate_exchange_item()).toBe(0);
  amount = 5; expect(c.locate_exchange_item()).toBe(-1);
});
it('upgrades carried equipment before considering an NPC base purchase', async () => {
  const actions: string[] = []; const stop = new Error('stop loop');
  const c = load(['upgradeLoop'], { character: { items: [{ name: 'sword' }, { name: 'scroll0' }] }, upgrade_idle_ready: () => true, cc_upgrade_enabled: () => true, find_compound_set: () => null, locate_upgrade_item: () => 0, upgrade_scroll_for: () => 'scroll0', cc_upgrade_rules: () => [{ item: 'sword', maxLevel: 7 }], item_count: () => 1, find_item: () => 1, ensure_mass_buff: async () => {}, set_message: () => {}, game_log: () => {}, next_upgrade_purchase: () => { actions.push('purchase'); return null; }, upgrade: async () => { actions.push('upgrade'); return { success: true }; }, sleep: async () => { throw stop; } });
  await expect(c.upgradeLoop()).rejects.toBe(stop); expect(actions).toEqual(['upgrade']);
});
it('queues target-level equipment for bank outside the recurrent allowlist, preserving locked and bound items', () => {
  const c = load(['upgrade_target_complete', 'should_bank_item'], { character: { name: 'Merchant' }, G: { items: { coat: { upgrade: true }, scroll0: { type: 'scroll' } } }, cc_upgrade_enabled: () => true, cc_upgrade_rules: () => [{ item: 'coat', maxLevel: 7 }], __ALCC: { bankDeposit: { enabled: true, items: [] } }, CONFIG: { BANK_NEVER: {} }, is_protected_item: () => false });
  expect(c.should_bank_item({ name: 'coat', level: 6 })).toBe(false);
  expect(c.should_bank_item({ name: 'coat', level: 7 })).toBe(true);
  expect(c.should_bank_item({ name: 'coat', level: 8 })).toBe(true);
  expect(c.should_bank_item({ name: 'coat', level: 7, l: 'locked' })).toBe(false);
  expect(c.should_bank_item({ name: 'coat', level: 7, b: true })).toBe(false);
  expect(c.should_bank_item({ name: 'scroll0' })).toBe(false);
});

it('keeps a craft trip when queued bank items have lower configured priority', () => {
 const c=load(['refresh_production_trip'],{character:{items:[{name:'leather'}]},production_trip:null,chores_in_progress:false,bank_dump_active:false,should_bank_item:()=>true,cc_exchange_enabled:()=>false,free_slots:()=>5,locate_exchange_item:()=>-1,merchant_work_next:()=> 'craft',next_craft_job:()=>({item:'pouchbow'})});
 expect(c.refresh_production_trip()).toBe('craft');
});

it('banks explicitly allowed fun tokens while preserving active reservations and locked items', () => {
 const c=load(['is_protected_item','should_bank_item'], { character:{name:'Merchant'}, G:{items:{}}, CONFIG:{BANK_NEVER:{},HPOT:'hpot0',MPOT:'mpot0'}, __ALCC:{bankDeposit:{enabled:true,items:['funtoken']}}, upgrade_target_complete:()=>false, cc_upgrade_enabled:()=>false, craft_item_reserved:()=>false, cc_listings:()=>[], should_sell:()=>false, cc_exchange_items:()=>[] });
 expect(c.should_bank_item({name:'funtoken',q:4})).toBe(true);
 expect(c.should_bank_item({name:'funtoken',q:4,l:true})).toBe(false);
 expect(c.should_bank_item({name:'funtoken',q:4,b:true})).toBe(false);
 c.__ALCC.bankDeposit.enabled=false;
 expect(c.should_bank_item({name:'funtoken',q:4})).toBe(false);
 c.__ALCC.bankDeposit.enabled=true; c.__ALCC.bankDeposit.items=[];
 expect(c.should_bank_item({name:'funtoken',q:4})).toBe(false);
 c.__ALCC.bankDeposit.items=['funtoken']; c.UpgradeProduction={reserved:()=>true};
 expect(c.should_bank_item({name:'funtoken',q:4})).toBe(false);
 expect(source).not.toMatch(/funtoken:\s*1/);
});
it('allows upgrades during remote exchanges but keeps bank and travel exclusive',()=>{
 const c=load(['merchant_parallel_stand_ready','upgrade_idle_ready'],{character:{map:'main',stand:true,q:{exchange:{num:4}}},smart:{moving:false},chores_in_progress:false,bank_dump_active:false,near_point:()=>true,cc_stand_spot:()=>({}),cc_stand_enabled:()=>true,merchant_work_next:()=> 'exchange',merchant_remote_exchange_available:()=>true});
 expect(c.upgrade_idle_ready()).toBe(true);
 c.character.q.upgrade={num:2};expect(c.upgrade_idle_ready()).toBe(false);delete c.character.q.upgrade;
 c.merchant_work_next=()=> 'bank';expect(c.merchant_parallel_stand_ready()).toBe(false);
 c.merchant_work_next=()=> 'exchange';c.character.map='bank';expect(c.merchant_parallel_stand_ready()).toBe(false);
 c.character.map='main';c.merchant_remote_exchange_available=()=>false;expect(c.merchant_parallel_stand_ready()).toBe(false);
});
it('sells during an exchange and never starts a second sale while one is pending',async()=>{
 const stop=new Error('stop'),calls:any[]=[];
 const c=load(['parallelStandSalesLoop'],{character:{items:[{name:'junk',q:3}],q:{exchange:{num:4}}},merchant_parallel_stand_ready:()=>true,merchant_work_next:()=> 'exchange',cc_npc_enabled:()=>true,merchant_task_allowed:()=>true,locate_sell_item:()=>0,remote_sale_busy:false,sell:async(...args:any[])=>{calls.push(args);expect(c.remote_sale_busy).toBe(true);},game_log:()=>{},sleep:async()=>{throw stop;}});
 await expect(c.parallelStandSalesLoop()).rejects.toThrow('stop');expect(calls).toEqual([[0,3]]);expect(c.remote_sale_busy).toBe(false);
 c.remote_sale_busy=true;await expect(c.parallelStandSalesLoop()).rejects.toThrow('stop');expect(calls).toHaveLength(1);
});
