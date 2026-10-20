import { useMemo, useState } from 'react';
import type { Catalog } from '../../types';
import { Sprite } from './Sprite';
import styles from './ItemMultiSelect.module.scss';

interface Props {
  id: string;
  catalog: Catalog;
  values: string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
  max?: number;
  placeholder?: string;
}

/** Searchable item picker with game sprites and multi-selection. */
export function ItemMultiSelect({ id, catalog, values, onChange, disabled = false, max = 500, placeholder = 'Search items…' }: Props) {
  const [search, setSearch] = useState('');
  const names = useMemo(() => new Map(catalog.items.map(item => [item.id, item.name])), [catalog.items]);
  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return catalog.items
      .filter(item => !needle || item.id.toLowerCase().includes(needle) || item.name.toLowerCase().includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 160);
  }, [catalog.items, search]);
  const selected = new Set(values);
  const toggle = (item: string) => {
    if (selected.has(item)) onChange(values.filter(value => value !== item));
    else if (max === 1) onChange([item]);
    else if (values.length < max) onChange([...values, item]);
  };
  return (
    <div className={styles.root} id={id}>
      <details className={styles.picker}>
        <summary className={styles.summary} aria-label={`${values.length} items selected`}>
          <span>{values.length ? `${values.length} item${values.length > 1 ? 's' : ''} selected` : max === 1 ? 'Choose an item' : 'Choose items'}</span>
          <span aria-hidden="true">▾</span>
        </summary>
        <div className={styles.menu}>
          <input aria-label="Search items" value={search} disabled={disabled} onChange={event => setSearch(event.target.value)} placeholder={placeholder} />
          <div className={styles.toolbar}>
            {max > 1 && <button type="button" disabled={disabled || shown.length === 0} onClick={() => onChange([...new Set([...values, ...shown.map(item => item.id)])].slice(0, max))}>Select shown</button>}
            <button type="button" disabled={disabled || values.length === 0} onClick={() => onChange([])}>Clear</button>
          </div>
          <div className={styles.options} role="listbox" aria-multiselectable="true">
            {shown.map(item => (
              <button key={item.id} type="button" role="option" aria-selected={selected.has(item.id)} disabled={disabled} className={selected.has(item.id) ? styles.active : ''} onClick={() => toggle(item.id)}>
                <Sprite id={`item:${item.id}`} catalog={catalog} label={item.name} size={32} />
                <span><strong>{item.name}</strong><small>{item.id}</small></span>
                <b aria-hidden="true">{selected.has(item.id) ? '✓' : '+'}</b>
              </button>
            ))}
          </div>
        </div>
      </details>
      {values.length > 0 && <div className={styles.selected}>
        {values.map(item => <button key={item} type="button" disabled={disabled} onClick={() => toggle(item)} title="Remove">
          <Sprite id={`item:${item}`} catalog={catalog} label={names.get(item) ?? item} size={24} />
          <span>{names.get(item) ?? item}</span><b>×</b>
        </button>)}
      </div>}
    </div>
  );
}
