import { expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { scripts, initialProfile, sourceDir } from '../server/scripts';
import { effectiveConfig } from '../server/builder';

it('gives the ranger seat to an enabled party rogue when the ranger is off', () => {
  const list = scripts(), p = initialProfile(list);
  for (const c of p.characters) if (c.ctype === 'ranger') c.enabled = false;
  const rogue = { name: 'Dromas', ctype: 'rogue', enabled: true, runtime: 'browser', script: 'dromas-rogue-party-v2', follow: 'Eadroma', events: true, job: 'hunt', farmMonster: '', overrides: {} } as any;
  p.characters = p.characters.filter(c => c.ctype !== 'rogue').concat([rogue]);
  const priest = p.characters.find(c => c.ctype === 'priest')!;
  const priestConfig: any = effectiveConfig(p, priest, list.find(s => s.id === priest.script)!);
  expect(priestConfig.RANGER).toBe('Dromas');
  expect(priestConfig.PARTY).toContain('Dromas');
  const own: any = effectiveConfig(p, rogue, list.find(s => s.id === 'dromas-rogue-party-v2')!);
  expect(own.NAME).toBe('Dromas');
  expect(own.WARRIOR).toBe('Eadroma');
});

it('treats Fan of Knives as an AOE skill that mono targets block', () => {
  const context: any = { character: { name: 'Dromas', ctype: 'rogue' }, CONFIG: { PACK_STYLE: { spider: 'mono', crab: 'aoe' } } };
  vm.runInNewContext(fs.readFileSync(path.join(sourceDir, 'style-loadout.js'), 'utf8'), context);
  expect(context.StyleLoadout.allows('fanofknives', 'spider')).toBe(false);
  expect(context.StyleLoadout.allows('fanofknives', 'crab')).toBe(true);
});
