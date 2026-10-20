import { useState } from 'react';
import type { Catalog, Character } from '../../types';
import { filterScripts } from '../../models/filters';
import { Field, TextInput, SelectInput, SectionHead, Badge, EmptyState, Button } from '../ui';
import { ScriptCard } from '../scripts/ScriptCard';
import { DashboardGrid } from '../layout/DashboardGrid';
import styles from './ScriptsPage.module.scss';

export interface ScriptsPageProps { catalog?: Catalog; characters: Character[]; loading: boolean; }

/** Browse scripts discovered by the backend, with metadata and immutable imported defaults. */
export function ScriptsPage({ catalog, characters, loading }: ScriptsPageProps) {
  const [search, setSearch] = useState('');
  const [ctype, setClass] = useState('');
  const scripts = catalog?.scripts ?? [];
  const classes = [...new Set([...scripts.map(script => script.ctype), ...(ctype ? [ctype] : [])])].sort();
  const filtered = filterScripts(scripts, search, ctype);

  return (
    <section aria-label="Script library">
      <SectionHead eyebrow="Local script catalog" title="Scripts">
        <Badge>{filtered.length} / {scripts.length} scripts</Badge>
      </SectionHead>
      <p className={styles.description}>Imported defaults are read-only. Saved profile overrides may change the configuration used in game.</p>
      {catalog && <p className={styles.path}>Source: {catalog.sourceDirectory}</p>}
      <div className={styles.filters}>
        <Field label="Search scripts" htmlFor="scripts-search">
          <TextInput id="scripts-search" type="search" value={search} onChange={setSearch} placeholder="Filename, label or type…" />
        </Field>
        <Field label="Character class" htmlFor="scripts-class">
          <SelectInput id="scripts-class" value={ctype} onChange={setClass} options={[{ value: '', label: 'All classes' }, ...classes.map(value => ({ value, label: value }))]} />
        </Field>
        <Button variant="ghost" onClick={() => { setSearch(''); setClass(''); }} disabled={!search && !ctype}>Reset filters</Button>
      </div>
      {loading && <EmptyState title="Loading scripts…" />}
      {!loading && !catalog && (
        <EmptyState title="Catalog unavailable" description="Use Refresh to retry the server connection." />
      )}
      {!loading && catalog && scripts.length === 0 && (
        <EmptyState title="No scripts found" description="Check the server's AL_CODE_DIR setting, then refresh." />
      )}
      {!loading && scripts.length > 0 && filtered.length === 0 && (
        <EmptyState title="No matching scripts" description="Change or reset the filters." />
      )}
      {!loading && filtered.length > 0 && (
        <DashboardGrid>
          {filtered.map(script => <ScriptCard key={script.id} script={script} characters={characters} />)}
        </DashboardGrid>
      )}
    </section>
  );
}
