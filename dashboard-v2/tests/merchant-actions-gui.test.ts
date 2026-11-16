import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {expect,it} from 'vitest';import {sourceDir} from '../server/scripts';
const source=fs.readFileSync(path.join(sourceDir,'merchant-actions-gui.js'),'utf8');
function setup(){let status='idle';const commands:any[]=[];const c:any={character:{name:'Merchant',ctype:'merchant'},parent:{},ALCCBankSorter:{snapshot:()=>({state:status}),request:(command:any)=>{commands.push(command);status='queued';return true;}}};vm.createContext(c);vm.runInContext(source,c);return {c,commands,status:(value:string)=>status=value};}
it('never starts work at installation and calls the dashboard sorter only on request',()=>{
 const {c,commands}=setup();expect(commands).toEqual([]);expect(c.MerchantActionsGUI.requestSort()).toBe(true);
 expect(commands[0]).toMatchObject({type:'sort_bank'});expect(commands[0].id).toMatch(/^hud-sort-/);
 expect(c.MerchantActionsGUI.requestSort()).toBe(false);expect(commands).toHaveLength(1);
});
it('blocks running jobs, unavailable runtimes and dead characters, but permits retry after completion',()=>{
 const {c,commands,status}=setup();status('running');expect(c.MerchantActionsGUI.requestSort()).toBe(false);
 status('complete');expect(c.MerchantActionsGUI.requestSort()).toBe(true);
 status('idle');c.character.rip=true;expect(c.MerchantActionsGUI.requestSort()).toBe(false);
 c.character.rip=false;c.ALCCBankSorter=undefined;expect(c.MerchantActionsGUI.requestSort()).toBe(false);expect(commands).toHaveLength(1);
});

it('starts the cave for every farmer only on request, after leaving the party, and never during an expedition',async()=>{
 const {c}=setup();const sent:any[]=[];let left=0;let available=true;
 c.__ALCC={farmers:['Eadroma','Aedroma','Droma'],eventExpedition:{enabled:false}};c.character.party='Eadroma';
 c.send_cm=(to:any,data:any)=>sent.push([to,data]);c.leave_party=async()=>{left++;};c.cave_info=async()=>({available});
 expect(sent).toEqual([]);
 expect(await c.MerchantActionsGUI.requestCave()).toBe(true);
 expect(left).toBe(1);expect(sent[0]).toEqual([['Eadroma','Aedroma','Droma'],{t:'cave',a:'start'}]);
 expect(await c.MerchantActionsGUI.requestCave()).toBe(false);
 const used=setup().c;Object.assign(used,{__ALCC:c.__ALCC,send_cm:c.send_cm,leave_party:c.leave_party,cave_info:async()=>({available:false})});
 expect(await used.MerchantActionsGUI.requestCave()).toBe(false);expect(sent).toHaveLength(1);
 const busy=setup().c;Object.assign(busy,{__ALCC:{farmers:['Eadroma'],eventExpedition:{enabled:true}},send_cm:c.send_cm});
 expect(busy.MerchantActionsGUI.caveState().available).toBe(false);
});

it('recalls only an active expedition, without automatically recalling on install',()=>{
 const {c}=setup();let calls=0;let phase='engaging';c.EventExpedition={snapshot:()=>({phase}),recall:()=>{calls++;phase='returning';return true;}};
 expect(calls).toBe(0);expect(c.MerchantActionsGUI.requestRecall()).toBe(true);expect(calls).toBe(1);
 expect(c.MerchantActionsGUI.requestRecall()).toBe(false);phase='complete';expect(c.MerchantActionsGUI.requestRecall()).toBe(false);
 phase='forming';c.character.rip=true;expect(c.MerchantActionsGUI.requestRecall()).toBe(false);
});

it('starts the crypt for the whole trio only on request, and offers abort only while a run is active',()=>{
 const {c}=setup();let starts=0,aborts=0;let run:any=null;let missing:string[]=['Droma'];
 c.CryptSupply={snapshot:()=>run,missingRoster:()=>missing,keysAvailable:()=>true,start:()=>{starts++;run={phase:'ready',active:true,kills:{}};return true;},abort:()=>{aborts++;run={...run,phase:'aborted',active:false};return true;}};
 expect(starts).toBe(0);
 expect(c.MerchantActionsGUI.cryptState()).toMatchObject({available:false,reason:'Not ready: Droma'});
 expect(c.MerchantActionsGUI.requestCrypt()).toBe(false);
 missing=[];expect(c.MerchantActionsGUI.requestCrypt()).toBe(true);expect(starts).toBe(1);
 expect(c.MerchantActionsGUI.requestCrypt()).toBe(false);expect(starts).toBe(1);
 expect(c.MerchantActionsGUI.requestCryptAbort()).toBe(true);expect(aborts).toBe(1);
 expect(c.MerchantActionsGUI.requestCryptAbort()).toBe(false);
 c.CryptSupply=undefined;expect(c.MerchantActionsGUI.cryptState().reason).toBe('Crypt module is not loaded');
});
