/** Versioned profile: revisions and conflicts, cautious first profile, lossless v2 import, HTTP contract. */
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { isDeepStrictEqual } from 'node:util';
import { createCatalogue } from '../server/builder/catalogue.ts';
import { validateProfile } from '../server/builder/validate.ts';
import { cautiousProfile, fetchV2Profile } from '../server/profile/sources.ts';
import { openProfileStore } from '../server/profile/store.ts';
import { CSRF_HEADER } from '../server/security.ts';
import type { SettingsHolder } from '../server/settings/holder.ts';
import type { Profile } from '../shared/profile.ts';
import { profileSchema } from '../shared/profile.ts';
import { testApp } from './helpers/fakes.ts';

const character = { name: 'Eadroma', ctype: 'warrior', enabled: true, runtime: 'browser', script: 'eadroma-warrior-v2', follow: '', events: true, job: 'hunt', farmMonster: '', overrides: {} } as const;

/** A v2 profile with sections this dashboard does not edit yet: they must survive untouched. */
const v2Profile = {
  name: 'Main party', onboardingComplete: true, server: { region: 'EU', name: 'III' },
  characters: [{ ...character, overrides: { KITE: true } }, { ...character, name: 'EadroSell', ctype: 'merchant', job: 'upgrade', follow: 'Eadroma' }],
  automation: { combatGear: [{ character: 'Eadroma', items: ['blade'] }] },
  farming: { defaultMonster: 'crab', loadouts: { Eadroma: { aoe: { mainhand: 'blade' } } } },
  seller: { listings: [{ item: 'hpot1', price: 25 }], workOrder: ['bank', 'sell'] },
};

const profile: Profile = { name: 'Main party', server: { region: 'EU', name: 'III' }, characters: [character] };

describe('profile store', () => {
  let directory = '';
  before(async () => { directory = await mkdtemp(path.join(os.tmpdir(), 'alcc-profile-')); });
  after(async () => { await rm(directory, { recursive: true, force: true }); });

  it('creates revision 1, then saves only from the current revision', () => {
    const store = openProfileStore(path.join(directory, 'a', 'profile.sqlite'));
    assert.equal(store.read(), null);
    const created = store.write(profile, null, 'cautious');
    assert.ok(created.ok);
    assert.equal(created.saved.revision, 1);
    // Two windows started from revision 1: the first save wins, the second is refused with the current profile.
    const first = store.write({ ...profile, name: 'First' }, 1, 'dashboard');
    const second = store.write({ ...profile, name: 'Second' }, 1, 'dashboard');
    assert.ok(first.ok);
    assert.deepEqual([second.ok, second.ok ? null : second.current?.profile.name], [false, 'First']);
    assert.equal(store.write(profile, null, 'cautious').ok, false);
    store.close();
  });

  it('keeps the profile across restarts', () => {
    const file = path.join(directory, 'b', 'profile.sqlite');
    const store = openProfileStore(file);
    store.write(profile, null, 'cautious');
    store.close();
    const reopened = openProfileStore(file);
    assert.equal(reopened.read()?.profile.characters[0]?.name, 'Eadroma');
    reopened.close();
  });
});

describe('profile sources', () => {
  it('builds a cautious profile the builder accepts: every character off, usual script per class, unknown classes left out', () => {
    const scripts = createCatalogue(path.resolve(import.meta.dirname, '..', '..', 'code'))();
    const cautious = cautiousProfile([
      { name: 'Tank', className: 'warrior', level: 73 }, { name: 'Bow', className: 'ranger', level: 60 }, { name: 'Shop', className: 'merchant', level: 70 },
      { name: 'Odd', className: null, level: 1 },
    ], { region: 'EU', name: 'III' }, scripts);
    assert.deepEqual(cautious.characters.map((entry) => [entry.name, entry.enabled, entry.events, entry.script]), [
      ['Tank', false, false, 'eadroma-warrior-v2'], ['Bow', false, false, 'droma-ranger-v2'], ['Shop', false, false, 'eadrosell-merchant-v2'],
    ]);
    const everything = { upgradeable: (): boolean => true, compoundable: (): boolean => true, hasRecipe: (): boolean => true };
    assert.equal(validateProfile(profileSchema.parse(cautious), scripts, everything), null);
  });

  it('imports a v2 profile without losing any section', async () => {
    const fakeFetch: typeof fetch = () => Promise.resolve(Response.json({ profile: v2Profile, version: 199, catalog: {} }));
    const result = await fetchV2Profile('http://127.0.0.1:9320', fakeFetch);
    assert.ok(result.ok);
    assert.equal(result.v2Revision, 199);
    assert.ok(isDeepStrictEqual(JSON.parse(JSON.stringify(result.profile)), v2Profile));
  });

  it('refuses an invalid or unreachable v2 profile with a code', async () => {
    const duplicate = { ...v2Profile, characters: [character, character] };
    const invalid = await fetchV2Profile('http://x', () => Promise.resolve(Response.json({ profile: duplicate, version: 1 })));
    assert.deepEqual([invalid.ok, invalid.ok ? null : invalid.code], [false, 'profile.v2Invalid']);
    const down = await fetchV2Profile('http://x', () => Promise.reject(new Error('down')));
    assert.deepEqual([down.ok, down.ok ? null : down.code], [false, 'profile.v2Unreachable']);
    assert.deepEqual(await fetchV2Profile('', fetch), { ok: false, code: 'profile.v2NotConfigured' });
  });
});

describe('profile routes', () => {
  const headers = { host: '127.0.0.1:9321', 'content-type': 'application/json', [CSRF_HEADER]: 'csrf' };
  const settings: SettingsHolder = {
    state: () => ({ status: 'ready', file: 'x', settings: { version: 1, account: { mcpUrl: 'https://adventure.land/mcp', mcpToken: 't' }, game: { region: 'EU', server: 'III', runtime: 'browser', codeDirectory: '../code' }, dashboard: { mode: 'local', publicUrl: '', host: '127.0.0.1', port: 9321, dataDirectory: '', language: 'fr', theme: 'night' }, gameData: { autoUpdate: true, checkEveryHours: 24, docsEveryDays: 7 }, market: { enabled: false, refreshMinutes: 15 }, deploy: { enabled: false }, migration: { relayV2Url: '' } } }),
    check: () => Promise.resolve({ ok: true, value: { characters: [{ name: 'Eadroma', className: 'warrior', level: 73 }], servers: [] } }),
    save: () => Promise.resolve({ ok: false, error: { code: 'x' } }),
    client: () => ({ call: () => Promise.resolve({ ok: false, error: { code: 'mcp.missingToken' } }) }),
  };

  it('reports a missing profile, creates a cautious one, then saves with conflict detection', async () => {
    const app = testApp({ settings, profiles: openProfileStore(':memory:') });
    assert.deepEqual(await (await app.request('/api/profile', { headers })).json(), { status: 'missing' });
    const created = await app.request('/api/profile/cautious', { method: 'POST', headers, body: JSON.stringify({ revision: null }) });
    assert.equal(created.status, 200);
    const save = async (revision: number): Promise<Response> => app.request('/api/profile', { method: 'PUT', headers, body: JSON.stringify({ revision, profile }) });
    assert.equal((await save(1)).status, 200);
    const stale = await save(1);
    assert.deepEqual([stale.status, await stale.json()], [409, { error: { code: 'profile.conflict' } }]);
    const again = await app.request('/api/profile/cautious', { method: 'POST', headers, body: JSON.stringify({ revision: null }) });
    assert.equal(again.status, 409);
  });

  it('needs the CSRF token and a valid profile to save', async () => {
    const app = testApp({ settings });
    const noToken = await app.request('/api/profile', { method: 'PUT', headers: { ...headers, [CSRF_HEADER]: '' }, body: JSON.stringify({ revision: 1, profile }) });
    assert.equal(noToken.status, 403);
    const invalid = await app.request('/api/profile', { method: 'PUT', headers, body: JSON.stringify({ revision: 1, profile: { ...profile, characters: [character, character] } }) });
    assert.deepEqual([invalid.status, await invalid.json()], [400, { error: { code: 'profile.invalid' } }]);
  });

  it('answers 422 with a code when v2 is not configured', async () => {
    const response = await testApp({ settings }).request('/api/profile/import-v2', { method: 'POST', headers, body: JSON.stringify({ revision: null }) });
    assert.deepEqual([response.status, await response.json()], [422, { error: { code: 'profile.v2NotConfigured' } }]);
  });
});
