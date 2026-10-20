import { expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { ast, sourceDir } from '../server/scripts';

const source = fs.readFileSync(path.join(sourceDir, 'eadrosell-merchant-v2.js'), 'utf8');
function merchant(feathers: number, enabled = true) {
  const context = {
    character: { items: [{ name: 'feather', q: feathers }] },
    G: { items: { shoes: { g: 100 } }, npcs: { basics: { role: 'merchant', items: ['shoes'] } }, craft: { wingedboots: { items: [[1, 'shoes', 0], [20, 'feather', 0]] } } },
    cc_craft_enabled: () => enabled,
    cc_craft_rules: () => [{ item: 'wingedboots' }],
    item_owned: () => true,
    upgrade_target_complete: () => false,
    cc_npc_items: () => ['shoes'],
    cc_upgrade_enabled: () => false,
  };
  vm.createContext(context);
  const names = ['craft_item_reserved', 'craft_shop_for', 'item_count_level', 'should_sell'];
  vm.runInContext(ast(source).body.filter((node: any) => node.type === 'FunctionDeclaration' && names.includes(node.id.name)).map((node: any) => source.slice(node.start, node.end)).join('\n'), context);
  return context as typeof context & { should_sell: (item: object) => boolean; craft_item_reserved: (name: string, level: number) => boolean };
}

it('allows the configured NPC sale of shoes until a full feather batch is available', () => {
  expect(merchant(0).should_sell({ name: 'shoes' })).toBe(true);
  expect(merchant(19).should_sell({ name: 'shoes', level: 0 })).toBe(true);
  expect(merchant(20).should_sell({ name: 'shoes', level: 0 })).toBe(false);
  expect(merchant(40).should_sell({ name: 'shoes', level: 0 })).toBe(false);
});

it('does not reserve upgraded shoes for a base-level recipe', () => {
  expect(merchant(20).should_sell({ name: 'shoes', level: 1 })).toBe(true);
});

it('keeps dropped ingredients and outputs, and releases reservations when craft is disabled', () => {
  const active = merchant(19);
  expect(active.craft_item_reserved('feather', 0)).toBe(true);
  expect(active.craft_item_reserved('wingedboots', 0)).toBe(true);
  expect(merchant(20, false).should_sell({ name: 'shoes' })).toBe(true);
});
