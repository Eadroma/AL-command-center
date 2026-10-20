import { useState } from 'react';
import type { Catalog, DeploymentsResponse, Profile } from '../../types';
import { addCraftContract, craftContracts, addProductionContract, productionContracts } from '../../models/production-contracts';
import { openMerchantRule } from '../../models/rule-navigation';
import { Button, Field, ItemMultiSelect, NumberInput, Sprite, Toggle, SelectInput } from '../ui';
import { CollapsiblePanel } from './CollapsiblePanel';
import styles from './MerchantTools.module.scss';
export function ProductionContracts({profile,catalog,deployments,disabled,onChange}:{profile:Profile;catalog:Catalog;deployments?:DeploymentsResponse;disabled:boolean;onChange:(p:Profile)=>void}) {
  const [mode,setMode]=useState('upgrade');
  const [items,setItems]=useState<string[]>([]),[level,setLevel]=useState<number|null>(9),[quantity,setQuantity]=useState<number|null>(3),[budget,setBudget]=useState<number|null>(200000000),[buy,setBuy]=useState(false),[error,setError]=useState('');
  const merchant=profile.characters.find(c=>c.enabled&&c.ctype==='merchant');
  const telemetry=merchant?deployments?.characters[merchant.name]?.telemetry:undefined;
  const contracts=productionContracts(profile,telemetry);
  const crafts=craftContracts(profile,telemetry);
  const selected=catalog.items.find(i=>i.id===items[0]);
  const eligible={...catalog,items:catalog.items.filter(i=>mode==='craft'?!!catalog.recipes?.[i.id]:i.upgrade)};
  function add(){if(!selected||(mode==='upgrade'&&level===null)||quantity===null||budget===null)return;try{onChange(mode==='craft'?addCraftContract(profile,selected.id,quantity,budget,crypto.randomUUID()):addProductionContract(profile,selected.id,level!,quantity,budget,buy&&!!selected.npcShops?.length,crypto.randomUUID()));setItems([]);setBuy(false);setError('');}catch(e){setError((e as Error).message);}}
  return <CollapsiblePanel id="production-contracts" eyebrow="Persistent bounded lots" title="Production contracts" defaultOpen>
    <p>Create a craft or bounded upgrade lot. Upgrade lots: carried pieces first, permitted NPC bases next, scrolls charged against its material budget, finished pieces to bank. Existing materials are protected by the normal merchant rules. Save and deploy to apply.</p>
    <div className={styles.spotLayout}><div className={styles.fields}>
      <Field label="Contract type" htmlFor="contract-type"><SelectInput id="contract-type" value={mode} options={[{value:'upgrade',label:'Bounded upgrade'},{value:'craft',label:'Craft recipe'}]} disabled={disabled} onChange={value=>{setMode(value);setItems([]);setBuy(false);setError('');}}/></Field>
      <Field label="Item to produce" htmlFor="contract-item"><ItemMultiSelect id="contract-item" catalog={eligible} values={items} max={1} disabled={disabled} onChange={value=>{setItems(value);setBuy(false);}}/></Field>
      {mode==='upgrade'&&<Field label="Target level +" htmlFor="contract-level"><NumberInput id="contract-level" min={1} max={15} value={level} disabled={disabled} onChange={setLevel}/></Field>}
      <Field label="Finished pieces" htmlFor="contract-quantity"><NumberInput id="contract-quantity" min={1} max={9999} value={quantity} disabled={disabled} onChange={setQuantity}/></Field>
      <Field label="Material budget (gold)" htmlFor="contract-budget"><NumberInput id="contract-budget" min={0} max={2e12} value={budget} disabled={disabled} onChange={setBudget}/></Field>
      {mode==='upgrade'&&!!selected?.npcShops?.length&&<Toggle label="Allow NPC base purchases" value={buy} disabled={disabled} onChange={setBuy}/>}
      <Button disabled={disabled||!selected||(mode==='upgrade'&&!level)||!quantity||budget===null||budget<0||(mode==='upgrade'&&(level??0)>15)||quantity>9999||budget>2e12} onClick={add}>Stage contract</Button>
    </div><div><p>Destination: <strong>{mode==='upgrade'?'Bank at target level':'Protected on merchant'}</strong></p><p>{mode==='upgrade'?'Budget counts purchased bases and consumed scrolls at catalog value.':'Craft budget counts permitted NPC ingredients and craft fees; carried materials are not repurchased.'} It does not guarantee the target will be reached. Locked and bound outputs remain protected.</p>{mode==='upgrade'&&!profile.seller.upgrade.enabled&&<p>Upgrades are disabled. Contracts will not run until you enable upgrades in the workshop.</p>}</div></div>
    {error&&<p role="alert">{error}</p>}
    <div className={styles.rows}>{contracts.map(c=><article key={c.run.runId} className={styles.row}><Sprite id={`item:${c.rule.item}`} catalog={catalog} label={c.rule.item} size={36}/><span><strong>{c.rule.item} → +{c.rule.maxLevel} · {c.run.quantity} pieces</strong><br/>{c.state} · {c.live?'Live':'Stored / unavailable sample'}<br/>{c.sample?`${c.sample.produced}/${c.run.quantity} produced · ${c.sample.spent.toLocaleString()}/${c.run.budget.toLocaleString()} material gold`:'No matching run sample'}<br/>{c.destination} · {c.rule.buyNpc?'NPC purchases allowed':'Carried pieces only'}</span><Button variant="ghost" size="small" onClick={()=>openMerchantRule(c.sample?.pending?'upgrade-resolution':'merchant-up')}>Inspect / edit lot</Button></article>)}</div>
    <div className={styles.rows}>{crafts.map(c=><article key={c.goal.id} className={styles.row}><Sprite id={`item:${c.goal.item}`} catalog={catalog} label={c.goal.item} size={36}/><span><strong>{c.goal.item} · craft {c.goal.quantity} pieces</strong><br/>{c.state} · {c.live?'Live':'Stored / unavailable sample'}<br/>{c.sample?`${c.sample.held}/${c.goal.quantity} produced · ${c.sample.spent.toLocaleString()}/${c.goal.budget.toLocaleString()} gold`:'No matching run sample'}<br/>{c.destination}</span><Button variant="ghost" size="small" onClick={()=>openMerchantRule('merchant-goals')}>Inspect / edit craft lot</Button></article>)}</div>
    <p>Craft contracts reuse the existing Commercial objectives runtime; permitted NPC recipe ingredients and craft fees are charged to their budget. This view reuses upgrade lot IDs and counters; editing does not reset their history.</p>
    <Button variant="ghost" onClick={()=>openMerchantRule('merchant-goals')}>Open craft objectives</Button>
  </CollapsiblePanel>;
}
