/**
 * Loadouts, opened from the Profile banner: per character and per combat style, the gear grid (like the game's
 * character sheet), the skills and, for custom styles, which base style they count as. Edits go to the profile
 * draft (Save / Discard); they reach the game at the next deployment. Creating loadouts comes later (V2).
 */
import type { Accessor, JSX } from 'solid-js';
import { createEffect, createResource, createSignal, For, Index, Show } from 'solid-js';
import type { BaseStyle, CatalogueEntry, GearSlot, LoadoutCatalogue } from '../../../shared/loadouts.ts';
import { BASE_STYLES, loadoutCatalogueSchema } from '../../../shared/loadouts.ts';
import { apiGet } from '../../api/http.ts';
import { t } from '../../i18n/i18n.ts';
import type { LoadoutTarget } from '../../profile/draft.ts';
import { setBase, setGear, setSkills } from '../../profile/draft.ts';
import type { ProfileState } from '../../profile/profile-state.ts';
import { FrameImage } from '../../ui/FrameImage.tsx';
import { SaveRow } from '../profile/SaveRow.tsx';
import { GearGrid } from './GearGrid.tsx';
import type { LoadoutView } from './loadout-view.ts';
import { boards, readLoadout, toggleSkill } from './loadout-view.ts';
import { SlotEditor } from './SlotEditor.tsx';
import './LoadoutsDialog.css';

export interface LoadoutsDialogProps {
  readonly open: boolean;
  readonly profile: ProfileState;
  readonly onClose: () => void;
}

const isBase = (style: string): style is BaseStyle => BASE_STYLES.some((base) => base === style);
const styleName = (style: string): string => (isBase(style) ? t(`loadouts.style.${style}`) : style);

/** A row of toggle buttons (character or style), the chosen one pressed. */
function Tabs(props: { readonly label: string; readonly values: readonly string[]; readonly current: string; readonly name: (value: string) => string; readonly onPick: (value: string) => void }): JSX.Element {
  return (
    <div class="loadout-tabs" role="group" aria-label={props.label}>
      <For each={props.values}>{(value) => <button type="button" aria-pressed={props.current === value} onClick={() => { props.onPick(value); }}>{props.name(value)}</button>}</For>
    </div>
  );
}

function Skills(props: { readonly skills: readonly CatalogueEntry[]; readonly chosen: readonly string[]; readonly onChange: (skills: string[]) => void }): JSX.Element {
  return (
    <section aria-labelledby="loadout-skills">
      <h4 id="loadout-skills">{t('loadouts.skills')}</h4>
      <p class="dim">{t('loadouts.skillsHelp')}</p>
      <div class="loadout-skills">
        <Index each={props.skills}>
          {(skill) => (
            <button type="button" aria-pressed={props.chosen.includes(skill().key)} onClick={() => { props.onChange(toggleSkill(props.chosen, skill().key, !props.chosen.includes(skill().key))); }}>
              <FrameImage frame={skill().icon} box={24} />{skill().name}
            </button>
          )}
        </Index>
      </div>
    </section>
  );
}

function Base(props: { readonly base: BaseStyle | null; readonly onChange: (base: BaseStyle) => void }): JSX.Element {
  return (
    <section aria-labelledby="loadout-base">
      <h4 id="loadout-base">{t('loadouts.base')}</h4>
      <p class="dim">{t('loadouts.baseHelp')}</p>
      <Tabs label={t('loadouts.base')} values={BASE_STYLES} current={props.base ?? ''} name={styleName} onPick={(value) => { if (isBase(value)) { props.onChange(value); } }} />
    </section>
  );
}

interface Selection {
  readonly character: Accessor<string>;
  readonly style: Accessor<string>;
  readonly slot: Accessor<GearSlot | null>;
  readonly pickCharacter: (name: string) => void;
  readonly pickStyle: (style: string) => void;
  readonly pickSlot: (slot: GearSlot) => void;
}

/** Which character, style and slot are shown; the first ones by default, kept valid when the draft changes. */
function createSelection(draft: Accessor<ReturnType<ProfileState['draft']>>): Selection {
  const [character, setCharacter] = createSignal('');
  const [style, setStyle] = createSignal('');
  const [slot, setSlot] = createSignal<GearSlot | null>(null);
  createEffect(() => {
    const current = draft();
    const all = current === null ? [] : boards(current.profile);
    const board = all.find((entry) => entry.character === character()) ?? all[0];
    setCharacter(board?.character ?? '');
    setStyle(board?.styles.includes(style()) === true ? style() : board?.styles[0] ?? '');
  });
  return {
    character, style, slot,
    pickCharacter: (name) => { setCharacter(name); setSlot(null); },
    pickStyle: (value) => { setStyle(value); },
    pickSlot: (value) => { setSlot(value); },
  };
}

function Editor(props: { readonly profile: ProfileState; readonly catalogue: LoadoutCatalogue; readonly selection: Selection }): JSX.Element {
  const target = (): LoadoutTarget => ({ character: props.selection.character(), style: props.selection.style() });
  const view = (): LoadoutView | null => { const draft = props.profile.draft(); return draft === null ? null : readLoadout(draft.profile, props.selection.character(), props.selection.style()); };
  const all = (): ReturnType<typeof boards> => { const draft = props.profile.draft(); return draft === null ? [] : boards(draft.profile); };
  const ctype = (): string => all().find((entry) => entry.character === props.selection.character())?.ctype ?? '';
  const items = (): Map<string, CatalogueEntry> => new Map(props.catalogue.items.map((item) => [item.key, item]));
  const edit = (change: (draft: Parameters<Parameters<ProfileState['edit']>[0]>[0]) => ReturnType<Parameters<ProfileState['edit']>[0]>): void => { props.profile.edit(change); };
  return (
    <Show when={view()}>
      {(loadout) => (
        <>
          <Tabs label={t('loadouts.characters')} values={all().map((entry) => entry.character)} current={props.selection.character()} name={(value) => value} onPick={props.selection.pickCharacter} />
          <Tabs label={t('loadouts.styles')} values={all().find((entry) => entry.character === props.selection.character())?.styles ?? []} current={props.selection.style()} name={styleName} onPick={props.selection.pickStyle} />
          <section class="loadout-gear" aria-labelledby="loadout-gear">
            <h4 id="loadout-gear">{t('loadouts.gear')}</h4>
            <p class="dim">{t('loadouts.gearHelp')}</p>
            <div class="loadout-gear-body">
              <GearGrid gear={loadout().gear} items={items()} selected={props.selection.slot()} onSelect={props.selection.pickSlot} />
              <Show when={props.selection.slot()}>
                {(slot) => <SlotEditor slot={slot()} worn={loadout().gear.get(slot()) ?? null} items={props.catalogue.items} onWear={(gear) => { const where = { ...target(), slot: slot() }; edit((draft) => setGear(draft, where, gear)); }} />}
              </Show>
            </div>
          </section>
          <Skills skills={props.catalogue.skills[ctype()] ?? []} chosen={loadout().skills} onChange={(skills) => { const where = target(); edit((draft) => setSkills(draft, where, skills)); }} />
          <Show when={!isBase(props.selection.style())}>
            <Base base={loadout().base} onChange={(base) => { const where = target(); edit((draft) => setBase(draft, where, base)); }} />
          </Show>
        </>
      )}
    </Show>
  );
}

export function LoadoutsDialog(props: LoadoutsDialogProps): JSX.Element {
  const [catalogue] = createResource(() => props.open || undefined, () => apiGet('/api/game/loadout-catalogue', loadoutCatalogueSchema));
  const selection = createSelection(() => props.profile.draft());
  let dialog: HTMLDialogElement | undefined;
  createEffect(() => {
    if (props.open && dialog?.open === false) {
      dialog.showModal();
    }
    if (!props.open && dialog?.open === true) {
      dialog.close();
    }
  });
  const loaded = (): LoadoutCatalogue | null => { const result = catalogue(); return result?.ok === true ? result.value : null; };
  const hasBoards = (): boolean => { const draft = props.profile.draft(); return draft !== null && boards(draft.profile).length > 0; };
  return (
    <dialog ref={(element) => { dialog = element; }} class="loadouts-dialog slot" aria-labelledby="loadouts-title" onClose={() => { props.onClose(); }}>
      <header class="loadouts-head">
        <h2 id="loadouts-title">{t('loadouts.title')}</h2>
        <button type="button" class="quiet" onClick={() => { dialog?.close(); }}>{t('loadouts.close')}</button>
      </header>
      <p class="dim">{t('loadouts.intro')}</p>
      <Show when={hasBoards()} fallback={<p>{t('loadouts.noLoadouts')}</p>}>
        <Show when={loaded()} fallback={<p class="dim">{t('loadouts.loading')}</p>}>
          {(current) => <Editor profile={props.profile} catalogue={current()} selection={selection} />}
        </Show>
      </Show>
      <Show when={props.profile.dirty()}><SaveRow state={props.profile} /></Show>
    </dialog>
  );
}
