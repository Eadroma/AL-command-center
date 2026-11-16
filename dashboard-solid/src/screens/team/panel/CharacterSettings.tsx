/**
 * The character's own settings, edited in the profile draft. Saving writes a new profile revision and never
 * deploys. Script and farming target are shown here, chosen on their own screens (builder, farming).
 */
import type { JSX } from 'solid-js';
import { For, Show } from 'solid-js';
import type { ProfileCharacter } from '../../../../shared/profile.ts';
import { errorMessage } from '../../../i18n/error-message.ts';
import { t } from '../../../i18n/i18n.ts';
import type { ProfileState } from '../../../profile/profile-state.ts';
import { SaveRow } from '../../profile/SaveRow.tsx';

const RUNTIMES = ['browser', 'caracal'] as const satisfies readonly ProfileCharacter['runtime'][];

export interface CharacterSettingsProps {
  readonly name: string;
  readonly state: ProfileState;
}

function Fields(props: { readonly character: ProfileCharacter; readonly others: readonly string[]; readonly state: ProfileState }): JSX.Element {
  const edit = (patch: Parameters<ProfileState['editCharacter']>[1]): void => { props.state.editCharacter(props.character.name, patch); };
  return (
    <div class="panel-settings-fields">
      <label class="panel-check">
        <input type="checkbox" checked={props.character.enabled} aria-describedby="panel-enabled-help" onChange={(event) => { edit({ enabled: event.currentTarget.checked }); }} />
        {t('profile.enabled')}
      </label>
      <p id="panel-enabled-help" class="panel-note">{t('profile.enabledHelp')}</p>
      <label class="panel-check">
        <input type="checkbox" checked={props.character.events} onChange={(event) => { edit({ events: event.currentTarget.checked }); }} />
        {t('profile.events')}
      </label>
      <label class="panel-field">
        {t('profile.follow')}
        <select onChange={(event) => { edit({ follow: event.currentTarget.value }); }}>
          <option value="" selected={props.character.follow === ''}>{t('profile.followNobody')}</option>
          <For each={props.others}>{(other) => <option value={other} selected={props.character.follow === other}>{other}</option>}</For>
        </select>
      </label>
      <label class="panel-field">
        {t('profile.runtime')}
        <select onChange={(event) => { const value = event.currentTarget.value; edit({ runtime: RUNTIMES.find((runtime) => runtime === value) ?? 'browser' }); }}>
          <For each={RUNTIMES}>
            {(runtime) => <option value={runtime} selected={props.character.runtime === runtime}>{runtime === 'browser' ? t('profile.runtimeBrowser') : t('profile.runtimeCaracal')}</option>}
          </For>
        </select>
      </label>
      <dl class="panel-readonly">
        <dt>{t('profile.script')}</dt>
        <dd>{props.character.script === '' ? t('profile.scriptNone') : props.character.script}</dd>
        <dt>{t('profile.target')}</dt>
        <dd>{props.character.farmMonster === '' ? t('profile.targetDefault') : props.character.farmMonster}</dd>
      </dl>
    </div>
  );
}

export function CharacterSettings(props: CharacterSettingsProps): JSX.Element {
  const characters = (): readonly ProfileCharacter[] => props.state.draft()?.profile.characters ?? [];
  const character = (): ProfileCharacter | undefined => characters().find((entry) => entry.name === props.name);
  return (
    <Show when={props.state.draft() !== null}>
      <section aria-labelledby="panel-settings">
        <h3 id="panel-settings">{t('profile.settings')}</h3>
        <Show when={character()} fallback={<p class="panel-note">{t('profile.notInProfile')}</p>}>
          {(current) => <Fields character={current()} others={characters().filter((entry) => entry.name !== props.name).map((entry) => entry.name)} state={props.state} />}
        </Show>
        <Show when={props.state.dirty()}><SaveRow state={props.state} /></Show>
        <Show when={props.state.error()}>
          {(error) => (
            <p class="panel-error" role="alert">
              {errorMessage(error())}
              <Show when={error().code === 'profile.conflict'}>
                {' '}<button type="button" class="quiet" onClick={() => { void props.state.reload(); }}>{t('profile.reload')}</button>
              </Show>
            </p>
          )}
        </Show>
      </section>
    </Show>
  );
}
