import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { sourceDir, ast } from '../server/scripts';
const source = fs.readFileSync(path.join(sourceDir, 'compound-production.js'), 'utf8');
function setup() {
  const context: any = {
    __ALCC: { compound: { enabled: true, checkBankOnDeposit: true, rules: [{ item: 'ringsj', maxLevel: 3 }] } },
    G: { items: { ringsj: { compound: true }, sword: { upgrade: true } } },
    character: { name: 'Merchant', map: 'bank', items: [], bank: {} },
    free_slots: () => 20, bank_pack_floor: (pack: string) => pack === 'items0' ? 'bank' : 'bank_b',
    sleep: async () => {}, game_log: () => {},
    smart_move: async (map: string) => { context.character.map = map; },
    bank_retrieve: async (pack: string, slot: number) => {
      context.character.items.push(context.character.bank[pack][slot]);
      context.character.bank[pack][slot] = null;
    },
  };
  vm.runInNewContext(source, context);
  return context;
}
describe('explicit compound production', () => {
  it('keeps a withdrawn trio even when a matching stand listing would bank its surplus', async () => {
    const c=setup();
    c.cc_listings=()=>[{item:'ringsj',level:1,bankReserve:2}];
    c.stand_listing_posted=()=>true;
    c.listing_bank_stock_reserved=()=>false;
    const merchantSource=fs.readFileSync(path.join(sourceDir,'eadrosell-merchant-v2.js'),'utf8');
    const node:any=ast(merchantSource).body.find((entry:any)=>entry.type==='FunctionDeclaration'&&entry.id.name==='should_bank_item');
    vm.runInNewContext(merchantSource.slice(node.start,node.end),c);
    c.character.items=[{name:'ringsj',level:1}];
    c.character.bank={items0:[{name:'ringsj',level:1},{name:'ringsj',level:1}]};
    await c.CompoundProduction.checkBank();
    expect(c.character.items.some(c.should_bank_item)).toBe(false);
    c.character.items.pop();
    expect(c.should_bank_item(c.character.items[0])).toBe(true);
  });
  it('tracks confirmed outcomes separately from uncertain actions and persists counters', () => {
    const c = setup(); let saved: unknown;
    c.set = (_key: string, value: unknown) => { saved = structuredClone(value); };
    c.CompoundProduction.record('lantern', { success: true }, 1000);
    c.CompoundProduction.record('lantern', { success: false }, 1000);
    c.CompoundProduction.record('lantern', null, 1000);
    expect(c.CompoundProduction.snapshot()[0]).toMatchObject({ item: 'lantern', attempts: 3, successes: 1, destroyed: 1, unconfirmed: 1, scrollGold: 2000 });
    c.get = () => saved;
    vm.runInNewContext(source, c);
    expect(c.CompoundProduction.snapshot()[0].attempts).toBe(3);
  });
  it('banks intermediate results without cycling an actionable trio back into the bank', async () => {
    const c = setup(); const p = c.CompoundProduction;
    const intermediate = { name: 'ringsj', level: 1 };
    c.character.items = [intermediate];
    expect(p.depositEligible(intermediate)).toBe(true);
    expect(p.depositEligible({ name: 'ringsj', level: 0 })).toBe(false);
    c.character.bank = { items0: [{ name: 'ringsj', level: 1 }, { name: 'ringsj', level: 1 }] };
    await p.checkBank();
    expect(c.character.items).toHaveLength(3);
    expect(c.character.items.some(p.depositEligible)).toBe(false);
    expect(p.depositEligible({ name: 'ringsj', level: 3 })).toBe(true);
    for (const extra of [{ l: 'l' }, { b: true }, { oo: 'Other' }]) {
      expect(p.depositEligible({ ...intermediate, ...extra })).toBe(false);
    }
  });
  it('respects configured targets and protects locked, bound and foreign-owned stock', () => {
    const c = setup(); const p = c.CompoundProduction;
    expect(p.eligible({ name: 'ringsj', level: 2 })).toBe(true);
    expect(p.eligible({ name: 'ringsj', level: 3 })).toBe(false);
    expect(p.complete({ name: 'ringsj', level: 3 })).toBe(true);
    for (const extra of [{ l: 'l' }, { b: true }, { oo: 'Other' }]) {
      expect(p.eligible({ name: 'ringsj', level: 0, ...extra })).toBe(false);
      expect(p.complete({ name: 'ringsj', level: 3, ...extra })).toBe(false);
    }
    expect(p.eligible({ name: 'sword', level: 0 })).toBe(false);
    c.__ALCC.compound.enabled = false;
    expect(p.eligible({ name: 'ringsj', level: 0 })).toBe(false);
  });
  it('completes one equal-level trio across bank floors without withdrawing locked stock', async () => {
    const c = setup();
    c.character.items = [{ name: 'ringsj', level: 1 }];
    c.character.bank = {
      items0: [{ name: 'ringsj', level: 1, l: 'l' }, { name: 'ringsj', level: 1 }],
      items8: [{ name: 'ringsj', level: 1 }, { name: 'ringsj', level: 1 }, { name: 'ringsj', level: 3 }],
    };
    await c.CompoundProduction.checkBank();
    expect(c.character.items).toHaveLength(3);
    expect(c.character.map).toBe('bank_b');
    expect(c.character.bank.items0[0].l).toBe('l');
    expect(c.character.bank.items8[1]).not.toBeNull();
  });
  it('does not withdraw incomplete trios or scan when the option is disabled', async () => {
    const c = setup();
    c.character.bank = { items0: [{ name: 'ringsj', level: 0 }, { name: 'ringsj', level: 1 }] };
    await c.CompoundProduction.checkBank();
    expect(c.character.items).toHaveLength(0);
    c.character.bank.items0 = Array.from({ length: 3 }, () => ({ name: 'ringsj', level: 0 }));
    c.__ALCC.compound.checkBankOnDeposit = false;
    await c.CompoundProduction.checkBank();
    expect(c.character.items).toHaveLength(0);
  });
});
