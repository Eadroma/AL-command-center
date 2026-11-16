/**
 * Save → Preview → Deploy, pinned to the bottom of the screen. A real sequence, hence numbered steps: the current one
 * carries its action, the next ones say what they wait for. Deploying asks for confirmation, then lists who was
 * deployed and who failed with why (team deployment carries on after a failure).
 */
import type { JSX } from 'solid-js';
import { createSignal, For, Show } from 'solid-js';
import type { BarStep } from '../../../deploy/deploy-bar.ts';
import { barStep, deployBlocker } from '../../../deploy/deploy-bar.ts';
import type { DeployState } from '../../../deploy/deploy-state.ts';
import type { PreviewState } from '../../../deploy/preview-state.ts';
import { errorMessage } from '../../../i18n/error-message.ts';
import { t } from '../../../i18n/i18n.ts';
import type { ProfileState } from '../../../profile/profile-state.ts';
import './DeployBar.css';

export interface DeployBarProps {
  readonly profile: ProfileState;
  readonly preview: PreviewState;
  readonly deploy: DeployState;
}

const STEPS: readonly Exclude<BarStep, 'none'>[] = ['save', 'preview', 'deploy'];

/** The three steps: done ones in green, the current one in gold (aria-current), the next ones dimmed. */
function BarSteps(props: { readonly step: BarStep }): JSX.Element {
  const position = (): number => (props.step === 'none' ? 0 : STEPS.indexOf(props.step));
  return (
    <ol class="bar-steps">
      <For each={STEPS}>
        {(entry, index) => (
          <li classList={{ current: props.step === entry, done: position() > index() }} aria-current={props.step === entry ? 'step' : undefined}>
            {t(`bar.${entry}`)}
          </li>
        )}
      </For>
    </ol>
  );
}

function PartyOutcome(props: { readonly deploy: DeployState }): JSX.Element {
  return (
    <>
      <Show when={props.deploy.partyError()}>{(error) => <p class="bar-error" role="alert">{errorMessage(error())}</p>}</Show>
      <Show when={props.deploy.party()}>
        {(result) => (
          <div class="bar-outcome" role="status">
            <p>{result().deployed.length > 0 ? t('bar.deployed', { names: result().deployed.join(', ') }) : t('bar.nothingDeployed')}</p>
            <Show when={result().failures.length > 0}>
              <p class="bar-error">{t('bar.failed', { count: result().failures.length })}</p>
              <ul><For each={result().failures}>{(failure) => <li><strong>{failure.character}</strong>{` : ${errorMessage(failure.error)}`}</li>}</For></ul>
            </Show>
          </div>
        )}
      </Show>
    </>
  );
}

export function DeployBar(props: DeployBarProps): JSX.Element {
  const [confirming, setConfirming] = createSignal(false);
  const saved = (): number | null => props.profile.saved()?.revision ?? null;
  const enabledCount = (): number => props.profile.saved()?.profile.characters.filter((entry) => entry.enabled).length ?? 0;
  const input = (): Parameters<typeof barStep>[0] => ({
    savedRevision: saved(), dirty: props.profile.dirty(), previewedRevision: props.deploy.deployments()?.previewedRevision ?? null,
    enabled: props.deploy.deployments()?.enabled === true, busy: props.deploy.deploying() || props.preview.busy() !== null || props.profile.busy() !== null,
  });
  const step = (): BarStep => barStep(input());
  const blocker = (): string | null => { const reason = deployBlocker(input()); return reason === null ? null : t(`bar.blocker.${reason}`); };
  const preview = (revision: number): void => { void props.preview.preview(revision).then(async () => props.deploy.refresh()); };
  const deploy = (revision: number): void => { setConfirming(false); void props.deploy.deployParty(revision); };

  return (
    <section class="deploy-bar" aria-label={t('bar.label')}>
      <BarSteps step={step()} />
      <div class="bar-actions">
        <Show when={step() === 'save'}>
          <button type="button" class="primary" disabled={input().busy} onClick={() => { void props.profile.save(); }}>{t('bar.saveAction')}</button>
          <button type="button" class="quiet" disabled={input().busy} onClick={() => { props.profile.discard(); }}>{t('bar.discard')}</button>
        </Show>
        <Show when={step() === 'preview' ? saved() : null}>
          {(revision) => <button type="button" class="primary" disabled={input().busy} onClick={() => { preview(revision()); }}>{t('bar.previewAction', { revision: revision() })}</button>}
        </Show>
        <Show when={step() === 'deploy' ? saved() : null}>
          {(revision) => (
            <Show when={confirming()} fallback={
              <button type="button" class="primary" disabled={blocker() !== null} aria-describedby="bar-blocker" onClick={() => setConfirming(true)}>{t('bar.deployAction', { count: enabledCount() })}</button>
            }>
              <span class="bar-confirm" role="group" aria-label={t('bar.confirm', { revision: revision(), count: enabledCount() })}>
                <span>{t('bar.confirm', { revision: revision(), count: enabledCount() })}</span>
                <button type="button" class="primary" onClick={() => { deploy(revision()); }}>{t('bar.confirmAction')}</button>
                <button type="button" class="quiet" onClick={() => setConfirming(false)}>{t('bar.cancel')}</button>
              </span>
            </Show>
          )}
        </Show>
        <Show when={input().busy}><span class="dim" role="status">{t('bar.working')}</span></Show>
        <Show when={blocker()}>{(reason) => <span id="bar-blocker" class="dim">{reason()}</span>}</Show>
      </div>
      <PartyOutcome deploy={props.deploy} />
    </section>
  );
}
