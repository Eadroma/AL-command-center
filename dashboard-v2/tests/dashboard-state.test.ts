import { describe, expect, it } from 'vitest';
import { profileSchema } from '../shared/schema';
import { mapActivity, mapParty } from '../src/models/party';
import { isDirty, updateAutomation } from '../src/models/profile';

const profile = profileSchema.parse({
  name: 'Test', server: { region: 'EU', name: 'I' },
  characters: [{ name: 'Test', ctype: 'warrior', enabled: true, runtime: 'browser', script: 'test', follow: '', events: false, job: 'hunt', overrides: {} }],
  farming: { defaultMonster: 'goo', hunts: false, allowedHunts: [], rareVisits: false },
  events: { enabled: false, allowed: [] },
  seller: { npcEnabled: false, npcItems: [], standEnabled: false, listings: [] },
});
const stats = { skin: 'mwarrior2', hp: 25, max_hp: 100, mp: 10, max_mp: 50, map: 'main', x: 125, y: -42, level: 82, target: 'stoneworm', goldMultiplier: 3.205, luckMultiplier: 1.53, xpMultiplier: 1.1 };

describe('party API adapters', () => {
  it('reads nested telemetry, not deployment-stage guesses', () => {
    const [member] = mapParty(profile, { Test: { stage: 'Running', telemetry: { live: true, stats, activeEffects: [{ id: 'lonewolf', ms: 60000 }] } } });
    expect(member).toMatchObject({ skin: 'mwarrior2', hp: 25, maxHp: 100, status: 'online', freeSlots: null, map: 'main', x: 125, y: -42, level: 82, target: 'stoneworm', runtime: 'browser', deploymentStage: 'Running', goldMultiplier: 3.205, luckMultiplier: 1.53, xpMultiplier: 1.1, activeEffects: [{ id: 'lonewolf', ms: 60000 }] });
  });
  it('does not fabricate resources or trust stale telemetry', () => {
    expect(mapParty(profile, {})[0]).toMatchObject({ hp: null, map: null, status: 'offline' });
    expect(mapParty(profile, { Test: { stage: 'Running', telemetry: { live: false, stats } } })[0].hp).toBeNull();
  });
  it('preserves zero HP and identifies death', () => {
    expect(mapParty(profile, { Test: { telemetry: { live: true, stats: { ...stats, hp: 0 } } } })[0]).toMatchObject({ hp: 0, status: 'dead' });
  });
  it('distinguishes intentionally disabled characters from missing telemetry', () => {
    const disabled = { ...profile, characters: [{ ...profile.characters[0], enabled: false }] };
    expect(mapParty(disabled, {})[0].status).toBe('disabled');
  });
  it('orders persisted activity and normalizes unknown severity', () => {
    const entry = { time: '2026-09-20T00:00:00Z', character: '', level: 'custom', message: 'hello' };
    const input = [{ ...entry, id: 2 }, { ...entry, id: 1 }];
    expect(mapActivity(input).map(log => log.id)).toEqual([1, 2]);
    expect(mapActivity(input)[0]).toMatchObject({ level: 'info', source: 'System' });
    expect(input[0].id).toBe(2);
  });
});

describe('profile draft transformations', () => {
  it('keeps unrelated merchant, character and farming configuration intact', () => {
    const updated = updateAutomation(profile, 'events', true);
    expect(updated.events.enabled).toBe(true);
    expect(profile.events.enabled).toBe(false);
    expect(updated.seller).toBe(profile.seller);
    expect(updated.farming).toBe(profile.farming);
    expect(updated.characters).toBe(profile.characters);
  });
  it('compares edits to the original revision and recognizes reverted changes', () => {
    const base = { profile, version: 3, updatedAt: '' };
    const updated = updateAutomation(profile, 'hunts', true);
    expect(isDirty({ base, profile: updated })).toBe(true);
    expect(isDirty({ base, profile: updateAutomation(updated, 'hunts', false) })).toBe(false);
    expect(isDirty(null)).toBe(false);
  });
});
