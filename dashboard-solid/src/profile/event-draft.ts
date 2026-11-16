/**
 * Event edits on the profile draft (pure, same rules as dashboard-v2's events model): the events section and the
 * farming boss checks are changed key by key, so every other setting keeps its value and order.
 */
import { EVENTS } from '../../shared/events.ts';
import type { JsonRecord } from '../../shared/raw.ts';
import { record, strings } from '../../shared/raw.ts';
import type { Draft } from './draft.ts';

function updateEvents(draft: Draft, change: (events: JsonRecord) => JsonRecord): Draft {
  return { ...draft, profile: { ...draft.profile, events: change(record(draft.profile['events'])) } };
}

const withId = (values: readonly string[], id: string, on: boolean): string[] => (on ? [...new Set([...values, id])] : values.filter((value) => value !== id));

export function setEventsEnabled(draft: Draft, enabled: boolean): Draft {
  return updateEvents(draft, (events) => ({ ...events, enabled }));
}

/** Allows or forbids an event; a newly allowed one gets its default style. */
export function setEventAllowed(draft: Draft, id: string, allowed: boolean): Draft {
  return updateEvents(draft, (events) => {
    const styles = record(events['style']);
    const fallback = EVENTS.find((entry) => entry.id === id)?.defaultStyle;
    const style = allowed && fallback !== undefined && !Object.hasOwn(styles, id) ? { ...styles, [id]: fallback } : styles;
    return { ...events, allowed: withId(strings(events['allowed']), id, allowed), style };
  });
}

/** The combat style (aoe, mono, tank or a custom loadout) the characters use for this event. */
export function setEventStyle(draft: Draft, id: string, style: string): Draft {
  return updateEvents(draft, (events) => ({ ...events, style: { ...record(events['style']), [id]: style } }));
}

export interface BossRule {
  readonly boss: string;
  readonly everyMinutes: number;
}

/** Recurring boss checks (farming.bossChecks): on / off and the list of bosses with their interval. */
export function setBossChecks(draft: Draft, patch: { readonly enabled?: boolean; readonly rules?: readonly BossRule[] }): Draft {
  const farming = record(draft.profile['farming']);
  const checks = { enabled: false, rules: [], ...record(farming['bossChecks']), ...patch };
  return { ...draft, profile: { ...draft.profile, farming: { ...farming, bossChecks: checks } } };
}
