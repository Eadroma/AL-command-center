import type { Catalog, Profile } from '../types';
import type { FarmStyle } from '../../shared/schema';

export interface EventDefinition {
  id: string;
  label: string;
  kind: 'event' | 'boss';
  defaultStyle: FarmStyle;
  monsterId?: string;
}

export const EVENT_DEFINITIONS: readonly EventDefinition[] = [
  { id: 'horseman', label: 'Headless Horseman', kind: 'event', defaultStyle: 'mono' },
  { id: 'graveyard', label: 'Graveyard Rising · Gargoyle', monsterId: 'gargoyle', kind: 'event', defaultStyle: 'aoe' },
  { id: 'crabxx', label: 'Giga Crab', kind: 'event', defaultStyle: 'mono' },
  { id: 'goobrawl', label: 'Goo Brawl', kind: 'event', defaultStyle: 'aoe' },
  { id: 'franky', label: 'Franky', kind: 'event', defaultStyle: 'aoe' },
  { id: 'icegolem', label: 'Ice Golem', kind: 'event', defaultStyle: 'mono' },
  { id: 'abtesting', label: 'A/B Testing', kind: 'event', defaultStyle: 'aoe' },
  { id: 'phoenix', label: 'Phoenix', kind: 'boss', defaultStyle: 'mono' },
  { id: 'jr', label: 'Jr.', kind: 'boss', defaultStyle: 'mono' },
  { id: 'greenjr', label: 'Green Jr.', kind: 'boss', defaultStyle: 'mono' },
  { id: 'mrpumpkin', label: 'Mr. Pumpkin', kind: 'boss', defaultStyle: 'mono' },
  { id: 'mrgreen', label: 'Mr. Green', kind: 'boss', defaultStyle: 'mono' },
  { id: 'snowman', label: 'Snowman', kind: 'boss', defaultStyle: 'mono' },
  { id: 'dragold', label: 'Dragold', kind: 'boss', defaultStyle: 'mono' },
  { id: 'grinch', label: 'Grinch', kind: 'boss', defaultStyle: 'mono' },
  { id: 'wabbit', label: 'Wabbit', kind: 'boss', defaultStyle: 'mono' },
  { id: 'pinkgoo', label: 'Pink Goo', kind: 'boss', defaultStyle: 'aoe' },
  { id: 'slenderman', label: 'Slenderman', kind: 'boss', defaultStyle: 'mono' },
  { id: 'tiger', label: 'Tiger', kind: 'boss', defaultStyle: 'mono' },
];

export function eventLabel(event: EventDefinition, catalog?: Catalog) {
  return catalog?.monsters.find(monster => monster.id === event.id)?.name || event.label;
}

export function eventStyle(profile: Profile, event: EventDefinition): FarmStyle {
  return profile.events.style[event.id] ?? event.defaultStyle;
}

export function setEventsEnabled(profile: Profile, enabled: boolean): Profile {
  return { ...profile, events: { ...profile.events, enabled } };
}

export function setCharacterEvents(profile: Profile, name: string, enabled: boolean): Profile {
  return { ...profile, characters: profile.characters.map(character => character.name === name ? { ...character, events: enabled } : character) };
}

export function setEventAllowed(profile: Profile, id: string, allowed: boolean): Profile {
  const next = allowed ? [...new Set([...profile.events.allowed, id])] : profile.events.allowed.filter(value => value !== id);
  const definition = EVENT_DEFINITIONS.find(event => event.id === id);
  const style = allowed && definition && profile.events.style[id] === undefined
    ? { ...profile.events.style, [id]: definition.defaultStyle }
    : profile.events.style;
  return { ...profile, events: { ...profile.events, allowed: next, style, expedition: { ...profile.events.expedition, allowed: profile.events.expedition.allowed.filter(event => next.includes(event)) } } };
}

export function setAllEvents(profile: Profile, allowed: boolean): Profile {
  if (!allowed) return { ...profile, events: { ...profile.events, allowed: [], expedition: { ...profile.events.expedition, allowed: [] } } };
  const styles = { ...profile.events.style };
  for (const event of EVENT_DEFINITIONS) styles[event.id] ??= event.defaultStyle;
  return { ...profile, events: { ...profile.events, allowed: EVENT_DEFINITIONS.map(event => event.id), style: styles } };
}

export function setEventStyle(profile: Profile, id: string, style: FarmStyle): Profile {
  return { ...profile, events: { ...profile.events, style: { ...profile.events.style, [id]: style } } };
}
