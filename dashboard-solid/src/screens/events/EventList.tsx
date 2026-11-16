/** The events the team may leave its farm for, by kind, each with the build (combat style) it uses there. */
import type { JSX } from 'solid-js';
import { For, Show } from 'solid-js';
import type { MonsterSummary } from '../../../shared/game.ts';
import type { EventKind } from '../../../shared/events.ts';
import { EVENTS } from '../../../shared/events.ts';
import { t } from '../../i18n/i18n.ts';
import { setEventAllowed, setEventStyle } from '../../profile/event-draft.ts';
import type { ProfileState } from '../../profile/profile-state.ts';
import { FrameImage } from '../../ui/FrameImage.tsx';
import type { EventLook } from './event-names.ts';
import { eventLook } from './event-names.ts';
import type { EventsView } from './event-view.ts';

export interface EventListProps {
  readonly view: EventsView;
  readonly styles: readonly string[];
  readonly monsters: ReadonlyMap<string, MonsterSummary>;
  readonly profile: ProfileState;
  readonly styleName: (style: string) => string;
}

function EventRow(props: EventListProps & { readonly id: string; readonly fallback: string }): JSX.Element {
  const look = (): EventLook => eventLook(props.id, props.monsters);
  const allowed = (): boolean => props.view.allowed.includes(props.id);
  const style = (): string => props.view.styles[props.id] ?? props.fallback;
  const options = (): readonly string[] => (props.styles.includes(style()) ? props.styles : [...props.styles, style()]);
  return (
    <li class="event-row" classList={{ off: !allowed() }}>
      <label class="event-allow">
        <input type="checkbox" checked={allowed()} aria-label={t('events.allow', { name: look().name })}
          onChange={(event) => { const id = props.id; const on = event.currentTarget.checked; props.profile.edit((draft) => setEventAllowed(draft, id, on)); }} />
        <FrameImage frame={look().sprite} box={32} />
        <span>{look().name}</span>
      </label>
      <Show when={allowed()}>
        <select aria-label={t('events.build', { name: look().name })} value={style()}
          onChange={(event) => { const id = props.id; const value = event.currentTarget.value; props.profile.edit((draft) => setEventStyle(draft, id, value)); }}>
          <For each={options()}>{(option) => <option value={option}>{props.styleName(option)}</option>}</For>
        </select>
      </Show>
    </li>
  );
}

function Group(props: EventListProps & { readonly kind: EventKind }): JSX.Element {
  return (
    <div class="event-group">
      <h4>{props.kind === 'event' ? t('events.kindEvent') : t('events.kindBoss')}</h4>
      <ul class="event-rows">
        <For each={EVENTS.filter((entry) => entry.kind === props.kind)}>{(entry) => <EventRow {...props} id={entry.id} fallback={entry.defaultStyle} />}</For>
      </ul>
    </div>
  );
}

export function EventList(props: EventListProps): JSX.Element {
  const setAll = (on: boolean): void => {
    props.profile.edit((draft) => EVENTS.reduce((next, entry) => setEventAllowed(next, entry.id, on), draft));
  };
  return (
    <section aria-labelledby="events-list">
      <h3 id="events-list">{t('events.list')}</h3>
      <p class="dim">{t('events.listHelp')}</p>
      <div class="events-actions">
        <button type="button" onClick={() => { setAll(true); }}>{t('events.allowAll')}</button>
        <button type="button" class="quiet" onClick={() => { setAll(false); }}>{t('events.allowNone')}</button>
      </div>
      <div class="event-groups">
        <Group {...props} kind="event" />
        <Group {...props} kind="boss" />
      </div>
    </section>
  );
}
