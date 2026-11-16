/** Editor of the selected slot: which item (only items that fit), from which upgrade level, or empty it. */
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';
import type { CatalogueEntry, GearSlot } from '../../../shared/loadouts.ts';
import { MAX_MIN_LEVEL } from '../../../shared/loadouts.ts';
import { t } from '../../i18n/i18n.ts';
import { ChoiceField } from '../../ui/ChoiceField.tsx';
import type { Choice } from '../../ui/choices.ts';
import type { Worn } from './loadout-view.ts';
import { itemsFor } from './loadout-view.ts';

export interface SlotEditorProps {
  readonly slot: GearSlot;
  readonly worn: Worn | null;
  readonly items: readonly CatalogueEntry[];
  readonly onWear: (gear: Worn | null) => void;
}

const ITEM_TYPES = ['weapon', 'shield', 'source', 'quiver', 'misc_offhand', 'helmet', 'chest', 'pants', 'shoes', 'gloves', 'belt', 'amulet', 'ring', 'earring', 'cape', 'orb'] as const;

/** The item's type in the current language (a type the game adds later is shown as it is). */
function typeName(type: string): string {
  const known = ITEM_TYPES.find((entry) => entry === type);
  return known === undefined ? type : t(`loadouts.type.${known}`);
}

function itemChoice(item: CatalogueEntry): Choice {
  return { key: item.key, name: item.name, detail: typeName(item.type), image: item.icon };
}

export function SlotEditor(props: SlotEditorProps): JSX.Element {
  const choices = (): Choice[] => itemsFor(props.slot, props.items).map(itemChoice);
  const level = (): number => props.worn?.minLevel ?? 0;
  return (
    <section class="slot-editor" aria-labelledby="slot-editor-title">
      <h4 id="slot-editor-title">{t(`loadouts.slot.${props.slot}`)}</h4>
      <ChoiceField id={`gear-${props.slot}`} label={t('loadouts.item')} value={props.worn?.item ?? ''} choices={choices()} allowEmpty
        searchHelp={t('loadouts.itemHelp')} unknownText={t('loadouts.unknownItem')}
        onChange={(key) => { props.onWear(key === '' ? null : { item: key, minLevel: level() }); }} />
      <Show when={props.worn}>
        {(worn) => (
          <div class="slot-editor-row">
            <label class="slot-level">
              <span>{t('loadouts.minLevel')}</span>
              <input type="number" min="0" max={MAX_MIN_LEVEL} step="1" value={worn().minLevel} aria-describedby="slot-level-help"
                onChange={(event) => { const value = Number(event.currentTarget.value); props.onWear({ item: worn().item, minLevel: Number.isFinite(value) ? value : 0 }); }} />
            </label>
            <button type="button" class="quiet" onClick={() => { props.onWear(null); }}>{t('loadouts.clear')}</button>
          </div>
        )}
      </Show>
      <Show when={props.worn !== null}><p id="slot-level-help" class="dim">{t('loadouts.minLevelHelp')}</p></Show>
    </section>
  );
}
