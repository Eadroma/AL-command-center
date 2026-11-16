/**
 * Character panel, opened from a card: what the character is doing, why (simplified explanation), its script and
 * its recent log. A native modal <dialog>: focus moves in, Escape closes, focus returns to the card's button.
 * Its own settings edit the profile draft; Launch starts or stops its CODE (refused while deploy.enabled is false).
 */
import type { JSX } from 'solid-js';
import { createEffect, For, Show } from 'solid-js';
import { formatAgo, formatClock } from '../../../i18n/format.ts';
import { locale, t } from '../../../i18n/i18n.ts';
import { CharacterSprite } from '../../../ui/CharacterSprite.tsx';
import { className } from '../../settings/Roster.tsx';
import type { CharacterCardModel } from '../team-view.ts';
import type { ProfileState } from '../../../profile/profile-state.ts';
import type { DeployState } from '../../../deploy/deploy-state.ts';
import { CharacterSettings } from './CharacterSettings.tsx';
import { LaunchSection } from './LaunchSection.tsx';
import { explain, isWarning, quotesScript } from './explain.ts';
import { explanationText } from './explanation-text.ts';
import './CharacterPanel.css';

export interface CharacterPanelProps {
  /** The character shown, or null when the panel is closed. */
  readonly card: CharacterCardModel | null;
  readonly now: number;
  readonly profile: ProfileState;
  readonly deploy: DeployState;
  readonly onClose: () => void;
}

function Doing(props: { readonly card: CharacterCardModel; readonly now: number }): JSX.Element {
  const live = (): CharacterCardModel['live'] => props.card.live;
  const round = (value: number): number => Math.round(value);
  return (
    <section aria-labelledby="panel-doing">
      <h3 id="panel-doing">{live().freshness === 'live' ? t('panel.doing') : t('panel.lastKnown')}</h3>
      <p class="panel-activity">{live().activity ?? t('panel.noActivity')}</p>
      <ul class="panel-facts">
        <Show when={live().insight.since}>{(since) => <li>{t('panel.since', { ago: formatAgo((props.now - since()) / 1000, locale()) })}</li>}</Show>
        <Show when={live().map !== null && live().x !== null && live().y !== null}>
          <li>{t('panel.position', { map: live().map ?? '', x: round(live().x ?? 0), y: round(live().y ?? 0) })}</li>
        </Show>
        <Show when={live().insight.destination}>{(to) => <li>{t('panel.destination', { map: to().map, x: round(to().x), y: round(to().y) })}</li>}</Show>
      </ul>
    </section>
  );
}

function Why(props: { readonly card: CharacterCardModel; readonly now: number }): JSX.Element {
  const explanation = (): ReturnType<typeof explain> => explain(props.card.live);
  const text = (): ReturnType<typeof explanationText> => explanationText(explanation(), props.now);
  return (
    <section aria-labelledby="panel-why" class="panel-why" classList={{ warning: isWarning(explanation()) }}>
      <h3 id="panel-why">{t('panel.why')}</h3>
      <p class="panel-action">{text().action}</p>
      <p>{text().reason}</p>
      <h4>{t('panel.next')}</h4>
      <p>{text().next}</p>
      <Show when={quotesScript(explanation())}>
        <p class="panel-note">{t('panel.quoted')}</p>
      </Show>
    </section>
  );
}

function ScriptAndLog(props: { readonly card: CharacterCardModel }): JSX.Element {
  const live = (): CharacterCardModel['live'] => props.card.live;
  return (
    <>
      <section aria-labelledby="panel-script">
        <h3 id="panel-script">{t('panel.script')}</h3>
        <p>
          <span class="panel-script-name">{live().insight.script ?? t('panel.scriptUnknown')}</span>
          {' · '}
          {live().source === 'v2' ? t('panel.viaV2') : t('panel.viaTelemetry')}
        </p>
      </section>
      <section aria-labelledby="panel-log">
        <h3 id="panel-log">{t('panel.log')}</h3>
        <Show when={live().logs.length > 0} fallback={<p class="panel-note">{t('panel.noLog')}</p>}>
          <ol class="panel-log">
            <For each={[...live().logs].reverse().slice(0, 10)}>
              {(line) => <li><time datetime={new Date(line.at).toISOString()}>{formatClock(line.at, locale())}</time><span>{line.message}</span></li>}
            </For>
          </ol>
        </Show>
      </section>
    </>
  );
}

export function CharacterPanel(props: CharacterPanelProps): JSX.Element {
  let dialog: HTMLDialogElement | undefined;
  createEffect(() => {
    if (props.card !== null && dialog?.open === false) {
      dialog.showModal();
    }
    if (props.card === null && dialog?.open === true) {
      dialog.close();
    }
  });

  return (
    <dialog ref={(element) => { dialog = element; }} class="character-panel slot" aria-labelledby="panel-title" onClose={() => { props.onClose(); }}>
      <Show when={props.card}>
        {(card) => (
          <>
            <header class="panel-head">
              <CharacterSprite frame={card().sprite} scale={2} />
              <div>
                <h2 id="panel-title">{card().name}</h2>
                <p>{className(card().className)}{card().level === null ? '' : ` · ${t('team.level', { level: card().level ?? 0 })}`}</p>
              </div>
              <button type="button" class="quiet" onClick={() => { dialog?.close(); }}>{t('panel.close')}</button>
            </header>
            <Why card={card()} now={props.now} />
            <Doing card={card()} now={props.now} />
            <CharacterSettings name={card().name} state={props.profile} />
            <LaunchSection name={card().name} state={props.deploy} now={props.now} />
            <ScriptAndLog card={card()} />
          </>
        )}
      </Show>
    </dialog>
  );
}
