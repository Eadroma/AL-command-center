import type { Profile } from '../../types';
import { FarmingProfit } from '../automation/FarmingProfit';
import { Activity, Coins, HeartPulse, Skull, Sparkles, Swords } from 'lucide-react';
import { useState } from 'react';
import { usePerformanceHistory } from '../../hooks/usePerformanceHistory';
import { performanceSummaries } from '../../models/performance';
import { performanceCsv } from '../../models/performance-export';
import { Badge, Button, EmptyState, Field, SectionHead, SelectInput } from '../ui';
import styles from './PerformancePage.module.scss';
import { SessionComparison } from '../automation/SessionComparison';
import { FarmingSessions } from '../automation/FarmingSessions';

const compact = (value: number) => Math.round(value || 0).toLocaleString();
const windows = [1, 6, 24, 168];

export function PerformancePage({ profile }: { profile?: Profile }) {
  const [hours, setHours] = useState(24);
  const [character, setCharacter] = useState('all');
  const [map, setMap] = useState('all');
  const [server, setServer] = useState('all');
  const history = usePerformanceHistory(hours);
  const buckets = history.data?.buckets ?? [];
  const options = (key: 'character' | 'map' | 'server') => [{ value: 'all', label: 'All' }, ...[...new Set(buckets.map(row => row[key] || 'unknown'))].sort().map(value => ({ value, label: value === 'unknown' ? 'Unknown (legacy)' : value }))];
  const filtered = buckets.filter(row => (character === 'all' || row.character === character) && (map === 'all' || (row.map || 'unknown') === map) && (server === 'all' || (row.server || 'unknown') === server));
  const summaries = performanceSummaries(filtered);
  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([performanceCsv(filtered)], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `adventureland-performance-${hours}h-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <section aria-label="Performance history">
      <SectionHead eyebrow="Measured runtime deltas" title="Performance history">
        <Button size="small" variant="secondary" disabled={!filtered.length || history.isFetching || !!history.error} onClick={exportCsv}>Export filtered CSV</Button>
        <div className={styles.windows}>{windows.map(value => <Button key={value} size="small" variant={hours === value ? 'secondary' : 'ghost'} onClick={() => setHours(value)}>{value === 168 ? '7d' : `${value}h`}</Button>)}</div>
      </SectionHead>
      <p className={styles.description}>Five-minute samples survive CODE restarts and dashboard reloads. Rates use observed online time; Loot Gold/h uses gold received through loot events and excludes transfers and spending. Balance gains/h remains a separate estimate from positive wallet deltas. XP uses positive deltas within the same level.</p>
      <div className={styles.filters}>
        <Field label="Character" htmlFor="performance-character"><SelectInput id="performance-character" value={character} onChange={setCharacter} options={options('character')} /></Field>
        <Field label="Terrain" htmlFor="performance-map"><SelectInput id="performance-map" value={map} onChange={setMap} options={options('map')} /></Field>
        <Field label="Server" htmlFor="performance-server"><SelectInput id="performance-server" value={server} onChange={setServer} options={options('server')} /></Field>
      </div>
      {history.isLoading && <EmptyState title="Loading performance history…" />}
      {history.error && <p role="alert" className={styles.error}>{history.error.message}</p>}
      {!history.isLoading && summaries.length === 0 && <EmptyState title={buckets.length ? 'No measurements match these filters' : 'History is collecting'} description={buckets.length ? 'Choose another character, terrain, server or time window.' : 'The first rate appears after two telemetry reports from the same CODE session.'} />}
      <FarmingSessions buckets={filtered.filter(row => !profile || profile.characters.some(character => character.name === row.character && character.ctype !== 'merchant'))} />
      <FarmingProfit buckets={filtered.filter(row => !profile || profile.characters.some(character => character.name === row.character && character.ctype !== 'merchant'))} />
      <SessionComparison disabled={history.isFetching || !!history.error} buckets={filtered.filter(row => !profile || profile.characters.some(character => character.name === row.character && character.ctype !== 'merchant'))} filterLabel={`${hours}h · ${character} · ${map} · ${server}`} />
      <div className={styles.grid}>{summaries.map(summary => {
        const points = summary.buckets.map(bucket => bucket.elapsedMs ? bucket.damage * 1000 / bucket.elapsedMs : 0);
        const ceiling = Math.max(1, ...points);
        return <article key={summary.character}>
          <div className={styles.head}><strong>{summary.character}</strong><Badge variant={summary.deaths ? 'warning' : 'success'}>{summary.deaths} deaths</Badge></div>
          <dl>
            <div><dt><Swords size={13} /> DPS</dt><dd>{compact(summary.dps)}</dd></div>
            <div><dt><HeartPulse size={13} /> HPS</dt><dd>{compact(summary.hps)}</dd></div>
            <div><dt><Skull size={13} /> Kills/h</dt><dd>{compact(summary.killsPerHour)}</dd></div>
            <div><dt><Sparkles size={13} /> XP/h</dt><dd>{compact(summary.xpPerHour)}</dd></div>
            <div><dt><Coins size={13} /> Loot Gold/h</dt><dd>{summary.lootGoldPerHour === null ? '—' : compact(summary.lootGoldPerHour)}</dd></div>
            <div><dt><Activity size={13} /> Moving</dt><dd>{compact(summary.movementPercent)}%</dd></div>
          </dl>
          <div className={styles.chart} aria-label={`${summary.character} damage trend`}>{points.map((point, index) => <span key={`${summary.buckets[index].at}:${index}`} style={{ height: `${Math.max(3, point / ceiling * 100)}%` }} title={`${new Date(summary.buckets[index].at).toLocaleString()} · ${compact(point)} DPS`} />)}</div>
          <small>Balance gains/h: {compact(summary.goldPerHour)} · Loot coverage: {Math.round(summary.lootElapsedMs / 60000)} min</small>
          <small>{summary.buckets.length} samples · {Math.round(summary.elapsedMs / 60000)} observed minutes</small>
        </article>;
      })}</div>
    </section>
  );
}
