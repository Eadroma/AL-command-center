/** One front-facing game sprite frame, scaled in whole pixels without smoothing. Decorative. */
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';
import type { SpriteFrame } from '../../shared/game.ts';

export function CharacterSprite(props: { readonly frame: SpriteFrame | null; readonly scale: number }): JSX.Element {
  return (
    <span class="character-sprite" aria-hidden="true" style={{ width: `${String(26 * props.scale)}px`, height: `${String(36 * props.scale)}px` }}>
      <Show when={props.frame}>
        {(frame) => (
          <span
            style={{
              display: 'block',
              width: `${String(frame().width * props.scale)}px`,
              height: `${String(frame().height * props.scale)}px`,
              'background-image': `url(${frame().url})`,
              'background-size': `${String(frame().sheetWidth * props.scale)}px ${String(frame().sheetHeight * props.scale)}px`,
              'background-position': `-${String(frame().x * props.scale)}px -${String(frame().y * props.scale)}px`,
              'image-rendering': 'pixelated',
            }}
          />
        )}
      </Show>
    </span>
  );
}
