import { useState } from 'react';
import type { PerformanceBucket } from '../../types';
import { measurementDifference, sessionMeasurement, type SessionMeasurement } from '../../models/session-comparison';
import { Button, Card } from '../ui';
import styles from './SessionComparison.module.scss';

type Snapshot = { label: string; measurement: SessionMeasurement };
const number = (value: number | null) => value === null ? '—' : value.toLocaleString(undefined, { maximumFractionDigits: 1 });
const metrics: Array<{ label: string; key: 'netPerHour' | 'xpPerHour' | 'deathsPerHour' | 'costPerHour' | 'consumedPerHour' | 'combatPercent' | 'movementPercent'; unit: string }> = [
  { label: 'Net gold / h', key: 'netPerHour', unit: '' }, { label: 'XP / h', key: 'xpPerHour', unit: '' },
  { label: 'Deaths / h', key: 'deathsPerHour', unit: '' }, { label: 'Consumable cost / h', key: 'costPerHour', unit: '' },
  { label: 'Consumed items / h', key: 'consumedPerHour', unit: '' }, { label: 'Combat time', key: 'combatPercent', unit: '%' },
  { label: 'Moving time', key: 'movementPercent', unit: '%' },
];

/** Explicit snapshots prevent live refreshes or later filter changes from altering a comparison. */
export function SessionComparison({ buckets, filterLabel, disabled = false }: { buckets: PerformanceBucket[]; filterLabel: string; disabled?: boolean }) {
  const [label, setLabel] = useState('');
  const [a, setA] = useState<Snapshot | null>(null);
  const [b, setB] = useState<Snapshot | null>(null);
  const capture = (setter: (value: Snapshot) => void) => {
    if (disabled) return;
    const measurement = sessionMeasurement(buckets);
    if (measurement) setter({ label: label.trim() || filterLabel, measurement });
  };
  return <Card title="Compare measured sessions">
    <p>Select a period, character, terrain and server above, then capture A. Change the filters and capture B. Captures stay fixed until replaced; they reset when you leave this page.</p>
    <div className={styles.controls}>
      <label>Session label<input value={label} maxLength={100} placeholder="Ghosts · solo · build A" onChange={event => setLabel(event.target.value)} /></label>
      <Button disabled={disabled || !buckets.length} onClick={() => capture(setA)}>Capture A</Button>
      <Button disabled={disabled || !buckets.length} onClick={() => capture(setB)}>Capture B</Button>
      <Button variant="ghost" disabled={!a && !b} onClick={() => { setA(null); setB(null); }}>Clear</Button>
    </div>
    <div className={styles.snapshots}>{([a, b] as const).map((snapshot, index) => <article key={index}>
      <strong>{index === 0 ? 'A' : 'B'} · {snapshot?.label ?? 'No capture'}</strong>
      {snapshot ? <>
        <p>{snapshot.measurement.characters.join(', ')} · {Math.round(snapshot.measurement.elapsedMs / 60000)} character-minutes · {snapshot.measurement.samples} samples</p>
        <small>{new Date(snapshot.measurement.from).toLocaleString()} → {new Date(snapshot.measurement.to).toLocaleString()} (bucket timestamps)</small>
        <p>{snapshot.measurement.deaths} deaths · matched economy coverage {Math.round(snapshot.measurement.coverage * 100)}%</p>
        {snapshot.measurement.short || snapshot.measurement.coverage < .95 || snapshot.measurement.unpriced > 0 ? <p className={styles.warning}>Limited sample or incomplete cost coverage. Net gold applies only to matched intervals; unknown prices suppress net and cost rates.</p> : null}
      </> : <p>Capture the current filtered measurements.</p>}
    </article>)}</div>
    {a && b ? <div className={styles.table}><table><thead><tr><th>Metric</th><th>A</th><th>B</th><th>B − A</th></tr></thead><tbody>{metrics.map(metric => {
      const av = a.measurement[metric.key], bv = b.measurement[metric.key];
      const difference = measurementDifference(av, bv);
      return <tr key={metric.key}><th>{metric.label}</th><td>{number(av)}{av === null ? '' : metric.unit}</td><td>{number(bv)}{bv === null ? '' : metric.unit}</td><td>{difference !== null && difference > 0 ? '+' : ''}{number(difference)}{difference === null ? '' : metric.unit === '%' ? ' pp' : ''}</td></tr>;
    })}</tbody></table></div> : null}
    <small>Compare the same characters and similar durations. Multiple characters use accumulated character-time, not team gold/h. Moving and fighting can overlap. A label describes your experiment; historical build identity is not recorded.</small>
  </Card>;
}
