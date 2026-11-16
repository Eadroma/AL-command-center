/**
 * State and actions of the Settings screen: form values, connection test, save.
 * Kept out of the component so the component only lays out fields.
 */
import type { Accessor } from 'solid-js';
import { createSignal } from 'solid-js';
import type { SetStoreFunction } from 'solid-js/store';
import { createStore } from 'solid-js/store';
import type { AccountCheck, ApiError } from '../../../shared/account.ts';
import { accountCheckSchema } from '../../../shared/account.ts';
import type { SettingsResponse } from '../../../shared/settings.ts';
import { settingsSavedSchema } from '../../../shared/settings.ts';
import { apiSend } from '../../api/http.ts';
import type { SettingsForm } from './settings-form.ts';
import { initialForm, pickServer } from './settings-form.ts';

export type Busy = 'idle' | 'testing' | 'saving';
export type Notice = { readonly kind: 'error'; readonly error: ApiError } | { readonly kind: 'saved'; readonly restartPort: number | null };

export interface SettingsActions {
  readonly form: SettingsForm;
  readonly setForm: SetStoreFunction<SettingsForm>;
  readonly check: Accessor<AccountCheck | null>;
  readonly busy: Accessor<Busy>;
  readonly notice: Accessor<Notice | null>;
  readonly test: () => Promise<void>;
  readonly save: () => Promise<void>;
}

export function createSettingsActions(initial: SettingsResponse, onSaved: (settings: SettingsResponse) => void): SettingsActions {
  const [form, setForm] = createStore(initialForm(initial));
  const [check, setCheck] = createSignal<AccountCheck | null>(null);
  const [busy, setBusy] = createSignal<Busy>('idle');
  const [notice, setNotice] = createSignal<Notice | null>(null);

  const test = async (): Promise<void> => {
    setBusy('testing');
    setNotice(null);
    const result = await apiSend({ method: 'POST', path: '/api/settings/test', body: { mcpToken: form.mcpToken }, schema: accountCheckSchema });
    setBusy('idle');
    if (!result.ok) {
      setNotice({ kind: 'error', error: result.error });
      return;
    }
    setCheck(result.value);
    setForm(pickServer(result.value.servers, form));
  };

  const save = async (): Promise<void> => {
    setBusy('saving');
    setNotice(null);
    const result = await apiSend({ method: 'PUT', path: '/api/settings', body: { ...form }, schema: settingsSavedSchema });
    setBusy('idle');
    if (!result.ok) {
      setNotice({ kind: 'error', error: result.error });
      return;
    }
    setForm('mcpToken', '');
    setNotice({ kind: 'saved', restartPort: result.value.restartRequired ? form.port : null });
    onSaved(result.value.settings);
  };

  return { form, setForm, check, busy, notice, test, save };
}
