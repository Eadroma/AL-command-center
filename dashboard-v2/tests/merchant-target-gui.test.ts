import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {expect,it} from 'vitest';import {sourceDir} from '../server/scripts';
const source=fs.readFileSync(path.join(sourceDir,'merchant-target-gui.js'),'utf8');
function setup(extra:Record<string,unknown>={}){const c:any={character:{name:'Merchant',map:'main',x:0,y:0,range:100,target:'mob1'},parent:{entities:{}},...extra};vm.createContext(c);vm.runInContext(source,c);return c.MerchantTargetGUI;}
it('reads selection, including measured zero HP, without any targeting command',()=>{
 const target={id:'mob1',mtype:'goo',visible:true,hp:0,max_hp:100,x:30,y:40,target:'Warrior',s:{burned:{}}};
 const hud=setup({get_target:()=>target,G:{monsters:{goo:{name:'Green Goo'}}}});
 expect(hud.model()).toMatchObject({name:'Green Goo',hp:0,maxHp:100,distance:50,target:'Warrior',effects:['burned']});
});
it('keeps missing stats and cross-map distances unknown',()=>{
 expect(setup({parent:{ctarget:{visible:true,name:'Priest',map:'spookytown',x:30,y:40}}}).model()).toMatchObject({hp:null,mp:null,distance:null});
 expect(setup({parent:{ctarget:{visible:false}}}).model()).toBeNull();
 expect(setup().model()).toBeNull();
});
