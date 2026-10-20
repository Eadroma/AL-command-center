import { expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { sourceDir } from '../server/scripts';

function setup(bank: Record<string, any[]>, items: any[] = [null, { name: 'carried' }]) {
  let pending: Promise<void>;
  const calls: any[] = [];
  const c: any = { character: { name: 'Merchant', map: 'main', bank, items },
    G: { items: { leather: { type: 'material', s: 9999 }, sword: { type: 'weapon' }, hat: { type: 'helmet' } } },
    chores_in_progress: false, production_trip: 'exchange',
    sleep: async () => {}, game_log: () => {}, hold_stand: () => {}, ensure_stand_closed: async () => {},
    smart_move: async (dest: any) => { c.character.map = typeof dest === 'string' ? dest : dest.map; },
    setTimeout: (fn: () => Promise<void>) => { pending = fn(); },
    bank_retrieve: async (pack: string, slot: number, inv: number) => {
      c.character.items[inv] = bank[pack][slot]; bank[pack][slot] = null;
    },
    bank_store: async (inv: number, pack: string, slot?: number) => {
      calls.push([inv, pack, slot]);
      const held = c.character.items[inv];
      if (slot === undefined) {
        const merge = bank[pack].findIndex(item => item?.name === held.name && item.q && held.q && item.q + held.q <= c.G.items[held.name].s);
        if (merge >= 0) { bank[pack][merge].q += held.q; c.character.items[inv] = null; }
        else { const empty = Array.from({ length: 42 }, (_, i) => i).find(i => !bank[pack][i])!; bank[pack][empty] = held; c.character.items[inv] = null; }
      } else { const displaced = bank[pack][slot]; bank[pack][slot] = held; c.character.items[inv] = displaced; }
      c.character.items = c.character.items.filter(Boolean); c.character.items.length = 42;
    },
  };
  vm.runInNewContext(fs.readFileSync(path.join(sourceDir, 'bank-sorter.js'), 'utf8'), c);
  return { c, calls, run: async () => { c.ALCCBankSorter.request({ id: 'test' }); await pending!; return c.ALCCBankSorter.snapshot(); } };
}

it('merges through automatic store, sorts all floors and preserves carried inventory through compaction', async () => {
  const bank = { items0: [{ name: 'sword', level: 0 }, null, { name: 'hat', level: 0 }, { name: 'leather', q: 10 }], items1: [{ name: 'leather', q: 20 }], items8: [{ name: 'sword', level: 1 }, { name: 'hat', level: 0 }], items24: [{ name: 'sword' }, { name: 'hat' }] };
  const s = setup(bank);
  expect(await s.run()).toMatchObject({ state: 'complete', merged: 1 });
  expect(s.calls.some(call => call[2] === undefined)).toBe(true);
  expect(bank.items0.slice(0, 3).map(item => item?.name)).toEqual(['hat', 'sword', 'leather']);
  expect(bank.items0[2]?.q).toBe(30);
  expect(bank.items8[0].name).toBe('hat'); expect(bank.items24[0].name).toBe('hat');
  expect(s.c.character.items.filter(Boolean)).toEqual([{ name: 'carried' }]);
  expect(s.c.chores_in_progress).toBe(false);
  const snapshot = s.c.ALCCBankSorter.bankSnapshot();
  bank.items0[0] = null;
  expect(snapshot.bank.items0[0].name).toBe('hat');
  delete s.c.character.bank;
  expect(s.c.ALCCBankSorter.bankSnapshot().bank.items0[0].name).toBe('hat');
});

it('does not confuse equipment modifiers or unequal stacks with identical copies', async () => {
  const bank = { items0: [null, { name: 'sword', level: 2, stat_type: 'dex' }, { name: 'sword', level: 2, stat_type: 'str' }] };
  const s = setup(bank);
  expect(await s.run()).toMatchObject({ state: 'complete' });
  expect(bank.items0.slice(0, 2).map(item => item?.stat_type)).toEqual(['dex', 'str']);
  expect(s.c.character.items.filter(Boolean)).toEqual([{ name: 'carried' }]);
});

it('reports rejected placements instead of claiming success', async () => {
  const s = setup({ items0: [{ name: 'sword' }, { name: 'hat' }] });
  s.c.bank_store = async () => {};
  expect(await s.run()).toMatchObject({ state: 'failed', message: 'Bank did not confirm placement' });
  expect(s.c.character.items.some((item: any) => item?.name === 'carried')).toBe(true);
});
it('groups item names and descending levels instead of preserving NPC-price order',async()=>{
 const bank={items0:[{name:'sword',level:0},{name:'zblade',level:9},{name:'ablade',level:1},{name:'ablade',level:5}]};
 const s=setup(bank);s.c.G.items.sword.g=1;s.c.G.items.zblade={type:'weapon',g:2};s.c.G.items.ablade={type:'weapon',g:999999};
 expect(await s.run()).toMatchObject({state:'complete'});
 expect(s.c.ALCCBankSorter.snapshot().moved).toBeGreaterThan(0);
 expect(bank.items0.slice(0,4).map((item:any)=>[item.name,item.level])).toEqual([['ablade',5],['ablade',1],['sword',0],['zblade',9]]);
});
it('publishes the sorted bank once and logs ALData HTTP status without affecting sort success', async () => {
  const s = setup({ items0: [{ name: 'sword' }, { name: 'hat' }] });
  const logs: string[] = [], requests: any[] = [];
  s.c.character.owner = 'owner/test'; s.c.AbortController = AbortController; s.c.clearTimeout = clearTimeout;
  s.c.game_log = (line: string) => logs.push(line);
  const schedule = s.c.setTimeout;
  s.c.setTimeout = (fn: any, ms: number) => ms === 0 ? schedule(fn) : setTimeout(fn, ms);
  s.c.fetch = async (url: string, options: any) => { requests.push({ url, options }); return { status: 200 }; };
  expect(await s.run()).toMatchObject({ state: 'complete' });
  expect(requests).toHaveLength(1);
  expect(requests[0].url).toBe('https://aldata.earthiverse.ca/bank/owner%2Ftest/ImNotEadroma');
  expect(requests[0].options.method).toBe('PUT');
  expect(JSON.parse(requests[0].options.body).items0[0].name).toBe('hat');
  expect(logs.some(line => line.includes('HTTP 200'))).toBe(true);
  expect(logs.some(line => line.includes('ImNotEadroma'))).toBe(false);
});
it('logs rejected ALData updates without reporting the successful bank sort as failed', async () => {
  const s = setup({ items0: [] }); const logs: string[] = [];
  s.c.character.owner = 'owner'; s.c.AbortController = AbortController; s.c.clearTimeout = clearTimeout;
  const schedule = s.c.setTimeout;
  s.c.setTimeout = (fn: any, ms: number) => ms === 0 ? schedule(fn) : setTimeout(fn, ms);
  s.c.game_log = (line: string) => logs.push(line);
  s.c.fetch = async () => ({ status: 403 });
  expect(await s.run()).toMatchObject({ state: 'complete' });
  expect(logs.some(line => line.includes('HTTP 403'))).toBe(true);
});
