import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {it,expect} from 'vitest';import {sourceDir} from '../server/scripts';
const source=fs.readFileSync(path.join(sourceDir,'manual-bank-deposit.js'),'utf8');
it('refuses protected or changed stacks and finds a uniquely relocated selection',()=>{
 const c:any={character:{name:'M',items:[null,{name:'coat',level:9}]},setInterval:()=>{}};vm.createContext(c);vm.runInContext(source,c);
 const selected={slot:0,name:'coat',level:9,quantity:1};expect(c.ManualBankDeposit.locate(selected)).toBe(1);expect(c.ManualBankDeposit.matches({name:'coat',level:9,l:true},selected)).toBe(false);
 c.character.items.push({name:'coat',level:9});expect(c.ManualBankDeposit.locate(selected)).toBe(-1);expect(c.ManualBankDeposit.request({id:'same',deposit:selected})).toBe(true);expect(c.ManualBankDeposit.request({id:'same',deposit:selected})).toBe(false);
});
it('deposits once, returns to stand and releases navigation',async()=>{
 const actions:string[]=[];const item={name:'coat',level:9};const c:any={character:{name:'M',map:'main',items:[item],q:{}},smart:{moving:false},chores_in_progress:false,setInterval:()=>{},game_log:()=>{},sleep:async()=>{},BankCoordinator:{acquire:()=>true,stage:()=>{},begin:()=>true,finish:()=>{},release:()=>actions.push('release')},go_to:async()=>{c.character.map='bank';c.character.bank={items0:[]};},find_empty_bank_slot:()=>({pack:'items0'}),bank_pack_floor:()=> 'bank',bank_store:async()=>{actions.push('store');c.character.items[0]=null;},cc_stand_spot:()=>({map:'main'}),walk_to:async()=>{actions.push('return');c.character.map='main';}};
 vm.createContext(c);vm.runInContext(source,c);c.ManualBankDeposit.request({id:'one',deposit:{slot:0,name:'coat',level:9,quantity:1}});await c.ManualBankDeposit.tick();expect(actions).toEqual(['store','return','release']);expect(c.chores_in_progress).toBe(false);
});
