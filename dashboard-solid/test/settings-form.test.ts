/** Settings form helpers: initial values and server selection. */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { initialForm, pickServer, regionsOf, serversIn } from '../src/screens/settings/settings-form.ts';

const servers = [
  { region: 'EU', name: 'I', online: true, players: 5 },
  { region: 'EU', name: 'III', online: false, players: 0 },
  { region: 'US', name: 'I', online: true, players: 9 },
];

describe('initialForm', () => {
  it('starts from saved settings, never pre-filling the token', () => {
    const form = initialForm({ status: 'ready', file: 'x', settings: {
      hasToken: true, region: 'EU', server: 'III', runtime: 'mainframe', mode: 'local', language: 'en',
      theme: 'night', deployEnabled: false, marketEnabled: true, port: 9321,
    } });
    assert.deepEqual(form, { mcpToken: '', region: 'EU', server: 'III', runtime: 'mainframe', language: 'en', port: 9321 });
  });

  it('uses defaults on first launch', () => {
    assert.equal(initialForm({ status: 'missing', file: 'x' }).port, 9320);
  });
});

describe('servers', () => {
  it('lists regions once, in game order, and servers per region', () => {
    assert.deepEqual(regionsOf(servers), ['EU', 'US']);
    assert.deepEqual(serversIn(servers, 'EU').map((s) => s.name), ['I', 'III']);
  });

  it('keeps an existing choice, even offline', () => {
    assert.deepEqual(pickServer(servers, { region: 'EU', server: 'III' }), { region: 'EU', server: 'III' });
  });

  it('falls back to the first online server of the region, then anywhere', () => {
    assert.deepEqual(pickServer(servers, { region: 'EU', server: 'IX' }), { region: 'EU', server: 'I' });
    assert.deepEqual(pickServer(servers, { region: 'ASIA', server: 'I' }), { region: 'EU', server: 'I' });
  });
});
