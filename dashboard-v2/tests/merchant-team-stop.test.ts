import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.join(process.env.AL_CODE_DIR || '../code', 'eadrosell-merchant-v2.js'), 'utf8');
const helper = source.match(/function stop_unlisted_team_character\(\) \{[\s\S]*?\r?\n\}\r?\n/)![0];

function run(live: Record<string, string>) {
  const stopped: string[] = [];
  const context = {
    CONFIG: { FARMERS: ['Eadroma', 'Aedroma', 'Droma'] }, character: { name: 'EadroSell' },
    get_active_characters: () => live, stop_character: (name: string) => { stopped.push(name); return Promise.resolve(); }, game_log() {},
  };
  const result = vm.runInNewContext(`${helper}; stop_unlisted_team_character()`, context);
  return { result, stopped };
}

describe('merchant team supervisor', () => {
  it('stops one running character outside the team before starting another', () => {
    expect(run({ EadroSell: 'self', Dromas: 'code', Eadroma: 'active' })).toEqual({ result: true, stopped: ['Dromas'] });
  });
  it('leaves team members, the merchant and inactive entries alone', () => {
    expect(run({ EadroSell: 'self', Eadroma: 'active', Dromas: '' })).toEqual({ result: false, stopped: [] });
  });
});

describe('merchant stackable listing top-up', () => {
  const topup = source.match(/function listing_topup_wanted\(rule\) \{[\s\S]*?\r?\n\}\r?\n/)![0];
  const check = (slots: Record<string, unknown>, items: unknown[] = []) => vm.runInNewContext(`${topup}; listing_topup_wanted({ item: 'scroll3', level: 0 })`, {
    G: { items: { scroll3: { s: true }, coat: {} } }, character: { items, slots }, merchant_trade_capacity: () => 4, remembered_stand_listings: {},
  });
  it('tops up a listed stackable that has no spare stack in the inventory', () => {
    expect(check({ trade2: { name: 'scroll3', q: 1 } })).toBe(true);
  });
  it('ignores buy orders and stacks already carried', () => {
    expect(check({ trade2: { name: 'scroll3', q: 1, b: true } })).toBe(false);
    expect(check({ trade2: { name: 'scroll3', q: 1 } }, [{ name: 'scroll3', q: 3 }])).toBe(false);
  });
});

describe('merchant stackable deposit loop', () => {
  const pick = (name: string) => source.match(new RegExp(String.raw`function ${name}\([^)]*\) \{[\s\S]*?\r?\n\}\r?\n`))![0];
  const code = ['should_bank_item', 'listing_bank_stock_reserved', 'stand_listing_posted', 'listing_bank_leases'].map(pick).join('\n');
  const run = (item: string, leased: boolean) => {
    const carried = { name: item, q: 3, rid: 'r1' };
    return vm.runInNewContext(`${code}; should_bank_item(carried)`, {
      carried, G: { items: { scroll3: { s: true }, coat: {} } }, CONFIG: {},
      character: { name: 'EadroSell', stand: true, items: [carried], slots: { trade1: { name: item, q: 1 } } },
      cc_stand_enabled: () => true, cc_listings: () => [{ item, level: 0, price: 1 }], merchant_trade_capacity: () => 2,
      listing_bank_stock_cache: leased ? { [`${item}:0`]: { rid: 'r1' } } : {}, upgrade_target_complete: () => false,
      __ALCC: { bankDeposit: { enabled: true, items: [item] } }, is_protected_item: () => false, cc_upgrade_enabled: () => false,
    });
  };
  it('keeps a withdrawn stackable top-up instead of depositing it again', () => {
    expect(run('scroll3', true)).toBe(false);
  });
  it('still deposits a surplus copy of a unique listed item', () => {
    expect(run('coat', false)).toBe(true);
  });
});

describe('merchant potion supply', () => {
  const reach = source.match(/async function reach_farmer\(name, state\) \{[\s\S]*?\r?\n\}\r?\n/)![0];
  const run = (map: string) => {
    const walks: unknown[] = [];
    const result = vm.runInNewContext(`${reach}; reach_farmer('Aedroma', { report: { map: '${map}', x: 832, y: 1968 } })`, {
      G: { maps: { desertland: {}, crypt: { instance: true } } }, character: { map: 'main' }, CONFIG: { REACH: 300 },
      distance: () => 999, get_player: () => null, walk_to: (d: unknown) => { walks.push(d); return Promise.resolve(); },
    });
    return result.then(() => walks.length);
  };
  it('walks to a farmer on a normal map', async () => { expect(await run('desertland')).toBe(1); });
  it('never paths into instanced maps (Cave Dreams zone, crypt)', async () => {
    expect(await run('zone_d3d332bef93f7849f78dc06e_0')).toBe(0);
    expect(await run('crypt')).toBe(0);
  });
});

describe('merchant bank deposit slot', () => {
  const find = source.match(/function find_empty_bank_slot\(item\) \{[\s\S]*?\r?\n\}\r?\n/)![0];
  const pick = (bank: Record<string, unknown[]>) => vm.runInNewContext(`${find}; find_empty_bank_slot({ name: 'pumpkinspice', level: 0, q: 44 })`, {
    character: { bank }, G: { items: { pumpkinspice: { s: 9999 } } }, get_available_bank_packs: () => Object.keys(bank), game_log() {},
  });
  const full = (extra: unknown) => Array.from({ length: 42 }, (_, i) => i === 0 ? extra : { name: 'fury', level: 0 });
  it('merges into an existing stack when the total fits', () => {
    expect(pick({ items3: full({ name: 'pumpkinspice', level: 0, q: 100 }), items4: [] })).toMatchObject({ pack: 'items3', merge: true });
  });
  it('tops a nearly full stack up to its cap, the rest of the deposit is split off', () => {
    expect(pick({ items3: full({ name: 'pumpkinspice', level: 0, q: 9980 }), items4: [null] })).toMatchObject({ pack: 'items3', merge: true, room: 19 });
  });
  it('opens a new stack in a pack with a free slot once the existing stack is capped', () => {
    expect(pick({ items3: full({ name: 'pumpkinspice', level: 0, q: 9999 }), items4: [null] })).toMatchObject({ pack: 'items4', merge: false });
  });
});

describe('merchant stand loop ownership', () => {
  it('never runs the standalone stand fallback once the Command Center manager is injected', () => {
    const loop = source.slice(source.indexOf('async function standLoop()'));
    const guard = loop.indexOf('Array.isArray(__ALCC.listings)');
    expect(guard).toBeGreaterThan(loop.indexOf('await maybe_keep_shop()'));
    expect(guard).toBeLessThan(loop.indexOf('walk_to(spot, "stand spot")'));
  });
});

describe('merchant craft bank stocking', () => {
  it('backs off 15 minutes when the bank lacks an ingredient instead of returning every minute', async () => {
    const fnSrc = source.match(/async function stock_craft_bank\(job\) \{[\s\S]*?\r?\n\}\r?\n/)![0];
    const ctx: any = { craft_bank_retry: {}, character: { map: 'bank', bank: { items0: [] }, items: [null, null] }, logs: [] as string[] };
    Object.assign(ctx, { hold_stand() {}, ensure_stand_closed: async () => {}, smart_move: async () => {}, item_count_level: () => 0, free_slots: () => 5,
      each_bank_item() {}, game_log: (m: string) => ctx.logs.push(m) });
    const before = Date.now();
    await vm.runInNewContext(`${fnSrc}; stock_craft_bank({ item: 'firestaff', batch: 1, bank: [{ item: 'essenceoffire', level: 0, quantity: 1 }] })`, ctx);
    expect(ctx.craft_bank_retry.firestaff).toBeGreaterThanOrEqual(before + 15 * 60000);
    expect(ctx.logs[0]).toContain('essenceoffire +0 absent');
  });
});
