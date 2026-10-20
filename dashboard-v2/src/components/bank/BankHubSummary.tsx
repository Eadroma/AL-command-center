import type { BankHub } from '../../../shared/bank-hub';


import { Badge } from '../ui';
import styles from './BankHubSummary.module.scss';

/** The bank snapshot is an observation, never a promise of executable stock. */
export function BankHubSummary({hub,live}:{hub?:BankHub;live:boolean}) {
 if(!hub)return null;
 return <BankHubContent hub={hub} live={live}/>;
}
function BankHubContent({hub,live}:{hub:BankHub;live:boolean}) {
 const blocked=hub.persistenceError||!hub.ledger.durable;
 return <section className={styles.card} aria-label="Bank coordination">
  <div className={styles.head}><h3>Stock &amp; flow</h3><Badge variant={blocked?'warning':live?'success':'neutral'}>{blocked?'Backup unavailable':live?'Coordinator online':'Stored observation'}</Badge></div>
  <div className={styles.summary}>
   <div><span>Activity</span><strong>{hub.owner?`${hub.owner} · ${hub.phase}`:'Waiting for justified work'}</strong></div>
   <div><span>Bank observation</span><strong>{hub.ledger.observedAt?new Date(hub.ledger.observedAt).toLocaleString():'Not yet observed'}</strong></div>
  </div>
  {(hub.persistenceError||!hub.ledger.durable)&&<p role="alert">Runtime state is retained, but its restart backup could not be saved.</p>}
  <details><summary>Stock available for stand · {hub.ledger.stock.length} observed item levels</summary>
   <p>Estimated from the last bank observation. Locked and bound stock is excluded from eligible quantities. Stock is checked again before withdrawal.</p>
   <div className={styles.table}><table><thead><tr><th>Item</th><th>Bank</th><th>Minimum</th><th>Eligible surplus</th></tr></thead><tbody>{hub.ledger.stock.map(row=><tr key={`${row.item}:${row.level}`}><td>{row.item} +{row.level}</td><td>{row.quantity}</td><td>{row.minimum}</td><td>{row.availableForStand}</td></tr>)}</tbody></table></div>
  </details>
  <details><summary>Latest bank movements · {hub.journal.length}</summary><ul>{hub.journal.slice().reverse().map((row,i)=><li key={`${row.at}:${i}`}>{row.kind} · {row.item} +{row.level} ×{row.quantity} · {row.state}{row.evidence&&` — ${row.evidence}`}</li>)}</ul></details>
 </section>;
}

