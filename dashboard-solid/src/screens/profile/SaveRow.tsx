/** "Unsaved changes" with Save / Discard, wherever the profile draft is edited. Saving never deploys. */
import type { JSX } from 'solid-js';
import { t } from '../../i18n/i18n.ts';
import type { ProfileState } from '../../profile/profile-state.ts';
import './SaveRow.css';

export function SaveRow(props: { readonly state: ProfileState }): JSX.Element {
  return (
    <div class="save-row" role="group" aria-label={t('profile.unsaved')}>
      <p>{t('profile.unsaved')} <span class="save-row-note">{t('profile.noDeploy')}</span></p>
      <button type="button" class="primary" disabled={props.state.busy() !== null} onClick={() => { void props.state.save(); }}>
        {props.state.busy() === 'saving' ? t('profile.saving') : t('profile.save')}
      </button>
      <button type="button" class="quiet" disabled={props.state.busy() !== null} onClick={() => { props.state.discard(); }}>{t('profile.discard')}</button>
    </div>
  );
}
