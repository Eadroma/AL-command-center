import { useEffect, useState } from 'react';
import { BarChart3, Download } from 'lucide-react';
import { TaskDialog } from './TaskDialog';
import { readUsage, resetUsage, setUsageEnabled, subscribeUsage, usageStorageAvailable } from '../../models/usage-store';
import { usageRows } from '../../models/usage';
import styles from './UsageStats.module.scss';
export function UsageStats() {
  const [open,setOpen]=useState(false),[data,setData]=useState(readUsage);
  const [period,setPeriod]=useState<7|30|90>(30);
  const [filter,setFilter]=useState('all');
  const [group,setGroup]=useState('all');
  useEffect(()=>subscribeUsage(()=>setData(readUsage())),[]);
  const rows=usageRows(data,period),used=rows.filter(row=>row.total>0);
  const groups=[...new Set(rows.map(row=>row.group))];
  const visible=rows.filter(row=>(filter==='all'||(filter==='unused'?row.total===0:row.total>0))&&(group==='all'||row.group===group)).sort((a,b)=>b.total-a.total||a.label.localeCompare(b.label));
  function exportData() {
    const blob=new Blob([JSON.stringify({...data,exportedAt:new Date().toISOString(),period,summary:rows},null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='dashboard-usage.json';link.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  return <>
    <button type="button" className={styles.launch} onClick={()=>{setData(readUsage());setOpen(true);}}><BarChart3 size={16}/>Usage</button>
    <TaskDialog title="Dashboard usage" open={open} onClose={()=>setOpen(false)}>
      <section className={styles.report} data-usage-ignore="true">
        <p className={styles.intro}>See which parts of the dashboard earn their place. Counts stay in this browser on this computer; nothing is sent to a server.</p>
        {!usageStorageAvailable() && <p role="alert">Browser storage is unavailable. Usage cannot be saved.</p>}
        <div className={styles.summary}>
          <article><strong>{used.length}<small> / {rows.length}</small></strong><span>Features used</span></article>
          <article><strong>{rows.length-used.length}</strong><span>Not used in this period</span></article>
          <article><strong>{rows.reduce((sum,row)=>sum+row.interactions,0).toLocaleString()}</strong><span>Control interactions</span></article>
        </div>
        <div className={styles.controls}>
          <label>Period<select aria-label="Period" value={period} onChange={e=>setPeriod(Number(e.target.value) as 7|30|90)}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select></label>
          <label>Show<select aria-label="Show" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All features</option><option value="used">Used features</option><option value="unused">Not used</option></select></label>
          <label>Area<select aria-label="Area" value={group} onChange={e=>setGroup(e.target.value)}><option value="all">All areas</option>{groups.map(value=><option key={value}>{value}</option>)}</select></label>
        </div>
        <p className={styles.note}>Collecting since {new Date(data.startedAt).toLocaleDateString()} · {data.enabled?'Tracking on':'Tracking paused'} · up to 90 days retained. Opens include navigation and revealed tools; interactions count clicks and committed field changes, not successful game actions. No time-on-page is inferred.</p>
        <div className={styles.tableWrap}><table><caption>Features ranked by opens plus interactions</caption><thead><tr><th>Feature</th><th>Opens</th><th>Interactions</th><th>Days used</th><th>Last used</th></tr></thead><tbody>{visible.map(row=><tr key={row.id}><th scope="row">{row.label}<small>{row.group}</small></th><td>{row.opens}</td><td>{row.interactions}</td><td>{row.activeDays}</td><td>{row.lastUsed?new Date(row.lastUsed).toLocaleString():'Not used'}</td></tr>)}</tbody></table>{!visible.length&&<p>No features match these filters.</p>}</div>
        <p className={styles.note}>Zero use means no recorded interaction during the selected period. It does not prove a feature is unnecessary: unavailable features, occasional tools and automatic game behaviour need separate consideration. The preview and live dashboard have separate browser storage.</p>
        <div className={styles.actions}>
          <button type="button" onClick={()=>setUsageEnabled(!data.enabled)}>{data.enabled?'Pause tracking':'Resume tracking'}</button>
          <button type="button" onClick={exportData}><Download size={15}/>Export JSON</button>
          <button type="button" onClick={()=>{if(window.confirm('Delete all dashboard usage history in this browser?'))resetUsage();}}>Reset history</button>
        </div>
      </section>
    </TaskDialog>
  </>;
}
