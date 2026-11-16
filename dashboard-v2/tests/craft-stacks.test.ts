import { expect, it } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { sourceDir, ast } from '../server/scripts';

it('merges split ingredient stacks before crafting, and leaves a stack that already suffices alone', async () => {
  const source = fs.readFileSync(path.join(sourceDir, 'eadrosell-merchant-v2.js'), 'utf8');
  const items: any[] = [{ name: 'seashell', q: 1 }, null, { name: 'seashell', q: 7 }, { name: 'reefglass', q: 2 }, { name: 'reefglass', q: 1 }];
  const swaps: number[][] = [];
  const c: any = { character: { items }, sleep: async () => {}, swap: async (a: number, b: number) => { swaps.push([a, b]); items[b] = { ...items[b], q: items[b].q + items[a].q }; items[a] = null; } };
  vm.createContext(c);
  vm.runInContext(ast(source).body.filter((n: any) => n.type === 'FunctionDeclaration' && n.id.name === 'merge_craft_stacks').map((n: any) => source.slice(n.start, n.end)).join(''), c);
  await c.merge_craft_stacks({ items: [[8, 'seashell'], [2, 'reefglass']] });
  expect(swaps).toEqual([[2, 0]]);
  expect(items[0]).toEqual({ name: 'seashell', q: 8 });
});
