import fs from 'node:fs';
import vm from 'node:vm';
import {expect,it} from 'vitest';
import {sourceDir} from '../server/scripts';
import path from 'node:path';
const source=fs.readFileSync(path.join(sourceDir,'bank-coordinator.js'),'utf8');
function fixture(saved:any={}) {
 const c:any={character:{name:'Merchant',map:'bank',items:[{name:'coat',level:9}],bank:{items0:[{name:'coat',level:9},{name:'coat',level:9},{name:'coat',level:9},{name:'coat',level:9,l:true}]}},Date,get:(key:string)=>saved[key],set:(key:string,value:any)=>saved[key]=structuredClone(value),cc_listings:()=>[{item:'coat',level:9,bankReserve:2}]};
 vm.createContext(c);vm.runInContext(source,c);return {c,saved,hub:c.BankCoordinator,stock:c.BankStock};
}
it('serializes navigation while failures never retain an evidence hold',async()=>{
 const {hub}=fixture();expect(hub.acquire('deposit')).toBe(true);expect(hub.acquire('sort')).toBe(false);
 hub.begin('deposit','coat',9,1,'items0');hub.finish(false,'Request failed');expect(hub.snapshot().current).toBeNull();expect(hub.release('deposit')).toBe(true);expect(hub.acquire('sort')).toBe(true);
 expect(hub.snapshot().journal.at(-1)).toMatchObject({state:'review',evidence:'Request failed'});expect(hub.reserved({name:'coat'})).toBe(false);
});
it('archives legacy review during startup and permits sorting',()=>{
 const f=fixture();f.hub.begin('deposit','coat',9,1,'items0');
 const restart=fixture(f.saved);expect(restart.hub.snapshot().current).toBeNull();expect(restart.hub.acquire('sort')).toBe(true);expect(restart.hub.snapshot().journal.at(-1).evidence).toContain('Legacy evidence hold removed');
});
it('retains stock reservations and compatible listing reserves',()=>{
 const {stock}=fixture();stock.observe();expect(stock.snapshot().stock[0]).toMatchObject({quantity:4,eligible:3,minimum:2,availableForStand:1});
});
