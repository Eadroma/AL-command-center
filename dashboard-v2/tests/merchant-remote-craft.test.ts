import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { expect, it } from 'vitest';
import { ast, sourceDir } from '../server/scripts';
const source = fs.readFileSync(path.join(sourceDir, 'eadrosell-merchant-v2.js'), 'utf8');
function fixture(computer = true, map = 'main') {
  const calls: string[] = [];
  const job = {item:'pouchbow',batch:10,bank:[],missing:[],recipe:{cost:100}};
  const c: any = {character:{name:'Merchant',map,stand:true,items:computer?[{name:'computer'}]:[],q:{}},
    craft_batch:null,production_trip:'craft',stand_hold_until:999,chores_in_progress:false,bank_dump_active:false,smart:{moving:false},
    set_message:()=>{},next_craft_job:()=>job,get:()=>({}),set:()=>{},stock_craft_bank:async()=>{calls.push('bank');return true;},
    near_point:()=>true,cc_stand_spot:()=>({map:'main',x:0,y:0}),walk_to:async()=>calls.push('move'),
    hold_stand:()=>calls.push('hold'),ensure_stand_closed:async()=>calls.push('close'),sleep:async()=>{},
    auto_craft:async()=>{calls.push('craft');return {};},ensure_mass_buff:async()=>{},game_log:()=>{},
    free_slots:()=>10,SHOP_XY:{craftsman:{},basics:{}},buy:async()=>calls.push('buy'),
    merchant_work_next:()=> 'craft',cc_stand_enabled:()=>true,
  };
  const functions = ['merchant_remote_exchange_available','run_next_craft','buy_from_shop','chores_pending','merchant_parallel_stand_ready'];
  vm.createContext(c);
  vm.runInContext(ast(source).body.filter((node:any)=>node.type==='FunctionDeclaration'&&functions.includes(node.id.name)).map((node:any)=>source.slice(node.start,node.end)).join('\n'),c);
  return {c,calls,job};
}
it('crafts and buys at the stand without closing it, and permits parallel stand work',async()=>{
  const {c,calls}=fixture();
  expect(c.chores_pending()).toBe(false);
  expect(c.merchant_parallel_stand_ready()).toBe(true);
  await c.run_next_craft();
  c.near_point=()=>false;
  await c.buy_from_shop('bow',1,'basics');
  expect(calls).toEqual(['craft','buy']);
  expect(c.stand_hold_until).toBe(0);
  expect(c.craft_batch.remaining).toBe(9);
});
it('keeps the Leo fallback without a Computer',async()=>{
  const {c,calls}=fixture(false);
  c.near_point=()=>false;
  await c.run_next_craft();
  expect(calls).toEqual(['hold','close','move']);
  expect(c.chores_pending()).toBe(true);
});
it('leaves the bank before crafting, and never sends a buy from inside the bank',async()=>{
  const {c,calls}=fixture(true,'bank');
  await c.run_next_craft();
  expect(await c.buy_from_shop('bow',1,'basics')).toBe(false);
  expect(calls).toEqual(['move']);
});
it('still retrieves bank ingredients before remote production',async()=>{
  const {c,calls,job}=fixture();
  (job.bank as object[]).push({item:'spidersilk'});
  await c.run_next_craft();
  expect(calls).toEqual(['bank']);
});
