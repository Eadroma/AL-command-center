import { useEffect, useRef, useState } from 'react';
import type { Catalog, Profile } from '../../types';
import { filterSearch, searchEntries, type SearchEntry } from '../../models/global-search';
import { openMerchantRule } from '../../models/rule-navigation';
import styles from './GlobalSearch.module.scss';
/** Native modal provides focus trapping, Escape handling and inert background. */
export function GlobalSearch({ profile, catalog }: { profile?: Profile; catalog?: Catalog }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const rows = filterSearch(searchEntries(profile, catalog), query);
  const active = Math.min(index, Math.max(0, rows.length-1));
  useEffect(() => { dialog.current?.querySelector(`[data-search-index="${active}"]`)?.scrollIntoView({ block: 'nearest' }); }, [active]);
  function open() { previousFocus.current = document.activeElement as HTMLElement; setQuery('');setIndex(0);dialog.current?.showModal();input.current?.focus(); }
  function close() { dialog.current?.close();previousFocus.current?.focus(); }
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {event.preventDefault(); if(dialog.current?.open) close();else open();} };
    window.addEventListener('keydown',shortcut);return () => window.removeEventListener('keydown',shortcut);
  }, []);
  function navigate(row: SearchEntry) {
    close();
    if(row.id.startsWith('item:')) { try { sessionStorage.setItem('alcc:inventory-query', row.id.slice(5)); } catch {} }
    window.location.hash = row.page;
    // Route mount precedes the rule reveal; cancel if the user navigates elsewhere.
    if(row.panel) { const panel = row.panel; window.setTimeout(() => {if(window.location.hash === `#${row.page}`) openMerchantRule(panel);},100); }
    if(row.id.startsWith('item:')) window.dispatchEvent(new CustomEvent('alcc:inventory-search',{detail:row.detail.replace('Item · ','')}));
  }
  return <>
    <button type="button" className={styles.launch} onClick={open}>Search <kbd>Ctrl K</kbd></button>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="global-search-title" onCancel={() => previousFocus.current?.focus()}>
      <div className={styles.head}><strong id="global-search-title">Search the command center</strong><button type="button" onClick={close} aria-label="Close search">×</button></div>
      <input ref={input} role="combobox" aria-expanded={true} aria-controls="global-search-results" aria-activedescendant={rows[active] ? `search-result-${active}` : undefined} aria-label="Global search" placeholder="Pages, characters, items, loadouts…" value={query} onChange={e => {setQuery(e.target.value);setIndex(0);}} onKeyDown={e => {
        if(e.key === 'ArrowDown' || e.key === 'ArrowUp') {e.preventDefault();setIndex((active+(e.key==='ArrowDown'?1:-1)+Math.max(1,rows.length))%Math.max(1,rows.length));}
        if(e.key==='Enter' && rows[active]) {e.preventDefault();navigate(rows[active]);}
      }}/>
      <div id="global-search-results" role="listbox" aria-label="Search results" className={styles.results}>{rows.map((row,i) => <button type="button" key={row.id} role="option" aria-selected={i===active} id={`search-result-${i}`} data-search-index={i} className={i===active?styles.active:undefined} onClick={() => navigate(row)}><strong>{row.label}</strong><span>{row.detail}</span></button>)}{!rows.length && <p>No matching result.</p>}</div>
      <small>↑ ↓ select · Enter open · Escape close</small>
    </dialog>
  </>;
}
