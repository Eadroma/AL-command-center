import { useEffect, useRef, useState } from 'react';
import { canonicalItemId } from '../../../shared/schema';
import type { Catalog, DeploymentsResponse, PartyMember, Profile } from '../../types';
import { locateItems } from '../../models/item-locator';
import { itemLoadoutReservations, itemRuleLinks } from '../../models/item-details';
import { bankSnapshots } from '../../models/bank';
import { useOperationsHistory } from '../../hooks/useOperationsHistory';
import { openMerchantRule } from '../../models/rule-navigation';
import { Sprite } from '../ui';
import styles from './ItemDetailsDrawer.module.scss';
interface Props { profile?: Profile; catalog?: Catalog; deployments?: DeploymentsResponse; members: PartyMember[] | null; }
/** One shared native dialog: Escape, focus trapping and background inertness are browser-managed. */
export function ItemDetailsDrawer(props: Props) {
  const [item, setItem] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const focus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const open = (event: Event) => {
      const id = (event as CustomEvent<string>).detail;
      if (typeof id !== 'string' || !/^[a-zA-Z0-9_]+$/.test(id)) return;
      focus.current = document.activeElement as HTMLElement;
      setItem(canonicalItemId(id));
      if(!dialog.current?.open) dialog.current?.showModal();
    };
    window.addEventListener('alcc:item-details',open);return () => window.removeEventListener('alcc:item-details',open);
  }, []);
  function close() { dialog.current?.close();setItem('');focus.current?.focus(); }
  return <dialog ref={dialog} className={styles.drawer} aria-labelledby="item-details-title" onCancel={() => {setItem('');focus.current?.focus();}}>
    <header className={styles.header}><div><Sprite id={`item:${item}`} catalog={props.catalog} label={item} size={40} inspect={false}/><div><h2 id="item-details-title">{props.catalog?.items.find(row => row.id === item)?.name ?? item}</h2><small>{item}</small></div></div><button type="button" aria-label="Close item details" onClick={close}>×</button></header>
    {item && <ItemDetailsBody {...props} item={item} onNavigate={panel => {close();const page=panel==='bank'?'bank':'merchant';window.location.hash=page;window.setTimeout(() => {if(window.location.hash===`#${page}`)openMerchantRule(panel);},150);}}/>}
  </dialog>;
}
function ItemDetailsBody({ item, profile, catalog, deployments, members, onNavigate }: Props & {item:string;onNavigate:(panel:string)=>void}) {
  const history = useOperationsHistory();
  const locations = locateItems(item,members,catalog,deployments,profile).filter(row => canonicalItemId(row.item)===item);
  const reservations = itemLoadoutReservations(item,profile);
  const rules = itemRuleLinks(item,profile,catalog);
  const bank = bankSnapshots(deployments)[0];
  const commerce = (history.data?.commerce ?? []).filter(row => canonicalItemId(row.item)===item);
  const upgrades = Object.entries(deployments?.characters ?? {}).flatMap(([character,row]) => (row.telemetry?.upgradeHistory?.entries ?? []).filter(entry => canonicalItemId(entry.item)===item).map(entry => ({...entry,character})));
  return <div className={styles.body}>
    <p className={styles.note}>Rules and reservations use the saved profile. Locations and history reflect available samples, not a complete account audit.</p>
    <section><h3>Locations <small>{locations.reduce((n,row)=>n+row.quantity,0)} observed units</small></h3>
      {!locations.length && <p>No observed copy. Offline inventories may be unavailable.</p>}
      {locations.map(row => <article key={row.key}><strong>{row.owner} · +{row.level} ×{row.quantity}</strong><span>{row.location}</span></article>)}
      <p className={styles.note}>Character locations use current party samples. Bank snapshot: {bank?.capturedAt ? new Date(bank.capturedAt).toLocaleString() : 'unavailable'}. Wishlist orders are not owned copies.</p>
    </section>
    <section><h3>Equipment reservations</h3>{!reservations.length && <p>No saved loadout reservation.</p>}{reservations.map((r,i) => <article key={i}><strong>{r.character} · {r.style}</strong><span>{r.slot} · minimum +{r.minLevel}</span></article>)}<p className={styles.note}>Default script protections, locks and supply quotas can also retain an item. Inspect Inventory for the running policy decision.</p></section>
    <section><h3>Commercial rules</h3>{!rules.length && <p>No matching saved commercial rule.</p>}{rules.map((rule,i) => <button type="button" className={styles.rule} key={i} onClick={() => onNavigate(rule.id)}><strong>{rule.label} · {rule.enabled?'Enabled':'Disabled'}</strong><span>{rule.detail} → Open rule</span></button>)}</section>
    <section><h3>Observed history</h3>
      {history.isPending && <p>Loading commercial history…</p>}{history.isError && <p role="alert">Commercial history unavailable. <button type="button" onClick={() => history.refetch()}>Retry</button></p>}
      {[...commerce.map(row => ({id:row.id,at:row.at,title:`${row.character} · ${row.side} · +${row.level} ×${row.quantity}`,detail:`${row.unitPrice.toLocaleString()} gold/unit · ${row.goldDelta.toLocaleString()} gold change`})),...upgrades.map(row => ({id:`${row.character}:${row.id}`,at:row.at,title:`${row.character} · ${row.kind} +${row.level} · ${row.outcome}`,detail:`${row.cost.toLocaleString()} gold recorded${row.manual?' · manually resolved':''}`}))].sort((a,b)=>b.at-a.at).slice(0,40).map(row => <article key={row.id}><strong>{row.title}</strong><span>{row.detail}</span><time>{new Date(row.at).toLocaleString()}</time></article>)}
      {!commerce.length && !upgrades.length && !history.isPending && <p>No matching recorded operation.</p>}
      <p className={styles.note}>Commerce: last 7 days. Upgrades: retained deployment entries. Compound and bank logs do not yet provide an item-by-item timeline here.</p>
    </section>
  </div>;
}
