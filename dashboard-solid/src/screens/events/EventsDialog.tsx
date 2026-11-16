/**
 * Events, opened from the Profile banner: whether the team joins events and who takes part, which events with which
 * build, and recurring boss checks. Edits go to the profile draft
 * (Save / Discard); they reach the game at the next deployment.
 */
import type { JSX } from 'solid-js';
import { createEffect, createResource, For, Show } from 'solid-js';
import type { MonsterSummary } from '../../../shared/game.ts';
import { monstersSchema } from '../../../shared/game.ts';
import type { Profile } from '../../../shared/profile.ts';
import { BASE_STYLES } from '../../../shared/loadouts.ts';
import { apiGet } from '../../api/http.ts';
import { t } from '../../i18n/i18n.ts';
import { patchCharacter } from '../../profile/draft.ts';
import { setEventsEnabled } from '../../profile/event-draft.ts';
import type { ProfileState } from '../../profile/profile-state.ts';
import { SaveRow } from '../profile/SaveRow.tsx';
import { BossChecks } from './BossChecks.tsx';
import { EventList } from './EventList.tsx';
import type { EventsView } from './event-view.ts';
import { readEvents, styleOptions } from './event-view.ts';
import './EventsDialog.css';

export interface EventsDialogProps {
  readonly open: boolean;
  readonly profile: ProfileState;
  readonly onClose: () => void;
}

const styleName = (style: string): string => {
  const base = BASE_STYLES.find((entry) => entry === style);
  return base === undefined ? style : t(`loadouts.style.${base}`);
};

function Participation(props: { readonly view: EventsView; readonly characters: Profile['characters']; readonly profile: ProfileState }): JSX.Element {
  return (
    <section aria-label={t('events.master')}>
      <label class="events-check">
        <input type="checkbox" checked={props.view.enabled} aria-describedby="events-master-help"
          onChange={(event) => { const on = event.currentTarget.checked; props.profile.edit((draft) => setEventsEnabled(draft, on)); }} />
        {t('events.master')}
      </label>
      <p id="events-master-help" class="dim">{t('events.masterHelp')}</p>
      <h4>{t('events.characters')}</h4>
      <div class="events-people" role="group" aria-label={t('events.characters')} aria-describedby="events-people-help">
        <For each={props.characters}>
          {(character) => (
            <button type="button" aria-pressed={character.events} disabled={!props.view.enabled}
              onClick={() => { const name = character.name; const events = !character.events; props.profile.edit((draft) => patchCharacter(draft, name, { events })); }}>
              {character.name}
            </button>
          )}
        </For>
      </div>
      <p id="events-people-help" class="dim">{t('events.charactersHelp')}</p>
    </section>
  );
}

function Body(props: { readonly draft: Profile; readonly monsters: ReadonlyMap<string, MonsterSummary>; readonly profile: ProfileState }): JSX.Element {
  const view = (): EventsView => readEvents(props.draft);
  return (
    <>
      <Participation view={view()} characters={props.draft.characters} profile={props.profile} />
      <EventList view={view()} styles={styleOptions(props.draft)} monsters={props.monsters} profile={props.profile} styleName={styleName} />
      <BossChecks view={view()} monsters={props.monsters} profile={props.profile} />
    </>
  );
}

export function EventsDialog(props: EventsDialogProps): JSX.Element {
  const [monsters] = createResource(() => props.open || undefined, () => apiGet('/api/game/monsters', monstersSchema));
  const byKey = (): ReadonlyMap<string, MonsterSummary> => { const result = monsters(); return new Map(result?.ok === true ? result.value.monsters.map((monster) => [monster.key, monster]) : []); };
  let dialog: HTMLDialogElement | undefined;
  createEffect(() => {
    if (props.open && dialog?.open === false) {
      dialog.showModal();
    }
    if (!props.open && dialog?.open === true) {
      dialog.close();
    }
  });
  return (
    <dialog ref={(element) => { dialog = element; }} class="events-dialog slot" aria-labelledby="events-title" onClose={() => { props.onClose(); }}>
      <header class="events-head">
        <h2 id="events-title">{t('events.title')}</h2>
        <button type="button" class="quiet" onClick={() => { dialog?.close(); }}>{t('events.close')}</button>
      </header>
      <p class="dim">{t('events.intro')}</p>
      <Show when={props.profile.draft()} fallback={<p>{t('events.noProfile')}</p>}>
        {(draft) => <Body draft={draft().profile} monsters={byKey()} profile={props.profile} />}
      </Show>
      <Show when={props.profile.dirty()}><SaveRow state={props.profile} /></Show>
    </dialog>
  );
}
