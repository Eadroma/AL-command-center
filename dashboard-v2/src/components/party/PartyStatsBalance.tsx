import type { PerformanceBucket } from '../../types';
import { partyFarmingBalance } from '../../models/party-statistics';
import styles from './PartyStats.module.scss';
const number = (value: number | null) => value == null ? '—' : Math.round(value).toLocaleString();
const minutes = (value: number | null) => value == null ? '—' : `${(value / 60000).toFixed(1)} min`;
export function PartyStatsBalance({ buckets, names }: { buckets: PerformanceBucket[]; names: string[] }) {
  const balances = partyFarmingBalance(buckets, names);
  return <article className={styles.card} aria-label="Observed farming balance">
    <header><div><h3>Farming balance</h3><p>Loot gold + confirmed NPC sales − known consumable replacement costs</p></div><span className={styles.quality}>Observed · selected filters</span></header>
    <div className={styles.tableWrap}><table className={styles.balanceTable}><thead><tr><th>Character</th><th>Loot gold</th><th>NPC sales</th><th>Consumables</th><th>Net gold</th><th>Net / h</th><th>Deaths</th><th>Moving</th><th>Data coverage</th></tr></thead><tbody>{balances.map(row => <tr key={row.character}><th>{row.character}</th><td>{number(row.loot)}</td><td>{number(row.sales)}</td><td>{number(row.cost)}</td><td>{number(row.net)}</td><td>{number(row.netPerHour)}</td><td>{number(row.deaths)}</td><td>{minutes(row.movingMs)}</td><td><span className={row.coverage === 100 && !row.unpriced ? styles.live : styles.warning}>{!row.elapsedMs ? 'No measurements' : !row.measuredMs ? 'Missing economy data' : row.unpriced ? `${row.unpriced} unpriced consumption(s)` : `${Math.round(row.coverage)}% matched${row.measuredMs<300000?' · short sample':''}`}</span><small>{minutes(row.measuredMs)} matched / {minutes(row.elapsedMs)} observed</small></td></tr>)}</tbody></table></div>
    <details><summary>Calculation & limitations</summary><p>Net rates use only intervals with matching loot, NPC sale and cost coverage. Zero means a measured zero; — means unavailable. Unpriced consumption hides the net amount and rate. Negative results remain visible.</p><p>Consumables are valued at catalog replacement prices. This is an operating balance, excluding upgrades, crafts, player trading and unsold loot. NPC sales are attributed to the character and time of sale; they cannot prove which earlier farming session produced the sold item.</p><p>Deaths and movement use all observed time. Missing intervals and offline time are excluded; per-character hourly rates are not added into a fictitious team rate.</p></details>
  </article>;
}
