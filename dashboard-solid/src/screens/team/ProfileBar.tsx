/**
 * Profile banner on the Team screen: creates the first profile (import from v2, or cautious) and then names the
 * saved revision and where it came from. Replacing an existing profile asks for confirmation first.
 */
import type { JSX } from 'solid-js';
import { createSignal, Match, Show, Switch } from 'solid-js';
import type { SavedProfile } from '../../../shared/profile.ts';
import { errorMessage } from '../../i18n/error-message.ts';
import { t } from '../../i18n/i18n.ts';
import type { ProfileState } from '../../profile/profile-state.ts';
import { EventsDialog } from '../events/EventsDialog.tsx';
import { FarmingDialog } from '../farming/FarmingDialog.tsx';
import { LoadoutsDialog } from '../loadouts/LoadoutsDialog.tsx';
import './ProfileBar.css';

function originLabel(origin: string): string {
  const v2 = /^v2 revision (\d+)$/.exec(origin);
  if (v2 !== null) {
    return t('profile.originV2', { revision: v2[1] ?? '' });
  }
  return origin === 'cautious' ? t('profile.originCautious') : t('profile.originDashboard');
}

function Missing(props: { readonly state: ProfileState }): JSX.Element {
  return (
    <>
      <p>{t('profile.missing')}</p>
      <div class="profile-actions">
        <button type="button" class="primary" disabled={props.state.busy() !== null} onClick={() => { void props.state.importV2(); }}>
          {props.state.busy() === 'importing' ? t('profile.importing') : t('profile.importV2')}
        </button>
        <button type="button" disabled={props.state.busy() !== null} aria-describedby="profile-cautious-help" onClick={() => { void props.state.createCautious(); }}>
          {props.state.busy() === 'creating' ? t('profile.creating') : t('profile.cautious')}
        </button>
        <span id="profile-cautious-help" class="dim">{t('profile.cautiousHelp')}</span>
      </div>
    </>
  );
}

function Ready(props: { readonly state: ProfileState; readonly saved: SavedProfile }): JSX.Element {
  const [confirming, setConfirming] = createSignal(false);
  const [farming, setFarming] = createSignal(false);
  const [loadouts, setLoadouts] = createSignal(false);
  const [events, setEvents] = createSignal(false);
  return (
    <div class="profile-ready">
      <p>
        <strong>{t('profile.summary', { name: props.saved.profile.name, revision: props.saved.revision })}</strong>
        <span class="dim">{` · ${originLabel(props.saved.origin)}`}</span>
      </p>
      <button type="button" onClick={() => setFarming(true)}>{t('farming.open')}</button>
      <FarmingDialog open={farming()} profile={props.state} onClose={() => setFarming(false)} />
      <button type="button" onClick={() => setLoadouts(true)}>{t('loadouts.open')}</button>
      <LoadoutsDialog open={loadouts()} profile={props.state} onClose={() => setLoadouts(false)} />
      <button type="button" onClick={() => setEvents(true)}>{t('events.open')}</button>
      <EventsDialog open={events()} profile={props.state} onClose={() => setEvents(false)} />
      <Show when={confirming()} fallback={
        <button type="button" class="quiet" disabled={props.state.busy() !== null} onClick={() => setConfirming(true)}>{t('profile.reimport')}</button>
      }>
        <span class="profile-confirm" role="group" aria-label={t('profile.reimportConfirm')}>
          <span>{t('profile.reimportConfirm')}</span>
          <button type="button" class="primary" onClick={() => { setConfirming(false); void props.state.importV2(); }}>{t('profile.confirm')}</button>
          <button type="button" class="quiet" onClick={() => setConfirming(false)}>{t('profile.cancel')}</button>
        </span>
      </Show>
    </div>
  );
}

export function ProfileBar(props: { readonly state: ProfileState }): JSX.Element {
  return (
    <section class="profile-bar" aria-labelledby="profile-title">
      <h3 id="profile-title">{t('profile.title')}</h3>
      <Switch>
        <Match when={props.state.loadError()}>{(error) => <p role="alert">{errorMessage(error())}</p>}</Match>
        <Match when={props.state.saved() === null}><Missing state={props.state} /></Match>
        <Match when={props.state.saved()}>{(saved) => <Ready state={props.state} saved={saved()} />}</Match>
      </Switch>
      <Show when={props.state.error()}>
        {(error) => (
          <p class="profile-error" role="alert">
            {errorMessage(error())}
            <Show when={error().code === 'profile.conflict'}>
              {' '}<button type="button" class="quiet" onClick={() => { void props.state.reload(); }}>{t('profile.reload')}</button>
            </Show>
          </p>
        )}
      </Show>
    </section>
  );
}
