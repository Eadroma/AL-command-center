/**
 * Party map: the real game terrain drawn from G.geometry, characters with their sprite, and 10-minute trails.
 * Choosing a character follows it until the player moves the view (see map-camera.ts).
 */
import type { JSX } from 'solid-js';
import { createMemo, For, Show } from 'solid-js';
import { t } from '../../../i18n/i18n.ts';
import { CharacterSprite } from '../../../ui/CharacterSprite.tsx';
import type { CharacterCardModel } from '../team-view.ts';
import type { MapCamera } from './map-camera.ts';
import { createMapCamera } from './map-camera.ts';
import { occupiedMaps, placedCharacters } from './map-view.ts';
import { MapStage } from './MapStage.tsx';
import './PartyMap.css';

export interface PartyMapProps {
  readonly cards: readonly CharacterCardModel[];
  readonly now: number;
}

function FollowBar(props: { readonly cards: readonly CharacterCardModel[]; readonly camera: MapCamera }): JSX.Element {
  return (
    <div class="party-map-follow" role="group" aria-label={t('map.follow')}>
      <For each={props.cards}>
        {(card) => (
          <button type="button" class="quiet" aria-pressed={props.camera.following() === card.name} onClick={() => { props.camera.toggleFollow(card.name); }}>
            <CharacterSprite frame={card.sprite} scale={1} />
            <span>{props.camera.following() === card.name ? t('map.following', { name: card.name }) : card.name}</span>
          </button>
        )}
      </For>
    </div>
  );
}

export function PartyMap(props: PartyMapProps): JSX.Element {
  const placed = createMemo(() => placedCharacters(props.cards.map((card) => card.live)));
  const maps = createMemo(() => occupiedMaps(placed()));
  const camera = createMapCamera(placed, maps);
  const placedCards = (): CharacterCardModel[] => props.cards.filter((card) => placed().some((entry) => entry.name === card.name));

  return (
    <section class="party-map" aria-labelledby="party-map-title">
      <header class="party-map-head">
        <h3 id="party-map-title">{t('map.title')}</h3>
        <Show when={maps().length > 1}>
          <div class="party-map-maps" role="group" aria-label={t('map.maps')}>
            <For each={maps()}>
              {(map) => <button type="button" class="quiet" aria-pressed={camera.activeMap() === map} onClick={() => { camera.chooseMap(map); }}>{map}</button>}
            </For>
          </div>
        </Show>
      </header>
      <Show when={placed().length > 0} fallback={<p class="dim">{t('map.noPositions')}</p>}>
        <MapStage cards={props.cards} placed={placed} camera={camera} now={props.now} />
        <FollowBar cards={placedCards()} camera={camera} />
        <p class="party-map-help">{t('map.help')}</p>
      </Show>
    </section>
  );
}
