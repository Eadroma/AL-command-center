import { describe, expect, it } from 'vitest';
import { initialProfile, scripts } from '../server/scripts';
import { validateDashboardConfig } from '../src/models/config-validation';

describe('configuration validator', () => {
  it('detects conflicting commerce and multiple elixir rules', () => {
    const profile = initialProfile(scripts());
    profile.seller.listings = [{ item: 'fireblade', level: 8, price: 1000 }];
    profile.seller.buy.orders = [{ item: 'fireblade', level: 8, price: 900, quantity: 1 }];
    profile.seller.consumables.rules = [
      { character: 'Droma', item: 'elixirluck', minQty: 1, targetQty: 1, maxQty: 1, mode: 'elixir', source: 'mule' },
      { character: 'Droma', item: 'elixirdex0', minQty: 1, targetQty: 1, maxQty: 1, mode: 'elixir', source: 'mule' },
    ];
    const issues = validateDashboardConfig(profile);
    expect(issues.some(issue => issue.severity === 'error' && issue.message.includes('both a buy and sell'))).toBe(true);
    expect(issues.some(issue => issue.severity === 'error' && issue.message.includes('multiple automatic elixirs'))).toBe(true);
  });
});
