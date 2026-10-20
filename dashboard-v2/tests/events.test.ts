import { describe, expect, it } from 'vitest';
import { profileSchema } from '../shared/schema';
import {
  EVENT_DEFINITIONS,
  eventLabel,
  eventStyle,
  setAllEvents,
  setCharacterEvents,
  setEventAllowed,
  setEventsEnabled,
  setEventStyle,
} from '../src/models/events';
import type { Catalog } from '../src/types';

const profile = profileSchema.parse({
  name: 'Events', server: { region: 'EU', name: 'III' },
  characters: [
    { name: 'Tank', ctype: 'warrior', enabled: true, runtime: 'browser', script: 'tank', follow: '', events: true, job: 'hunt', overrides: {} },
    { name: 'Healer', ctype: 'priest', enabled: true, runtime: 'browser', script: 'heal', follow: 'Tank', events: false, job: 'hunt', overrides: {} },
  ],
  farming: { defaultMonster: 'goo', hunts: true, allowedHunts: [], rareVisits: true },
  events: { enabled: true, allowed: ['goobrawl'], style: { goobrawl: 'aoe' } },
  seller: { npcEnabled: false, npcItems: [], standEnabled: false, listings: [] },
});

describe('event profile transformations', () => {
  it('updates the master and character switches without mutating the profile', () => {
    const paused = setEventsEnabled(profile, false);
    const healer = setCharacterEvents(paused, 'Healer', true);
    expect(paused.events.enabled).toBe(false);
    expect(healer.characters.find(character => character.name === 'Healer')?.events).toBe(true);
    expect(profile.events.enabled).toBe(true);
    expect(profile.characters[1].events).toBe(false);
  });

  it('adds an event once and seeds its supported default style', () => {
    const added = setEventAllowed(profile, 'crabxx', true);
    const repeated = setEventAllowed(added, 'crabxx', true);
    expect(repeated.events.allowed.filter(id => id === 'crabxx')).toHaveLength(1);
    expect(repeated.events.style.crabxx).toBe('mono');
  });

  it('removes an event while preserving its style for a future re-enable', () => {
    const styled = setEventStyle(profile, 'goobrawl', 'tank');
    const removed = setEventAllowed(styled, 'goobrawl', false);
    expect(removed.events.allowed).not.toContain('goobrawl');
    expect(removed.events.style.goobrawl).toBe('tank');
  });

  it('supports deterministic allow-all and clear operations', () => {
    const all = setAllEvents(profile, true);
    expect(all.events.allowed).toEqual(EVENT_DEFINITIONS.map(event => event.id));
    expect(EVENT_DEFINITIONS.every(event => eventStyle(all, event))).toBe(true);
    expect(setAllEvents(all, false).events.allowed).toEqual([]);
  });

  it('uses catalog names when available and falls back to the curated label', () => {
    const event = EVENT_DEFINITIONS.find(entry => entry.id === 'jr')!;
    const catalog = { scripts: [], items: [], assets: {}, importedAt: '', sourceDirectory: '', monsters: [{ id: 'jr', name: 'Junior' }] } satisfies Catalog;
    expect(eventLabel(event, catalog)).toBe('Junior');
    expect(eventLabel(event)).toBe('Jr.');
  });
});
