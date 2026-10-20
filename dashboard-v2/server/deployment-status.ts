// A fresh receipt confirms this deployment, regardless of an earlier queued response.
// Keep operation progress visible while a request is still in flight.
export function deploymentStatus(deployment:any,telemetry:any){
 if(deployment.busy)return {...deployment,telemetry};
 if(telemetry?.live)return {...deployment,stage:'Running',confirmed:true,message:'This deployed version is reporting live telemetry.',telemetry};
 if(deployment.browserStatus?.code_running===false && Date.parse(deployment.checkedAt||'')>(telemetry?.lastSeen||0))return {...deployment,stage:deployment.browserStatus.online?'Stopped':'Offline',confirmed:false,message:deployment.browserStatus.online?'Game reports CODE stopped.':'Game reports the character offline.',telemetry};
 if(telemetry?.lastSeen)return {...deployment,stage:deployment.stage==='Stopped'?'Stopped':'Telemetry stale',confirmed:false,message:deployment.stage==='Stopped'?'Game reported CODE stopped.':'No fresh report for this version. Check game status.',telemetry};
 return {...deployment,confirmed:false,telemetry};
}
