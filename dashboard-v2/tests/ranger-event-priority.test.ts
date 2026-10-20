import { expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { sourceDir } from '../server/scripts';
const source = fs.readFileSync(path.join(sourceDir, 'event-router.js'), 'utf8');
it('keeps attacking a tanked Pumpkin while Green is idle, and switches when Green is engaged', () => {
  const pumpkin = { type: 'monster', mtype: 'mrpumpkin', visible: true, target: 'Ynhi', id: 'pumpkin' };
  const statuses: any = { mrgreen: { live: true, map: 'spookytown' }, mrpumpkin: { live: true, map: 'halloween', target: 'Ynhi' } };
  let green: any = null;
  const context = { __ALCC: { eventsEnabled: true, events: ['mrpumpkin', 'mrgreen'] }, character: { name: 'Droma', ctype: 'ranger', map: 'halloween' }, server: { status: statuses }, get_nearest_monster: ({ type }: { type: string }) => type === 'mrpumpkin' ? pumpkin : green };
  const router = vm.runInNewContext(`${source}\nEventRouter`, context);
  expect(router.next().id).toBe('mrpumpkin');
  expect(router.canEngage(pumpkin)).toBe(true);
  statuses.mrgreen.target = 'Tank';
  expect(router.next().id).toBe('mrgreen');
  green = { target: '' };
  expect(router.next().id).toBe('mrpumpkin'); // visible idle state overrides stale server status
  green = null; statuses.mrgreen.target = ''; statuses.mrpumpkin.target = ''; pumpkin.target = '';
  expect(router.next().id).toBe('mrgreen'); // wait for a tank if all bosses are idle
  expect(router.canEngage(pumpkin)).toBe(false);
});
