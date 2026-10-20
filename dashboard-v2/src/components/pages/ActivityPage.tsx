import { useState } from 'react';
import type { LogEntry } from '../../types';
import { filterActivity } from '../../models/filters';
import { Field, TextInput, SelectInput, SectionHead, Badge, Button, EmptyState } from '../ui';
import { TelemetryPanel } from '../telemetry/TelemetryPanel';
import styles from './ActivityPage.module.scss';

export interface ActivityPageProps {
  entries: LogEntry[];
  loading: boolean;
  onClear: () => void;
}

const LEVEL_OPTIONS = [
  { value: '', label: 'All levels' },
  { value: 'info', label: 'Info' },
  { value: 'warn', label: 'Warning' },
  { value: 'error', label: 'Error' },
  { value: 'debug', label: 'Debug' },
];

/** Search the recent server activity window with independent severity and source filters. */
export function ActivityPage({ entries, loading, onClear }: ActivityPageProps) {
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState('');
  const [source, setSource] = useState('');
  const sources = [...new Set([...entries.map(entry => entry.source), ...(source ? [source] : [])])].sort();
  const filtered = filterActivity(entries, { search, level, source });
  const reset = () => { setSearch(''); setLevel(''); setSource(''); };

  return (
    <section aria-label="Activity log">
      <SectionHead eyebrow="Recent server history" title="Activity">
        <Badge>{filtered.length} / {entries.length} entries</Badge>
      </SectionHead>
      <p className={styles.description}>The server supplies up to 100 recent entries. Clear hides the received history in this session.</p>
      <div className={styles.filters}>
        <Field label="Search activity" htmlFor="activity-search">
          <TextInput id="activity-search" type="search" value={search} onChange={setSearch} placeholder="Message or character…" />
        </Field>
        <Field label="Severity" htmlFor="activity-level">
          <SelectInput id="activity-level" value={level} onChange={setLevel} options={LEVEL_OPTIONS} />
        </Field>
        <Field label="Source" htmlFor="activity-source">
          <SelectInput id="activity-source" value={source} onChange={setSource} options={[{ value: '', label: 'All sources' }, ...sources.map(value => ({ value, label: value }))]} />
        </Field>
        <Button variant="ghost" onClick={reset} disabled={!search && !level && !source}>Reset filters</Button>
      </div>
      {loading ? <EmptyState title="Loading activity…" />
        : filtered.length === 0 && entries.length > 0
          ? <EmptyState title="No matching entries" description="Change or reset the filters to see more activity." />
          : <TelemetryPanel entries={filtered} maxEntries={100} onClear={onClear} />}
    </section>
  );
}
