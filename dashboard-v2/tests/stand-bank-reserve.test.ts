import { expect, it } from 'vitest';
import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';
import {ast, sourceDir} from '../server/scripts';
const source=fs.readFileSync(path.join(sourceDir,'eadrosell-merchant-v2.js'),'utf8');
function setup(count:number){
 const storage:any={};const rule={item:'coat',level:9,price:1000000,bankReserve:2};
 const items=Array.from({length:count},(_,i)=>({name:'coat',level:9,rid:'coat-'+i}));let withdrawals=0;
 const c:any={Date,last_listing_bank_check:0,character:{name:'Merchant',map:'bank',esize:42,items:Array(42).fill(null),slots:{},bank:{items0:items}},cc_stand_spot:()=>({map:"main",x:0,y:0}),cc_stand_enabled:()=>true,cc_listings:()=>[rule],get:(key:string)=>storage[key],set:(key:string,value:any)=>storage[key]=value,each_bank_item:(cb:any)=>items.forEach((item,i)=>item&&cb(item,'items0',i)),hold_stand:()=>{},act:()=>{},go_to:async()=>{},walk_to:async()=>{},sleep:async()=>{},game_log:()=>{},free_slots:()=>42,upgrade_target_complete:()=>true,bank_retrieve:async(pack:string,slot:number,target:number)=>{withdrawals++;c.character.items[target]=items[slot];items[slot]=null as any;}};
 vm.createContext(c);vm.runInContext(ast(source).body.filter((n:any)=>n.type==='FunctionDeclaration'&&['merchant_trade_capacity','remember_stand_listings','listing_bank_leases','save_listing_bank_leases','release_listing_bank_stock','stand_listing_posted','listing_bank_stock_reserved','stand_inventory_allowed','listing_present','restock_listing_bank_stock','maybe_restock_listing_from_bank','should_bank_item'].includes(n.id.name)).map((n:any)=>source.slice(n.start,n.end)).join('\n'),c);
 return {c,withdrawals:()=>withdrawals,items};
}
it('keeps the exact minimum in bank and only withdraws surplus at the configured level',async()=>{
 const two=setup(2);await two.c.maybe_restock_listing_from_bank();expect(two.withdrawals()).toBe(0);
 const three=setup(3);await three.c.maybe_restock_listing_from_bank();expect(three.withdrawals()).toBe(1);expect(three.items.filter(Boolean)).toHaveLength(2);
 const stock=three.c.character.items[0];expect(three.c.should_bank_item(stock)).toBe(false);expect(three.c.stand_inventory_allowed(stock)).toBe(true);
 const fresh={name:'coat',level:9,rid:'new-production'};expect(three.c.should_bank_item(fresh)).toBe(true);expect(three.c.stand_inventory_allowed(fresh)).toBe(false);
 three.c.release_listing_bank_stock(stock);expect(three.c.listing_bank_stock_reserved(stock)).toBe(false);
});
it('does not withdraw while all stand slots are occupied',async()=>{const {c,withdrawals}=setup(3);for(let i=1;i<=16;i++)c.character.slots['trade'+i]={name:'other'};await c.maybe_restock_listing_from_bank();expect(withdrawals()).toBe(0);});

it('splits bank stacks and returns the reserved surplus before publishing',async()=>{
 const {c,items}=setup(1);(items[0] as any).q=3;
 c.split=async(slot:number,quantity:number)=>{const original=c.character.items[slot];original.q-=quantity;c.character.items[1]={...original,q:quantity,rid:'split'};};
 c.bank_store=async(slot:number,pack:string,destination:number)=>{items[destination]=c.character.items[slot];c.character.items[slot]=null;};
 await c.maybe_restock_listing_from_bank();expect((items[0] as any).q).toBe(2);expect(c.character.items[1].q).toBe(1);expect(c.listing_bank_stock_reserved(c.character.items[1])).toBe(true);
});
it('owns the travel lock through arrival and withdrawal rather than returning after entry',async()=>{
 const {c,withdrawals}=setup(3);c.character.map='main';c.chores_in_progress=false;
 c.go_to=async()=>{expect(c.chores_in_progress).toBe(true);c.character.map='bank';};
 await c.maybe_restock_listing_from_bank();expect(withdrawals()).toBe(1);expect(c.chores_in_progress).toBe(false);
});
it('keeps the same withdrawn piece reserved when other chores delay publication beyond five minutes',async()=>{
 const {c}=setup(3);await c.maybe_restock_listing_from_bank();const stock=c.character.items[0];
 const rows=c.listing_bank_leases();rows['coat:9'].at=Date.now()-600000;c.save_listing_bank_leases(rows);
 expect(c.should_bank_item(stock)).toBe(false);expect(c.stand_inventory_allowed(stock)).toBe(true);
 expect(c.should_bank_item({name:'coat',level:9,rid:'another-output'})).toBe(true);
 c.character.slots.trade10={name:'coat',level:9};expect(c.listing_bank_stock_reserved(stock)).toBe(false);expect(c.listing_bank_leases()['coat:9']).toBeTruthy();
 c.release_listing_bank_stock(stock);expect(c.listing_bank_stock_reserved(stock)).toBe(false);
});
it('holds the withdrawal navigation lock until the return to the stand completes',async()=>{
 const {c}=setup(3);c.chores_in_progress=false;
 c.walk_to=async()=>{expect(c.chores_in_progress).toBe(true);expect(c.listing_bank_stock_reserved(c.character.items[0])).toBe(true);c.character.map='main';};
 await c.maybe_restock_listing_from_bank();expect(c.character.map).toBe('main');expect(c.chores_in_progress).toBe(false);
});
it('retains the reservation even when persistent storage is unavailable',async()=>{
 const {c}=setup(3);c.get=()=>null;c.set=()=>{throw new Error('storage unavailable');};
 await c.maybe_restock_listing_from_bank();const stock=c.character.items[0];
 expect(c.listing_bank_stock_reserved(stock)).toBe(true);expect(c.should_bank_item(stock)).toBe(false);
});
it('does not withdraw a duplicate when closing the stand hides its extended trade slots',async()=>{
 const {c,withdrawals}=setup(3);c.character.ctype='merchant';c.character.level=70;
 c.character.stand=true;c.character.slots.trade10={name:'coat',level:9};c.remember_stand_listings();
 c.character.stand=false;c.character.slots={};await c.maybe_restock_listing_from_bank();expect(withdrawals()).toBe(0);
 c.character.stand=true;c.remember_stand_listings();c.character.stand=false;
 await c.maybe_restock_listing_from_bank();expect(withdrawals()).toBe(1);
});
it('banks surplus behind a posted listing without deleting the lease during policy reads',async()=>{
 const {c}=setup(3);await c.maybe_restock_listing_from_bank();const stock=c.character.items[0];
 c.character.slots.trade10={name:'coat',level:9};expect(c.should_bank_item(stock)).toBe(true);
 expect(c.listing_bank_leases()['coat:9']).toBeTruthy();
 c.cc_listings=()=>[{item:'suckerpunch',level:0,price:100}];c.character.slots.trade2={name:'suckerpunch',level:0};
 expect(c.should_bank_item({name:'suckerpunch',level:0})).toBe(true);
 expect(c.should_bank_item({name:'suckerpunch',level:0,l:true})).toBe(false);
});
it('restocks multiple missing announcements inside one owned deposit visit',async()=>{
 const {c,items,withdrawals}=setup(3);items.push({name:'pants',level:9,rid:'pants'} as any);
 c.cc_listings=()=>[{item:'coat',level:9,price:100,bankReserve:2},{item:'pants',level:9,price:100,bankReserve:0}];
 vm.runInContext(fs.readFileSync(path.join(sourceDir,'bank-coordinator.js'),'utf8'),c);
 c.BankCoordinator.acquire('deposit');let exits=0;c.walk_to=async()=>{exits++;};
 expect(await c.maybe_restock_listing_from_bank({stayInBank:true})).toBe(true);
 expect(await c.maybe_restock_listing_from_bank({stayInBank:true})).toBe(true);
 expect(await c.maybe_restock_listing_from_bank({stayInBank:true})).toBe(false);
 expect(withdrawals()).toBe(2);expect(exits).toBe(0);expect(c.BankCoordinator.snapshot().journal).toHaveLength(2);
});
