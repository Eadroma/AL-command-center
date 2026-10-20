import {expect,it} from 'vitest';import fs from 'node:fs';import vm from 'node:vm';import path from 'node:path';import {sourceDir,ast} from '../server/scripts';
it('plans recipe-sized bank batches and excludes protected stock, while draining carried items first',()=>{const source=fs.readFileSync(path.join(sourceDir,'eadrosell-merchant-v2.js'),'utf8');let carried=0;const c:any={Date,exchange_bank_retry:{},character:{name:'Merchant',bank:{}},__ALCC:{exchange:{enabled:true,items:['candy0'],bank:{candy0:{enabled:true,batchSize:10}}}},G:{items:{candy0:{e:3}}},free_slots:()=>5,item_count:()=>carried,each_bank_item:(cb:any)=>[{name:'candy0',q:21},{name:'candy0',q:100,l:true}].forEach(cb)};vm.createContext(c);vm.runInContext(ast(source).body.filter((n:any)=>n.type==='FunctionDeclaration'&&n.id.name==='next_exchange_bank_job').map((n:any)=>source.slice(n.start,n.end)).join(''),c);expect(c.next_exchange_bank_job()).toMatchObject({batch:7,bank:[{quantity:21}]});carried=3;expect(c.next_exchange_bank_job()).toBeNull();carried=0;c.__ALCC.exchange.bank.candy0.enabled=false;expect(c.next_exchange_bank_job()).toBeNull();});
it('drains carried bank-fed stock below the inventory trigger without changing inventory-only thresholds',()=>{
 const source=fs.readFileSync(path.join(sourceDir,'eadrosell-merchant-v2.js'),'utf8');
 const c:any={exchange_drain:{},__ALCC:{exchange:{bank:{candy0:{enabled:true}}}},cc_exchange_items:()=>['candy0'],cc_exchange_min:()=>({candy0:50}),item_count:()=>17,G:{items:{candy0:{e:1}}},find_item:()=>0,character:{items:[{name:'candy0',q:17}]}};
 vm.createContext(c);vm.runInContext(ast(source).body.filter((n:any)=>n.type==='FunctionDeclaration'&&n.id.name==='locate_exchange_item').map((n:any)=>source.slice(n.start,n.end)).join(''),c);
 expect(c.locate_exchange_item()).toBe(0);
 c.exchange_drain={};c.__ALCC.exchange.bank.candy0.enabled=false;
 expect(c.locate_exchange_item()).toBe(-1);
});
it('pauses at four slots, prioritizes carried work and resumes only at eight slots',()=>{
 const source=fs.readFileSync(path.join(sourceDir,'eadrosell-merchant-v2.js'),'utf8');let slots=4,sell=0,bank=false,upgrade=2;
 const c:any={bank_dump_active:false,exchange_space_pause:false,production_trip:'exchange',cc_exchange_enabled:()=>true,free_slots:()=>slots,locate_exchange_item:()=>1,game_log:()=>{},set_message:()=>{},character:{items:[{}]},cc_npc_enabled:()=>true,locate_sell_item:()=>sell,merchant_task_allowed:()=>true,should_bank_item:()=>bank,bankable_signature:()=> 'stock',last_bank_failure_signature:'',last_bank_failure_at:0,CONFIG:{},Date,cc_upgrade_enabled:()=>true,locate_upgrade_item:()=>upgrade};
 vm.createContext(c);vm.runInContext(ast(source).body.filter((n:any)=>n.type==='FunctionDeclaration'&&['exchange_space_paused','merchant_work_next'].includes(n.id.name)).map((n:any)=>source.slice(n.start,n.end)).join(''),c);
 expect(c.merchant_work_next()).toBe('sell');sell=-1;bank=true;expect(c.merchant_work_next()).toBe('bank');bank=false;expect(c.merchant_work_next()).toBe('upgrade');upgrade=-1;expect(c.merchant_work_next()).toBeNull();
 slots=5;expect(c.exchange_space_paused()).toBe(true);slots=8;expect(c.exchange_space_paused()).toBe(false);
 slots=4;c.exchange_space_pause=true;c.character.q={exchange:{}};expect(c.merchant_work_next()).toBeNull();
});

it('keeps the bank lease ahead of pressure sales, including while inside the bank',()=>{
 const source=fs.readFileSync(path.join(sourceDir,'eadrosell-merchant-v2.js'),'utf8');const c:any={bank_dump_active:true,merchant_task_allowed:()=>true,exchange_space_paused:()=>{throw Error('must finish bank lease first');}};
 vm.createContext(c);vm.runInContext(ast(source).body.filter((n:any)=>n.type==='FunctionDeclaration'&&n.id.name==='merchant_work_next').map((n:any)=>source.slice(n.start,n.end)).join(''),c);
 expect(c.merchant_work_next()).toBe('bank');
});

