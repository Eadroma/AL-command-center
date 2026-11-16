/**
 * The equipment grid, laid out like the game's character sheet: one notched slot per piece, with the item icon and
 * its minimum level. Picking a slot selects it for the editor (aria-pressed); an empty slot shows its name.
 */
import type { JSX } from 'solid-js';
import { For, Show } from 'solid-js';
import type { CatalogueEntry, GearSlot } from '../../../shared/loadouts.ts';
import { t } from '../../i18n/i18n.ts';
import { FrameImage } from '../../ui/FrameImage.tsx';
import type { Worn } from './loadout-view.ts';
import { GRID } from './loadout-view.ts';

export interface GearGridProps {
  readonly gear: ReadonlyMap<GearSlot, Worn>;
  readonly items: ReadonlyMap<string, CatalogueEntry>;
  readonly selected: GearSlot | null;
  readonly onSelect: (slot: GearSlot) => void;
}

function Slot(props: { readonly slot: GearSlot } & GearGridProps): JSX.Element {
  const worn = (): Worn | undefined => props.gear.get(props.slot);
  const item = (): CatalogueEntry | undefined => { const key = worn()?.item; return key === undefined ? undefined : props.items.get(key); };
  const label = (): string => t('loadouts.slotLabel', { slot: t(`loadouts.slot.${props.slot}`), item: item()?.name ?? worn()?.item ?? t('loadouts.empty') });
  return (
    <button type="button" class="gear-slot slot" classList={{ filled: worn() !== undefined }} aria-pressed={props.selected === props.slot} aria-label={label()} title={label()} onClick={() => { props.onSelect(props.slot); }}>
      <Show when={worn()} fallback={<span class="gear-slot-name">{t(`loadouts.slot.${props.slot}`)}</span>}>
        {(current) => (
          <>
            <FrameImage frame={item()?.icon ?? null} box={40} />
            <Show when={current().minLevel > 0}><span class="gear-level">{t('loadouts.level', { level: current().minLevel })}</span></Show>
          </>
        )}
      </Show>
    </button>
  );
}

export function GearGrid(props: GearGridProps): JSX.Element {
  return (
    <div class="gear-grid" role="group" aria-label={t('loadouts.gear')}>
      <For each={GRID.flat()}>
        {(slot) => <Show when={slot} fallback={<span class="gear-gap" aria-hidden="true" />}>{(current) => <Slot slot={current()} {...props} />}</Show>}
      </For>
    </div>
  );
}
