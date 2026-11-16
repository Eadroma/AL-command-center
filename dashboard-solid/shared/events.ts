/**
 * Events and bosses the scripts know (same lists as dashboard-v2): the events the farmers may join and the timed
 * world bosses the party checks.
 */
export type EventKind = 'event' | 'boss';

export interface EventDefinition {
  readonly id: string;
  readonly kind: EventKind;
  /** Combat style used when the profile has none for this event. */
  readonly defaultStyle: 'aoe' | 'mono';
  /** The game monster that shows the event (name and sprite); none for events without one. */
  readonly monster: string | null;
}

const event = (id: string, kind: EventKind, defaultStyle: 'aoe' | 'mono'): EventDefinition => ({ id, kind, defaultStyle, monster: id });

export const EVENTS: readonly EventDefinition[] = [
  event('horseman', 'event', 'mono'), { ...event('graveyard', 'event', 'aoe'), monster: 'gargoyle' }, event('crabxx', 'event', 'mono'),
  { ...event('goobrawl', 'event', 'aoe'), monster: null }, event('franky', 'event', 'aoe'), event('icegolem', 'event', 'mono'),
  { ...event('abtesting', 'event', 'aoe'), monster: null }, event('phoenix', 'boss', 'mono'), event('jr', 'boss', 'mono'),
  event('greenjr', 'boss', 'mono'), event('mrpumpkin', 'boss', 'mono'), event('mrgreen', 'boss', 'mono'),
  event('snowman', 'boss', 'mono'), event('dragold', 'boss', 'mono'), event('grinch', 'boss', 'mono'),
  event('wabbit', 'boss', 'mono'), event('pinkgoo', 'boss', 'aoe'), event('slenderman', 'boss', 'mono'), event('tiger', 'boss', 'mono'),
];

/** Timed open-world bosses the party can check on a schedule (dashboard-v2's worldBosses). */
export const WORLD_BOSSES: readonly string[] = ['dragold', 'jr', 'greenjr', 'mvampire', 'fvampire', 'stompy', 'bscorpion', 'mrpumpkin', 'mrgreen'];
/** Selectable check intervals, in minutes. */
export const BOSS_CHECK_INTERVALS: readonly number[] = [15, 30, 60, 120, 240, 360, 480, 720, 1440];
