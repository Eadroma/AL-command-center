import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';
import {expect,it} from 'vitest';import {ast,sourceDir} from '../server/scripts';
const source=fs.readFileSync(path.join(sourceDir,'eadrosell-merchant-v2.js'),'utf8');
function fixture(computer:boolean,map='main') {
 const calls:string[]=[];const halt=Error('end tick');
 const c:any={character:{map,stand:true,items:[{name:'candy1',q:10},...(computer?[{name:'computer'}]:[])],q:{}},immediate_bankable:false,stand_hold_until:123,chores_in_progress:false,
 merchant_work_next:()=> 'exchange',next_exchange_bank_job:()=>null,locate_exchange_item:()=>0,cc_exchange_enabled:()=>true,free_slots:()=>10,set_message:()=>{},hold_stand:()=>calls.push('hold'),ensure_stand_closed:async()=>calls.push('close'),cc_stand_spot:()=>({map:'main',x:0,y:0}),SHOP_XY:{exchange:{}},near_point:()=>true,walk_to:async()=>calls.push('move'),ensure_mass_buff:async()=>{},exchange:async()=>{calls.push('exchange');return {};},game_log:()=>{},sleep:async()=>{throw halt;}};
 vm.createContext(c);const helper:any=ast(source).body.find((n:any)=>n.type==='FunctionDeclaration'&&n.id.name==='merchant_remote_exchange_available');vm.runInContext(source.slice(helper.start,helper.end),c);
 const start=source.indexOf('var bankExchangeJob ='),end=source.indexOf('// --- 3. Craft chez Leo',start);
 const run=vm.runInContext('(async function(){while(true){'+source.slice(start,end)+'}})',c);
 return {c,calls,run,halt};
}
it('exchanges at the stand with its computer without closing or moving',async()=>{
 const f=fixture(true);await expect(f.run()).rejects.toBe(f.halt);expect(f.calls).toEqual(['exchange']);expect(f.c.stand_hold_until).toBe(0);
});
it('keeps the NPC fallback when no remote capability exists',async()=>{
 const f=fixture(false);f.c.near_point=()=>false;await expect(f.run()).rejects.toBe(f.halt);expect(f.calls).toEqual(['hold','close','move']);
});
it('leaves the bank before attempting a remote exchange',async()=>{
 const f=fixture(true,'bank');await expect(f.run()).rejects.toBe(f.halt);expect(f.calls).toEqual(['move']);expect(f.c.chores_in_progress).toBe(false);
});
