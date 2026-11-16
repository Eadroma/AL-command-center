/**
 * "To handle" banner at the top of the Team screen: one row per signal, severity shown by the game's colours
 * (HP red = danger, gold = warning, MP blue = info), each with a link to the character card and, when it makes
 * sense, a dismiss button. Dismissed keys are stored by the server (see server/routes/attention.ts).
 */
import type { JSX } from 'solid-js';
import { For, Match, Show, Switch } from 'solid-js';
import { formatAgo } from '../../i18n/format.ts';
import { locale, t } from '../../i18n/i18n.ts';
import type { Signal } from './attention.ts';
import { isDismissable } from './attention.ts';
import './AttentionBanner.css';

export interface AttentionBannerProps {
  readonly signals: readonly Signal[];
  readonly now: number;
  readonly onDismiss: (key: string) => void;
  readonly onRetryGameData: () => void;
}

function message(signal: Signal, now: number): string {
  const ago = (at: number): string => formatAgo((now - at) / 1000, locale());
  switch (signal.kind) {
    case 'death':
      return t('attention.death', { name: signal.character, ago: ago(signal.at), reason: signal.reason });
    case 'lowHp':
      return t('attention.lowHp', { name: signal.character, percent: signal.percent });
    case 'silent':
      return t('attention.silent', { name: signal.character, ago: ago(signal.at) });
    case 'never':
      return t('attention.never', { name: signal.character });
    case 'gameData':
      return t('attention.gameData');
    default: {
      const exhaustive: never = signal;
      return exhaustive;
    }
  }
}

export function AttentionBanner(props: AttentionBannerProps): JSX.Element {
  return (
    <section class="attention" aria-labelledby="attention-title">
      <h3 id="attention-title">{t('attention.title')}</h3>
      <Show when={props.signals.length > 0} fallback={<p class="attention-none">{t('attention.none')}</p>}>
        <ul>
          <For each={props.signals}>
            {(signal) => (
              <li class={`signal signal-${signal.severity}`}>
                <span class="signal-text">{message(signal, props.now)}</span>
                <span class="signal-actions">
                  <Switch>
                    <Match when={signal.kind === 'gameData'}>
                      <button type="button" class="quiet" onClick={() => { props.onRetryGameData(); }}>{t('attention.retry')}</button>
                    </Match>
                    <Match when={'character' in signal ? signal.character : null}>
                      {(name) => (
                        // Silent characters sit in a folded section: unfold it so the browser can scroll to the card.
                        <a href={`#character-${name()}`} onClick={() => { document.getElementById(`character-${name()}`)?.closest('details')?.setAttribute('open', ''); }}>
                          {t('attention.show')}
                        </a>
                      )}
                    </Match>
                  </Switch>
                  <Show when={isDismissable(signal)}>
                    <button type="button" class="quiet" onClick={() => { props.onDismiss(signal.key); }}>{t('attention.dismiss')}</button>
                  </Show>
                </span>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </section>
  );
}
