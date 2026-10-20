import type {Profile,ScriptInfo} from '../shared/schema';

export function realmKey(value:string){
 // Telemetry often reports "EU Europas III" while the profile stores "EU III".
 return String(value||'')
  .replace(/\bEuropas\b|\bAmericas\b|\bAsia\b/gi,'')
  .replace(/\s+/g,'')
  .toUpperCase();
}

export function profileRealm(server:{region:string;name:string}){
 return realmKey(`${server.region}${server.name}`);
}

export function reportedRealm(deployment:any,telemetry:any){
 const fromTel=telemetry?.stats?.server;
 const fromStatus=deployment?.browserStatus?.server;
 return realmKey(String(fromTel||fromStatus||''));
}

export type CharacterHealth={
 name:string;
 enabled:boolean;
 script:string;
 runtime:string;
 live:boolean;
 confirmed:boolean;
 sourceDrift:boolean;
 profileDrift:boolean;
 realmMismatch:boolean;
 needsRebuild:boolean;
 issues:string[];
 sourceHash?:string;
 deployedSourceHash?:string;
 profileVersion?:number;
 reportedServer?:string;
 wantedServer:string;
 stage?:string;
};

export function characterHealth(
 c:Profile['characters'][number],
 script:ScriptInfo|undefined,
 deployment:any,
 telemetry:any,
 profile:Profile,
 profileVersion:number
):CharacterHealth{
 const wanted=profileRealm(profile.server);
 const reported=reportedRealm(deployment,telemetry);
 const live=!!telemetry?.live;
 const sourceDrift=!deployment?.sourceHash||!script||deployment.sourceHash!==script.hash;
 const profileDrift=deployment?.profileVersion!==profileVersion;
 const realmMismatch=!!reported&&reported!==wanted;
 const issues:string[]=[];
 if(!c.enabled)return{name:c.name,enabled:false,script:c.script,runtime:c.runtime,live:false,confirmed:false,sourceDrift:false,profileDrift:false,realmMismatch:false,needsRebuild:false,issues:[],wantedServer:`${profile.server.region} ${profile.server.name}`,stage:deployment?.stage};
 if(!deployment?.hash&&!deployment?.sourceHash)issues.push('Never deployed from this Command Center (or deployment record missing).');
 else{
  if(sourceDrift)issues.push('Local script source changed since last deploy — rebuild required.');
  if(profileDrift)issues.push(`Profile revision ${profileVersion} differs from deployed revision ${deployment.profileVersion??'?'}.`);
 }
 if(realmMismatch)issues.push(`Live realm ${telemetry?.stats?.server||deployment?.browserStatus?.server} ≠ profile ${profile.server.region} ${profile.server.name}.`);
 const preparedWorker=profile.events.expedition?.enabled&&['warrior','priest'].includes(c.ctype)&&deployment?.stage==='Prepared';
 if(deployment&&!live&&!deployment.busy&&!preparedWorker)issues.push(deployment.message||'No live telemetry for the deployed bundle.');
 return{
  name:c.name,
  enabled:true,
  script:c.script,
  runtime:c.runtime,
  live,
  confirmed:!!(live&&deployment?.confirmed!==false),
  sourceDrift,
  profileDrift,
  realmMismatch,
  needsRebuild:sourceDrift||profileDrift,
  issues,
  sourceHash:script?.hash,
  deployedSourceHash:deployment?.sourceHash,
  profileVersion:deployment?.profileVersion,
  reportedServer:telemetry?.stats?.server||deployment?.browserStatus?.server,
  wantedServer:`${profile.server.region} ${profile.server.name}`,
  stage:deployment?.stage
 };
}

export function fleetHealth(profile:Profile,profileVersion:number,list:ScriptInfo[],deployments:Record<string,any>,view:(id?:string)=>any){
 const characters=profile.characters.map(c=>{
  const script=list.find(s=>s.id===c.script);
  const deployment=deployments[c.name];
  return characterHealth(c,script,deployment,view(deployment?.telemetryId),profile,profileVersion);
 });
 const enabled=characters.filter(c=>c.enabled);
 return{
  characters,
  enabled:enabled.length,
  live:enabled.filter(c=>c.live).length,
  needsRebuild:enabled.filter(c=>c.needsRebuild).length,
  realmMismatches:enabled.filter(c=>c.realmMismatch).length,
  issues:enabled.flatMap(c=>c.issues.map(message=>({character:c.name,message})))
 };
}
