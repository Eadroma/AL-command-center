import { useState } from 'react';
import type { Catalog, DeploymentsResponse } from '../../types';
import { api } from '../../api/client';
import { InventoryItemSlot } from '../inventory/InventoryItemSlot';
import styles from './MerchantDepositInventory.module.scss';

export function MerchantDepositInventory({name,telemetry,catalog,busy}:{name?:string;telemetry?:NonNullable<DeploymentsResponse['characters'][string]['telemetry']>;catalog?:Catalog;busy:boolean}){
 const [pending,setPending]=useState<number[]>([]),[message,setMessage]=useState(''),[error,setError]=useState('');
 const inventory=telemetry?.inventory||[],live=!!telemetry?.live;
 async function deposit(item:typeof inventory[number]){
  setPending(rows=>[...rows,item.slot]);setError('');
  try{await api('/api/bank/deposit',{slot:item.slot,name:item.name,level:item.level,quantity:item.quantity});setMessage(`${item.name} +${item.level} ×${item.quantity}: deposit queued. The merchant will return to his stand afterwards.`);}
  catch(e){setError(e instanceof Error?e.message:'Deposit failed');}
  finally{setPending(rows=>rows.filter(slot=>slot!==item.slot));}
 }
 return <section className={styles.card} aria-label="Merchant inventory deposits">
  <header><h3>{name||'Merchant'} · Inventory</h3><span>{telemetry?.stats?.gold?.toLocaleString()||'—'} gold · {live?'Live':'Offline'}</span></header>
  <p>Click an item to deposit its entire stack once. Recurring rules stay unchanged.</p>
  <div className={styles.grid}>{Array.from({length:Math.max(42,...inventory.map(it=>it.slot+1))},(_,slot)=>{
   const item=inventory.find(it=>it.slot===slot),disabled=!live||busy||!item||item.locked||item.bound||item.name==='placeholder'||pending.includes(slot);
   return <button type="button" key={slot} disabled={disabled} onClick={()=>item&&deposit(item)} aria-label={item?`Deposit ${item.name} +${item.level} ×${item.quantity}`:`Empty slot ${slot}`} title={item?.locked||item?.bound?'Protected item':item?'Deposit this stack':'Empty slot'}><InventoryItemSlot item={item} slotIndex={slot} catalog={catalog} size={48}/></button>;
  })}</div>
  {message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}
 </section>;
}
