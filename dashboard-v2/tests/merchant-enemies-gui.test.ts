import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {expect,it} from 'vitest';import {sourceDir} from '../server/scripts';
const source=fs.readFileSync(path.join(sourceDir,'merchant-enemies-gui.js'),'utf8');
function model(entities:object){const c:any={character:{id:'merchant-id',name:'Merchant',map:'main',x:0,y:0},CONFIG:{FARMERS:['Archer']},parent:{entities}};vm.createContext(c);vm.runInContext(source,c);return c.MerchantEnemiesGUI.model();}
it('excludes dead, hidden, cross-map and non-monster entities',()=>{
 const monster={type:'monster',mtype:'goo',hp:10,x:3,y:4};
 expect(model({a:{...monster,dead:true},b:{...monster,visible:false},c:{...monster,hp:0},d:{...monster,map:'cave'},e:{type:'character'},f:monster})).toHaveLength(1);
});
it('sorts observed team aggro first and resolves target entity names',()=>{
 const rows=model({farmer:{type:'character',name:'Archer'},near:{type:'monster',hp:5,x:0,y:1},danger:{type:'monster',target:'farmer',hp:10,x:30,y:40},self:{type:'monster',target:'merchant-id'}});
 expect(rows.slice(0,2).every((row:any)=>row.team)).toBe(true);
 expect(rows.find((row:any)=>row.id==='danger')).toMatchObject({target:'Archer',distance:50,team:true});
 expect(rows.find((row:any)=>row.id==='self')).toMatchObject({self:true,hp:null,distance:null});
});
it('does not invent merchant aggro when both entity target and character id are missing',()=>{
 const c:any={character:{name:'Merchant',map:'main'},parent:{entities:{goo:{type:'monster',hp:20}}}};
 vm.createContext(c);vm.runInContext(source,c);
 expect(c.MerchantEnemiesGUI.model()[0]).toMatchObject({team:false,self:false,target:''});
});
