import { useState } from 'react';
import type { Catalog, DeploymentsResponse, Profile } from '../../types';
import { usePerformanceHistory } from '../../hooks/usePerformanceHistory';
import { performanceSummaries } from '../../models/performance';
import { Button, Sprite } from '../ui';
import { filterStatistics } from '../../models/party-statistics';
import { statisticsActivity, type StatisticsActivity } from '../../../shared/statistics-activity';
import { PartyStatsBalance } from './PartyStatsBalance';
import { PartyStatsPanels } from './PartyStatsPanels';
import styles from './PartyStats.module.scss';

const number = (value: number | undefined | null) => value == null || !Number.isFinite(value) ? '—' : Math.round(value).toLocaleString();
const percent = (value: number, maximum: number) => maximum > 0 ? Math.max(0, Math.min(100, value * 100 / maximum)) : 0;

export function PartyStats({ profile, deployments, catalog }: { profile?: Profile; deployments?: DeploymentsResponse; catalog?: Catalog }) {
  const [hours, setHours] = useState(24);
  const [damageMode, setDamageMode] = useState('dps');
  const history = usePerformanceHistory(hours);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [activity, setActivity] = useState<StatisticsActivity>('all');
  const availableNames = profile ? profile.characters.filter(c => c.enabled).map(c => c.name) : Object.keys(deployments?.characters ?? {});
  const names = availableNames.filter(name => !excluded.includes(name));
  const since = history.dataUpdatedAt ? history.dataUpdatedAt - hours * 3600000 : 0;
  const buckets = filterStatistics(history.data?.buckets ?? [], {names, since, activity});
  const unclassifiedMs = (history.data?.buckets ?? []).filter(row=>names.includes(row.character)&&row.at>=since&&statisticsActivity(row)==='unknown').reduce((sum,row)=>sum+row.elapsedMs,0);
  const firstAt = buckets.length ? Math.min(...buckets.map(row => row.at)) : null;
  const summaries = performanceSummaries(buckets);
  const timeline = new Map<number, number>();
  for (const bucket of buckets) if (bucket.lootGold != null && (bucket.lootElapsedMs ?? 0) > 0) timeline.set(bucket.at, (timeline.get(bucket.at) ?? 0) + bucket.lootGold);
  const points = [...timeline.entries()].sort((a,b) => a[0]-b[0]);
  const ceiling = Math.max(1, ...points.map(row => row[1]));
  const maxDps = Math.max(1, ...summaries.map(row => damageMode === 'dps' ? row.dps : row.damage));
  return <section aria-label="Party statistics" className={styles.page}>
    <header className={styles.heading}><div><h2>Party statistics</h2><p>Live character status · observed results across CODE sessions</p></div><div className={styles.ranges} aria-label="Statistics period">{[1,6,24,168].map(value => <Button key={value} size="small" variant={hours===value?'secondary':'ghost'} aria-pressed={hours===value} onClick={()=>setHours(value)}>{value===1?'1h':value===6?'6h':value===24?'24h':'7d'}</Button>)}</div></header>
    <div className={`${styles.card} ${styles.filters}`} aria-label="Shared statistics filters">
      <fieldset><legend>Characters</legend>{availableNames.map(name=><label key={name}><input type="checkbox" checked={names.includes(name)} onChange={()=>setExcluded(current=>current.includes(name)?current.filter(row=>row!==name):[...current,name])}/>{name}</label>)}</fieldset>
      <label>Activity<select aria-label="Statistics activity" value={activity} onChange={event=>setActivity(event.target.value as StatisticsActivity)}><option value="all">All activities</option><option value="farming">Regular farming</option><option value="events">World bosses / events</option><option value="cave">Cave Dreams</option><option value="unknown">Unclassified</option></select></label>
      <p className={styles.quality} role="status">{history.isLoading?'Loading measurements…':history.error?'History unavailable':firstAt?`Observed since ${new Date(firstAt).toLocaleString()} · ${buckets.length} measurement buckets`:'No measurements for these filters'} · {names.length}/{availableNames.length} characters</p>
      {activity!=='all'&&activity!=='unknown'&&unclassifiedMs>0&&<p className={styles.warning}>{Math.round(unclassifiedMs/60000)} character-minutes have no activity attribution and are excluded from this filter.</p>}
      <p>Filters apply to measured results. Live status, lifetime tracker and the account bank remain snapshots; wallet history is not attributable to a farming activity.</p>
    </div>
    {!names.length && <p>Select at least one character to view statistics.</p>}
    <PartyStatsBalance buckets={buckets} names={names}/>
    <div className={styles.characters}>{names.map(name => {
      const t=deployments?.characters[name]?.telemetry, s=t?.stats, summary=summaries.find(row=>row.character===name);
      const role=profile?.characters.find(c=>c.name===name)?.ctype;
      return <article key={name} className={styles.card}>
        <header><Sprite id={s?.skin && catalog?.assets?.[`skin:${s.skin}`] ? `skin:${s.skin}` : role ?? 'warrior'} catalog={catalog} label={name} size={36}/><div><h3>{name}</h3><span>{role ?? 'Character'} · Lv {number(s?.level)}</span></div><span className={t?.live?styles.live:styles.offline} title={t?.lastSeen?`Last report: ${new Date(t.lastSeen).toLocaleString()}`:'No report received'}>{t?.live?'Live':t?.lastSeen?'Last observation':'No telemetry'}</span></header>
        {t?.lastSeen&&!t.live&&<p className={styles.quality}>Snapshot from {new Date(t.lastSeen).toLocaleString()}</p>}
        <p className={styles.location}>{s?.server || '—'} · {s?.map || '—'} · Session {t?.combat ? `${Math.floor(Math.max(0,(t.lastSeen ?? t.combat.startedAt)-t.combat.startedAt)/60000)}m` : '—'}</p>
        {(['hp','mp'] as const).map(key => <div className={styles.resource} key={key}><span>{key.toUpperCase()}</span><div role="progressbar" aria-label={`${name} ${key.toUpperCase()}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={s?percent(s[key],s[key==='hp'?'max_hp':'max_mp']):0}><i className={key==='hp'?styles.hp:styles.mp} style={{width:`${s?percent(s[key],s[key==='hp'?'max_hp':'max_mp']):0}%`}} /></div><strong>{s?`${number(s[key])} / ${number(s[key==='hp'?'max_hp':'max_mp'])}`:'—'}</strong></div>)}
        {[{label:'XP',value:s?.xp,max:s?.maxXp,color:styles.xp},{label:'CC',value:s?.cc,max:200,color:styles.cc}].map(row=><div className={styles.resource} key={row.label}><span>{row.label}</span><div role="progressbar" aria-label={`${name} ${row.label}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={row.value!=null&&row.max?percent(row.value,row.max):undefined} aria-valuetext={row.value!=null&&row.max?undefined:'Measurement unavailable'}><i className={row.color} style={{width:`${row.value!=null&&row.max?percent(row.value,row.max):0}%`}}/></div><strong>{number(row.value)} / {number(row.max)}</strong></div>)}
        <dl className={styles.metrics}><div><dt>Target</dt><dd>{s?.target || 'None'}</dd></div><div><dt>Time to level</dt><dd>{s?.maxXp!=null&&s.xp!=null&&summary&&summary.xpPerHour>0?`${((s.maxXp-s.xp)/summary.xpPerHour).toFixed(1)}h`:'—'}</dd></div><div><dt>Gold balance</dt><dd>{number(s?.gold)}</dd></div><div><dt>Ping</dt><dd>{t?.live&&t.network?`${number(t.network.pingMs)} ms`:'—'}</dd></div><div><dt>Loot gold / h</dt><dd>{number(summary?.lootGoldPerHour)}</dd></div><div><dt>XP / h</dt><dd>{number(summary?.xpPerHour)}</dd></div><div><dt>DPS</dt><dd>{number(summary?.dps)}</dd></div><div><dt>Kills · deaths</dt><dd>{summary?`${number(summary.kills)} · ${number(summary.deaths)}`:'—'}</dd></div></dl>
        <details><summary>Character details</summary><dl className={styles.metrics}><div><dt>Gold multiplier</dt><dd>{s?.goldMultiplier!=null?`${Math.round(s.goldMultiplier*100)}%`:'—'}</dd></div><div><dt>Luck multiplier</dt><dd>{s?.luckMultiplier!=null?`${Math.round(s.luckMultiplier*100)}%`:'—'}</dd></div><div><dt>XP multiplier</dt><dd>{s?.xpMultiplier!=null?`${Math.round(s.xpMultiplier*100)}%`:'—'}</dd></div>{(['attack','frequency','speed','range'] as const).map(key=><div key={key}><dt>{key}</dt><dd>{number(s?.[key])}</dd></div>)}<div><dt>Armor</dt><dd>{number(s?.armor)}</dd></div><div><dt>Resistance</dt><dd>{number(s?.resistance)}</dd></div><div><dt>Movement</dt><dd>{summary?`${Math.round(summary.movementPercent)}%`:'—'}</dd></div><div><dt>Target ID</dt><dd>{s?.target||'None'}</dd></div></dl></details>
        <div className={styles.effects}>{(t?.activeEffects??[]).map(effect=><span key={effect.id} title={effect.ms!=null?`${Math.ceil(effect.ms/60000)} min remaining at last report`:undefined}>{effect.id}</span>)}</div>
      </article>;
    })}</div>
    {history.error?<p role="alert">Statistics history unavailable: {history.error.message}</p>:null}
    <div className={styles.charts}><article className={styles.card}><header><h3>Damage</h3><select aria-label="Damage measure" value={damageMode} onChange={event=>setDamageMode(event.target.value)}><option value="dps">DPS</option><option value="total">Total damage</option></select></header><p>Selected period · average DPS uses observed online time</p>{summaries.length?summaries.map(row=><div className={styles.comparison} key={row.character}><span>{row.character}</span><div><i style={{width:`${(damageMode==='dps'?row.dps:row.damage)*100/maxDps}%`}} /></div><strong>{number(damageMode==='dps'?row.dps:row.damage)}</strong></div>):<p>{history.isLoading?'Loading history…':'Waiting for measurements'}</p>}</article>
      <article className={styles.card}><h3>Loot gold history</h3><p>Team gold received per five-minute bucket · excludes transfers and purchases</p>{points.length?<svg viewBox="0 0 600 160" role="img" aria-label="Team loot gold over time" className={styles.plot}>{points.map(([at,gold],index)=><rect key={at} x={index*600/points.length} y={150-gold*140/ceiling} width={Math.max(1,600/points.length-2)} height={gold*140/ceiling}><title>{new Date(at).toLocaleString()}: {number(gold)} gold</title></rect>)}</svg>:<p>{history.isLoading?'Loading history…':'Waiting for measured loot'}</p>}<div className={styles.axis}><span>{points.length?new Date(points[0][0]).toLocaleString():''}</span><span>{points.length?new Date(points[points.length-1][0]).toLocaleString():''}</span></div></article></div>
    <PartyStatsPanels names={names} buckets={buckets} deployments={deployments} catalog={catalog} since={since} activity={activity}/>
    <p className={styles.note}>Rates use observed online time in the selected period. Offline cards show the last known status. Missing measurements appear as —. Gold history refreshes every minute; character status follows live telemetry.</p>
  </section>;
}
