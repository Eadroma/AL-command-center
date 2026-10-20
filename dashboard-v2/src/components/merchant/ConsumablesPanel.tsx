import { useMemo, useState } from 'react';
import type { Profile } from '../../../shared/schema';
import { consumableStockStatuses } from '../../models/consumables';
import { removeConsumableRule, setConsumableRule, setSellerBoardEnabled } from '../../models/merchant';
import type { Catalog } from '../../types';
import type { PartyMember } from '../../types/party';
import { Badge, Button, Field, ItemMultiSelect, NumberInput, SelectInput, Sprite, Toggle } from '../ui';
import { CollapsiblePanel } from './CollapsiblePanel';
import styles from './ConsumablesPanel.module.scss';

interface Props {
  profile: Profile;
  catalog: Catalog;
  farmers: Profile['characters'];
  members?: PartyMember[] | null;
  pending: boolean;
  onChange: (profile: Profile) => void;
}

const MODE_OPTIONS = [{ value: 'carry', label: 'Carry / stock' }, { value: 'elixir', label: 'Auto-drink elixir' }];
const SOURCE_OPTIONS = [{ value: 'either', label: 'Bag or bank' }, { value: 'mule', label: 'Merchant bag' }, { value: 'bank', label: 'Bank only' }];

/** Recurring supply editor with live min/target/max policy feedback. */
export function ConsumablesPanel({ profile, catalog, farmers, members, pending, onChange }: Props) {
  const [character, setCharacter] = useState(farmers[0]?.name ?? '');
  const [items, setItems] = useState<string[]>([]);
  const [minimum, setMinimum] = useState<number | null>(200);
  const [target, setTarget] = useState<number | null>(1000);
  const [maximum, setMaximum] = useState<number | null>(2000);
  const [mode, setMode] = useState<'carry' | 'elixir'>('carry');
  const [source, setSource] = useState<'mule' | 'bank' | 'either'>('either');

  const names = useMemo(() => new Map(catalog.items.map(entry => [entry.id, entry.name])), [catalog]);
  const statuses = consumableStockStatuses(profile, members);
  const alertCount = statuses.filter(status => status.level === 'low' || status.level === 'excess').length;
  const targetCharacter = farmers.some(entry => entry.name === character) ? character : farmers[0]?.name ?? '';
  const options = farmers.map(entry => ({ value: entry.name, label: `${entry.name} · ${entry.ctype}` }));
  const ordered = minimum !== null && target !== null && maximum !== null && minimum <= target && target <= maximum;

  const addRule = () => {
    if (!targetCharacter || !items.length || !ordered || minimum === null || target === null || maximum === null) return;
    onChange(items.reduce((next, item) => setConsumableRule(next, {
      character: targetCharacter, item,
      minQty: minimum,
      targetQty: target,
      maxQty: maximum,
      mode,
      source,
    }), profile));
    setItems([]);
  };

  return (
    <CollapsiblePanel id="merchant-cons" eyebrow="Recurring stock" title="Consumables" actions={
        <div className={styles.headerActions}>
          {alertCount > 0 ? <Badge variant="warning">{alertCount} stock alert{alertCount > 1 ? 's' : ''}</Badge> : null}
          <Toggle label="Enable consumable delivery" value={profile.seller.consumables.enabled} disabled={pending} onChange={value => onChange(setSellerBoardEnabled(profile, 'consumables', value))} />
        </div>
      }>
      <p className={styles.help}>Below minimum, the merchant refills to target. Maximum reports excess stock and never increases a delivery.</p>
      <div className={styles.formGrid}>
        <Field label="Character" htmlFor="cons-character"><SelectInput id="cons-character" value={targetCharacter} disabled={pending} onChange={setCharacter} options={options} /></Field>
        <Field label="Items" htmlFor="cons-item"><ItemMultiSelect id="cons-item" catalog={catalog} values={items} disabled={pending} onChange={setItems} /></Field>
        <Field label="Minimum" htmlFor="cons-min"><NumberInput id="cons-min" min={1} max={999999} value={minimum} disabled={pending} onChange={setMinimum} /></Field>
        <Field label="Refill target" htmlFor="cons-target"><NumberInput id="cons-target" min={1} max={999999} value={target} disabled={pending} onChange={setTarget} /></Field>
        <Field label="Maximum" htmlFor="cons-max"><NumberInput id="cons-max" min={1} max={999999} value={maximum} disabled={pending} onChange={setMaximum} /></Field>
        <Field label="Mode" htmlFor="cons-mode"><SelectInput id="cons-mode" value={mode} disabled={pending} onChange={value => setMode(value as typeof mode)} options={MODE_OPTIONS} /></Field>
        <Field label="Source" htmlFor="cons-source"><SelectInput id="cons-source" value={source} disabled={pending} onChange={value => setSource(value as typeof source)} options={SOURCE_OPTIONS} /></Field>
        <Button size="small" variant="secondary" disabled={pending || !targetCharacter || !items.length || !ordered} onClick={addRule}>Add or replace</Button>
      </div>
      {!ordered ? <p className={styles.validation} role="alert">Use minimum ≤ target ≤ maximum.</p> : null}
      {statuses.length === 0 ? <p className={styles.empty}>No recurring supplies configured.</p> : (
        <div className={styles.rules}>
          {statuses.map(status => {
            const rule = status.rule;
            const variant = status.level === 'low' ? 'danger' : status.level === 'excess' ? 'warning' : status.level === 'healthy' ? 'success' : 'neutral';
            return (
              <article key={`${rule.character}:${rule.item}`}>
                <Sprite id={`item:${rule.item}`} catalog={catalog} label={rule.item} size={40} />
                <div>
                  <strong>{rule.character} · {names.get(rule.item) ?? rule.item}</strong>
                  <span>min {rule.minQty} · target {rule.targetQty} · max {rule.maxQty}</span>
                  <span>{rule.mode} · {rule.source}</span>
                </div>
                <div className={styles.ruleActions}>
                  <Badge variant={variant}>{status.message}</Badge>
                  <Button size="small" variant="ghost" disabled={pending} onClick={() => onChange(removeConsumableRule(profile, rule.character, rule.item))}>Remove</Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </CollapsiblePanel>
  );
}
