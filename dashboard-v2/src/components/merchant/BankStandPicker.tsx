import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { bankSnapshots } from '../../models/bank';
import type { Catalog, DeploymentsResponse } from '../../types';
import type { MarketPrice } from '../../../shared/market-prices';
import { Button, Sprite, TextInput } from '../ui';
import styles from './BankStandPicker.module.scss';

/** Selection only stages the existing listing form; it never saves or withdraws stock. */
export function BankStandPicker({catalog,deployments,disabled,onSelect}:{catalog:Catalog;deployments?:DeploymentsResponse;disabled:boolean;onSelect:(item:string,level:number,price:number|null)=>void}){
 const [search,setSearch]=useState('');
 const market=useQuery({queryKey:['market-prices'],queryFn:()=>api<{prices:MarketPrice[];fetchedAt:number;stale:boolean}>('/api/market-prices'),staleTime:300000,retry:false});
 const snapshot=bankSnapshots(deployments)[0];
 const names=new Map(catalog.items.map(it=>[it.id,it.name]));
 const groups=new Map<string,{item:string;level:number;quantity:number}>();
 for(const it of snapshot?.items??[]){const key=it.name+':'+it.level;const row=groups.get(key)??{item:it.name,level:it.level,quantity:0};row.quantity+=it.quantity;groups.set(key,row);}
 const all=[...groups.values()].filter(it=>(it.item+' '+(names.get(it.item)??'')).toLowerCase().includes(search.toLowerCase())).sort((a,b)=>{
  const prices=market.data?.prices;
  const ap=prices?.find(p=>p.item===a.item&&p.level===a.level)?.average;
  const bp=prices?.find(p=>p.item===b.item&&p.level===b.level)?.average;
  return (bp??-1)-(ap??-1)||a.item.localeCompare(b.item)||b.level-a.level;
 });
 return <details className={styles.picker}><summary>Choose stock from bank · {groups.size} items / levels</summary>
 <p>Bank snapshot: {snapshot?.capturedAt?new Date(snapshot.capturedAt).toLocaleString():'unavailable'}. Selection fills the form above; review the price before adding and saving.</p>
 <TextInput aria-label="Search bank stock for stand" value={search} onChange={setSearch} placeholder="Search bank items" />
 <p role="status">{market.isPending?'Loading estimates…':market.isError?'Prices unavailable; enter a price manually.':`ALData offers checked ${new Date(market.data!.fetchedAt).toLocaleString()}${market.data!.stale?' · cached, service unavailable':''}.`}</p>
 <p>Average asking price, not completed sales. Exact item / level; last-week offers across servers. Outliers can distort the average. Availability and reservations are checked by the merchant.</p>
 <div className={styles.rows}>{all.slice(0,40).map(it=>{const estimate=market.data?.prices.find(p=>p.item===it.item&&p.level===it.level);return <div key={it.item+':'+it.level} className={styles.row}><Sprite id={'item:'+it.item} catalog={catalog} label={names.get(it.item)??it.item} size={32}/><div><strong>{names.get(it.item)??it.item} +{it.level}</strong><small>{it.quantity.toLocaleString()} in bank</small></div><div><strong>{estimate?estimate.average.toLocaleString()+' gold':'No estimate'}</strong>{estimate&&<small title={`Median ${estimate.median.toLocaleString()} · range ${estimate.minimum.toLocaleString()}–${estimate.maximum.toLocaleString()} gold`}>{estimate.offers} offers · hover for range</small>}</div><Button size="small" variant="secondary" disabled={disabled} onClick={()=>onSelect(it.item,it.level,estimate?.average??null)}>Select</Button></div>})}</div>
 {!all.length&&<p>No matching bank stock. Visit the bank to refresh its snapshot.</p>}{all.length>40&&<p>Showing 40 of {all.length}; refine your search.</p>}
 </details>;
}
