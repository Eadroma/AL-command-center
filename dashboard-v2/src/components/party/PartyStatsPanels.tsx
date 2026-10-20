import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { BankItem, Catalog, DeploymentsResponse, PerformanceBucket } from '../../types';
import type { StatisticsActivity } from '../../../shared/statistics-activity';
import type { PartyStatistics } from '../../../shared/party-statistics';
import { bankSnapshots } from '../../models/bank';
import { InventoryItemSlot } from '../inventory/InventoryItemSlot';
import { Button, Sprite } from '../ui';
import styles from './PartyStats.module.scss';

const format = (value: number) => Math.round(value).toLocaleString();
function Bars({ rows }: { rows: Array<{ label: string; value: number }> }) {
  const max = Math.max(1, ...rows.map(row => row.value));
  return rows.length ? <div className={styles.scroll}>{rows.map(row => <div className={styles.comparison} key={row.label}><span>{row.label}</span><div><i style={{ width: `${row.value * 100 / max}%` }} /></div><strong>{format(row.value)}</strong></div>)}</div> : <p>No measurements yet.</p>;
}
function Items({ items, catalog }: { items: Array<{ name: string; level: number; quantity: number }>; catalog?: Catalog }) {
  const [expanded, setExpanded] = useState(false);
  return <><div className={styles.itemGrid}>{items.slice(0, expanded ? items.length : 48).map((item, index) => <InventoryItemSlot key={`${item.name}:${item.level}:${index}`} item={{ ...item, slot: String(index) }} catalog={catalog} size={44} />)}</div>{items.length > 48 && <Button size="small" variant="ghost" onClick={() => setExpanded(!expanded)}>{expanded ? 'Show fewer' : `Show all ${items.length}`}</Button>}</>;
}
export function PartyStatsPanels({ names, buckets, deployments, catalog, since, activity }: { names: string[]; buckets: PerformanceBucket[]; deployments?: DeploymentsResponse; catalog?: Catalog; since: number; activity: StatisticsActivity }) {
  const history = useQuery({ queryKey: ['party-statistics'], queryFn: ({ signal }) => api<PartyStatistics>('/api/party-statistics', undefined, 'GET', signal), refetchInterval: 60000 });
  const [trackerName, setTrackerName] = useState('');
  const [trackerMode, setTrackerMode] = useState('monsters');
  const [month, setMonth] = useState('');
  const [bankMode, setBankMode] = useState('flat');
  const [pack, setPack] = useState('');
  const [search, setSearch] = useState('');
  const trackers = names.filter(name => deployments?.characters[name]?.telemetry?.stats?.tracker);
  const selectedTracker = trackers.includes(trackerName) ? trackerName : trackers[0];
  const tracker = selectedTracker ? deployments?.characters[selectedTracker]?.telemetry?.stats?.tracker : undefined;
  const trackerRows = Object.entries(tracker?.[trackerMode === 'monsters' ? 'monsters' : 'exchanges'] ?? {}).sort((a, b) => b[1] - a[1]);
  const balances = history.data?.balances.map(row=>({...row,at:row.observedAt ?? row.at})).filter(row => names.includes(row.character) && row.at >= since) ?? [];
  // Separate series avoid adding balances sampled at different times into a fictitious team wallet.
  const walletSeries = names.map(name => ({ name, points: balances.filter(row => row.character === name).sort((a, b) => a.at - b.at) })).filter(row => row.points.length);
  const allPoints = walletSeries.flatMap(row => row.points);
  const minAt = Math.min(...allPoints.map(row => row.at)), maxAt = Math.max(...allPoints.map(row => row.at));
  const maxGold = Math.max(1, ...allPoints.map(row => row.gold));
  const colors = ['#72dfb4', '#69a8ef', '#e3bd72', '#c7a0ef', '#e4798a'];
  const kills = new Map<string, number>();
  for (const row of buckets) { const id = row.farmContext?.monster || 'Unclassified'; kills.set(id, (kills.get(id) ?? 0) + row.kills); }
  const items = history.data?.items.filter(row => names.includes(row.character)) ?? [];
  const months = [...new Set(items.map(row => row.month))].sort().reverse();
  const selectedMonth = months.includes(month) ? month : months[0];
  const groupItems = (rows: typeof items) => {
    const result = new Map<string, typeof items[number]>();
    for (const row of rows) { const key = `${row.name}:${row.level}`, old = result.get(key); result.set(key, { ...row, quantity: row.quantity + (old?.quantity ?? 0) }); }
    return [...result.values()].sort((a, b) => b.quantity - a.quantity);
  };
  const monthly = groupItems(items.filter(row => row.month === selectedMonth));
  const scopedReceipts = (history.data?.receipts ?? []).filter(row=>names.includes(row.character)&&row.at>=since&&(activity==='all'||row.activity===activity));
  const totals = groupItems(scopedReceipts.map(row=>({...row,month:new Date(row.at).toISOString().slice(0,7)})));
  const expeditions = Object.values(deployments?.characters ?? {}).map(row => row.telemetry?.eventExpedition).filter(row => !!row);
  const missions = expeditions.flatMap(row=>[row,...(row.history??[])]).filter(row=>row.startedAt>=since&&row.participants.some(p=>names.includes(p.name))&&(activity==='all'||activity==='events')).sort((a,b)=>b.startedAt-a.startedAt);
  const mission = missions[0];
  const participants = mission?.participants.filter(row=>names.includes(row.name)) ?? [];
  const bossTotal = participants.reduce((sum,row)=>sum+(row.metrics?.bossDamage??0),0);
  const bank = bankSnapshots(deployments)[0];
  const packs = [...new Set(bank?.items.map(item => item.pack) ?? [])].sort();
  const filtered = (bank?.items ?? []).filter(item => (bankMode !== 'tab' || !pack || item.pack === pack) && `${item.name} ${catalog?.items.find(row => row.id === item.name)?.name ?? ''}`.toLowerCase().includes(search.toLowerCase()));
  const stacked = new Map<string, BankItem>();
  for (const item of filtered) { const key = `${item.name}:${item.level}`, old = stacked.get(key); stacked.set(key, { ...item, quantity: item.quantity + (old?.quantity ?? 0) }); }
  return <div className={styles.charts}>
    <article className={styles.card}><header><h3>Gold history</h3><span className={styles.quality}>Selected period · wallet snapshots</span></header><p>Hourly wallet snapshots · selected characters and period; activity filter does not apply. Includes trading and transfers.</p>{allPoints.length ? <svg viewBox="0 0 600 180" className={styles.plot} role="img" aria-label="Character gold balances over time">{walletSeries.map((series, index) => <g key={series.name}><polyline fill="none" stroke={colors[index % colors.length]} strokeWidth="2" points={series.points.map(row => `${10 + (row.at - minAt) * 580 / Math.max(3600000, maxAt - minAt)},${160 - row.gold * 150 / maxGold}`).join(' ')} />{series.points.map(row => <circle key={row.at} cx={10 + (row.at - minAt) * 580 / Math.max(3600000, maxAt - minAt)} cy={160 - row.gold * 150 / maxGold} r="3" fill={colors[index % colors.length]}><title>{series.name} · {new Date(row.at).toLocaleString()} · {format(row.gold)} gold</title></circle>)}</g>)}</svg> : <p>Waiting for wallet snapshots.</p>}<div className={styles.effects}>{walletSeries.map((row, index) => <span key={row.name} style={{ color: colors[index % colors.length] }}>{row.name}</span>)}</div></article>
    <article className={styles.card}><h3>Kills</h3><p>Selected period · classified by observed farming target, not lifetime tracker score.</p><Bars rows={[...kills].sort((a, b) => b[1] - a[1]).map(([id, value]) => ({ label: catalog?.monsters.find(row => row.id === id)?.name ?? id, value }))} /></article>
    <article className={styles.card}><h3>Items</h3><p>Actual loot receipts · shared character, period and activity filters; excludes purchases and transfers.</p>{totals.length ? <Bars rows={totals.map(row => ({ label: `${catalog?.items.find(item => item.id === row.name)?.name ?? row.name} +${row.level}`, value: row.quantity }))} /> : <p>No timestamped loot receipts for these filters. Older monthly totals cannot be attributed to this period or activity.</p>}</article>
    <article className={styles.card}><h3>Co-op contribution</h3><p>{mission ? `${mission.event} · ${mission.phase} · ${mission.reason}` : 'No expedition report available.'}</p>{mission && <>{participants.map(row => <div key={row.name} className={styles.contribution}><strong>{row.name}</strong><span>{row.metrics?format(row.metrics.bossDamage):'—'} boss damage · {row.metrics?format(row.metrics.bossHits):'—'} hits · {bossTotal && row.metrics ? (row.metrics.bossDamage * 100 / bossTotal).toFixed(1) : '—'}% of observed team damage</span></div>)}<p>Team contributions only. A completed mission does not by itself prove the boss died.</p></>}</article>
    <article className={styles.card}><header><h3>Tracker & exchange</h3><span className={styles.quality}>Lifetime snapshot</span><div className={styles.ranges}><select aria-label="Tracker character" value={selectedTracker ?? ''} onChange={event => setTrackerName(event.target.value)}>{trackers.length ? trackers.map(name => <option key={name}>{name}</option>) : <option value="">No tracker snapshot</option>}</select><select aria-label="Tracker category" value={trackerMode} onChange={event => setTrackerMode(event.target.value)}><option value="monsters">Monsters</option><option value="exchanges">Exchange</option></select></div></header><p>Lifetime Tracktrix points and exchange counts · selected character; period and activity filters do not apply.</p>{tracker ? <div className={styles.scroll}>{trackerRows.map(([id, count]) => <div className={styles.trackerRow} key={id}><Sprite id={`${trackerMode === 'monsters' ? 'monster' : 'item'}:${id}`} catalog={catalog} label={id} size={32} /><span>{(trackerMode === 'monsters' ? catalog?.monsters : catalog?.items)?.find(row => row.id === id)?.name ?? id}</span><strong>{format(count)}</strong></div>)}</div> : <p>Open Tracktrix in game and deploy the updated CODE to share its snapshot.</p>}</article>
    <article className={styles.card}><header><h3>Monthly loot</h3><select aria-label="Loot month" value={selectedMonth ?? ''} onChange={event => setMonth(event.target.value)}>{months.length ? months.map(value => <option key={value}>{value}</option>) : <option value="">No recorded month</option>}</select></header><p className={styles.quality}>Monthly archive · selected characters; shared period and activity filters do not apply.</p><p>{monthly.length ? `${monthly.length} item variants · ${format(monthly.reduce((sum, row) => sum + row.quantity, 0))} items received` : 'No monthly loot receipts available'}</p><Items items={monthly} catalog={catalog} /></article>
    <article className={`${styles.card} ${styles.wide}`}><header><h3>Bank</h3><span className={styles.quality}>Account snapshot · independent of result filters</span><div className={styles.ranges}>{['flat','stack','tab'].map(mode => <Button key={mode} size="small" variant={mode === bankMode ? 'secondary' : 'ghost'} aria-pressed={mode === bankMode} onClick={() => setBankMode(mode)}>{mode === 'flat' ? 'Flat' : mode === 'stack' ? 'Stack' : 'Tab'}</Button>)}</div></header><p>{bank ? `${bank.items.length} occupied slots · ${packs.length} observed tabs · snapshot ${bank.capturedAt ? new Date(bank.capturedAt).toLocaleString() : 'time unavailable'}` : 'No bank snapshot available. Visit the bank with the merchant.'}</p><div className={styles.ranges}><input aria-label="Search bank items" placeholder="Search bank items…" value={search} onChange={event => setSearch(event.target.value)} />{bankMode === 'tab' && <select aria-label="Bank tab" value={pack} onChange={event => setPack(event.target.value)}><option value="">All observed tabs</option>{packs.map(value => <option key={value}>{value}</option>)}</select>}</div><Items items={bankMode === 'stack' ? [...stacked.values()] : filtered} catalog={catalog} /></article>
    <p className={styles.note}>Extended collection: {history.data?.startedAt ? `since ${new Date(history.data.startedAt).toLocaleString()}` : 'waiting for telemetry'} · historical results refresh every minute.</p>
    {history.error && <p role="alert">Extended statistics unavailable: {history.error.message}</p>}
  </div>;
}
