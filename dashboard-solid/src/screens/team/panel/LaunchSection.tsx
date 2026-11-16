/**
 * The character's CODE in the panel: last deployment step, slot, what the game reports, and start / stop / check.
 * While deploy.enabled is false the buttons stay visible but disabled, with the reason (no hidden feature).
 */
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';
import type { Deployment } from '../../../../shared/deploy.ts';
import type { DeployState } from '../../../deploy/deploy-state.ts';
import { errorMessage } from '../../../i18n/error-message.ts';
import { formatAgo } from '../../../i18n/format.ts';
import { locale, t } from '../../../i18n/i18n.ts';

export interface LaunchSectionProps {
  readonly name: string;
  readonly state: DeployState;
  readonly now: number;
}

function GameReport(props: { readonly deployment: Deployment }): JSX.Element {
  return (
    <ul class="panel-facts">
      <Show when={props.deployment.slot}>{(slot) => <li>{t('deploy.slot', { slot: slot() })}</li>}</Show>
      <Show when={props.deployment.online !== null}><li>{props.deployment.online === true ? t('deploy.online') : t('deploy.offline')}</li></Show>
      <Show when={props.deployment.codeRunning !== null}><li>{props.deployment.codeRunning === true ? t('deploy.running') : t('deploy.stopped')}</li></Show>
    </ul>
  );
}

export function LaunchSection(props: LaunchSectionProps): JSX.Element {
  const deployment = (): Deployment | null => props.state.of(props.name);
  const enabled = (): boolean => props.state.deployments()?.enabled === true;
  const disabled = (): boolean => !enabled() || props.state.pending() !== null;
  const run = (action: 'start' | 'stop' | 'status'): void => { void props.state.control(props.name, action); };
  return (
    <section aria-labelledby="panel-launch">
      <h3 id="panel-launch">{t('deploy.title')}</h3>
      <Show when={deployment()} fallback={<p class="panel-note">{t('deploy.never')}</p>}>
        {(current) => (
          <>
            <p class="panel-activity">{t('deploy.last', { stage: t(`deploy.stage.${current().stage}`), ago: formatAgo((props.now - Date.parse(current().at)) / 1000, locale()) })}</p>
            <Show when={current().error}>{(error) => <p class="panel-error" role="alert">{errorMessage(error())}</p>}</Show>
            <GameReport deployment={current()} />
          </>
        )}
      </Show>
      <Show when={!enabled()}><p id="panel-launch-locked" class="panel-note">{t('deploy.locked')}</p></Show>
      <div class="panel-launch-actions">
        <button type="button" disabled={disabled()} aria-describedby={enabled() ? undefined : 'panel-launch-locked'} onClick={() => { run('start'); }}>{t('deploy.start')}</button>
        <button type="button" disabled={disabled()} aria-describedby={enabled() ? undefined : 'panel-launch-locked'} onClick={() => { run('stop'); }}>{t('deploy.stop')}</button>
        <button type="button" class="quiet" disabled={disabled()} onClick={() => { run('status'); }}>{t('deploy.status')}</button>
        <Show when={props.state.pending() === props.name}><span class="panel-note" role="status">{t('deploy.working')}</span></Show>
      </div>
      <Show when={props.state.error()?.character === props.name ? props.state.error()?.error : null}>
        {(error) => <p class="panel-error" role="alert">{errorMessage(error())}</p>}
      </Show>
      <Show when={enabled()}><p class="panel-note">{t('deploy.requestNote')}</p></Show>
    </section>
  );
}
