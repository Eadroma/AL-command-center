/** Script runtime, default language and advanced options. */
import type { JSX } from 'solid-js';
import { For } from 'solid-js';
import { isLocale, LOCALES, t } from '../../i18n/i18n.ts';
import type { SettingsForm } from './settings-form.ts';

export interface OptionFieldsProps {
  readonly form: SettingsForm;
  readonly onChange: (patch: Partial<SettingsForm>) => void;
}

export function OptionFields(props: OptionFieldsProps): JSX.Element {
  return (
    <>
      <fieldset>
        <legend>{t('settings.runtime')}</legend>
        <label class="choice">
          <input type="radio" name="runtime" id="runtime-browser" checked={props.form.runtime === 'browser'} onChange={() => { props.onChange({ runtime: 'browser' }); }} />
          {t('settings.runtimeBrowser')}
        </label>
        <label class="choice">
          <input type="radio" name="runtime" id="runtime-mainframe" checked={props.form.runtime === 'mainframe'} onChange={() => { props.onChange({ runtime: 'mainframe' }); }} />
          {t('settings.runtimeMainframe')}
        </label>
      </fieldset>
      <label class="stacked">
        <span>{t('settings.defaultLanguage')}</span>
        <select id="settings-language" onChange={(event) => {
          const language = event.currentTarget.value;
          if (isLocale(language)) {
            props.onChange({ language });
          }
        }}>
          <For each={LOCALES}>{(code) => <option value={code} selected={code === props.form.language}>{t(`languages.${code}`)}</option>}</For>
        </select>
      </label>
      <details>
        <summary>{t('settings.advanced')}</summary>
        <label class="stacked">
          <span>{t('settings.port')}</span>
          <input id="settings-port" type="number" min="1024" max="65535" value={props.form.port}
            onInput={(event) => { props.onChange({ port: event.currentTarget.valueAsNumber }); }} />
        </label>
        <p class="help">{t('settings.portHelp')}</p>
      </details>
    </>
  );
}
