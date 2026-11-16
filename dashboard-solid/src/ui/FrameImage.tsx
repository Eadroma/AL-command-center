/**
 * One sprite frame fitted into a square box, pixels kept sharp: whole-number zoom when the frame is small, shrunk
 * when it is larger than the box (big bosses). Decorative: the name next to it carries the meaning.
 */
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';
import type { SpriteFrame } from '../../shared/game.ts';
import { fitScale } from './frame-scale.ts';

export function FrameImage(props: { readonly frame: SpriteFrame | null; readonly box: number }): JSX.Element {
  return (
    <span class="frame-image" aria-hidden="true" style={{ width: `${String(props.box)}px`, height: `${String(props.box)}px`, display: 'inline-grid', 'place-items': 'center' }}>
      <Show when={props.frame}>
        {(frame) => {
          const scale = (): number => fitScale(frame(), props.box);
          return (
            <span style={{
              display: 'block',
              width: `${String(frame().width * scale())}px`,
              height: `${String(frame().height * scale())}px`,
              'background-image': `url(${frame().url})`,
              'background-size': `${String(frame().sheetWidth * scale())}px ${String(frame().sheetHeight * scale())}px`,
              'background-position': `-${String(frame().x * scale())}px -${String(frame().y * scale())}px`,
              'image-rendering': 'pixelated',
            }} />
          );
        }}
      </Show>
    </span>
  );
}
