import type { DeploymentsResponse, Profile } from '../../types';
import { temporaryCharacters } from '../../models/temporary-characters';
import { openMerchantRule } from '../../models/rule-navigation';
import { craftContracts, productionContracts } from '../../models/production-contracts';
import styles from './MissionBanner.module.scss';
export function MissionBanner({profile,deployments}:{profile?:Profile;deployments?:DeploymentsResponse}) {
  if(!profile)return null;
  const state=temporaryCharacters(profile,deployments),mission=state.mission;
  const telemetry=state.merchant?deployments?.characters[state.merchant]?.telemetry:undefined;
  const contracts=productionContracts(profile,telemetry);
  const crafts=craftContracts(profile,telemetry);
  const active=mission&&!['complete','idle'].includes(mission.phase);
  const blocked=contracts.filter(c=>c.sample?.pending);
  if(!active&&!contracts.length&&!crafts.length&&!profile.events.expedition.enabled)return null;
  return <aside className={styles.banner} aria-label="Mission summary"><div><strong>{active?`${mission.event} · ${mission.phase}`:'Event duo · ready for next mission'}</strong><p>{!state.live?'Coordinator telemetry stale — current state unknown':active?`${state.rows.filter(r=>!!r.participant&&(r.participant.returned||!r.participant.online)).length}/${state.rows.length} returned or offline · ${mission.reason}`:'Temporary workers start only for allowed events.'}</p><a href="#events" onClick={()=>window.setTimeout(()=>openMerchantRule('temporary-characters'),150)}>Inspect mission / workers</a></div><div><strong>Production · {contracts.length} upgrade / {crafts.length} craft lots</strong><p>{blocked.length?`${blocked.length} unconfirmed action(s) need review`:contracts.length||crafts.length?`${contracts.filter(c=>c.state==='Complete').length} upgrade / ${crafts.filter(c=>c.state==='complete').length} craft complete · ${state.live?'live':'stored'} progress`:'No production contract'}</p><a href="#merchant" onClick={()=>window.setTimeout(()=>openMerchantRule('production-contracts'),150)}>Open production contracts</a></div></aside>;
}
