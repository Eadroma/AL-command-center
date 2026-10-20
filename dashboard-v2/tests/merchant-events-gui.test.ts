import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {expect,it} from 'vitest';import {sourceDir} from '../server/scripts';
const source=fs.readFileSync(path.join(sourceDir,'merchant-events-gui.js'),'utf8');
const model=(S?:unknown)=>{const c:any={parent:{S}};vm.createContext(c);vm.runInContext(source,c);return c.MerchantEventsGUI.model(1800000000000);};
it('distinguishes missing announcements from a measured empty list',()=>{expect(model()).toBeNull();expect(model({})).toEqual([]);});
it('sorts active events first and preserves unknown HP and spawn times',()=>{
 const rows=model({mrgreen:{live:true,hp:500},franky:{live:false,spawn:1800000060000},icegolem:{active:true},misc:{foo:true}});
 expect(rows).toHaveLength(3);expect(rows[0].active).toBe(true);expect(rows[1].active).toBe(true);
 expect(rows.find((r:any)=>r.id==='franky')).toMatchObject({remaining:60000,hp:null});
 expect(rows.find((r:any)=>r.id==='icegolem')).toMatchObject({hp:null});
});
it('does not treat stale HP as an active boss after an explicit inactive announcement',()=>{
 expect(model({mrgreen:{live:false,hp:100}})[0].active).toBe(false);
});
it('fits the complete native boss sprite in its frame and reuses it on refresh',()=>{
 let calls=0;const sprite={style:{width:'192px',height:'208px'}};
 const c:any={parent:{sprite:(id:string,args:any)=>{expect(id).toBe('mrgreen');expect(args.full).toBe(true);calls++;return '<div></div>';}},G:{monsters:{mrgreen:{}}}};
 vm.createContext(c);vm.runInContext(source,c);
 c.parent.document={createElement:()=>({style:{},setAttribute(){},set innerHTML(_html:string){this.firstElementChild=sprite;},firstElementChild:null as any})};
 const icon=c.MerchantEventsGUI.bossIcon({id:'mrgreen',name:'Mr. Green'});
 expect(sprite.style).toMatchObject({transform:'scale(0.25)',left:'0px',top:'0px'});
 expect(c.MerchantEventsGUI.bossIcon({id:'mrgreen',name:'Mr. Green'})).toBe(icon);expect(calls).toBe(1);
 const fallback=c.MerchantEventsGUI.bossIcon({id:'unknown',name:'Unknown'});expect(fallback.textContent).toBe('?');
});
