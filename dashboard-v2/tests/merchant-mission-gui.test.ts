import { expect,it } from 'vitest';
it('deduplicates legacy launcher entries across separate CODE contexts',()=>{
 const saved:any={};
 const node=()=>({id:'',title:'',textContent:'',style:{},children:[] as any[],parentNode:null as any,listeners:{} as any,appendChild(child:any){child.parentNode=this;this.children.push(child);},addEventListener(key:string,fn:any){this.listeners[key]=fn;},setAttribute(){},remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter((child:any)=>child!==this);}});
 const body=node(),launcher=node();launcher.id='alcc-hud-launcher';body.appendChild(launcher);
 const legacy=node();legacy.textContent='Queue · visible';launcher.appendChild(legacy);
 const doc={body,createElement:node,getElementById:(id:string)=>[body,launcher,...launcher.children].find(n=>n.id===id)};
 const handle=node();let panel:any;
 for(let reload=0;reload<3;reload++){
  const c:any={character:{name:'Merchant'},parent:{localStorage:{getItem:(key:string)=>saved[key],setItem:(key:string,value:string)=>saved[key]=value}}};vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(sourceDir,'merchant-mission-gui.js'),'utf8'),c);c.parent.document=doc;
  panel={id:'queue',style:{}};c.MerchantMissionGUI.makeCloseable(panel,handle,'Queue');
  expect(launcher.children).toHaveLength(1);expect(handle.children).toHaveLength(1);
 }
 handle.children[0].listeners.click({preventDefault(){},stopPropagation(){}});expect(panel.style.display).toBe('none');
 launcher.children[0].listeners.click();expect(panel.style.display).toBe('');
});
import fs from 'node:fs';import vm from 'node:vm';import path from 'node:path';import {sourceDir} from '../server/scripts';
it('explains readiness and stale reports without claiming a boss kill',()=>{const c:any={parent:{}};vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(sourceDir,'merchant-mission-gui.js'),'utf8'),c);const now=20000;expect(c.MerchantMissionGUI.describe({phase:'forming',event:'mrgreen',participants:[{name:'Priest',online:true,reportedAt:now,readinessReason:'HP 40%; needs 70%',deaths:0}]},now).join(' ')).toContain('HP 40%');expect(c.MerchantMissionGUI.describe({phase:'complete',participants:[]},now)[0]).toContain('boss kill not verified');expect(c.MerchantMissionGUI.describe({phase:'forming',participants:[{name:'Priest',online:true,reportedAt:1,deaths:0}]},now).join(' ')).toContain('Report stale');});

it('keeps dragged coordinates within the viewport even when the panel is larger',()=>{const c:any={parent:{}};vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(sourceDir,'merchant-mission-gui.js'),'utf8'),c);expect(c.MerchantMissionGUI.clampPosition(-5,900,290,300,1280,720)).toEqual({x:0,y:420});expect(c.MerchantMissionGUI.clampPosition(500,500,290,300,200,200)).toEqual({x:0,y:0});});

it('moves a freshly bound header, persists coordinates and suppresses collapse after dragging',()=>{
 const listeners:any={}, saved:any={}; const panel:any={id:'test',style:{resize:'both'},getBoundingClientRect:()=>({left:10,top:20,width:300,height:200})};
 const handle:any={dataset:{},style:{},addEventListener:(name:string,fn:any)=>listeners[name]=fn,setPointerCapture:()=>{}};
 const c:any={character:{name:'Merchant'},parent:{innerWidth:1000,innerHeight:800,localStorage:{getItem:()=>null,setItem:(key:string,value:string)=>saved[key]=JSON.parse(value)}}};
 vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(sourceDir,'merchant-mission-gui.js'),'utf8'),c);c.MerchantMissionGUI.makeMovable(panel,handle);
 listeners.pointerdown({button:0,pointerId:1,clientX:20,clientY:30});listeners.pointermove({pointerId:1,clientX:70,clientY:80});expect(panel.style.left).toBe('60px');expect(panel.style.top).toBe('70px');listeners.pointerup({pointerId:1});expect(Object.keys(saved)).toHaveLength(1);let prevented=false;listeners.click({preventDefault:()=>prevented=true,stopPropagation:()=>{}});expect(prevented).toBe(true);
});
it('persists closed panels and reopens them from the HUD menu',()=>{
 const nodes:any={},saved:any={};
 const node=()=>({style:{},children:[] as any[],listeners:{} as any,appendChild(n:any){this.children.push(n);if(n.id)nodes[n.id]=n;},addEventListener(k:string,fn:any){this.listeners[k]=fn;},setAttribute(){},remove(){}});
 const doc:any={getElementById:(id:string)=>nodes[id],createElement:node,body:node()};
 const c:any={character:{name:'Merchant'},parent:{localStorage:{getItem:(k:string)=>saved[k],setItem:(k:string,v:string)=>saved[k]=v}}};
 vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(sourceDir,'merchant-mission-gui.js'),'utf8'),c);c.parent.document=doc;
 const panel:any={id:'queue',style:{}},handle=node();c.MerchantMissionGUI.makeCloseable(panel,handle,'Queue');
 handle.children[0].listeners.click({preventDefault(){},stopPropagation(){}});expect(panel.style.display).toBe('none');
 const replacement:any={id:'queue',style:{}};c.MerchantMissionGUI.makeCloseable(replacement,node(),'Queue');expect(replacement.style.display).toBe('none');
 nodes['alcc-hud-launcher'].children.at(-1).listeners.click();expect(replacement.style.display).toBe('');expect(saved['alcc:hud-hidden:Merchant:queue']).toBe('false');
});
