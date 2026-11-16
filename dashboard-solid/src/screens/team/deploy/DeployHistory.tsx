/** CODE backups, newest first, each with Restore (confirmed on the spot, refused while deployment is locked). */
import type { JSX } from 'solid-js';
import { createSignal, For, Show } from 'solid-js';
import type { Backup } from '../../../../shared/deploy.ts';
import type { PreviewState } from '../../../deploy/preview-state.ts';
import { formatAgo } from '../../../i18n/format.ts';
import { locale, t } from '../../../i18n/i18n.ts';

export interface DeployHistoryProps {
  readonly state: PreviewState;
  readonly enabled: boolean;
  readonly now: number;
}

function BackupRow(props: { readonly backup: Backup } & DeployHistoryProps): JSX.Element {
  const [confirming, setConfirming] = createSignal(false);
  const when = (): string => formatAgo((props.now - Date.parse(props.backup.at)) / 1000, locale());
  return (
    <li>
      <span>
        {t('preview.backup', { name: props.backup.character, slot: props.backup.slot, when: when() })}
        <span class="dim">{` · ${t('preview.size', { size: new Intl.NumberFormat(locale()).format(props.backup.bytes) })}`}</span>
      </span>
      <Show when={confirming()} fallback={
        <button type="button" class="quiet" disabled={!props.enabled || props.state.busy() !== null} aria-describedby={props.enabled ? undefined : 'history-locked'} onClick={() => setConfirming(true)}>
          {t('preview.restore')}
        </button>
      }>
        <span class="history-confirm" role="group" aria-label={t('preview.restoreConfirm', { name: props.backup.character })}>
          <span>{t('preview.restoreConfirm', { name: props.backup.character })}</span>
          <button type="button" class="primary" onClick={() => { setConfirming(false); void props.state.rollback(props.backup.id); }}>{t('preview.confirm')}</button>
          <button type="button" class="quiet" onClick={() => setConfirming(false)}>{t('preview.cancel')}</button>
        </span>
      </Show>
    </li>
  );
}

export function DeployHistory(props: DeployHistoryProps): JSX.Element {
  return (
    <details class="deploy-history">
      <summary>{t('preview.history')}</summary>
      <p class="dim">{t('preview.historyHelp')}</p>
      <Show when={!props.enabled}><p id="history-locked" class="dim">{t('preview.locked')}</p></Show>
      <Show when={props.state.backups().length > 0} fallback={<p class="dim">{t('preview.noBackups')}</p>}>
        <ul class="history-list">
          <For each={props.state.backups()}>{(backup) => <BackupRow backup={backup} state={props.state} enabled={props.enabled} now={props.now} />}</For>
        </ul>
      </Show>
      <Show when={props.state.busy() === 'restoring'}><p class="dim" role="status">{t('preview.restoring')}</p></Show>
    </details>
  );
}
