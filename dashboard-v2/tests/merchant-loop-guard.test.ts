import fs from 'node:fs';
import vm from 'node:vm';
import { expect, it } from 'vitest';
function fixture() {
  let now = 100000;
  const stored: Record<string, unknown> = {};
  const c = { character: { name: 'Merchant', map: 'main', items: [{ name: 'leather', q: 10 }], slots: {} as Record<string, unknown>, q: {} }, __ALCC: { profile: 'test', bankDeposit: { items: ['leather'] } }, Date: { now: () => now }, game_log: () => {}, get: (k: string) => stored[k], set: (k: string,v: unknown) => { stored[k] = structuredClone(v); } };
  const context = vm.createContext(c); const source = fs.readFileSync('../code/merchant-transactions.js','utf8'); vm.runInContext(source,context);
  return { c, runtime: context.MerchantLoopGuard, advance: (ms: number) => { now += ms; }, reload: () => { vm.runInContext(source,context); return context.MerchantLoopGuard; } };
}
it('suspends repeated bank transitions without stock progress, and persists across restart', () => {
  const f=fixture(); f.runtime.tick('bank');
  for(let i=0;i<8;i++){ f.advance(4000); f.c.character.map=i%2?'main':'bank'; f.runtime.tick('bank'); }
  expect(f.runtime.allowed('bank')).toBe(false); expect(f.runtime.allowed('sell')).toBe(true);
  expect(f.reload().allowed('bank')).toBe(false);
  f.c.character.items[0].q=9; expect(f.runtime.allowed('bank')).toBe(true);
});
it('does not suspend productive tasks or sparse observations', () => {
  const f=fixture();
  for(let i=0;i<60;i++){ f.advance(4000); f.c.character.items[0].q++; f.runtime.tick('craft'); }
  expect(f.runtime.snapshot().holds).toHaveLength(0);
  f.advance(200000); f.runtime.tick('craft'); expect(f.runtime.allowed('craft')).toBe(true);
});
it('holds a repeatedly failing stationary task and releases on rule changes', () => {
  const f=fixture(); for(let i=0;i<48;i++){ f.advance(4000); f.runtime.tick('upgrade'); }
  expect(f.runtime.allowed('upgrade')).toBe(false);
  f.c.__ALCC.bankDeposit.items=[]; expect(f.runtime.allowed('upgrade')).toBe(true);
});
it('detects repeated identical stand layouts, without blocking other tasks', () => {
  const f=fixture(); f.c.character.items.push({name:'cryptkey',q:1}); f.runtime.tick(null);
  for(let i=0;i<9;i++){f.advance(4000); if(i%2){f.c.character.slots.trade1=null;f.c.character.items.push({name:'cryptkey',q:1});}else{f.c.character.items=f.c.character.items.filter(it=>it.name!=='cryptkey');f.c.character.slots.trade1={name:'cryptkey',level:0,price:5000};} f.runtime.tick(null);}
  expect(f.runtime.allowed('stand')).toBe(false); expect(f.runtime.allowed('exchange')).toBe(true);
});
