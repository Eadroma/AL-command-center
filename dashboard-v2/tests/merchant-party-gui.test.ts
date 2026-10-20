import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { expect, it } from 'vitest';
import { sourceDir } from '../server/scripts';
const source=fs.readFileSync(path.join(sourceDir,'merchant-party-gui.js'),'utf8');
function context(extra:Record<string,unknown>={}) {
 const c:any={character:{name:'Merchant',ctype:'merchant',hp:100,max_hp:200,mp:0,max_mp:100,map:'main'},parent:{entities:{}},CONFIG:{FARMERS:['Archer','Priest']},...extra};
 vm.createContext(c);vm.runInContext(source,c);return c;
}
it('keeps unobserved characters unknown instead of showing zero health or offline',()=>{
 const c=context({farmer_reports:{Archer:{at:5000,map:'spookytown',hpot:0,mpot:100}}});
 const rows=c.MerchantPartyGUI.model(10000);
 expect(rows[0]).toMatchObject({name:'Merchant',hp:100,mp:0,source:'Self'});
 expect(rows[1]).toMatchObject({name:'Archer',hp:null,mp:null,source:'Recent report',map:'spookytown',hpot:0});
 expect(rows[2]).toMatchObject({name:'Priest',hp:null,source:'Out of sight'});
});
it('prefers visible game entities and labels older potion reports',()=>{
 const c=context({parent:{entities:{player7:{name:'Archer',visible:true,hp:50,max_hp:100,mp:20,max_mp:30,s:{mluck:{ms:1000}},target:'crab1'}}},farmer_reports:{Priest:{at:1000,map:'main'}}});
 const rows=c.MerchantPartyGUI.model(30000);
 expect(rows[1]).toMatchObject({hp:50,source:'Visible nearby',target:'crab1',effects:['mluck']});
 expect(rows[2]).toMatchObject({source:'Old report',age:29000,hp:null});
});
it('never starts a timer or requires DOM APIs in headless CODE',()=>{
 const c=context({setInterval:()=>{throw Error('Unexpected timer');}});
 expect(c.MerchantPartyGUI).toBeTruthy();
});
it('can render before the merchant CONFIG is initialized by the generated bundle',()=>{
 const c=context({CONFIG:undefined,supply_farmer_names:()=>{throw Error('CONFIG is not ready');}});
 expect(c.MerchantPartyGUI.model(10000)).toHaveLength(1);
});
it('does not block startup when mission reports depend on uninitialized merchant globals',()=>{
 const c=context({EventExpedition:{snapshot:()=>{throw Error('farmer_reports is not initialized');}}});
 expect(c.MerchantPartyGUI.model(10000)[0].name).toBe('Merchant');
});
