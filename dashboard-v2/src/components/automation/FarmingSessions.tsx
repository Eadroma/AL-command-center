import { useState } from 'react';
import type { PerformanceBucket } from '../../types';
import { farmingSessions } from '../../models/farming-sessions';
import { Card, Button } from '../ui';
import styles from '../merchant/MerchantPlanner.module.scss';

const format = (value: number | null) => value === null ? '—' : Math.round(value).toLocaleString();
export function FarmingSessions({ buckets }: { buckets: PerformanceBucket[] }) {
  const [all, setAll] = useState(false);
  const [brief, setBrief] = useState(false);
  const sessions = farmingSessions(buckets);
  const visible = brief ? sessions : sessions.filter(row => !row.short);
  return <Card title="Observed farming sessions">
    <p>Measured segments grouped by character, terrain, server, target and team. A gap over ten minutes starts another segment. Five-minute timestamps cannot precisely order activity changes; different contexts can share a time window. Rates use observed character-time; combat and movement may overlap.</p>
    <Button variant="ghost" onClick={() => { setBrief(!brief); setAll(false); }}>{brief ? 'Hide segments under 5 minutes' : 'Include segments under 5 minutes'}</Button>
    <div className={styles.grid}>{visible.slice(0, all ? undefined : 6).map(row => <article key={row.id}>
      <strong>{row.character} · {row.monster ?? 'Target unknown'}</strong>
      <span>{row.map ?? 'Unknown terrain'} · {row.server ?? 'Unknown server'}</span>
      <span>Team: {row.participants.length ? row.participants.join(', ') : 'not reported'}</span>
      <span>{new Date(row.from).toLocaleString()} → {new Date(row.to).toLocaleTimeString()}</span>
      <span>{(row.elapsedMs / 60000).toLocaleString(undefined, { maximumFractionDigits: 1 })} observed min · {row.kills} kills · {row.deaths} deaths</span>
      <span>Loot gold/h {format(row.lootPerHour)} · XP/h {format(row.xpPerHour)}</span>
      <span>Net gold/h {format(row.netPerHour)} · combat {format(row.combatPercent)}% · moving {format(row.movementPercent)}%</span>
      <small>Loot coverage: {Math.round(row.lootMs / 60000)} min · cost coverage: {Math.round(row.coverage * 100)}%</small>
      {row.short || row.unpriced || row.coverage < .95 ? <p>Short session or incomplete cost coverage; interpret rates cautiously.</p> : null}
    </article>)}</div>
    {!visible.length && <p>{sessions.length ? 'Only short segments available. Include them above to inspect the measurements.' : 'Waiting for observed farming data.'}</p>}
    {visible.length > 6 && <Button variant="ghost" onClick={() => setAll(!all)}>{all ? 'Show latest six' : `Show all ${visible.length} segments`}</Button>}
  </Card>;
}
