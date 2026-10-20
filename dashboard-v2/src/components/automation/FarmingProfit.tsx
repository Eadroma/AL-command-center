import type { PerformanceBucket } from '../../types';
import { farmingProfit } from '../../models/farming-profit';
import { Badge, Card, EmptyState } from '../ui';
import styles from './BuildComparison.module.scss';

const gold = (value: number | null) => value === null ? '—' : Math.round(value).toLocaleString();

function equipmentLabel(value?: string) {
  if (!value) return 'Unavailable on legacy samples';
  try { return (JSON.parse(value) as Array<[string,string,number]>).map(([slot,item,level]) => `${slot}: ${item} +${level}`).join(' · '); } catch { return 'Equipment evidence unavailable'; }
}
export function FarmingProfit({ buckets }: { buckets: PerformanceBucket[] }) {
  const rows = farmingProfit(buckets);
  return <Card title="Farming profitability · tracked net estimate">
    <p className={styles.help}>Loot received minus confirmed consumed items valued at their game-catalog replacement price. Transfers and purchases do not count as loot. NPC resale is shown separately for the selling character and cannot be attributed to a farmer after a transfer. This excludes upgrades, travel fees and consumptions without a recognised game response. It is not your wallet balance or a complete accounting profit.</p>
    {!rows.some(row => row.elapsedMs) && <EmptyState title="Collecting consumption coverage" description="Deploy updated farmer bundles. Historical loot samples cannot reconstruct their consumable costs." />}
    <div className={styles.tableWrap}><table><caption>Ranked by tracked net gold / hour · current History filters</caption><thead><tr><th>Character / activity</th><th>Loot/h</th><th>Replacement/h</th><th>Tracked net/h</th><th>NPC resale/h</th><th>Net incl. own resale/h</th><th>Coverage / reliability</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}>
      <th scope="row">{row.character}<br /><small>{row.monster} · {row.map} · {row.server}</small><br /><small>Team: {row.participants.join(', ') || 'not reported'}</small><br /><small>Gold: {row.goldMultiplier === undefined ? 'unknown' : `${Math.round(row.goldMultiplier * 100)}%`} · Effects: {row.effects.join(', ') || 'unknown / none'}</small><details><summary>Recorded equipment</summary>{equipmentLabel(row.build)}</details></th>
      <td>{gold(row.lootPerHour)}</td><td>{gold(row.costPerHour)}</td><td>{gold(row.netPerHour)}{row.unpriced > 0 && <Badge variant="warning">{row.unpriced} unpriced</Badge>}</td>
      <td>{gold(row.resalePerHour)}</td><td>{gold(row.combinedNetPerHour)}</td><td>{Math.round(row.elapsedMs / 60000)} / {Math.round(row.coverage / 60000)} min<br /><small>{row.elapsedMs ? row.consumed : '—'} consumed</small>{row.elapsedMs > 0 && row.elapsedMs < 300000 && <Badge variant="warning">Short sample</Badge>}<br /><small>{row.reliability} · {row.deaths} deaths · {Math.round(row.movementPercent)}% moving</small></td>
    </tr>)}</tbody></table></div>
  </Card>;
}
