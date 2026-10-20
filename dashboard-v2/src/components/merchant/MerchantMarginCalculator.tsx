import { useState } from 'react';
import type { Catalog, Profile } from '../../types';
import { merchantMargin } from '../../models/merchant-margin';
import { Field, ItemMultiSelect, NumberInput, SelectInput } from '../ui';
import { CollapsiblePanel } from './CollapsiblePanel';
import styles from './MerchantTools.module.scss';
export function MerchantMarginCalculator({ profile, catalog }: { profile: Profile; catalog: Catalog }) {
  const [items, setItems] = useState<string[]>([]);
  const [mode, setMode] = useState('resale');
  const [costs, setCosts] = useState<Record<string, number | null>>({});
  const [fee, setFee] = useState<number | null>(null);
  const [chance, setChance] = useState<number | null>(null);
  const [sale, setSale] = useState<number | null>(null);
  const id = items[0]; const recipe = catalog.recipes?.[id];
  const parts = mode === 'craft' ? recipe?.ingredients ?? [] : id ? [{ item: id, level: 0, quantity: mode === 'compound' ? 3 : 1 }] : [];
  const key = (item: string, level: number) => `${item}:${level}`;
  const outputLevel = mode === 'compound' ? 1 : 0;
  const configuredPrice = profile.seller.listings.find(row => row.item === id && row.level === outputLevel)?.price;
  const salePrice = sale ?? configuredPrice ?? null;
  const operationFee = fee ?? (mode === 'craft' ? recipe?.cost ?? null : mode === 'resale' ? 0 : null);
  const probability = mode === 'compound' ? chance === null ? NaN : chance / 100 : 1;
  const result = merchantMargin(parts.map(p => ({ quantity: p.quantity, unitCost: costs[key(p.item,p.level)] ?? NaN })), operationFee ?? NaN, probability, salePrice ?? NaN);
  return <CollapsiblePanel id="merchant-margin" title="Merchant margin calculator" eyebrow="Estimates · no purchases">
    <p>Compare resale, a catalog craft, or one compound step (+0 → +1). Enter material acquisition or replacement values. Stand prices are asking prices, not confirmed revenue.</p>
    <div className={styles.fields}>
      <Field label="Operation" htmlFor="margin-mode"><SelectInput id="margin-mode" value={mode} options={[{value:'resale',label:'Resale'},{value:'craft',label:'Craft'},{value:'compound',label:'Compound +0 → +1'}]} onChange={value => {setMode(value);setFee(null);setChance(null);setSale(null);}}/></Field>
      <Field label="Output item" htmlFor="margin-item"><ItemMultiSelect id="margin-item" catalog={{...catalog,items:catalog.items.filter(i => mode === 'craft' ? !!catalog.recipes?.[i.id] : mode === 'compound' ? i.compound : true)}} values={items} max={1} onChange={value => {setItems(value);setFee(null);setSale(null);setChance(null);}}/></Field>
      {parts.map(p => <Field key={key(p.item,p.level)} label={`${p.quantity} × ${catalog.items.find(i => i.id === p.item)?.name ?? p.item} +${p.level} · unit cost`} htmlFor={`margin-cost-${p.item}-${p.level}`}><NumberInput id={`margin-cost-${p.item}-${p.level}`} min={0} max={2e12} value={costs[key(p.item,p.level)] ?? null} onChange={value => setCosts(old => ({...old,[key(p.item,p.level)]:value}))}/></Field>)}
      <Field label={mode === 'compound' ? 'Scroll / offering cost per attempt' : 'Operation fee'} htmlFor="margin-fee"><NumberInput id="margin-fee" min={0} max={2e12} value={operationFee} onChange={setFee}/></Field>
      {mode === 'compound' && <Field label="Success chance % (assumption)" htmlFor="margin-chance"><NumberInput id="margin-chance" min={0.01} max={100} step={0.01} value={chance} onChange={setChance}/></Field>}
      <Field label="Net sale proceeds per output" htmlFor="margin-sale"><NumberInput id="margin-sale" min={0} max={2e12} value={salePrice} onChange={setSale}/></Field>
    </div>
    {result ? <p role="status">Cost per attempt: {Math.round(result.attemptCost).toLocaleString()} gold · Expected break-even: {Math.round(result.breakEven).toLocaleString()} gold · Expected margin: {Math.round(result.margin).toLocaleString()} gold</p> : <p>Complete all cost, price and probability assumptions.</p>}
    <small>Compound failures are assumed to destroy all three inputs. Expected cost includes repeated attempts. No travel cost, sale delay or market liquidity is modeled. Use net proceeds after any fees.</small>
  </CollapsiblePanel>;
}
