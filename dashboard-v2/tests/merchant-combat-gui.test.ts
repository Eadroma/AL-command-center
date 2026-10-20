import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {expect,it} from 'vitest';import {sourceDir} from '../server/scripts';
const source=fs.readFileSync(path.join(sourceDir,'merchant-combat-gui.js'),'utf8');
function setup(){const c:any={Date:class extends Date {static now(){return 10000;}},character:{name:'Merchant'},CONFIG:{FARMERS:['Archer','Priest']},parent:{entities:{player2:{name:'Archer'}}}};vm.createContext(c);vm.runInContext(source,c);return c;}
it('counts actual team hits and incoming damage while excluding unrelated players and invalid counters',()=>{
 const c=setup(),hud=c.MerchantCombatGUI;hud.onHit({hid:'player2',id:'goo',damage:100});hud.onHit({hid:'Priest',id:'player2',heal:50});hud.onHit({hid:'goo',id:'player2',damage:25});hud.onHit({hid:'Stranger',id:'goo',damage:999});hud.onHit({hid:'Archer',damage:NaN,heal:true});
 expect(hud.model(20000).find((r:any)=>r.name==='Archer')).toMatchObject({damage:100,taken:25,dps:10,hits:1});
 expect(hud.model(20000).find((r:any)=>r.name==='Priest')).toMatchObject({healing:50,hps:5});expect(hud.model(20000)).toHaveLength(2);
});
it('keeps unobserved players absent and reset affects only local counters',()=>{const c=setup(),hud=c.MerchantCombatGUI;expect(hud.model(10000)).toEqual([]);hud.onHit({hid:'Archer',damage:10});expect(hud.model(10000)[0].dps).toBeNull();hud.reset();expect(hud.model(20000)).toEqual([]);});
it('removes its socket listener when stopped',()=>{const c=setup();let removed=false;c.parent.document={};c.parent.socket={on:()=>{},off:(event:string,fn:any)=>{removed=event==='hit'&&fn===c.MerchantCombatGUI.onHit;}};c.setInterval=()=>1;c.clearInterval=()=>{};c.MerchantCombatGUI.install();c.MerchantCombatGUI.stop();expect(removed).toBe(true);});
