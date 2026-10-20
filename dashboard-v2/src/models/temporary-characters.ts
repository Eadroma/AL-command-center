import type { Profile, DeploymentsResponse } from '../types';
export function temporaryCharacters(profile: Profile, deployments?: DeploymentsResponse) {
  const merchant=profile.characters.find(c=>c.enabled&&c.ctype==='merchant');
  const telemetry=merchant?deployments?.characters[merchant.name]?.telemetry:undefined;
  const mission=telemetry?.eventExpedition;
  const workerNames=[...new Set([...(mission?.participants.map(p=>p.name)??[]),...(['warrior','priest'] as const).map(ctype=>profile.characters.find(c=>c.enabled&&c.ctype===ctype)?.name).filter((name):name is string=>!!name)])];
  return {mission,live:!!telemetry?.live,merchant:merchant?.name,rows:workerNames.map(name=>{
    const participant=mission?.participants.find(p=>p.name===name);
    const owned=!!mission?.owned.includes(name);
    const condition=!telemetry?.live?'Coordinator telemetry unavailable':!participant?'No mission report':!participant.online?'Offline':!owned?'Manual session · kept online':mission?.phase==='complete'?'Mission complete · inspect remaining session':participant.returned?'Unloading verified · waiting for disconnect':['returning','blocked'].includes(mission?.phase??'')?'Waiting for return and verified unloading':mission?.phase==='engaging'?'Participating in boss · return after event or limits':participant.ready?'Ready for mission':'Waiting for assembly, health, mana and supplies';
    return {name,participant,owned,condition};
  })};
}
