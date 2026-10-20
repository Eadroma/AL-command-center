import { useState } from 'react';
import type { Catalog, Profile } from '../../types';
import { Button, Field, ItemMultiSelect, NumberInput, Sprite, Toggle } from '../ui';
import { CollapsiblePanel } from './CollapsiblePanel';
import styles from './CraftPanel.module.scss';

export function CompoundPanel({ profile, catalog, pending, onChange }: {
  profile: Profile; catalog: Catalog; pending: boolean; onChange: (profile: Profile) => void;
}) {
  const board = profile.seller.compound;
  const [selected, setSelected] = useState<string[]>([]);
  const [target, setTarget] = useState<number | null>(3);
  const update = (patch: Partial<typeof board>) => onChange({ ...profile, seller: { ...profile.seller, compound: { ...board, ...patch } } });
  const supported = { ...catalog, items: catalog.items.filter(item => item.compound) };
  return <CollapsiblePanel id="merchant-compound" eyebrow="Combine three identical items" title="Compound" actions={
    <Toggle label="Enable compound" value={board.enabled} disabled={pending} onChange={enabled => update({ enabled })} />
  }>
    <p className={styles.help}>Combine three copies at the same level. Intermediate results also go to the bank. A complete trio below the target stays together for the next compound. Locked and bound items are excluded.</p>
    <Toggle label="Check bank stock after each deposit trip" value={board.checkBankOnDeposit} disabled={pending} onChange={checkBankOnDeposit => update({ checkBankOnDeposit })} />
    <p className={styles.help}>Completes one trio per item from bank stock during an existing deposit trip. Does not start extra bank trips.</p>
    <div className={styles.formGrid}>
      <Field label="Compoundable items" htmlFor="compound-items"><ItemMultiSelect id="compound-items" catalog={supported} values={selected} disabled={pending} onChange={setSelected} /></Field>
      <Field label="Target level +" htmlFor="compound-target"><NumberInput id="compound-target" min={1} max={15} value={target} disabled={pending} onChange={setTarget} /></Field>
      <Button disabled={pending || !selected.length || target === null} onClick={() => {
        update({ rules: [...board.rules.filter(rule => !selected.includes(rule.item)), ...selected.map(item => ({ item, maxLevel: target! }))] }); setSelected([]);
      }}>Add targets</Button>
    </div>
    <div className={styles.rules}>{board.rules.map(rule => <article key={rule.item}>
      <Sprite id={`item:${rule.item}`} catalog={catalog} label={rule.item} size={44} />
      <strong>{catalog.items.find(item => item.id === rule.item)?.name ?? rule.item}</strong>
      <Field label="Target level +" htmlFor={`compound-${rule.item}`}><NumberInput id={`compound-${rule.item}`} min={1} max={15} value={rule.maxLevel} disabled={pending} onChange={value => value !== null && update({ rules: board.rules.map(row => row.item === rule.item ? { ...row, maxLevel: value } : row) })} /></Field>
      <Button variant="ghost" disabled={pending} onClick={() => update({ rules: board.rules.filter(row => row.item !== rule.item) })}>Remove</Button>
    </article>)}</div>
  </CollapsiblePanel>;
}
