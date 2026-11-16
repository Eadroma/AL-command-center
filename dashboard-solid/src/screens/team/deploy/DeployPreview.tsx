/**
 * Deployment section of the Team screen: preview the saved revision (sends nothing to the game) and the CODE
 * history with rollback. Deploying itself joins this section with the Save → Preview → Deploy bar.
 */
import type { JSX } from 'solid-js';
import { For, Show } from 'solid-js';
import type { DeployState } from '../../../deploy/deploy-state.ts';
import type { PreviewState } from '../../../deploy/preview-state.ts';
import { errorMessage } from '../../../i18n/error-message.ts';
import { t } from '../../../i18n/i18n.ts';
import type { ProfileState } from '../../../profile/profile-state.ts';
import { DeployHistory } from './DeployHistory.tsx';
import { PreviewCharacter } from './PreviewCharacter.tsx';
import './DeployPreview.css';

export interface DeployPreviewProps {
  readonly profile: ProfileState;
  readonly deploy: DeployState;
  readonly preview: PreviewState;
  readonly now: number;
}

export function DeployPreview(props: DeployPreviewProps): JSX.Element {
  const revision = (): number | null => props.profile.saved()?.revision ?? null;
  // The preview uses the saved profile: nothing to preview yet, or unsaved edits that it would not show.
  const blocker = (): string | null => {
    if (props.profile.saved() === null) {
      return t('preview.noProfile');
    }
    return props.profile.dirty() ? t('preview.saveFirst') : null;
  };
  return (
    <section class="deploy-preview" aria-labelledby="deploy-preview-title">
      <h3 id="deploy-preview-title">{t('preview.title')}</h3>
      <p class="dim">{t('preview.intro')}</p>
      <div class="deploy-preview-actions">
        <Show when={revision()}>
          {(current) => (
            <button type="button" class="primary" disabled={blocker() !== null || props.preview.busy() !== null} aria-describedby="deploy-preview-blocker" onClick={() => { void props.preview.preview(current()).then(async () => props.deploy.refresh()); }}>
              {props.preview.busy() === 'previewing' ? t('preview.running') : t('preview.run', { revision: current() })}
            </button>
          )}
        </Show>
        <Show when={blocker()}>{(reason) => <span id="deploy-preview-blocker" class="dim">{reason()}</span>}</Show>
      </div>
      <Show when={props.preview.error()}>{(error) => <p class="preview-error" role="alert">{errorMessage(error())}</p>}</Show>
      <Show when={props.preview.result()}>
        {(result) => (
          <>
            <h4 class="preview-heading">{t('preview.revision', { revision: result().revision })}</h4>
            <ul class="preview-list"><For each={result().characters}>{(character) => <PreviewCharacter character={character} />}</For></ul>
          </>
        )}
      </Show>
      <DeployHistory state={props.preview} enabled={props.deploy.deployments()?.enabled === true} now={props.now} />
    </section>
  );
}
