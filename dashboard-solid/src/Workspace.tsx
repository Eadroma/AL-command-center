/**
 * The two working screens, Team and Merchant, around the state they share: one profile draft, one preview, one
 * deployment. The Save → Preview → Deploy bar is the same on both. The screen shown follows the URL hash (#marchand),
 * so a reload or a bookmark comes back to it.
 */
import type { Accessor, JSX } from 'solid-js';
import { createSignal, Match, onCleanup, Switch } from 'solid-js';
import type { PublicSettings } from '../shared/settings.ts';
import type { TeamLive } from '../shared/telemetry.ts';
import { createDeployState } from './deploy/deploy-state.ts';
import { createPreviewState } from './deploy/preview-state.ts';
import { t } from './i18n/i18n.ts';
import { createProfileState } from './profile/profile-state.ts';
import { MerchantScreen } from './screens/merchant/MerchantScreen.tsx';
import { DeployBar } from './screens/team/deploy/DeployBar.tsx';
import { DeployPreview } from './screens/team/deploy/DeployPreview.tsx';
import { TeamScreen } from './screens/team/TeamScreen.tsx';
import './Workspace.css';

type Screen = 'team' | 'merchant';

const HASHES: Readonly<Record<Screen, string>> = { team: '', merchant: '#marchand' };

const screenOf = (hash: string): Screen => (hash === HASHES.merchant ? 'merchant' : 'team');

/** Relative times ("seen 3 minutes ago") move on even when no packet arrives. */
function createClock(): Accessor<number> {
  const [now, setNow] = createSignal(Date.now());
  const timer = setInterval(() => setNow(Date.now()), 15_000);
  onCleanup(() => { clearInterval(timer); });
  return now;
}

function createScreen(): [Accessor<Screen>, (screen: Screen) => void] {
  const [screen, setScreen] = createSignal(screenOf(location.hash));
  const follow = (): void => { setScreen(screenOf(location.hash)); };
  window.addEventListener('hashchange', follow);
  onCleanup(() => { window.removeEventListener('hashchange', follow); });
  return [screen, (next) => {
    // pushState keeps the back button working without the page jumping to an anchor.
    history.pushState(null, '', HASHES[next] === '' ? location.pathname : HASHES[next]);
    setScreen(next);
  }];
}

export function Workspace(props: { readonly settings: PublicSettings; readonly team: Accessor<TeamLive | null> }): JSX.Element {
  const profile = createProfileState();
  const deploy = createDeployState();
  const preview = createPreviewState();
  const now = createClock();
  const [screen, show] = createScreen();
  const tab = (target: Screen, label: string): JSX.Element => (
    <a href={HASHES[target] === '' ? '#' : HASHES[target]} aria-current={screen() === target ? 'page' : undefined}
      onClick={(event) => { event.preventDefault(); show(target); }}>{label}</a>
  );
  return (
    <>
      <nav class="screens" aria-label={t('common.screens')}>
        {tab('team', t('common.team'))}
        {tab('merchant', t('common.merchant'))}
      </nav>
      <Switch>
        <Match when={screen() === 'team'}><TeamScreen settings={props.settings} team={props.team} profile={profile} deploy={deploy} now={now} /></Match>
        <Match when={screen() === 'merchant'}><MerchantScreen profile={profile} team={props.team} now={now} /></Match>
      </Switch>
      <DeployPreview profile={profile} deploy={deploy} preview={preview} now={now()} />
      <DeployBar profile={profile} preview={preview} deploy={deploy} />
    </>
  );
}
