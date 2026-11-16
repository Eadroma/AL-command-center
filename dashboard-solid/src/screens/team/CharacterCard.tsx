/**
 * One character on the Team screen, as a notched game slot: sprite, name, class, level, freshness,
 * HP/MP in the game's colours, activity and map. Unknown values show "—", never a guess.
 */
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';
import { formatAgo } from '../../i18n/format.ts';
import { locale, t } from '../../i18n/i18n.ts';
import { CharacterSprite } from '../../ui/CharacterSprite.tsx';
import { Meter } from '../../ui/Meter.tsx';
import { className } from '../settings/Roster.tsx';
import type { CharacterCardModel } from './team-view.ts';

function Freshness(props: { readonly card: CharacterCardModel; readonly now: number }): JSX.Element {
  return (
    <Show when={props.card.live.freshness !== 'live'} fallback={<span class="fresh live">{t('team.live')}</span>}>
      <span class="fresh stale">
        {props.card.live.lastSeen === null ? '—' : t('team.seenAgo', { ago: formatAgo((props.now - props.card.live.lastSeen) / 1000, locale()) })}
      </span>
    </Show>
  );
}

export interface CharacterCardProps {
  readonly card: CharacterCardModel;
  readonly now: number;
  readonly onOpen: (name: string) => void;
}

export function CharacterCard(props: CharacterCardProps): JSX.Element {
  const live = (): CharacterCardModel['live'] => props.card.live;
  return (
    <article id={`character-${props.card.name}`} class="character-card slot" classList={{ stale: live().freshness !== 'live' }} aria-label={props.card.name}>
      <CharacterSprite frame={props.card.sprite} scale={2} />
      <div class="identity">
        <h3>{props.card.name}</h3>
        <span class="class">{className(props.card.className)}</span>
        <span class="level">{props.card.level === null ? '—' : t('team.level', { level: props.card.level })}</span>
        <Freshness card={props.card} now={props.now} />
      </div>
      <div class="vitals">
        <Meter label={t('team.hp')} value={live().hp} max={live().maxHp} tone="hp" />
        <Meter label={t('team.mp')} value={live().mp} max={live().maxMp} tone="mp" />
      </div>
      <p class="activity">{live().activity ?? t('team.idle')}</p>
      <p class="map">{live().map ?? t('team.unknownMap')}</p>
      <button type="button" class="quiet open" aria-label={t('panel.openLabel', { name: props.card.name })} onClick={() => { props.onOpen(props.card.name); }}>
        {t('panel.open')}
      </button>
    </article>
  );
}
