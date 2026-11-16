/**
 * Settings screen: connect the account, choose the home server, set options, save.
 * A real sequence, hence numbered steps (docs/DESIGN.md). Shown on first launch and from the header.
 * Saving tests the token with the game first; nothing is written when the test fails.
 */
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';
import type { SettingsResponse } from '../../../shared/settings.ts';
import { errorMessage } from '../../i18n/error-message.ts';
import { t } from '../../i18n/i18n.ts';
import { OptionFields } from './OptionFields.tsx';
import { Roster } from './Roster.tsx';
import { ServerFields } from './ServerFields.tsx';
import type { Notice } from './settings-actions.ts';
import { createSettingsActions } from './settings-actions.ts';
import { TokenField } from './TokenField.tsx';
import './SettingsScreen.css';

export interface SettingsScreenProps {
  readonly settings: SettingsResponse;
  readonly onSaved: (settings: SettingsResponse) => void;
  readonly onClose?: () => void;
}

export function SettingsScreen(props: SettingsScreenProps): JSX.Element {
  // eslint-disable-next-line solid/reactivity -- the form starts from a one-time snapshot of the saved settings; edits then live in the form.
  const actions = createSettingsActions(props.settings, (next) => { props.onSaved(next); });
  const hasSavedToken = (): boolean => props.settings.status === 'ready' && props.settings.settings.hasToken;
  return (
    <section class="settings" aria-labelledby="settings-title">
      <header class="settings-head">
        <h2 id="settings-title">{t('settings.title')}</h2>
        <Show when={props.onClose}>{(close) => <button type="button" class="quiet" onClick={() => { close()(); }}>{t('settings.close')}</button>}</Show>
      </header>
      <p class="lead">{props.settings.status === 'missing' ? t('settings.missing') : t('settings.intro')}</p>
      <Show when={props.settings.status === 'invalid'}><p class="notice error">{t('settings.invalid')}</p></Show>
      <form onSubmit={(event) => { event.preventDefault(); void actions.save(); }}>
        <ol class="steps">
          <li class="step">
            <h3>{t('settings.stepConnect')}</h3>
            <div class="step-body">
              <TokenField value={actions.form.mcpToken} hasSavedToken={hasSavedToken()} testing={actions.busy() === 'testing'}
                onInput={(value) => { actions.setForm('mcpToken', value); }} onTest={() => { void actions.test(); }} />
              <Show when={actions.check()}>{(result) => <Roster characters={result().characters} />}</Show>
            </div>
          </li>
          <li class="step">
            <h3>{t('settings.stepServer')}</h3>
            <div class="step-body">
              <ServerFields servers={actions.check()?.servers ?? []} region={actions.form.region} server={actions.form.server}
                onChange={(region, server) => { actions.setForm({ region, server }); }} />
            </div>
          </li>
          <li class="step">
            <h3>{t('settings.stepOptions')}</h3>
            <div class="step-body"><OptionFields form={actions.form} onChange={(patch) => { actions.setForm(patch); }} /></div>
          </li>
        </ol>
        <SaveNotice notice={actions.notice()} />
        <div class="actions">
          <button type="submit" class="primary" disabled={actions.busy() !== 'idle'}>
            {actions.busy() === 'saving' ? t('settings.saving') : t('settings.save')}
          </button>
        </div>
      </form>
      <p class="help">{t('settings.file', { path: props.settings.file })}</p>
    </section>
  );
}

function SaveNotice(props: { readonly notice: Notice | null }): JSX.Element {
  return (
    <Show when={props.notice}>
      {(notice) => {
        const current = notice();
        if (current.kind === 'error') {
          return <p class="notice error" role="alert">{errorMessage(current.error)}</p>;
        }
        return (
          <p class="notice ok" role="status">
            {t('settings.saved')} {current.restartPort === null ? '' : t('settings.restartRequired', { port: current.restartPort })}
          </p>
        );
      }}
    </Show>
  );
}
