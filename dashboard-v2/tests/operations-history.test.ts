import { describe, expect, it } from 'vitest';
import { OperationsHistory } from '../server/operations-history';

describe('operations history', () => {
  it('deduplicates completed merchant transactions', () => {
    let now = 10_000;
    const history = new OperationsHistory(undefined, () => now);
    const transaction = { id: 'tx-1', kind: 'bank_deposit', detail: 'leather +0 x12', state: 'committed' as const, startedAt: 9_000, finishedAt: 9_500, message: 'stored items0:4' };
    const sample = { character: 'EadroSell', at: now, stats: { gold: 100 }, merchantTransactions: { journal: [transaction] } };
    expect(history.record(sample)).toBe(true);
    expect(history.record(sample)).toBe(false);
    expect(history.view().transactions).toEqual([{ ...transaction, character: 'EadroSell' }]);
  });

  it('records a stand sale only when a matching gold increase confirms it', () => {
    let now = 20_000;
    const history = new OperationsHistory(undefined, () => now);
    history.record({ character: 'EadroSell', at: now, stats: { gold: 1_000 }, stand: [{ slot: 1, name: 'fireblade', level: 8, quantity: 2, price: 500, buy: false }] });
    now += 5_000;
    history.record({ character: 'EadroSell', at: now, stats: { gold: 1_500 }, stand: [{ slot: 1, name: 'fireblade', level: 8, quantity: 1, price: 500, buy: false }] });
    expect(history.view().commerce).toMatchObject([{ side: 'sale', item: 'fireblade', level: 8, quantity: 1, unitPrice: 500 }]);
  });
});
