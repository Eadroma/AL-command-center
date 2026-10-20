import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { expect, it } from 'vitest';
import { ast, sourceDir } from '../server/scripts';
const source = fs.readFileSync(path.join(sourceDir, 'eadroma-warrior-v2.js'), 'utf8');
const functions = ast(source).body.filter((n: any) => n.type === 'FunctionDeclaration' && ['is_potion', 'get_max_keep', 'get_equipped_count', 'is_dumpable_slot'].includes(n.id.name)).map((n: any) => source.slice(n.start, n.end)).join('\n');
function classify(items: any[], slots = {}, loadouts: any[] = []) {
 const context = { character: { items, slots }, CONFIG: { KEEP_ITEMS: ['ololipop', 'glolipop', 'fireblade'], LOADOUT_ITEMS: loadouts } };
 return vm.runInNewContext(functions + '\ncharacter.items.map(function(_, i){return is_dumpable_slot(i);})', context);
}
it('gives the +0 lollipop while keeping the +7 even when the weaker copy comes first', () => {
 expect(classify([{name:'ololipop',level:0},{name:'ololipop',level:7}], {mainhand:{name:'fireblade',level:8}}, [{item:'ololipop',minLevel:7}])).toEqual([true,false]);
});
it('keeps the strongest fallback weapon without explicit loadouts and honors locks', () => {
 expect(classify([{name:'ololipop',level:0},{name:'ololipop',level:7}])).toEqual([true,false]);
 expect(classify([{name:'ololipop',level:0,l:true},{name:'ololipop',level:7}])).toEqual([false,false]);
});
it('keeps two strongest fireblades for dual wield and dumps a weaker third copy', () => {
 expect(classify([{name:'fireblade',level:0},{name:'fireblade',level:7},{name:'fireblade',level:8}])).toEqual([true,false,false]);
});
