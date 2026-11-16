/**
 * Team screen (home): every character's live state, pushed by the server over /live.
 * Reporting characters first; those never heard from are folded, with what to do about it.
 */
import type { Accessor, JSX } from 'solid-js';
import { createResource, createSignal, For, Show } from 'solid-js';
import { accountCharactersSchema } from '../../../shared/account.ts';
import { characterSpritesSchema } from '../../../shared/game.ts';
import type { PublicSettings } from '../../../shared/settings.ts';
import type { TeamLive } from '../../../shared/telemetry.ts';
import { apiGet } from '../../api/http.ts';
import { t } from '../../i18n/i18n.ts';
import { attentionSignals } from './attention.ts';
import { createAttentionState } from './attention-state.ts';
import { AttentionBanner } from './AttentionBanner.tsx';
import { CharacterCard } from './CharacterCard.tsx';
import type { DeployState } from '../../deploy/deploy-state.ts';
import type { ProfileState } from '../../profile/profile-state.ts';
import { PartyMap } from './map/PartyMap.tsx';
import { CharacterPanel } from './panel/CharacterPanel.tsx';
import { ProfileBar } from './ProfileBar.tsx';
import { buildTeamView } from './team-view.ts';
import './TeamScreen.css';

export interface TeamScreenProps {
  readonly settings: PublicSettings;
  readonly team: Accessor<TeamLive | null>;
  readonly profile: ProfileState;
  readonly deploy: DeployState;
  readonly now: Accessor<number>;
}

/** Live state merged with the account roster (class, level) and the sprites. */
function createTeamView(team: Accessor<TeamLive | null>): Accessor<ReturnType<typeof buildTeamView>> {
  const [roster] = createResource(() => apiGet('/api/account/characters', accountCharactersSchema));
  const [sprites] = createResource(() => apiGet('/api/game/character-sprites', characterSpritesSchema));
  return () => {
    const rosterResult = roster();
    const spritesResult = sprites();
    return buildTeamView(team(), rosterResult?.ok === true ? rosterResult.value.characters : [], spritesResult?.ok === true ? spritesResult.value : null);
  };
}

export function TeamScreen(props: TeamScreenProps): JSX.Element {
  const view = createTeamView(() => props.team());

  const attention = createAttentionState();
  const [opened, setOpened] = createSignal<string | null>(null);

  return (
    <section class="team" aria-labelledby="team-title">
      <header class="team-head">
        <h2 id="team-title">{t('team.title')}</h2>
        <span class="server">{`${props.settings.region} ${props.settings.server}`}</span>
      </header>
      <ProfileBar state={props.profile} />
      <Show when={props.team() !== null} fallback={<p class="dim">{t('common.loading')}</p>}>
        <AttentionBanner
          signals={attentionSignals({ team: props.team(), job: attention.job(), dismissed: attention.dismissed(), now: props.now() })}
          now={props.now()}
          onDismiss={(key) => { void attention.dismiss(key); }}
          onRetryGameData={() => { void attention.retryGameData(); }}
        />
        <Show when={view().reporting.length > 0 || view().silent.length > 0} fallback={<p class="lead">{t('team.empty')}</p>}>
          <div class="cards">
            <For each={view().reporting}>{(card) => <CharacterCard card={card} now={props.now()} onOpen={setOpened} />}</For>
          </div>
          <PartyMap cards={view().reporting} now={props.now()} />
          <Show when={view().silent.length > 0}>
            <details class="silent">
              <summary>{t('team.silent', { count: view().silent.length })}</summary>
              <p class="help">{t('team.silentHelp')}</p>
              <div class="cards"><For each={view().silent}>{(card) => <CharacterCard card={card} now={props.now()} onOpen={setOpened} />}</For></div>
            </details>
          </Show>
        </Show>
      </Show>
      <CharacterPanel
        card={[...view().reporting, ...view().silent].find((card) => card.name === opened()) ?? null}
        now={props.now()} profile={props.profile} deploy={props.deploy} onClose={() => setOpened(null)}
      />
    </section>
  );
}
