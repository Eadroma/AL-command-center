/**
 * Consumables the merchant keeps each character supplied with: minimum / target / maximum, edited in place, with the
 * character's current stock against them. Quantities out of order are refused and said so; the draft keeps the last
 * valid rule.
 */
import type { JSX } from 'solid-js';
import { createSignal, For, Index, Show } from 'solid-js';
import type { CatalogueEntry } from '../../../shared/loadouts.ts';
import type { ProfileCharacter } from '../../../shared/profile.ts';
import type { Stock } from '../../../shared/stock.ts';
import { t } from '../../i18n/i18n.ts';
import type { ProfileState } from '../../profile/profile-state.ts';
import type { ConsumableMode, ConsumableRule, ConsumableSource } from '../../profile/seller-draft.ts';
import { MAX_QUANTITY, quantitiesInOrder, removeConsumableRule, setBoardEnabled, setConsumableRule } from '../../profile/seller-draft.ts';
import { ChoiceField } from '../../ui/ChoiceField.tsx';
import type { Choice } from '../../ui/choices.ts';
import { FrameImage } from '../../ui/FrameImage.tsx';
import type { StockLevel } from './supply-view.ts';
import { boardEnabled, consumableRules, heldQuantity, stockLevel, suppliedCharacters } from './supply-view.ts';

interface ConsumablesProps {
  readonly profile: ProfileState;
  readonly supplies: readonly CatalogueEntry[];
  readonly stock: Stock | null;
}

const MODES: readonly ConsumableMode[] = ['carry', 'elixir'];
const SOURCES: readonly ConsumableSource[] = ['either', 'mule', 'bank'];
type Quantity = 'minQty' | 'targetQty' | 'maxQty';
const QUANTITIES: readonly { readonly key: Quantity; readonly label: 'min' | 'target' | 'max' }[] = [
  { key: 'minQty', label: 'min' }, { key: 'targetQty', label: 'target' }, { key: 'maxQty', label: 'max' },
];

/** Held stock against the rule, like the game's bars: the scale runs a quarter past the maximum. */
function StockGauge(props: { readonly rule: ConsumableRule; readonly held: number | null; readonly level: StockLevel }): JSX.Element {
  const scale = (): number => props.rule.maxQty * 1.25;
  const at = (value: number): string => `${String(Math.min(100, (value / scale()) * 100))}%`;
  return (
    <div class={`gauge gauge-${props.level}`}>
      <span class="gauge-track" aria-hidden="true">
        <Show when={props.held !== null}><span class="gauge-fill" style={{ width: at(props.held ?? 0) }} /></Show>
        <span class="gauge-mark" style={{ left: at(props.rule.minQty) }} />
        <span class="gauge-mark target" style={{ left: at(props.rule.targetQty) }} />
        <span class="gauge-mark" style={{ left: at(props.rule.maxQty) }} />
      </span>
      <span class="gauge-text">
        {props.held === null ? t('merchant.consumables.unknown') : t('merchant.consumables.held', { count: props.held })}
        <Show when={props.level !== 'unknown'}><strong>{` ${t(`merchant.consumables.level.${props.level}`)}`}</strong></Show>
      </span>
    </div>
  );
}

/** `onValue` answers whether the value was taken; a refused one is put back, so the field never shows what the draft lacks. */
function QuantityInput(props: { readonly value: number; readonly label: string; readonly onValue: (value: number) => boolean }): JSX.Element {
  return (
    <label class="field qty">
      <span>{props.label}</span>
      <input type="number" min="1" max={MAX_QUANTITY} step="1" value={props.value}
        onChange={(event) => { const input = event.currentTarget; if (!props.onValue(Number(input.value))) { input.value = String(props.value); } }} />
    </label>
  );
}

function RuleRow(props: ConsumablesProps & { readonly rule: ConsumableRule }): JSX.Element {
  const [invalid, setInvalid] = createSignal(false);
  const known = (): CatalogueEntry | undefined => props.supplies.find((item) => item.key === props.rule.item);
  const held = (): number | null => (props.stock === null ? null : heldQuantity(props.stock, props.rule.character, props.rule.item));
  const change = (next: ConsumableRule): boolean => {
    const valid = quantitiesInOrder(next);
    setInvalid(!valid);
    props.profile.edit((draft) => setConsumableRule(draft, next));
    return valid;
  };
  const errorId = (): string => `cons-error-${props.rule.character}-${props.rule.item}`;
  return (
    <li class="supply-rule">
      <div class="supply-rule-head">
        <span class="piece-icon"><FrameImage frame={known()?.icon ?? null} box={40} /></span>
        <div class="piece-text"><strong>{known()?.name ?? props.rule.item}</strong><span class="dim">{props.rule.character}</span></div>
        <button type="button" class="quiet" onClick={() => { const { character, item } = props.rule; props.profile.edit((draft) => removeConsumableRule(draft, character, item)); }}>
          {t('merchant.consumables.remove')}
        </button>
      </div>
      <StockGauge rule={props.rule} held={held()} level={stockLevel(props.rule, held())} />
      <div class="supply-rule-fields" aria-describedby={invalid() ? errorId() : undefined}>
        <For each={QUANTITIES}>{(quantity) => <QuantityInput value={props.rule[quantity.key]} label={t(`merchant.consumables.${quantity.label}`)} onValue={(value) => change({ ...props.rule, [quantity.key]: value })} />}</For>
        <label class="field">
          <span>{t('merchant.consumables.mode')}</span>
          <select value={props.rule.mode} onChange={(event) => { const mode = MODES.find((entry) => entry === event.currentTarget.value); if (mode !== undefined) { void change({ ...props.rule, mode }); } }}>
            <For each={MODES}>{(mode) => <option value={mode}>{t(`merchant.consumables.modes.${mode}`)}</option>}</For>
          </select>
        </label>
        <label class="field">
          <span>{t('merchant.consumables.source')}</span>
          <select value={props.rule.source} onChange={(event) => { const source = SOURCES.find((entry) => entry === event.currentTarget.value); if (source !== undefined) { void change({ ...props.rule, source }); } }}>
            <For each={SOURCES}>{(source) => <option value={source}>{t(`merchant.consumables.sources.${source}`)}</option>}</For>
          </select>
        </label>
      </div>
      <Show when={invalid()}><p id={errorId()} class="supply-error" role="alert">{t('merchant.consumables.order')}</p></Show>
    </li>
  );
}

function RuleAdder(props: ConsumablesProps & { readonly characters: readonly ProfileCharacter[]; readonly rules: readonly ConsumableRule[] }): JSX.Element {
  const [character, setCharacter] = createSignal('');
  const [item, setItem] = createSignal('');
  const [quantities, setQuantities] = createSignal({ minQty: 200, targetQty: 1000, maxQty: 2000 });
  const [mode, setMode] = createSignal<ConsumableMode>('carry');
  const [source, setSource] = createSignal<ConsumableSource>('either');
  const who = (): string => (props.characters.some((entry) => entry.name === character()) ? character() : props.characters[0]?.name ?? '');
  const choices = (): Choice[] => props.supplies.map((entry) => ({ key: entry.key, name: entry.name, detail: entry.type, image: entry.icon }));
  const ordered = (): boolean => quantitiesInOrder(quantities());
  const add = (): void => {
    const rule: ConsumableRule = { character: who(), item: item(), ...quantities(), mode: mode(), source: source() };
    props.profile.edit((draft) => setConsumableRule(draft, rule));
    setItem('');
  };
  return (
    <details class="kit-adder">
      <summary>{t('merchant.consumables.add')}</summary>
      <div class="kit-adder-body">
        <label class="field">
          <span>{t('merchant.consumables.character')}</span>
          <select value={who()} onChange={(event) => setCharacter(event.currentTarget.value)}>
            <For each={props.characters}>{(entry) => <option value={entry.name}>{entry.name}</option>}</For>
          </select>
        </label>
        <ChoiceField id="cons-add-item" label={t('merchant.consumables.item')} value={item()} choices={choices()} allowEmpty
          searchHelp={t('merchant.consumables.itemHelp')} unknownText={t('merchant.consumables.unknownItem')} onChange={setItem} />
        <div class="supply-rule-fields">
          <For each={QUANTITIES}>{(quantity) => <QuantityInput value={quantities()[quantity.key]} label={t(`merchant.consumables.${quantity.label}`)} onValue={(value) => { setQuantities({ ...quantities(), [quantity.key]: value }); return true; }} />}</For>
          <label class="field">
            <span>{t('merchant.consumables.mode')}</span>
            <select value={mode()} onChange={(event) => { const next = MODES.find((entry) => entry === event.currentTarget.value); if (next !== undefined) { setMode(next); } }}>
              <For each={MODES}>{(entry) => <option value={entry}>{t(`merchant.consumables.modes.${entry}`)}</option>}</For>
            </select>
          </label>
          <label class="field">
            <span>{t('merchant.consumables.source')}</span>
            <select value={source()} onChange={(event) => { const next = SOURCES.find((entry) => entry === event.currentTarget.value); if (next !== undefined) { setSource(next); } }}>
              <For each={SOURCES}>{(entry) => <option value={entry}>{t(`merchant.consumables.sources.${entry}`)}</option>}</For>
            </select>
          </label>
        </div>
        <Show when={!ordered()}><p class="supply-error" role="alert">{t('merchant.consumables.order')}</p></Show>
        <Show when={props.rules.some((rule) => rule.character === who() && rule.item === item())}><p class="dim">{t('merchant.consumables.replaces')}</p></Show>
        <div><button type="button" disabled={item() === '' || who() === '' || !ordered()} onClick={add}>{t('merchant.consumables.addButton')}</button></div>
      </div>
    </details>
  );
}

export function Consumables(props: ConsumablesProps): JSX.Element {
  const rules = (): ConsumableRule[] => { const draft = props.profile.draft(); return draft === null ? [] : consumableRules(draft.profile); };
  const on = (): boolean => { const draft = props.profile.draft(); return draft !== null && boardEnabled(draft.profile, 'consumables'); };
  const characters = (): ProfileCharacter[] => { const draft = props.profile.draft(); return draft === null ? [] : suppliedCharacters(draft.profile); };
  return (
    <section class="supply-section" aria-labelledby="consumables-title">
      <h3 id="consumables-title">{t('merchant.consumables.title')}</h3>
      <p class="dim">{t('merchant.consumables.intro')}</p>
      <label class="check">
        <input type="checkbox" checked={on()} onChange={(event) => { const enabled = event.currentTarget.checked; props.profile.edit((draft) => setBoardEnabled(draft, 'consumables', enabled)); }} />
        {t('merchant.consumables.enabled')}
      </label>
      <Show when={rules().length > 0} fallback={<p class="dim">{t('merchant.consumables.none')}</p>}>
        {/* Index keeps each row, and the field being typed in, while the draft changes. */}
        <ul class="supply-rules"><Index each={rules()}>{(rule) => <RuleRow {...props} rule={rule()} />}</Index></ul>
      </Show>
      <RuleAdder {...props} characters={characters()} rules={rules()} />
    </section>
  );
}
