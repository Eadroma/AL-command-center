import { describe, expect, it } from 'vitest';
import { PartyStatisticsHistory } from '../server/party-statistics';
describe('party statistics history', () => {
  it('counts loot once across repeated samples, replayed packets and CODE restarts', () => {
    const history = new PartyStatisticsHistory();
    const sample = { sessionId: 'one', character: 'A', at: 10000, stats: { gold: 100 }, loot: { items: [{ name: 'coat', level: 0, quantity: 3 }] } };
    history.record(sample);
    history.record({ ...sample, at: 15000 });
    history.record({ ...sample, at: 20000, loot: { items: [{ name: 'coat', level: 0, quantity: 5 }] } });
    history.record({ ...sample, at: 18000 });
    history.record({ ...sample, at: 25000, sessionId: 'two', loot: { items: [{ name: 'coat', level: 0, quantity: 1 }] } });
    expect(history.view().items[0].quantity).toBe(6);
    expect(history.view().receipts?.[0].quantity).toBe(6);
    expect(history.view().balances).toHaveLength(1);
  });
  it('keeps activity-specific timestamped loot separate from monthly archives', () => {
    const history = new PartyStatisticsHistory();
    const sample = {sessionId:'one',character:'A',at:10000,stats:{gold:0,map:'main'},farmContext:{monster:'mrgreen'},loot:{items:[{name:'coat',level:0,quantity:1}]}};
    history.record(sample);
    history.record({...sample,at:15000,farmContext:{monster:'crab'},loot:{items:[{name:'coat',level:0,quantity:3}]}});
    expect(history.view().receipts).toMatchObject([{activity:'events',quantity:1,at:0},{activity:'farming',quantity:2,at:0}]);
    expect(history.view().items[0].quantity).toBe(3);
  });
  it('drops receipts older than seven days once a newer bucket opens, and keeps counting into indexed rows', () => {
    const history = new PartyStatisticsHistory(), day = 86400000;
    const sample = { sessionId: 'one', character: 'A', at: 10000, stats: { gold: 0 }, loot: { items: [{ name: 'coat', level: 0, quantity: 1 }] } };
    history.record(sample);
    history.record({ ...sample, at: 8 * day, loot: { items: [{ name: 'coat', level: 0, quantity: 2 }] } });
    history.record({ ...sample, at: 8 * day + 1000, loot: { items: [{ name: 'coat', level: 0, quantity: 4 }] } });
    expect(history.view().receipts).toMatchObject([{ at: 8 * day, quantity: 3 }]);
  });
  it('never treats wallet changes as item loot', () => {
    const history = new PartyStatisticsHistory();
    history.record({ sessionId: 'one', character: 'A', at: 10000, stats: { gold: 100 } });
    history.record({ sessionId: 'one', character: 'A', at: 15000, stats: { gold: 200 } });
    expect(history.view().items).toEqual([]);
    expect(history.view().balances[0].gold).toBe(200);
  });
});
