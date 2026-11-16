/** MCP token input with show/hide and the connection test button. */
import type { JSX } from 'solid-js';
import { createSignal } from 'solid-js';
import { t } from '../../i18n/i18n.ts';

export interface TokenFieldProps {
  readonly value: string;
  readonly hasSavedToken: boolean;
  readonly testing: boolean;
  readonly onInput: (value: string) => void;
  readonly onTest: () => void;
}

export function TokenField(props: TokenFieldProps): JSX.Element {
  const [visible, setVisible] = createSignal(false);
  return (
    <>
      <label class="stacked" for="settings-token"><span>{t('settings.tokenLabel')}</span></label>
      <div class="row">
        <input
          id="settings-token"
          type={visible() ? 'text' : 'password'}
          autocomplete="off"
          spellcheck={false}
          value={props.value}
          placeholder={props.hasSavedToken ? t('settings.tokenSaved') : ''}
          onInput={(event) => { props.onInput(event.currentTarget.value); }}
        />
        <button type="button" class="quiet" aria-pressed={visible()} onClick={() => setVisible(!visible())}>
          {visible() ? t('settings.hideToken') : t('settings.showToken')}
        </button>
        <button type="button" disabled={props.testing} onClick={() => { props.onTest(); }}>
          {props.testing ? t('settings.testing') : t('settings.test')}
        </button>
      </div>
      <p class="help">{props.hasSavedToken ? `${t('settings.tokenKeep')} ${t('settings.tokenHelp')}` : t('settings.tokenHelp')}</p>
    </>
  );
}
