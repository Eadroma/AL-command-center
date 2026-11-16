import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { sourceDir } from '../server/scripts';

const source = fs.readFileSync(path.join(sourceDir, 'crypt-supply.js'), 'utf8');
const TRIO = ['Eadroma', 'Aedroma', 'Droma'];

function setup() {
  const store: Record<string, unknown> = {};
  const sent: any[] = [];
  const journal: any[] = [];
  const items: any[] = Array(42).fill(null);
  items[0] = { name: 'hpot1', q: 200 };
  const ctx: any = {
    character: { name: 'EadroSell', ctype: 'merchant', map: 'bank', x: 0, y: 0, items, bank: { items4: [{ name: 'cryptkey', q: 22 }, { name: 'funtoken', q: 49 }] } },
    CONFIG: { WARRIOR: 'Eadroma', PRIEST: 'Aedroma', RANGER: 'Droma', MERCHANT: 'EadroSell' },
    farmer_reports: Object.fromEntries(TRIO.map(n => [n, { at: Date.now() }])),
    get: (k: string) => store[k],
    set: (k: string, v: unknown) => { store[k] = JSON.parse(JSON.stringify(v)); },
    send_cm: (to: string[], data: unknown) => sent.push([to, data]),
    game_log: () => {},
    sleep: async () => {},
    distance: (a: any, b: any) => Math.hypot(a.x - b.x, a.y - b.y),
    smart_move: async (to: any) => { if (typeof to === 'string') ctx.character.map = to; else Object.assign(ctx.character, to); },
    free_slots: () => items.filter(it => !it).length,
    bank_retrieve: async (pack: string, slot: number, to: number) => { items[to] = ctx.character.bank[pack][slot]; ctx.character.bank[pack][slot] = null; },
    split: async (slot: number, q: number) => { const free = items.indexOf(null); items[free] = { name: items[slot].name, q }; items[slot] = { ...items[slot], q: items[slot].q - q }; },
    bank_store: async (slot: number, pack: string, to: number) => { ctx.character.bank[pack][to] = items[slot]; items[slot] = null; },
    BankStock: { snapshot: () => ({ observedAt: 1, stock: [{ item: 'cryptkey', level: 0, quantity: 22 }] }) },
    BankCoordinator: {
      acquire: () => true, releaseNavigation: () => true,
      begin: (...args: unknown[]) => { journal.push(['begin', ...args]); return true; },
      finish: (ok: boolean, evidence: unknown) => journal.push(['finish', ok, evidence]),
    },
  };
  vm.createContext(ctx);
  vm.runInContext(source, ctx);
  return { ctx, sent, journal, items };
}

const readyAll = (ctx: any, runId: string, extra: Record<string, unknown> = {}) =>
  TRIO.forEach(n => ctx.CryptSupply.onCm(n, { t: 'crypt', a: 'ready', runId, ...extra }));

describe('crypt supply', () => {
  it('starts only with the full trio reporting and a key known in the bank', () => {
    const { ctx, sent } = setup();
    ctx.farmer_reports.Droma.at = Date.now() - 10 * 60 * 1000;
    expect(ctx.CryptSupply.missingRoster()).toEqual(['Droma']);
    expect(ctx.CryptSupply.start()).toBe(false);
    ctx.farmer_reports.Droma.at = Date.now();
    ctx.BankStock.snapshot = () => ({ observedAt: 1, stock: [] });
    expect(ctx.CryptSupply.start()).toBe(false);
    ctx.BankStock.snapshot = () => ({ observedAt: 0, stock: [] }); // never observed: let the trip check
    expect(ctx.CryptSupply.start()).toBe(true);
    expect(sent[0]).toEqual([TRIO, expect.objectContaining({ t: 'crypt', a: 'start' })]);
    expect(ctx.CryptSupply.start()).toBe(false); // one run at a time
  });

  it('aborts the whole run when one member answers busy', () => {
    const { ctx, sent } = setup();
    ctx.CryptSupply.start();
    const runId = ctx.CryptSupply.snapshot().runId;
    ctx.CryptSupply.onCm('Eadroma', { t: 'crypt', a: 'ready', runId });
    ctx.CryptSupply.onCm('Droma', { t: 'crypt', a: 'busy', runId, reason: 'cave' });
    expect(ctx.CryptSupply.snapshot()).toMatchObject({ phase: 'aborted', active: false });
    expect(sent[1]).toEqual([TRIO, { t: 'crypt', a: 'abort', runId }]);
  });

  it('withdraws exactly one key, returns the rest of the stack to its slot and journals it', async () => {
    const { ctx, journal, items } = setup();
    ctx.CryptSupply.start();
    readyAll(ctx, ctx.CryptSupply.snapshot().runId);
    expect(ctx.CryptSupply.snapshot().phase).toBe('fetch');
    expect(ctx.CryptSupply.needsMerchant()).toBe(true);
    await ctx.CryptSupply.tick();
    expect(ctx.character.bank.items4[0]).toEqual({ name: 'cryptkey', q: 21 });
    expect(items.filter(it => it && it.name === 'cryptkey')).toEqual([{ name: 'cryptkey', q: 1 }]);
    expect(journal[0]).toEqual(['begin', 'withdraw', 'cryptkey', 0, 1, 'items4']);
    expect(journal[1][1]).toBe(true);
    expect(ctx.CryptSupply.snapshot().phase).toBe('deliver');
  });

  it('retries instead of aborting while the bank is not loaded yet (run 25)', async () => {
    const { ctx, items } = setup();
    ctx.setTimeout = (f: () => void) => f(); // the 5 s wait for the bank runs instantly
    const bank = ctx.character.bank; ctx.character.bank = null;
    ctx.CryptSupply.start();
    readyAll(ctx, ctx.CryptSupply.snapshot().runId);
    await ctx.CryptSupply.tick();
    expect(ctx.CryptSupply.snapshot().phase).toBe('fetch'); // no "no Crypt Key in the bank" abort
    ctx.character.bank = bank;
    await ctx.CryptSupply.tick();
    expect(items.filter(it => it && it.name === 'cryptkey')).toEqual([{ name: 'cryptkey', q: 1 }]);
  });

  it('hands the key to the warrior at the Cave door, then waits for the instance id', async () => {
    const { ctx, sent, items } = setup();
    ctx.CryptSupply.start();
    const runId = ctx.CryptSupply.snapshot().runId;
    readyAll(ctx, runId);
    await ctx.CryptSupply.tick(); // fetch
    await ctx.CryptSupply.tick(); // walk to the door
    expect(ctx.character).toMatchObject({ map: 'cave', x: -193, y: -1296 });
    const given: any[] = [];
    ctx.get_player = () => ({ map: 'cave', x: -180, y: -1290 });
    ctx.send_item = async (to: string, slot: number, q: number) => { given.push([to, q]); items[slot] = null; };
    await ctx.CryptSupply.tick();
    expect(given).toEqual([['Eadroma', 1]]);
    expect(sent.at(-1)).toEqual([['Eadroma'], { t: 'crypt', a: 'key', runId }]);
    expect(ctx.CryptSupply.snapshot().phase).toBe('wait_open');
    ctx.CryptSupply.onCm('Droma', { t: 'crypt', a: 'open', runId, id: 'fake' });
    ctx.CryptSupply.onCm('Eadroma', { t: 'crypt', a: 'open', runId, id: 'inst-1' });
    ctx.CryptSupply.onCm('Eadroma', { t: 'crypt', a: 'kill', runId, mtype: 'vbat' });
    expect(ctx.CryptSupply.snapshot()).toMatchObject({ phase: 'inside', id: 'inst-1', kills: { vbat: 1 } });
  });

  it('skips the bank when the warrior already carries a key, and times out silent members', () => {
    const { ctx, sent } = setup();
    ctx.CryptSupply.start();
    const runId = ctx.CryptSupply.snapshot().runId;
    readyAll(ctx, runId, { hasKey: false });
    ctx.CryptSupply.onCm('Eadroma', { t: 'crypt', a: 'ready', runId, hasKey: true });
    expect(ctx.CryptSupply.snapshot().phase).toBe('fetch'); // already ready: a late hasKey changes nothing
    const other = setup();
    other.ctx.CryptSupply.start();
    const id2 = other.ctx.CryptSupply.snapshot().runId;
    other.ctx.CryptSupply.onCm('Eadroma', { t: 'crypt', a: 'ready', runId: id2, hasKey: true });
    other.ctx.CryptSupply.onCm('Aedroma', { t: 'crypt', a: 'ready', runId: id2 });
    other.ctx.CryptSupply.onCm('Droma', { t: 'crypt', a: 'ready', runId: id2 });
    expect(other.ctx.CryptSupply.snapshot().phase).toBe('wait_open');
    const late = setup();
    late.ctx.CryptSupply.start();
    vm.runInContext('Date.now = (function (n) { return function () { return n() + 120000; }; })(Date.now);', late.ctx);
    late.ctx.CryptSupply.watch();
    expect(late.ctx.CryptSupply.snapshot()).toMatchObject({ phase: 'aborted', reason: 'not ready: Eadroma, Aedroma, Droma' });
    expect(sent).toHaveLength(1);
  });
});

describe('crypt supply key custody', () => {
  it('reserves the key from bank deposits during a run and counts a key on the stand as still held', async () => {
    const { ctx, items } = setup();
    expect(ctx.CryptSupply.keeps({ name: 'cryptkey' })).toBe(false);
    ctx.CryptSupply.start();
    const runId = ctx.CryptSupply.snapshot().runId;
    TRIO.forEach(n => ctx.CryptSupply.onCm(n, { t: 'crypt', a: 'ready', runId }));
    expect(ctx.CryptSupply.keeps({ name: 'cryptkey' })).toBe(true);
    await ctx.CryptSupply.tick(); // fetch
    await ctx.CryptSupply.tick(); // walk to the door
    ctx.get_player = () => ({ map: 'cave', x: -180, y: -1290 });
    // The stand moved the key to a trade slot instead of the warrior receiving it.
    ctx.send_item = async (_to: string, slot: number) => { ctx.character.slots = { trade1: items[slot] }; items[slot] = null; };
    await ctx.CryptSupply.tick();
    expect(ctx.CryptSupply.snapshot()).toMatchObject({ phase: 'aborted', reason: "key transfer unconfirmed, check the warrior's bags" });
  });
});

describe('crypt supply resume', () => {
  it('offers the last instance after an abort and rejoins it without touching the bank', () => {
    const { ctx, sent, journal } = setup();
    ctx.CryptSupply.start();
    const runId = ctx.CryptSupply.snapshot().runId;
    TRIO.forEach(n => ctx.CryptSupply.onCm(n, { t: 'crypt', a: 'ready', runId }));
    ctx.CryptSupply.onCm('Eadroma', { t: 'crypt', a: 'open', runId, id: 'inst-7' });
    ctx.CryptSupply.abort('Bill');
    expect(ctx.CryptSupply.resumable()).toBe(true);
    expect(ctx.CryptSupply.resume()).toBe(true);
    const again = ctx.CryptSupply.snapshot().runId;
    expect(sent.at(-1)).toEqual([TRIO, { t: 'crypt', a: 'start', runId: again, id: 'inst-7' }]);
    TRIO.forEach(n => ctx.CryptSupply.onCm(n, { t: 'crypt', a: 'ready', runId: again }));
    expect(ctx.CryptSupply.snapshot()).toMatchObject({ phase: 'inside', id: 'inst-7' });
    expect(ctx.CryptSupply.needsMerchant()).toBe(false);
    expect(journal).toEqual([]);
  });
});
