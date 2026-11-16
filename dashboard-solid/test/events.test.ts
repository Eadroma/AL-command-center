/** Events: allowed list and builds, recurring boss checks; edits keep the other settings in place. */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Profile } from '../shared/profile.ts';
import { record } from '../shared/raw.ts';
import type { Draft } from '../src/profile/draft.ts';
import { setBossChecks, setEventAllowed, setEventStyle, setEventsEnabled } from '../src/profile/event-draft.ts';
import { intervalsWith, nextBossRule, readEvents, replaceRule, styleOptions } from '../src/screens/events/event-view.ts';

const profile: Profile = {
  name: 'Party', server: { region: 'EU', name: 'III' }, characters: [],
  farming: { defaultMonster: 'goo', bossChecks: { enabled: false, rules: [{ boss: 'jr', everyMinutes: 240 }] }, loadouts: { Hero: { aoe: {}, Lucky: {} } } },
  events: { expedition: { enabled: false, allowed: ['mrgreen'], maxMinutes: 20, maxDeaths: 3 }, enabled: true, allowed: ['mrgreen', 'crabxx'], style: { crabxx: 'tank' } },
};
const draft: Draft = { revision: 7, profile };
const events = (next: Draft): Record<string, unknown> => record(next.profile['events']);

describe('event edits', () => {
  it('allows an event with its default style, never overwriting a chosen one', () => {
    const next = setEventAllowed(setEventAllowed(draft, 'franky', true), 'crabxx', true);
    assert.deepEqual(events(next)['allowed'], ['mrgreen', 'crabxx', 'franky']);
    assert.deepEqual(events(next)['style'], { crabxx: 'tank', franky: 'aoe' });
    assert.deepEqual(Object.keys(events(next)), ['expedition', 'enabled', 'allowed', 'style']);
    assert.deepEqual(events(draft)['allowed'], ['mrgreen', 'crabxx']);
  });

  it('forbids an event, leaving the stored duo settings alone; the style can be a custom loadout', () => {
    const next = setEventStyle(setEventAllowed(draft, 'mrgreen', false), 'crabxx', 'Lucky');
    assert.deepEqual(events(next)['allowed'], ['crabxx']);
    assert.deepEqual(record(events(next)['expedition'])['allowed'], ['mrgreen']);
    assert.deepEqual(events(next)['style'], { crabxx: 'Lucky' });
    assert.equal(events(setEventsEnabled(draft, false))['enabled'], false);
  });

  it('changes boss checks in the farming section only', () => {
    const next = setBossChecks(draft, { enabled: true, rules: [{ boss: 'dragold', everyMinutes: 60 }] });
    const farming = record(next.profile['farming']);
    assert.deepEqual(farming['bossChecks'], { enabled: true, rules: [{ boss: 'dragold', everyMinutes: 60 }] });
    assert.deepEqual(Object.keys(farming), ['defaultMonster', 'bossChecks', 'loadouts']);
    assert.deepEqual(record(setBossChecks({ revision: 1, profile: { ...profile, farming: {} } }, { enabled: true }).profile['farming'])['bossChecks'], { enabled: true, rules: [] });
  });
});

describe('events view', () => {
  it('reads the sections, with defaults when they are missing', () => {
    const view = readEvents(profile);
    assert.deepEqual([view.enabled, view.allowed, view.styles, view.checks.rules], [true, ['mrgreen', 'crabxx'], { crabxx: 'tank' }, [{ boss: 'jr', everyMinutes: 240 }]]);
    const empty = readEvents({ ...profile, events: undefined, farming: undefined });
    assert.deepEqual([empty.enabled, empty.allowed, empty.checks], [false, [], { enabled: false, rules: [] }]);
  });

  it('offers the base styles then custom loadouts, the next unchecked boss and known intervals', () => {
    assert.deepEqual(styleOptions(profile), ['aoe', 'mono', 'tank', 'Lucky']);
    assert.deepEqual(nextBossRule([{ boss: 'dragold', everyMinutes: 60 }]), { boss: 'jr', everyMinutes: 240 });
    assert.deepEqual(replaceRule([{ boss: 'a', everyMinutes: 1 }, { boss: 'b', everyMinutes: 2 }], 0, null), [{ boss: 'b', everyMinutes: 2 }]);
    assert.equal(intervalsWith(240).length, 9);
    assert.deepEqual(intervalsWith(90).slice(2, 5), [60, 90, 120]);
  });
});
