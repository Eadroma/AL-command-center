/** One character in the deployment preview: what it is compared with, and the settings that would change. */
import type { JSX } from 'solid-js';
import { For, Show } from 'solid-js';
import type { PreviewCharacter as Preview } from '../../../../shared/deploy.ts';
import { builderMessage } from '../../../deploy/builder-messages.ts';
import { t } from '../../../i18n/i18n.ts';

const MAX_VALUE = 80;

/** A setting value on one line: JSON, shortened; nothing → dash. */
export function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return t('preview.empty');
  }
  const text = JSON.stringify(value);
  return text.length > MAX_VALUE ? `${text.slice(0, MAX_VALUE - 1)}…` : text;
}

function comparison(character: Preview): string {
  if (character.comparison === 'slot') {
    return t('preview.compared', { slot: character.slot ?? '' });
  }
  return character.comparison === 'noSlot' ? t('preview.noSlot') : t('preview.unreadable');
}

function Changes(props: { readonly character: Preview }): JSX.Element {
  return (
    <Show when={props.character.changes.length > 0} fallback={<p class="dim">{t('preview.noChange')}</p>}>
      <details class="preview-changes">
        <summary>{t('preview.changes', { count: props.character.changes.length })}</summary>
        <table>
          <thead><tr><th scope="col">{t('preview.setting')}</th><th scope="col">{t('preview.before')}</th><th scope="col">{t('preview.after')}</th></tr></thead>
          <tbody>
            <For each={props.character.changes}>
              {(change) => <tr><th scope="row">{change.key}</th><td>{formatValue(change.before)}</td><td>{formatValue(change.after)}</td></tr>}
            </For>
          </tbody>
        </table>
      </details>
    </Show>
  );
}

export function PreviewCharacter(props: { readonly character: Preview }): JSX.Element {
  return (
    <li class="preview-character slot" classList={{ failed: props.character.error !== null }}>
      <header>
        <h4>{props.character.name}</h4>
        <span class="dim">{props.character.script}</span>
      </header>
      <Show when={props.character.error} fallback={
        <>
          <p>
            {comparison(props.character)}
            <Show when={props.character.sourceChanged !== null}>
              {' · '}{props.character.sourceChanged === true ? t('preview.sourceChanged') : t('preview.sourceSame')}
            </Show>
          </p>
          <Changes character={props.character} />
          <Show when={props.character.warnings.length > 0}>
            <details class="preview-warnings">
              <summary>{t('preview.warnings')}</summary>
              <ul><For each={props.character.warnings}>{(warning) => <li>{builderMessage(warning)}</li>}</For></ul>
            </details>
          </Show>
        </>
      }>
        {(error) => <p class="preview-error" role="alert">{builderMessage(error())}</p>}
      </Show>
    </li>
  );
}
