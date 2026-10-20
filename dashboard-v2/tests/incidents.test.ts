import { describe, expect, it } from 'vitest';
import { incidentBoard } from '../src/models/incidents';
import type { DeploymentsResponse } from '../src/types';
import { profileSchema } from '../shared/schema';

const deployments = {
  configured: true, caracalAvailable: false, profileVersion: 1,
  profileServer: { region: 'EU', name: 'III' }, policy: {},
  fleet: { ready: false, issues: [], summary: '' },
  characters: {
    Eadroma: {
      stage: 'Running', updatedAt: new Date(500).toISOString(), telemetry: {
        live: true, lastSeen: 400,
        failures: [
          { at: 100, reason: 'healer unavailable', details: 'Priest missing.' },
          { at: 200, reason: 'healer unavailable', details: 'Priest out of range.' },
        ],
        movement: { state: 'blocked', moving: true, lastProgressAt: 250, stalledForMs: 16000, attempts: 3, recoveries: 0, lastAction: 'town recovery blocked by current context', updatedAt: 300 },
        logs: [{ time: 350, message: 'ERROR: path resolver exploded' }],
      },
    },
    Aedroma: { stage: 'Deployment failed', message: 'Browser unavailable', updatedAt: new Date(450).toISOString() },
  },
} satisfies DeploymentsResponse;

describe('incident center model', () => {
  it('groups repeated causes and includes movement, runtime and deployment evidence', () => {
    const rows = incidentBoard(deployments);
    expect(rows).toHaveLength(4);
    expect(rows.find(row => row.kind === 'death')).toMatchObject({ character: 'Eadroma', occurrences: 2, firstAt: 100, lastAt: 200, details: 'Priest out of range.' });
    expect(rows.find(row => row.kind === 'movement')).toMatchObject({ severity: 'error', title: 'Movement recovery blocked' });
    expect(rows.find(row => row.kind === 'runtime')?.title).toBe('path resolver exploded');
    expect(rows.find(row => row.kind === 'deployment')).toMatchObject({ character: 'Aedroma', severity: 'error' });
  });

  it('ignores legacy object-only runtime messages', () => {
    const noisy = structuredClone(deployments);
    noisy.characters.Eadroma.telemetry.logs.push({ time: 360, message: 'ERROR: [object Object]' });
    expect(incidentBoard(noisy).filter(row => row.kind === 'runtime')).toHaveLength(1);
  });

  it('keeps a resolution until a newer occurrence reopens that group', () => {
    const initial = incidentBoard(deployments);
    const death = initial.find(row => row.kind === 'death')!;
    expect(incidentBoard(deployments, { [death.id]: 250 }).find(row => row.id === death.id)?.resolved).toBe(true);
    const updated = structuredClone(deployments);
    updated.characters.Eadroma.telemetry.failures.push({ at: 300, reason: 'healer unavailable', details: 'New death.' });
    expect(incidentBoard(updated, { [death.id]: 250 }).find(row => row.id === death.id)?.resolved).toBe(false);
  });

  it('reports actionable stock, capacity, healer, stand and source-drift risks', () => {
    const profile = profileSchema.parse({
      name: 'Ops', server: { region: 'EU', name: 'III' },
      characters: [
        { name: 'Tank', ctype: 'warrior', enabled: true, runtime: 'browser', script: 'tank', follow: '', events: true, job: 'hunt', overrides: {} },
        { name: 'Heal', ctype: 'priest', enabled: true, runtime: 'browser', script: 'heal', follow: 'Tank', events: true, job: 'hunt', overrides: {} },
        { name: 'Shop', ctype: 'merchant', enabled: true, runtime: 'browser', script: 'shop', follow: '', events: false, job: 'upgrade', overrides: {} },
      ],
      farming: { defaultMonster: 'goo', hunts: false, allowedHunts: [], rareVisits: false },
      events: { enabled: false, allowed: [] },
      seller: {
        npcEnabled: false, npcItems: [], standEnabled: true, listings: [{ item: 'fireblade', level: 0, price: 1000 }],
        consumables: { enabled: true, rules: [{ character: 'Tank', item: 'mpot1', minQty: 50, targetQty: 200, maxQty: 500, mode: 'carry', source: 'either' }] },
      },
    });
    const fullInventory = Array.from({ length: 39 }, (_, slot) => ({ slot, name: slot ? 'seashell' : 'mpot1', level: 0, quantity: slot ? 1 : 10, locked: false, bound: false, upgradeable: false, sellable: true }));
    const runtime = {
      ...deployments,
      fleet: { ...deployments.fleet, characters: [{ name: 'Tank', sourceDrift: true, profileDrift: false, realmMismatch: false, needsRebuild: true, issues: ['source changed'] }] },
      characters: {
        Tank: { stage: 'Running', hash: 'bundle', sourceHash: 'source', telemetry: { live: true, lastSeen: 1000, stats: { hp: 100, max_hp: 100, mp: 10, max_mp: 100, map: 'main' }, inventory: fullInventory } },
        Heal: { stage: 'Running', telemetry: { live: false, lastSeen: 900 } },
        Shop: { stage: 'Running', telemetry: { live: true, lastSeen: 1100, stats: { hp: 100, max_hp: 100, mp: 100, max_mp: 100, map: 'main' }, intent: { state: 'Idle', since: 1, updatedAt: 1, map: 'main' }, stand: [], standOpen: false } },
      },
    } as unknown as DeploymentsResponse;
    const kinds = incidentBoard(runtime, {}, profile).map(row => row.kind);
    expect(kinds).toEqual(expect.arrayContaining(['stock', 'inventory', 'availability', 'commerce', 'drift']));
    expect(incidentBoard(runtime, {}, profile).find(row => row.kind === 'stock')).toMatchObject({ severity: 'warning', character: 'Tank' });
  });

  it('guards a configured solo ranger and suppresses the missing-priest incident', () => {
    const profile = profileSchema.parse({
      name: 'Solo', server: { region: 'EU', name: 'III' },
      characters: [
        { name: 'Tank', ctype: 'warrior', enabled: true, runtime: 'browser', script: 'tank', follow: '', events: true, job: 'hunt', overrides: {} },
        { name: 'Heal', ctype: 'priest', enabled: true, runtime: 'browser', script: 'heal', follow: 'Tank', events: true, job: 'hunt', overrides: {} },
        { name: 'Droma', ctype: 'ranger', enabled: true, runtime: 'browser', script: 'ranger', follow: '', events: true, job: 'hunt', overrides: {} },
      ],
      farming: { defaultMonster: 'crab', hunts: false, allowedHunts: [], rareVisits: false },
      events: { enabled: false, allowed: [] },
      seller: { npcEnabled: false, npcItems: [], standEnabled: false, listings: [], teamSupervisor: { enabled: true, characters: ['Droma'], soloGuard: true } },
    });
    const runtime = {
      ...deployments,
      characters: {
        Droma: { stage: 'Running', telemetry: { live: true, lastSeen: 1000, stats: { hp: 100, max_hp: 100, mp: 100, max_mp: 100, map: 'main' }, activeEffects: [] } },
        Tank: { stage: 'Running', telemetry: { live: true, lastSeen: 900, stats: { hp: 100, max_hp: 100, mp: 100, max_mp: 100, map: 'main' } } },
        Heal: { stage: 'Telemetry stale', telemetry: { live: false, lastSeen: 800 } },
      },
    } as unknown as DeploymentsResponse;
    const rows = incidentBoard(runtime, {}, profile);
    expect(rows.filter(row => row.kind === 'solo')).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: 'Solo session broken', severity: 'error' }),
      expect.objectContaining({ title: 'Lone Wolf inactive', severity: 'warning' }),
    ]));
    expect(rows.find(row => row.title === 'Priest unavailable')?.details).toContain('Tank');

    runtime.characters.Tank.telemetry.live = false;
    runtime.characters.Droma.telemetry.activeEffects = [{ id: 'encouragement_lonewolf' }];
    expect(incidentBoard(runtime, {}, profile).filter(row => row.kind === 'solo')).toHaveLength(0);
    expect(incidentBoard(runtime, {}, profile).some(row => row.title === 'Priest unavailable')).toBe(false);
    profile.characters.find(character => character.name === 'Tank')!.enabled = false;
    runtime.characters.Tank.telemetry.live = true;
    expect(incidentBoard(runtime, {}, profile).some(row => row.title === 'Solo session broken')).toBe(true);
  });
});


it('exposes unresolved upgrade warnings only for live telemetry', () => {
  const state = structuredClone(deployments) as DeploymentsResponse;
  const telemetry = state.characters.Eadroma.telemetry!;
  telemetry.upgradeProduction = [{ item: 'coat', runId: 'one', spent: 100, produced: 0, quantity: 1, budget: 200, pending: true, reviewAt: 100, reviewReason: 'Inventory evidence ambiguous' }];
  expect(incidentBoard(state).find(row => row.title === 'Transaction needs review: coat')).toMatchObject({ kind: 'commerce', severity: 'warning', details: 'Inventory evidence ambiguous', lastAt: 60100 });
  telemetry.live = false;
  expect(incidentBoard(state).some(row => row.title === 'Transaction needs review: coat')).toBe(false);
});
