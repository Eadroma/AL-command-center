import { expect, it } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { sourceDir, initialProfile, scripts } from '../server/scripts';
import { profileSchema } from '../shared/schema';
import { simulateUpgrade } from '../src/models/upgrade-simulation';
function setup() {
  const values: Record<string, any> = {};
  const context: any = { game_log: () => {}, character: { name: 'Seller' }, __ALCC: { profile: 'test', upgrade: { rules: [{ item: 'coat', maxLevel: 7, production: { enabled: true, budget: 10000, quantity: 1, runId: 'one' } }] } }, get: (key: string) => values[key], set: (key: string, value: any) => { values[key] = structuredClone(value); } };
  vm.createContext(context); vm.runInContext(fs.readFileSync(path.join(sourceDir, 'upgrade-production.js'), 'utf8'), context);
  return { context, values, runtime: context.UpgradeProduction };
}
it('reserves before spending, enforces the cap and counts only finished pieces', () => {
  const { runtime } = setup();
  const first = runtime.begin('coat', 6000); expect(runtime.allowed('coat', 1)).toBe(false);
  runtime.settle(first, false); expect(runtime.allowed('coat', 4001)).toBe(false);
  const second = runtime.begin('coat', 1000); runtime.settle(second, true);
  expect(runtime.allowed('coat', 0)).toBe(false);
  expect(runtime.snapshot()[0]).toMatchObject({ spent: 7000, produced: 1, pending: false });
});
it('preserves pending reservations across CODE restart and isolates new runs', () => {
  const { context, runtime } = setup(); runtime.begin('coat', 6000);
  vm.runInContext(fs.readFileSync(path.join(sourceDir, 'upgrade-production.js'), 'utf8'), context);
  expect(context.UpgradeProduction.allowed('coat', 1)).toBe(false);
  context.__ALCC.upgrade.rules[0].production.runId = 'two';
  expect(context.UpgradeProduction.allowed('coat', 6000)).toBe(true);
});
it('keeps unbounded legacy rules working and accepts the bounded profile', () => {
  const p = initialProfile(scripts()); p.seller.upgrade.rules = [{ item: 'coat', maxLevel: 7, buyNpc: true, production: { enabled: true, quantity: 2, budget: 200000, runId: 'run' } }];
  expect(profileSchema.parse(p).seller.upgrade.rules[0].production?.budget).toBe(200000);
  expect(setup().runtime.allowed('other', 99999999)).toBe(true);
});
it('calculates restart-on-destruction expected cost and rejects incomplete assumptions', () => {
  expect(simulateUpgrade(100, [{ probability: .5, scrollCost: 10 }, { probability: .5, scrollCost: 10 }])).toEqual({ chancePerBase: .25, expectedBases: 4, expectedDestroyed: 3, expectedScrolls: 6, expectedCost: 460 });
  expect(simulateUpgrade(100, [{ probability: 0, scrollCost: 10 }])).toBeNull();
  expect(simulateUpgrade(100, [{ probability: .5, scrollCost: NaN }])).toBeNull();
});

it('journals successful intermediate upgrades and destruction separately from output', () => {
  const { runtime } = setup();
  runtime.settle(runtime.begin('coat', 100, { kind: 'upgrade', level: 2 }), false, 'success');
  runtime.settle(runtime.begin('coat', 200, { kind: 'upgrade', level: 2 }), false, 'destroyed');
  expect(runtime.history().totals[0]).toMatchObject({ attempts: 2, successes: 1, destroyed: 1, cost: 300, pendingCost: 0 });
  expect(runtime.snapshot()[0].produced).toBe(0);
});
it('resolves only the verified current action, preserves prior counters and rejects repeats', () => {
  const { runtime } = setup();
  runtime.settle(runtime.begin('coat', 100), false, 'destroyed');
  runtime.begin('coat', 200, { kind: 'upgrade', level: 6 });
  const action = runtime.snapshot()[0].action;
  const resolution = { item: 'coat', runId: 'one', actionId: action.id, outcome: 'success', verified: true };
  expect(runtime.resolve({ resolution: { ...resolution, actionId: 'old' } })).toBe(false);
  expect(runtime.resolve({ resolution: { ...resolution, verified: false } })).toBe(false);
  expect(runtime.resolve({ resolution })).toBe(true);
  expect(runtime.resolve({ resolution })).toBe(false);
  expect(runtime.snapshot()[0]).toMatchObject({ spent: 300, produced: 1, pending: false });
  expect(runtime.history().entries[1]).toMatchObject({ outcome: 'success', manual: true });
});
it('releases only the nonexecuted purchase reservation and clears its separate guard', () => {
  const { runtime, context } = setup();
  context.game_log = () => {};
  context.upgrade_purchase_state = { coat: { pending: true } };
  runtime.settle(runtime.begin('coat', 100), false, 'destroyed');
  runtime.begin('coat', 200, { kind: 'purchase' });
  expect(runtime.resolve({ resolution: { item: 'coat', runId: 'one', actionId: runtime.snapshot()[0].action.id, outcome: 'not_executed', verified: true } })).toBe(true);
  expect(runtime.snapshot()[0]).toMatchObject({ spent: 100, produced: 0, pending: false });
  expect(context.upgrade_purchase_state.coat).toBeUndefined();
  expect(runtime.history().totals.find((t: any) => t.kind === 'purchase')).toMatchObject({ attempts: 0, cost: 0, pendingCost: 0 });
});


it('pauses and resumes across restart without resetting production counters',()=>{
 const {context,runtime}=setup();runtime.settle(runtime.begin('coat',100),false,'success');const before=runtime.snapshot()[0];context.set('alcc:upgrade-pauses:Seller',{coat:true});expect(runtime.allowed('coat',1)).toBe(false);vm.runInContext(fs.readFileSync(path.join(sourceDir,'upgrade-production.js'),'utf8'),context);expect(context.UpgradeProduction.allowed('coat',1)).toBe(false);context.set('alcc:upgrade-pauses:Seller',{coat:false});expect(context.UpgradeProduction.allowed('coat',1)).toBe(true);expect(context.UpgradeProduction.snapshot()[0]).toMatchObject({spent:before.spent,produced:before.produced,runId:before.runId});
});
