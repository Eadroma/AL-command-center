/** Profile draft: immutable edits, original revision kept, dirty detection. */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { SavedProfile } from '../shared/profile.ts';
import { record } from '../shared/raw.ts';
import { draftOf, isDirty, patchCharacter, patchFarming, setBase, setCharacterTarget, setGear, setSkills } from '../src/profile/draft.ts';

const saved: SavedProfile = {
  revision: 4, updatedAt: '2026-10-27T00:00:00.000Z', origin: 'dashboard',
  profile: { name: 'Main party', server: { region: 'EU', name: 'III' }, characters: [
    { name: 'Eadroma', ctype: 'warrior', enabled: false, runtime: 'browser', script: '', follow: '', events: false, job: 'hunt', farmMonster: '', overrides: {} },
  ] },
};

describe('profile draft', () => {
  it('edits a character without touching the saved profile, keeping the revision', () => {
    const draft = patchCharacter(draftOf(saved), 'Eadroma', { enabled: true });
    assert.equal(draft.revision, 4);
    assert.equal(draft.profile.characters[0]?.enabled, true);
    assert.equal(saved.profile.characters[0]?.enabled, false);
    assert.equal(isDirty(draft, saved), true);
    assert.equal(isDirty(draftOf(saved), saved), false);
  });
});

describe('farming targets in the draft', () => {
  const withFarming = { ...saved, profile: { ...saved.profile, farming: { defaultMonster: 'goo', hunts: true, style: { goo: 'aoe' }, rareVisits: false, loadouts: {} } } };

  it('changes the team target and rare visits, keeping the other farming keys in place', () => {
    const draft = patchFarming(draftOf(withFarming), { defaultMonster: 'bigbird', rareVisits: true }, ['bigbird']);
    assert.deepEqual(Object.keys(record(draft.profile['farming'])), ['defaultMonster', 'hunts', 'style', 'rareVisits', 'loadouts']);
    assert.deepEqual(draft.profile['farming'], { defaultMonster: 'bigbird', hunts: true, style: { goo: 'aoe', bigbird: 'mono' }, rareVisits: true, loadouts: {} });
  });

  it('sets a character target with a style for a new monster, and never overwrites a chosen style', () => {
    const first = setCharacterTarget(draftOf(withFarming), { name: 'Eadroma', monster: 'crab' }, ['bigbird']);
    assert.equal(first.profile.characters[0]?.farmMonster, 'crab');
    assert.deepEqual(record(first.profile['farming'])['style'], { goo: 'aoe', crab: 'aoe' });
    const back = setCharacterTarget(first, { name: 'Eadroma', monster: 'goo' }, ['goo']);
    assert.deepEqual(record(back.profile['farming'])['style'], { goo: 'aoe', crab: 'aoe' });
    assert.equal(setCharacterTarget(first, { name: 'Eadroma', monster: '' }, []).profile.characters[0]?.farmMonster, '');
  });
});

describe('loadouts in the draft', () => {
  const aoe = { base: 'aoe', gear: [{ slot: 'mainhand', item: 'ololipop', minLevel: 7 }, { slot: 'belt', item: 'strbelt', minLevel: 1 }], skills: ['taunt'] };
  const withLoadouts = { ...saved, profile: { ...saved.profile, farming: { defaultMonster: 'goo', loadouts: { Eadroma: { aoe, mono: aoe }, Other: { aoe } } } } };
  const loadout = (draft: ReturnType<typeof draftOf>, character = 'Eadroma', style = 'aoe'): unknown => record(record(record(draft.profile['farming'])['loadouts'])[character])[style];
  const target = { character: 'Eadroma', style: 'aoe' };

  it('replaces the gear of a slot in place, adds a new slot at the end, and bounds the level', () => {
    const swapped = setGear(draftOf(withLoadouts), { ...target, slot: 'mainhand' }, { item: 'fireblade', minLevel: 99 });
    assert.deepEqual(record(loadout(swapped))['gear'], [{ slot: 'mainhand', item: 'fireblade', minLevel: 15 }, { slot: 'belt', item: 'strbelt', minLevel: 1 }]);
    const added = setGear(swapped, { ...target, slot: 'cape' }, { item: 'cape', minLevel: -2 });
    assert.deepEqual(record(loadout(added))['gear'], [{ slot: 'mainhand', item: 'fireblade', minLevel: 15 }, { slot: 'belt', item: 'strbelt', minLevel: 1 }, { slot: 'cape', item: 'cape', minLevel: 0 }]);
  });

  it('empties a slot, changes skills and base, and leaves the other loadouts untouched', () => {
    const changed = setBase(setSkills(setGear(draftOf(withLoadouts), { ...target, slot: 'belt' }, null), target, ['taunt', 'charge']), target, 'tank');
    assert.deepEqual(loadout(changed), { base: 'tank', gear: [{ slot: 'mainhand', item: 'ololipop', minLevel: 7 }], skills: ['taunt', 'charge'] });
    assert.deepEqual(loadout(changed, 'Eadroma', 'mono'), aoe);
    assert.deepEqual(loadout(changed, 'Other'), aoe);
    assert.deepEqual(loadout(draftOf(withLoadouts)), aoe);
  });
});
