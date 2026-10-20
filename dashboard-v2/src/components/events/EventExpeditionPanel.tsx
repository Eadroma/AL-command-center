import { expeditionBosses } from '../../../shared/event-expedition';
import { EVENT_DEFINITIONS } from '../../models/events';
import { TemporaryCharacters } from './TemporaryCharacters';
import { useState } from 'react';
import type { Profile } from '../../../shared/schema';
import type { DeploymentsResponse } from '../../types';
import { api } from '../../api/client';
import { Badge, Button, Card, Field, NumberInput, Toggle } from '../ui';
import styles from './EventExpeditionPanel.module.scss';

/** Reused in Events and Merchant; never presents stale mission data as live. */
export function EventExpeditionStatus({ profile, deployments }: { profile: Profile; deployments?: DeploymentsResponse }) {
  const merchant = profile.characters.find(c => c.enabled && c.ctype === 'merchant');
  const telemetry = merchant ? deployments?.characters[merchant.name]?.telemetry : undefined;
  const mission = telemetry?.eventExpedition;
  if (!profile.events.expedition.enabled && !mission) return null;
  return <Card title="Event expedition">
    <div className={styles.head}><Badge variant={telemetry?.live ? 'info' : 'neutral'}>{mission?.phase ?? 'Waiting for deployment'}</Badge><span>{mission?.event || 'Waiting for an allowed boss'} · {telemetry?.live ? 'Live' : 'Offline / stale'}</span></div>
    <p>{mission?.reason ?? 'The merchant starts the duo when an allowed boss appears on the home server.'}</p>
    {mission && <>
      <div className={styles.roster}>{mission.participants.map(row => <article key={row.name}><strong>{row.name}</strong><span>{row.online ? 'Online' : 'Offline'} · {row.returned ? 'Unloaded' : row.ready ? 'Ready' : 'Not ready'} · {row.deaths} deaths</span><small>{mission.owned.includes(row.name) ? 'Started by merchant · eligible for automatic disconnect' : row.online ? 'Manual character · kept online' : 'Offline · ready for the next expedition'}</small></article>)}</div>
      <p>Observed Lone Wolf downtime: {Math.round(mission.loneWolfDowntimeMs / 60000)} min. This measures reported buff absence, not lost gold.</p>
      <details><summary>Expedition reports ({mission.history?.length ?? 0})</summary>
        <p>Last ten missions retained in the merchant browser. Damage to the named boss requires a matching visible entity; unobserved damage is not inferred. Loot and healing cover the mission, including travel. Missing reports mean unknown results.</p>
        {(mission.history ?? []).slice().reverse().map(report => <article key={report.id}>
          <strong>{report.event} · {report.phase} · {Math.round((report.finishedAt - report.startedAt) / 60000)} min</strong><p>{new Date(report.finishedAt).toLocaleString()} · {report.reason}</p>
          {report.participants.map(worker => <p key={worker.name}>{worker.name}: {worker.deaths} deaths · {worker.returned ? 'return / unload confirmed' : 'return / unload not confirmed'} · {worker.metrics ? `${Math.round(worker.metrics.bossDamage).toLocaleString()} boss damage · ${worker.metrics.bossHits} boss hits · ${Math.round(worker.metrics.healing).toLocaleString()} healing · ${Math.round(worker.metrics.lootGold).toLocaleString()} mission loot gold` : 'metrics unavailable'}{worker.metrics?.items?.length ? ` · loot: ${worker.metrics.items.map(item => `${item.name} +${item.level} ×${item.quantity}`).join(', ')}` : ''}{report.owned.includes(worker.name) ? worker.online ? ' · owned worker still online at report' : ' · owned worker stopped' : ' · manual worker kept online'}{report.engagedAt && report.finishedAt - report.engagedAt >= 30000 && worker.metrics && worker.metrics.bossHits === 0 ? ' · WARNING: no confirmed boss attack' : ''}</p>)}
        </article>)}
        {!mission.history?.length && <p>No completed mission recorded by this deployment.</p>}
      </details>
    </>}
  </Card>;
}

export function EventExpeditionPanel({ profile, deployments, version, dirty, pending, onChange }: { profile: Profile; deployments?: DeploymentsResponse; version?: number; dirty: boolean; pending: boolean; onChange: (profile: Profile) => void }) {
  const config = profile.events.expedition;
  const [preparing, setPreparing] = useState(false);
  const [notice, setNotice] = useState('');
  const update = (patch: Partial<typeof config>) => onChange({ ...profile, events: { ...profile.events, expedition: { ...config, ...patch } } });
  async function prepare() {
    setPreparing(true); setNotice('');
    try {
      for (const character of profile.characters.filter(c => c.enabled && ['warrior', 'priest'].includes(c.ctype))) await api('/api/deploy', { character: character.name, version, prepareOnly: true });
      setNotice('Duo CODE verified and saved. No character was started. Deploy the merchant and ranger to apply the mode.');
    } catch (error) { setNotice((error as Error).message); }
    finally { setPreparing(false); }
  }
  return <div className={styles.panel}>
    <EventExpeditionStatus profile={profile} deployments={deployments} />
    <TemporaryCharacters profile={profile} deployments={deployments} />
    <details className={styles.settings} open={!config.enabled}>
      <summary>On-demand event duo settings</summary>
      <Toggle label="Keep ranger farming; start warrior + priest for events" value={config.enabled} disabled={pending || preparing} onChange={enabled => onChange({ ...profile, events: { ...profile.events, allowed: enabled ? [...new Set([...profile.events.allowed, ...config.allowed])] : profile.events.allowed, expedition: { ...config, enabled } } })} />
      <p>Home server only: {profile.server.region} {profile.server.name}. The duo waits for health, mana and 20 potions of each type before departure. Starting them removes the ranger’s Lone Wolf bonus during their expedition.</p>
      <Button size="small" variant="secondary" disabled={pending || preparing} onClick={() => onChange({ ...profile, events: { ...profile.events, allowed: [...new Set([...profile.events.allowed, ...expeditionBosses])], expedition: { ...config, allowed: [...expeditionBosses] } } })}>Allow all supported event bosses</Button>
      <div className={styles.inputs}>
        {expeditionBosses.map(id => <Toggle key={id} label={EVENT_DEFINITIONS.find(event => event.id === id)?.label ?? id} value={config.allowed.includes(id)} disabled={pending || preparing} onChange={enabled => {
          const allowed = enabled ? [...new Set([...config.allowed, id])] : config.allowed.filter(event => event !== id);
          onChange({ ...profile, events: { ...profile.events, allowed: enabled ? [...new Set([...profile.events.allowed, id])] : profile.events.allowed, expedition: { ...config, allowed } } });
        }} />)}
        <Field label="Maximum mission minutes" htmlFor="expedition-minutes"><NumberInput id="expedition-minutes" value={config.maxMinutes} min={2} max={60} disabled={pending || preparing} onChange={value => update({ maxMinutes: value ?? 20 })} /></Field>
        <Field label="Maximum deaths per character" htmlFor="expedition-deaths"><NumberInput id="expedition-deaths" value={config.maxDeaths} min={1} max={10} disabled={pending || preparing} onChange={value => update({ maxDeaths: value ?? 3 })} /></Field>
      </div>
      <p>At the end: town → return → unload → disconnect characters started by the merchant. Manual characters stay online. Incomplete cleanup stays visible as blocked.</p>
      <Button variant="secondary" disabled={dirty || pending || preparing || !config.enabled || version === undefined} onClick={prepare}>{preparing ? 'Preparing CODE…' : 'Prepare duo CODE without starting'}</Button>
      <p className={styles.note}>Save first, prepare the offline duo, then deploy the saved profile. Preparation does not reload characters already online.</p>
      {notice && <p role="status">{notice}</p>}
    </details>
  </div>;
}
