/**
 * Picks one choice (a monster, an item…): a combobox (WAI-ARIA pattern) whose list shows each choice's image, name
 * and details. Typing filters, ↑ ↓ move, Enter picks, Escape closes and puts back the current choice. Only a known
 * choice (picked, or typed by key or exact name) is applied; anything else shows `unknownText`.
 */
import type { Accessor, JSX } from 'solid-js';
import { createEffect, createSignal, For, Show } from 'solid-js';
import type { Choice } from './choices.ts';
import { filterChoices, resolveChoice } from './choices.ts';
import { FrameImage } from './FrameImage.tsx';
import './ChoiceField.css';

export interface ChoiceFieldProps {
  readonly id: string;
  readonly label: string;
  /** Key of the current choice, or '' when empty is allowed. */
  readonly value: string;
  readonly choices: readonly Choice[];
  readonly allowEmpty: boolean;
  /** Under the field when nothing is chosen: how to search. */
  readonly searchHelp: string;
  /** Under the field when the typed text names nothing. */
  readonly unknownText: string;
  /** Under an empty field, when empty has a meaning (for example the team target). */
  readonly emptyHint?: string;
  readonly onChange: (key: string) => void;
}

const SHOWN = 40;

interface OptionProps {
  readonly id: string;
  readonly choice: Choice;
  readonly active: boolean;
  readonly selected: boolean;
  readonly onPick: () => void;
}

function Option(props: OptionProps): JSX.Element {
  return (
    // mousedown is prevented so picking does not blur (and commit) the field first.
    <li id={props.id} role="option" aria-selected={props.selected} classList={{ active: props.active }} onMouseDown={(event) => { event.preventDefault(); }} onClick={() => { props.onPick(); }}>
      <FrameImage frame={props.choice.image} box={40} />
      <span class="choice-option-text">
        <span class="choice-option-name">{props.choice.name}</span>
        <span class="choice-option-detail">{props.choice.detail}</span>
      </span>
    </li>
  );
}

interface Combo {
  readonly text: Accessor<string>;
  readonly open: Accessor<boolean>;
  readonly active: Accessor<number>;
  readonly invalid: Accessor<boolean>;
  readonly current: Accessor<Choice | null>;
  readonly shown: Accessor<Choice[]>;
  readonly type: (value: string) => void;
  readonly show: () => void;
  readonly pick: (choice: Choice) => void;
  readonly commit: () => void;
  readonly keys: Readonly<Record<string, () => void>>;
}

/** The combobox state: typed text, open list, active option, and what picking or leaving the field applies. */
function createCombo(props: ChoiceFieldProps): Combo {
  const [text, setText] = createSignal('');
  const [open, setOpen] = createSignal(false);
  const [active, setActive] = createSignal(0);
  const [invalid, setInvalid] = createSignal(false);
  const current = (): Choice | null => resolveChoice(props.value, props.choices);
  const shown = (): Choice[] => filterChoices(props.choices, { text: text(), current: current()?.name ?? '' }, SHOWN);
  // Follow the draft (a discard or another window's save).
  createEffect(() => { setText(current()?.name ?? props.value); setInvalid(false); });

  const pick = (choice: Choice): void => {
    setText(choice.name);
    setOpen(false);
    setInvalid(false);
    if (choice.key !== props.value) {
      props.onChange(choice.key);
    }
  };
  /** Leaving the field applies what was typed, if it names a choice (or empties an optional field). */
  const commit = (): void => {
    setOpen(false);
    const choice = resolveChoice(text(), props.choices);
    const emptied = text().trim() === '' && props.allowEmpty;
    setInvalid(choice === null && !emptied);
    if (choice !== null) {
      pick(choice);
    } else if (emptied && props.value !== '') {
      props.onChange('');
    }
  };
  const keys: Readonly<Record<string, () => void>> = {
    ArrowDown: () => { setActive(open() ? Math.min(active() + 1, shown().length - 1) : 0); setOpen(true); },
    ArrowUp: () => { setActive(Math.max(active() - 1, 0)); setOpen(true); },
    Enter: () => { const choice = open() ? shown()[active()] : undefined; if (choice === undefined) { commit(); } else { pick(choice); } },
    Escape: () => { setOpen(false); setText(current()?.name ?? props.value); setInvalid(false); },
  };
  return {
    text, open, active, invalid, current, shown, pick, commit, keys,
    type: (value) => { setText(value); setActive(0); setOpen(true); },
    show: () => setOpen(true),
  };
}

export function ChoiceField(props: ChoiceFieldProps): JSX.Element {
  const combo = createCombo(props);
  const { text, open, active, invalid, current, shown, pick, commit, keys } = combo;
  const optionId = (index: number): string => `${props.id}-option-${String(index)}`;

  return (
    <div class="choice-field">
      <label id={`${props.id}-label`} for={props.id}>{props.label}</label>
      <div class="choice-combo">
        <FrameImage frame={current()?.image ?? null} box={40} />
        <input id={props.id} type="text" role="combobox" autocomplete="off" aria-autocomplete="list" aria-expanded={open()} aria-controls={`${props.id}-list`}
          aria-activedescendant={open() && shown().length > 0 ? optionId(active()) : undefined} aria-invalid={invalid()} aria-describedby={`${props.id}-hint`}
          value={text()}
          onInput={(event) => { combo.type(event.currentTarget.value); }}
          onFocus={() => { combo.show(); }}
          onBlur={commit}
          onKeyDown={(event) => { const action = keys[event.key]; if (action !== undefined) { event.preventDefault(); action(); } }} />
      </div>
      <Show when={open() && shown().length > 0}>
        <ul id={`${props.id}-list`} role="listbox" aria-labelledby={`${props.id}-label`} class="choice-list">
          <For each={shown()}>
            {(choice, index) => <Option id={optionId(index())} choice={choice} active={index() === active()} selected={choice.key === props.value} onPick={() => { pick(choice); }} />}
          </For>
        </ul>
      </Show>
      <p id={`${props.id}-hint`} class="choice-hint" classList={{ error: invalid() }}>
        <Show when={!invalid()} fallback={props.unknownText}>
          <Show when={current()} fallback={props.value === '' && props.emptyHint !== undefined ? props.emptyHint : props.searchHelp}>{(choice) => choice().detail}</Show>
        </Show>
      </p>
    </div>
  );
}
