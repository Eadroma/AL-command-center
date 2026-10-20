import { expect, it } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { sourceDir } from '../server/scripts';
import { ast } from '../server/scripts';

it('does not fall through to the standalone stand walk during an exchange batch', async () => {
  const source = fs.readFileSync(path.join(sourceDir, 'eadrosell-merchant-v2.js'), 'utf8');
  const node: any = ast(source).body.find((entry: any) => entry.type === 'FunctionDeclaration' && entry.id.name === 'standLoop');
  const pause = new Error('stop test loop');
  const movement: string[] = [];
  const run = vm.runInNewContext(`(${source.slice(node.start, node.end)})`, {
    character: { rip: false }, refresh_production_trip: () => 'exchange',
    sleep: async () => { throw pause; }, game_log: () => {},
    walk_to: async () => movement.push('stand'), chores_in_progress: false,
  });
  await expect(run()).rejects.toBe(pause);
  expect(movement).toEqual([]);
});

it('drains the current NPC batch before switching, and releases blocked or dead trips', () => {
  const source = fs.readFileSync(path.join(sourceDir, 'eadrosell-merchant-v2.js'), 'utf8');
  const start = source.indexOf('var production_trip = null;');
  const end = source.indexOf('/** Only block the stand', start);
  let exchange = true, space = 2, bank = false;
  const context: any = {
    exchange_space_paused: () => false,
    character: { rip: false, items: [] }, chores_in_progress: false, bank_dump_active: false,
    merchant_work_next: () => 'exchange', cc_exchange_enabled: () => true, cc_npc_enabled: () => true, locate_sell_item: () => -1,
    free_slots: () => space, locate_exchange_item: () => exchange ? 0 : -1,
    near_point: () => false,
    should_bank_item: () => bank, SHOP_XY: { newupgrade: {} },
  };
  vm.runInNewContext(source.slice(start, end), context);
  expect(context.refresh_production_trip()).toBe('exchange');
  expect(context.refresh_production_trip()).toBe('exchange');
  exchange = false;
  expect(context.refresh_production_trip()).toBeNull();
  exchange = true;
  expect(context.refresh_production_trip()).toBe('exchange');
  space = 0;
  expect(context.refresh_production_trip()).toBeNull();
  space = 2;
  expect(context.refresh_production_trip()).toBe('exchange');
  bank = true; context.character.items = [{}];
  expect(context.refresh_production_trip()).toBe('exchange');
  space = 0;
  expect(context.refresh_production_trip()).toBeNull();
  bank = false; context.character.rip = true;
  expect(context.refresh_production_trip()).toBeNull();
});
