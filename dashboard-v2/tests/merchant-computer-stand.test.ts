import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { expect, it } from 'vitest';
import { ast, sourceDir } from '../server/scripts';
const source=fs.readFileSync(path.join(sourceDir,'eadrosell-merchant-v2.js'),'utf8');
const selector:any=ast(source).body.find((node:any)=>node.type==='FunctionDeclaration'&&node.id.name==='merchant_stand_item_slot');
const select=(items:unknown[])=>vm.runInNewContext(`(${source.slice(selector.start,selector.end)})()`,{character:{items}});
it('prefers the Super Computer, then Computer, and preserves a normal stand fallback',()=>{
 expect(select([{name:'stand0'},{name:'computer'},{name:'supercomputer'}])).toBe(2);
 expect(select([{name:'computer'},{name:'stand0'}])).toBe(0);
 expect(select([null,{name:'stand0'}])).toBe(1);
 expect(select([{name:'tracker'}])).toBe(-1);
});
