import { expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { profileSchema, loadoutOptions } from '../shared/schema';
import { scripts, initialProfile, sourceDir } from '../server/scripts';
import { effectiveConfig } from '../server/builder';

it('persists named builds, offers them globally and protects their items in injected configuration', () => {
  const list = scripts(), p = initialProfile(list);
  const c = p.characters.find(c => c.ctype === 'warrior')!;
  c.script = 'eadroma-warrior-v2';
  p.farming.loadouts[c.name] = { aoe: { gear: [], skills: [] }, mono: { gear: [], skills: [] }, tank: { gear: [], skills: [] }, franky_gold: { base: 'mono', gear: [{ slot: 'gloves', item: 'handofmidas', minLevel: 3 }], skills: ['warcry'] } };
  p.farming.style.franky = 'franky_gold';
  p.events.style.franky = 'franky_gold';
  const restored = profileSchema.parse(p);
  expect(loadoutOptions(restored).some(option => option.value === 'franky_gold')).toBe(true);
  const config: any = effectiveConfig(restored, c, list.find(s => s.id === c.script)!);
  expect(config.STYLE_LOADOUTS.franky_gold.skills).toEqual(['warcry']);
  expect(config.LOADOUT_ITEMS).toContainEqual({item:'handofmidas',minLevel:3});
  expect(config.WEAPONS.pack.franky).toBe('fireblade');
});

it('applies named builds while keeping their inherited single-target skill defaults', () => {
  const context: any = { character: { name: 'Ranger' }, CONFIG: { PACK_STYLE: { franky: 'gold' }, STYLE_LOADOUTS: { gold: { base: 'mono', gear: [{ slot: 'gloves', item: 'handofmidas' }], skills: [] } } } };
  vm.runInNewContext(fs.readFileSync(path.join(sourceDir, 'style-loadout.js'), 'utf8'), context);
  expect(context.StyleLoadout.mode('franky')).toBe('gold');
  expect(context.StyleLoadout.hasSlot('gloves', 'franky')).toBe(true);
  expect(context.StyleLoadout.isAoe('franky')).toBe(false);
  expect(context.StyleLoadout.allows('3shot', 'franky')).toBe(false);
  expect(context.StyleLoadout.allows('supershot', 'franky')).toBe(true);
});

it('targets Franky rather than surrounding One Eyes, retaining other event map enemies', () => {
  const source = fs.readFileSync(path.join(sourceDir, 'event-router.js'), 'utf8');
  const start = source.indexOf('function accepts(entity)'), end = source.indexOf('function visible_event_enemy()', start);
  let route = { id: 'franky', kind: 'join', map: 'level2' };
  const accepts = vm.runInNewContext(`(${source.slice(start, end)})`, { next: () => route, EVENT_MONSTERS: {}, character: { map: 'level2' } });
  expect(accepts({ type: 'monster', visible: true, mtype: 'oneeye' })).toBe(false);
  expect(accepts({ type: 'monster', visible: true, mtype: 'franky' })).toBe(true);
  route = { id: 'goobrawl', kind: 'join', map: 'level2' };
  expect(accepts({ type: 'monster', visible: true, mtype: 'bgoo' })).toBe(true);
});
