import { useState } from 'react';
import { Coins, Skull, Timer } from 'lucide-react';
import { worldBosses } from '../../../shared/schema';
import { expeditionBosses } from '../../../shared/event-expedition';
import { usePerformanceHistory } from '../../hooks/usePerformanceHistory';
import { lootTracker, type BossFilter } from '../../models/loot-tracker';
import type { Catalog, Profile } from '../../types';
import { Badge, Button, EmptyState, Field, SectionHead, SelectInput, Sprite } from '../ui';
import styles from './LootTrackerPage.module.scss';

// Event bosses and timed world bosses; a near-instant respawn (bscorpion: 6) is a regular farm target.
const BOSSES = [...new Set([...worldBosses.filter(b => b.respawn >= 600).map(b => b.id), ...expeditionBosses])];
const windows = [1, 6, 24, 168];
const filters: Array<{ value: BossFilter; label: string }> = [
  { value: 'all', label: 'All monsters' }, { value: 'regular', label: 'Without bosses' }, { value: 'bosses', label: 'Bosses only' },
];
const count = (value: number | null) => value === null ? '—' : Math.round(value).toLocaleString();
const rate = (value: number | null) => value === null ? '—' : value.toLocaleString(undefined, { maximumFractionDigits: value < 10 ? 1 : 0 });

export interface LootTrackerPageProps { profile?: Profile; catalog?: Catalog }

export function LootTrackerPage({ profile, catalog }: LootTrackerPageProps) {
  const [hours, setHours] = useState(24);
  const [filter, setFilter] = useState<BossFilter>('all');
  const [monster, setMonster] = useState('all');
  const history = usePerformanceHistory(hours);
  const farmers = (history.data?.buckets ?? []).filter(row => !profile || profile.characters.some(c => c.name === row.character && c.ctype !== 'merchant'));
  const tracker = lootTracker(farmers, BOSSES, filter);
  const selected = monster === 'all' ? null : tracker.monsters.find(row => row.mtype === monster) ?? null;
  const items = selected ? selected.items : tracker.items;
  const name = (mtype: string) => catalog?.monsters.find(m => m.id === mtype)?.name ?? mtype;
  return (
    <section aria-label="Kills and loot tracker">
      <SectionHead eyebrow="Measured from session telemetry" title="Kills & loot tracker">
        <div className={styles.windows}>{windows.map(value => <Button key={value} size="small" variant={hours === value ? 'secondary' : 'ghost'} onClick={() => setHours(value)}>{value === 168 ? '7d' : `${value}h`}</Button>)}</div>
      </SectionHead>
      <p className={styles.description}>Kills come from the game's kill credit, so each kill counts once for the team. Loot is what the farmers received from chests, credited to the monster that dropped the chest. Per hour and per day are projections from observed online time, not guarantees.</p>
      <div className={styles.filters}>
        <Field label="Monsters" htmlFor="loot-tracker-filter"><SelectInput id="loot-tracker-filter" value={filter} onChange={value => { setFilter(value as BossFilter); setMonster('all'); }} options={filters} /></Field>
        <Field label="Items from" htmlFor="loot-tracker-monster"><SelectInput id="loot-tracker-monster" value={monster} onChange={setMonster} options={[{ value: 'all', label: 'All listed monsters' }, ...tracker.monsters.map(row => ({ value: row.mtype, label: name(row.mtype) }))]} /></Field>
      </div>
      {history.isLoading && <EmptyState title="Loading telemetry history…" />}
      {history.error && <p role="alert" className={styles.error}>{history.error.message}</p>}
      {!history.isLoading && !tracker.observedMs && <EmptyState title="Waiting for per-monster telemetry" description="Redeploy the farmers so their scripts report kills and loot per monster. The first figures appear after two reports from the same CODE session." />}
      {tracker.observedMs > 0 && <>
        <dl className={styles.totals}>
          <div><dt><Timer size={13} /> Observed</dt><dd>{rate(tracker.observedMs / 3_600_000)} h</dd></div>
          <div><dt><Skull size={13} /> Kills</dt><dd>{count(tracker.totals.kills)}</dd><small>{count(tracker.perHour(tracker.totals.kills))}/h · {count(tracker.perDay(tracker.totals.kills))}/day</small></div>
          <div><dt><Coins size={13} /> Loot gold</dt><dd>{count(tracker.totals.gold)}</dd><small>{count(tracker.perHour(tracker.totals.gold))}/h · {count(tracker.perDay(tracker.totals.gold))}/day</small></div>
        </dl>
        <div className={styles.tableWrap}><table>
          <caption>Per monster · {filters.find(f => f.value === filter)?.label}</caption>
          <thead><tr><th>Monster</th><th>Kills</th><th>Kills/h</th><th>Kills/day</th><th>Gold</th><th>Gold/h</th><th>Gold/day</th></tr></thead>
          <tbody>{tracker.monsters.map(row => <tr key={row.mtype}>
            <td>{name(row.mtype)} {row.boss && <Badge variant="warning">Boss</Badge>}{row.mtype === 'unknown' && <Badge variant="info">Unattributed</Badge>}</td>
            <td>{count(row.kills)}</td><td>{rate(tracker.perHour(row.kills))}</td><td>{count(tracker.perDay(row.kills))}</td>
            <td>{count(row.gold)}</td><td>{count(tracker.perHour(row.gold))}</td><td>{count(tracker.perDay(row.gold))}</td>
          </tr>)}</tbody>
        </table></div>
        <div className={styles.tableWrap}><table>
          <caption>Items {selected ? `from ${name(selected.mtype)}` : 'from the listed monsters'}{selected?.kills ? ' · per kill = average drops per team kill' : ''}</caption>
          <thead><tr><th>Item</th><th>Quantity</th><th>Per hour</th><th>Per day</th>{selected?.kills ? <th>Per kill</th> : null}</tr></thead>
          <tbody>{items.map(it => <tr key={it.key}>
            <td><span className={styles.item}><Sprite id={`item:${it.name}`} catalog={catalog} label={it.name} size={24} />{catalog?.items.find(item => item.id === it.name)?.name ?? it.name}{it.level ? ` +${it.level}` : ''}</span></td>
            <td>{count(it.quantity)}</td><td>{rate(tracker.perHour(it.quantity))}</td><td>{rate(tracker.perDay(it.quantity))}</td>
            {selected?.kills ? <td>{rate(it.quantity / selected.kills)}</td> : null}
          </tr>)}</tbody>
        </table></div>
        {!items.length && <p className={styles.description}>No items received in this window.</p>}
      </>}
    </section>
  );
}
