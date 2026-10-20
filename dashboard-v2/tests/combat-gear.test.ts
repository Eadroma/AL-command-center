import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { buildBundle } from '../server/builder';
import { ast, sourceDir, initialProfile, scripts } from '../server/scripts';

function setup(movementItem = '') {
  let now = 10000;
  class Clock extends Date { static now() { return now; } }
  const callbacks: (() => void)[] = [], calls: string[] = [];
  const rule = { character: 'Droma', enabled: true, combatItem: 'handofmidas', combatMinLevel: 3, movementItem, movementMinLevel: 0 };
  const c: any = {
    Date: Clock, __ALCC: { automation: { combatGear: [rule] } },
    character: { name: 'Droma', x: 0, y: 0, map: 'main', range: 100, moving: false, items: [{ name: 'handofmidas', level: 3 }, { name: 'wgloves', level: 7 }, null], slots: { gloves: null }, target: 'm' },
    parent: { entities: { m: { id: 'm', type: 'monster', x: 20, y: 0, hp: 100 } } },
    G: { items: { handofmidas: { type: 'gloves' }, wgloves: { type: 'gloves' } } },
    is_disabled: () => false, setInterval: (fn: () => void) => { callbacks.push(fn); },
    attack: async () => { calls.push('attack'); }, use_skill: async () => { calls.push('skill'); },
    equip: async (index: number, slot: string) => { calls.push('equip:' + c.character.items[index].name); const old = c.character.slots[slot]; c.character.slots[slot] = c.character.items[index]; c.character.items[index] = old; },
    unequip: async (slot: string) => { calls.push('unequip'); const index = c.character.items.findIndex((i: any) => !i); c.character.items[index] = c.character.slots[slot]; c.character.slots[slot] = null; },
  };
  vm.runInNewContext(fs.readFileSync(path.join(sourceDir, 'combat-gear.js'), 'utf8'), c);
  return { c, gear: c.CombatGear, calls, advance: () => { now += 500; } };
}
describe('combat-only gloves', () => {
  it('equips Midas for rogue skills at skill range and removes them before movement starts', async () => {
    const { c, gear, calls, advance } = setup('wgloves');
    c.parent.entities.m.x = 140; gear.install();
    await new Promise(resolve => setTimeout(resolve, 0)); advance();
    await c.use_skill('fanofknives', ['m']);
    expect(c.character.slots.gloves.name).toBe('handofmidas');
    await gear.apply(true);
    expect(c.character.slots.gloves.name).toBe('wgloves');
    expect(calls).toContain('skill');
  });
  it('equips Midas stationary in range, removes it while moving even with a live target, and restores it in combat', async () => {
    const { c, gear, advance } = setup();
    await gear.apply(); expect(c.character.slots.gloves.name).toBe('handofmidas');
    c.character.moving = true; advance(); await gear.apply(); expect(c.character.slots.gloves).toBe(null);
    c.character.moving = false; advance(); await gear.apply(); expect(c.character.slots.gloves.name).toBe('handofmidas');
    c.parent.entities.m.x = 500; advance(); await gear.apply(); expect(c.character.slots.gloves).toBe(null);
  });
  it('uses travel gloves and owns the slot ahead of normal loadouts without repeated swaps', async () => {
    const { c, gear, calls, advance } = setup('wgloves');
    await gear.apply(); expect(gear.ownsSlot('gloves')).toBe(true); expect(gear.ownsSlot('offhand')).toBe(false);
    c.character.moving = true; advance(); await gear.apply(); expect(c.character.slots.gloves.name).toBe('wgloves');
    advance(); await gear.apply(); expect(calls.filter(s => s === 'equip:wgloves')).toHaveLength(1);
    c.CONFIG = { PACK_STYLE: {}, STYLE_LOADOUTS: {} };
    vm.runInNewContext(fs.readFileSync(path.join(sourceDir, 'style-loadout.js'), 'utf8'), c);
    advance(); await c.StyleLoadout.wear({ slot: 'gloves', item: 'handofmidas', minLevel: 3 });
    expect(c.character.slots.gloves.name).toBe('wgloves');
  });
  it('reports a full bag or missing travel pair and protects both item IDs in generated v2 code', async () => {
    const { c, gear, advance } = setup('wgloves');
    await gear.apply(); c.character.moving = true;
    c.character.items = [{ name: 'hpot0' }, { name: 'mpot0' }, { name: 'feather' }]; advance(); await gear.apply();
    expect(gear.snapshot().status).toContain('missing wgloves');
    c.character.items[2] = null; advance(); await gear.apply(); expect(c.character.slots.gloves).toBe(null);
    const p = initialProfile(scripts()); p.automation.combatGear = [{ character: 'Droma', enabled: true, combatItem: 'handofmidas', combatMinLevel: 3, movementItem: 'wgloves', movementMinLevel: 7 }];
    const built = await buildBundle(p, 'Droma');
    expect((built.config as any).KEEP_ITEMS ?? []).not.toContain('handofmidas');
    expect((built.config as any).KEEP_ITEMS ?? []).not.toContain('wgloves');
    expect((built.config as any).LOADOUT_ITEMS).toContainEqual({ item: 'handofmidas', minLevel: 3 });
    expect((built.config as any).LOADOUT_ITEMS).toContainEqual({ item: 'wgloves', minLevel: 7 });
    for (const script of ['droma-ranger-v2.js', 'droma-ranger-crab-aoe-v2.js']) {
      const source = fs.readFileSync(path.join(sourceDir, script), 'utf8');
      const declaration = ast(source).body.find((node: any) => node.type === 'FunctionDeclaration' && node.id.name === 'is_protected_item') as any;
      const context: any = { CONFIG: built.config };
      vm.runInNewContext(source.slice(declaration.start, declaration.end), context);
      expect(context.is_protected_item({ name: 'wgloves', level: 0 })).toBe(false);
      expect(context.is_protected_item({ name: 'wgloves', level: 7 })).toBe(true);
      expect(context.is_protected_item({ name: 'handofmidas', level: 2 })).toBe(false);
      expect(context.is_protected_item({ name: 'handofmidas', level: 3 })).toBe(true);
    }
    expect(built.code).toContain('CombatGear.install()');
  });
});
