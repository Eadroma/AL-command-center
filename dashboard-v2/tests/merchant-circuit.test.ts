import { describe, expect, it } from 'vitest';
import { initialProfile, scripts } from '../server/scripts';
import { merchantCircuit } from '../src/models/merchant-circuit';

describe('merchant circuit', () => {
  it('does not classify a just-started production action as a delayed confirmation', () => {
    const profile = initialProfile(scripts());
    const action = { id: 'one', item: 'coat', runId: 'test', kind: 'upgrade' as const, level: 0, target: 9, cost: 100, at: 10000, outcome: 'pending' as const, before: '' };
    const telemetry = { live: true, lastSeen: 11000, upgradeProduction: [{ item: 'coat', runId: 'test', spent: 100, produced: 0, quantity: 1, budget: 1000, pending: true, action }] };
    expect(merchantCircuit(profile, telemetry)?.blockedBy).toBeUndefined();
    expect(merchantCircuit(profile, { ...telemetry, lastSeen: 26000 })?.blockedBy).toContain('confirmation delayed');
  });
  it('does not turn stale or missing inventory into a live empty queue', () => {
    const profile = initialProfile(scripts());
    expect(merchantCircuit(profile, { live: false, inventory: [] })).toBeNull();
    expect(merchantCircuit(profile, { live: true })?.stops.find(stop => stop.id === 'upgrade')?.candidates).toBeNull();
  });
  it('counts eligible candidate pieces rather than quantities or locked items', () => {
    const profile = initialProfile(scripts());
    profile.seller.exchange = { enabled: true, items: ['gem0'], minimum: { gem0: 20 } };
    profile.seller.bankDeposit = { enabled: true, items: ['leather'] };
    profile.seller.upgrade = { enabled: true, minGold: 0, rules: [{ item: 'bow', maxLevel: 7 }] };
    const item = (name: string, level = 0, quantity = 1, locked = false) => ({ name, level, quantity, locked, bound: false, slot: 0, upgradeable: true, sellable: true });
    const circuit = merchantCircuit(profile, { live: true, inventory: [item('leather', 0, 200), item('leather', 0, 10, true), item('gem0', 0, 19), item('gem0', 0, 40), item('bow', 6), item('bow', 7)], standOpen: true });
    expect(circuit?.stops.find(stop => stop.id === 'bank')?.candidates).toBe(2);
    expect(circuit?.stops.find(stop => stop.id === 'exchange')?.candidates).toBe(1);
    expect(circuit?.stops.find(stop => stop.id === 'upgrade')?.candidates).toBe(1);
    expect(circuit?.stops.find(stop => stop.id === 'stand')?.detail).toBe('Stand is open.');
  });
});
