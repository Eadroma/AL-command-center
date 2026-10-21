import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

function setup() {
  let now = 100000;
  const values: Record<string, unknown> = {};
  const context = { Date: { now: () => now }, Math, game_log: () => {}, character: { name: 'Seller', map: 'main', gold: 10000, items: [{ name: 'coat', level: 6, q: 1 }, { name: 'scroll1', level: 0, q: 5 }, { name: 'offeringp', level: 0, q: 3 }], q: {} as Record<string, unknown> }, __ALCC: { profile: 'test', upgrade: { rules: [{ item: 'coat', maxLevel: 7, production: { enabled: true, runId: 'one', budget: 10000, quantity: 1 } }] } }, get: (k: string) => values[k], set: (k: string, v: unknown) => { values[k] = JSON.parse(JSON.stringify(v)); } };
  const sandbox = vm.createContext(context);
  vm.runInContext(readFileSync(new URL('../../code/upgrade-production.js', import.meta.url), 'utf8'), sandbox);
  const runtime = sandbox.UpgradeProduction;
  return { context, runtime, advance: (ms: number) => { now += ms; }, begin: () => runtime.begin('coat', 1600, { kind: 'upgrade', level: 6, scroll: 'scroll1', offering: 'offeringp' }) };
}
describe('automatic transaction reconciliation', () => {
  it('confirms exact late success once and preserves spending', () => {
    const s = setup(); s.begin(); s.context.character.items[0].level = 7; s.context.character.items[1].q--; s.context.character.items[2].q--; s.advance(16000); s.runtime.reconcile(); s.runtime.reconcile();
    expect(s.runtime.snapshot()[0]).toMatchObject({ pending: false, produced: 1, spent: 1600, action: { automatic: true, outcome: 'success' } });
    expect(s.runtime.history().totals[0].successes).toBe(1);
  });
  it('requires consumption of the selected offering', () => {
    const s = setup(); s.begin(); s.context.character.items[0].level = 7; s.context.character.items[1].q--; s.advance(61000); s.runtime.reconcile();
    expect(s.runtime.snapshot()[0]).toMatchObject({ pending: true, produced: 0, reviewReason: 'Inventory changes do not prove a unique outcome' });
    expect(s.runtime.reserved('coat')).toBe(true);
  });
  it('does not infer destruction or no execution from inventory alone', () => {
    const s = setup(); s.begin(); s.context.character.items.shift(); s.advance(61000); s.runtime.reconcile();
    expect(s.runtime.snapshot()[0]).toMatchObject({ pending: true, spent: 1600 });
    expect(s.runtime.history().totals[0].destroyed).toBe(0);
  });
  it('refunds only definitive rejection and never a timeout', () => {
    const s = setup(); const ticket = s.begin();
    expect(s.runtime.observe(ticket, { failed: true, reason: 'timeout' })).toBe(false);
    expect(s.runtime.observe(ticket, { failed: true, reason: 'upgrade_no_scroll' })).toBe(true);
    expect(s.runtime.observe(ticket, { failed: true, reason: 'upgrade_no_scroll' })).toBe(false);
    expect(s.runtime.snapshot()[0]).toMatchObject({ pending: false, spent: 0, produced: 0 });
  });
  it('alerts even when the game queue remains stuck', () => {
    const s = setup(); s.begin(); s.context.character.q.upgrade = true; s.advance(61000); s.runtime.reconcile();
    expect(s.runtime.snapshot()[0].reviewReason).toBe('Character or inventory is not ready for verification');
  });
  it('confirms a purchased base only with exact payment', () => {
    const s = setup(); s.runtime.begin('coat', 1000, { kind: 'purchase' }); s.context.character.items.push({ name: 'coat', level: 0, q: 1 }); s.advance(16000); s.runtime.reconcile();
    expect(s.runtime.snapshot()[0].pending).toBe(true);
    s.context.character.gold -= 1000; s.runtime.reconcile();
    expect(s.runtime.snapshot()[0]).toMatchObject({ pending: false, spent: 1000, produced: 0 });
  });
});
