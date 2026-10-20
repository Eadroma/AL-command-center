import type { DeploymentsResponse, Profile } from '../../types';
import { temporaryCharacters } from '../../models/temporary-characters';
import { CollapsiblePanel } from '../merchant/CollapsiblePanel';
import styles from '../merchant/MerchantTools.module.scss';
export function TemporaryCharacters({profile,deployments}:{profile:Profile;deployments?:DeploymentsResponse}) {
  const state=temporaryCharacters(profile,deployments);
  return <CollapsiblePanel id="temporary-characters" title="Temporary characters" eyebrow="Event lifecycle · ownership">
    <p>Coordinator: {state.merchant??'No enabled merchant'} · {state.live?'Live':'Stored / unavailable telemetry'}. Expedition mode {profile.events.expedition.enabled?'enabled':'disabled'}. Manual sessions are never automatically stopped by a mission that did not start them.</p>
    <div className={styles.rows}>{state.rows.map(row=><article className={styles.row} key={row.name}><span><strong>{row.name}</strong><br/>{state.live&&row.participant?.online?(row.owned?'Started by merchant':'Manual / pre-existing session'):'No current owned session confirmed'}<br/>{row.condition}<br/>{row.participant?`${row.participant.deaths} deaths · ${row.participant.returned?'unloading verified':'unloading not confirmed'}`:'No mission report'}</span></article>)}</div>
    <p>Automatic shutdown requires: mission returning or blocked → worker alive at assembly point → transferable loot emptied → verified report → shutdown of an owned client. A timeout keeps the worker online and accepts a later successful cleanup.</p>
    <a href="#events">Open event mission settings</a>
  </CollapsiblePanel>;
}
