/**
 * Application shell: header with the live connection badge, then the Settings screen when settings are
 * missing or invalid (or opened from the header), otherwise the Team and Merchant screens. The /live feed opens once here.
 */
import type { JSX } from 'solid-js';
import { createResource, createSignal, Match, Show, Switch } from 'solid-js';
import type { ApiError } from '../shared/account.ts';
import type { PublicSettings, SettingsResponse } from '../shared/settings.ts';
import { settingsResponseSchema } from '../shared/settings.ts';
import { apiGet } from './api/http.ts';
import { createLiveTeam } from './api/live.ts';
import { errorMessage } from './i18n/error-message.ts';
import { t } from './i18n/i18n.ts';
import { SettingsScreen } from './screens/settings/SettingsScreen.tsx';
import { ConnectionBadge } from './ui/ConnectionBadge.tsx';
import { LanguageSwitcher } from './ui/LanguageSwitcher.tsx';
import { Workspace } from './Workspace.tsx';

function readySettings(response: SettingsResponse): PublicSettings | null {
  return response.status === 'ready' ? response.settings : null;
}

export function App(): JSX.Element {
  const [result, { mutate }] = createResource(() => apiGet('/api/settings', settingsResponseSchema));
  const [settingsOpen, setSettingsOpen] = createSignal(false);
  const live = createLiveTeam();
  const settings = (): SettingsResponse | null => { const current = result(); return current?.ok === true ? current.value : null; };
  const failure = (): ApiError | null => { const current = result(); return current?.ok === false ? current.error : null; };

  return (
    <>
      <header class="app-header">
        <h1 class="brand">ALCC</h1>
        <ConnectionBadge connection={live.connection} />
        <span class="grow" />
        <LanguageSwitcher />
        <button type="button" class="quiet" onClick={() => setSettingsOpen(true)}>{t('settings.open')}</button>
      </header>
      <main class="app-main">
        <Switch fallback={<p class="dim">{t('common.loading')}</p>}>
          <Match when={failure()}>{(error) => <p class="dim" role="alert">{errorMessage(error())}</p>}</Match>
          <Match when={settings()}>
            {(current) => (
              <Show when={current().status === 'ready' && !settingsOpen()} fallback={
                <SettingsScreen settings={current()} onSaved={(next) => mutate({ ok: true, value: next })}
                  {...(current().status === 'ready' ? { onClose: () => setSettingsOpen(false) } : {})} />
              }>
                <Show when={readySettings(current())}>
                  {(saved) => <Workspace settings={saved()} team={live.team} />}
                </Show>
              </Show>
            )}
          </Match>
        </Switch>
      </main>
    </>
  );
}
