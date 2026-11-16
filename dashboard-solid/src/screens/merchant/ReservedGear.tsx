/**
 * Reserved equipment: per character, every piece it keeps (loadouts and kit as one list), why, and where it is.
 * Kit pieces are added and removed here; loadout pieces are changed in the Loadouts dialog.
 */
import type { JSX } from 'solid-js';
import { createSignal, For, Index, Show } from 'solid-js';
import type { CatalogueEntry, GearSlot } from '../../../shared/loadouts.ts';
import { GEAR_SLOTS, MAX_MIN_LEVEL } from '../../../shared/loadouts.ts';
import type { ProfileCharacter } from '../../../shared/profile.ts';
import type { Stock } from '../../../shared/stock.ts';
import { t } from '../../i18n/i18n.ts';
import type { ProfileState } from '../../profile/profile-state.ts';
import { removeKitRule, setBoardEnabled, setKitRule } from '../../profile/seller-draft.ts';
import { ChoiceField } from '../../ui/ChoiceField.tsx';
import type { Choice } from '../../ui/choices.ts';
import { FrameImage } from '../../ui/FrameImage.tsx';
import { itemsFor } from '../loadouts/loadout-view.ts';
import { className } from '../settings/Roster.tsx';
import type { Place, ReservedPiece } from './supply-view.ts';
import { boardEnabled, conflictingSlots, placeOf, reservedPieces, suppliedCharacters } from './supply-view.ts';

interface GearProps {
  readonly profile: ProfileState;
  readonly items: readonly CatalogueEntry[];
  readonly stock: Stock | null;
}

function placeText(place: Place): string {
  switch (place.kind) {
    case 'bank': return t('merchant.reserved.place.bank', { pack: place.pack });
    case 'other': return t('merchant.reserved.place.other', { holder: place.holder });
    default: return t(`merchant.reserved.place.${place.kind}`);
  }
}

function sourceText(piece: ReservedPiece): string[] {
  const styles = piece.styles.map((style) => (style === 'aoe' || style === 'mono' || style === 'tank' ? t(`loadouts.style.${style}`) : style));
  return [
    ...(styles.length > 0 ? [t('merchant.reserved.fromLoadouts', { styles: styles.join(', ') })] : []),
    ...(piece.kit === null ? [] : [t('merchant.reserved.fromKit') + (piece.kit.shiny ? ` (${t('merchant.reserved.shiny')})` : '')]),
  ];
}

function Piece(props: GearProps & { readonly piece: ReservedPiece; readonly conflict: boolean }): JSX.Element {
  const entry = (): CatalogueEntry | undefined => props.items.find((item) => item.key === props.piece.item);
  const place = (): Place => (props.stock === null ? { kind: 'unknown' } : placeOf(props.piece, props.stock));
  return (
    <li class="piece" classList={{ conflict: props.conflict }}>
      <span class="piece-icon">
        <FrameImage frame={entry()?.icon ?? null} box={40} />
        <Show when={props.piece.minLevel > 0}><span class="piece-level">{t('loadouts.level', { level: props.piece.minLevel })}</span></Show>
      </span>
      <div class="piece-text">
        <strong>{entry()?.name ?? props.piece.item}</strong>
        <span class="dim">{t(`loadouts.slot.${props.piece.slot}`)}</span>
        <For each={sourceText(props.piece)}>{(line) => <span>{line}</span>}</For>
        <span class={`place place-${place().kind}`}>{placeText(place())}</span>
        <Show when={props.conflict}><span class="piece-conflict" role="note">{t('merchant.reserved.conflict')}</span></Show>
      </div>
      <Show when={props.piece.kit !== null}>
        <button type="button" class="quiet" onClick={() => { const { character, slot } = props.piece; props.profile.edit((draft) => removeKitRule(draft, character, slot)); }}>
          {t('merchant.reserved.remove')}
        </button>
      </Show>
    </li>
  );
}

function KitAdder(props: GearProps & { readonly character: string; readonly pieces: readonly ReservedPiece[] }): JSX.Element {
  const [slot, setSlot] = createSignal<GearSlot>('mainhand');
  const [item, setItem] = createSignal('');
  const [level, setLevel] = createSignal(0);
  const [shiny, setShiny] = createSignal(false);
  const id = (): string => `kit-${props.character}`;
  const choices = (): Choice[] => itemsFor(slot(), props.items).map((entry) => ({ key: entry.key, name: entry.name, detail: t(`loadouts.slot.${slot()}`), image: entry.icon }));
  const replaced = (): ReservedPiece | undefined => props.pieces.find((piece) => piece.kit !== null && piece.slot === slot());
  const add = (): void => {
    const rule = { character: props.character, slot: slot(), item: item(), minLevel: level(), shiny: shiny() };
    props.profile.edit((draft) => setKitRule(draft, rule));
    setItem('');
  };
  return (
    <details class="kit-adder">
      <summary>{t('merchant.reserved.add')}</summary>
      <div class="kit-adder-body">
        <label class="field">
          <span>{t('merchant.reserved.slot')}</span>
          <select value={slot()} onChange={(event) => { const next = GEAR_SLOTS.find((entry) => entry === event.currentTarget.value); if (next !== undefined) { setSlot(next); setItem(''); } }}>
            <For each={GEAR_SLOTS}>{(entry) => <option value={entry}>{t(`loadouts.slot.${entry}`)}</option>}</For>
          </select>
        </label>
        <ChoiceField id={`${id()}-item`} label={t('merchant.reserved.item')} value={item()} choices={choices()} allowEmpty
          searchHelp={t('merchant.reserved.itemHelp')} unknownText={t('merchant.reserved.unknownItem')} onChange={setItem} />
        <div class="kit-adder-row">
          <label class="field">
            <span>{t('merchant.reserved.minLevel')}</span>
            <input type="number" min="0" max={MAX_MIN_LEVEL} step="1" value={level()} onChange={(event) => { const value = Number(event.currentTarget.value); setLevel(Number.isFinite(value) ? value : 0); }} />
          </label>
          <label class="check">
            <input type="checkbox" checked={shiny()} onChange={(event) => setShiny(event.currentTarget.checked)} />
            {t('merchant.reserved.shinyOnly')}
          </label>
          <button type="button" disabled={item() === ''} onClick={add}>{t('merchant.reserved.addButton')}</button>
        </div>
        <Show when={replaced()}>{(piece) => <p class="dim">{t('merchant.reserved.replaces', { item: props.items.find((entry) => entry.key === piece().item)?.name ?? piece().item })}</p>}</Show>
      </div>
    </details>
  );
}

function CharacterGear(props: GearProps & { readonly character: ProfileCharacter }): JSX.Element {
  const pieces = (): ReservedPiece[] => { const draft = props.profile.draft(); return draft === null ? [] : reservedPieces(draft.profile, props.character.name); };
  const conflicts = (): ReadonlySet<GearSlot> => conflictingSlots(pieces());
  return (
    <article class="reserve-character">
      <h4>{props.character.name} <span class="dim">{className(props.character.ctype)}</span></h4>
      <Show when={pieces().length > 0} fallback={<p class="dim">{t('merchant.reserved.none')}</p>}>
        <ul class="pieces">
          <Index each={pieces()}>{(piece) => <Piece {...props} piece={piece()} conflict={piece().kit !== null && conflicts().has(piece().slot)} />}</Index>
        </ul>
      </Show>
      <KitAdder {...props} character={props.character.name} pieces={pieces()} />
    </article>
  );
}

export function ReservedGear(props: GearProps): JSX.Element {
  const characters = (): ProfileCharacter[] => { const draft = props.profile.draft(); return draft === null ? [] : suppliedCharacters(draft.profile); };
  const kitOn = (): boolean => { const draft = props.profile.draft(); return draft !== null && boardEnabled(draft.profile, 'kit'); };
  return (
    <section class="supply-section" aria-labelledby="reserved-title">
      <h3 id="reserved-title">{t('merchant.reserved.title')}</h3>
      <p class="dim">{t('merchant.reserved.intro')}</p>
      <label class="check">
        <input type="checkbox" checked={kitOn()} aria-describedby="kit-enabled-help" onChange={(event) => { const on = event.currentTarget.checked; props.profile.edit((draft) => setBoardEnabled(draft, 'kit', on)); }} />
        {t('merchant.reserved.kitEnabled')}
      </label>
      <p id="kit-enabled-help" class="dim">{t('merchant.reserved.kitEnabledHelp')}</p>
      <p class="dim">{t('merchant.reserved.editLoadouts')}</p>
      <div class="reserve-grid">
        <Index each={characters()}>{(character) => <CharacterGear {...props} character={character()} />}</Index>
      </div>
    </section>
  );
}
