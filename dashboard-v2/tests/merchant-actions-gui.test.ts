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

it('recalls only an active expedition, without automatically recalling on install',()=>{
 const {c}=setup();let calls=0;let phase='engaging';c.EventExpedition={snapshot:()=>({phase}),recall:()=>{calls++;phase='returning';return true;}};
 expect(calls).toBe(0);expect(c.MerchantActionsGUI.requestRecall()).toBe(true);expect(calls).toBe(1);
 expect(c.MerchantActionsGUI.requestRecall()).toBe(false);phase='complete';expect(c.MerchantActionsGUI.requestRecall()).toBe(false);
 phase='forming';c.character.rip=true;expect(c.MerchantActionsGUI.requestRecall()).toBe(false);
});
