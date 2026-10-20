import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
export type Remote = (method:string,args?:Record<string,unknown>)=>Promise<any>;
import { dataDir } from './config';
const credentialFile = path.join(dataDir, 'credentials.json');
function token(){
 if(process.env.AL_MCP_TOKEN)return process.env.AL_MCP_TOKEN;
 try{const local=JSON.parse(fs.readFileSync(credentialFile,'utf8'));if(typeof local.token==='string'&&local.token)return local.token;}catch{}
 if(process.env.ALCC_DISABLE_LEGACY_CREDENTIALS==='1')return '';
 try{return JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname,'../../.cursor/mcp.json'),'utf8')).mcpServers['Adventure Land'].headers.Authorization.replace(/^Bearer\s+/i,'');}catch{return '';}
}
export const credentialAvailable=()=>Boolean(token());
async function callRemote(method:string,args:Record<string,unknown>,secret:string){
 if(!secret)throw Error('Configure AL_MCP_TOKEN on the local server or your Adventure Land MCP connection.');
 let response:Response;
 try{response=await fetch('https://adventure.land/mcp_api/'+method,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...args,token:secret}),signal:AbortSignal.timeout(20000)});}catch{throw Error(`${method}: connection failed or timed out. Check game status before retrying.`);}
 if(!response.ok)throw Error(`${method}: game service returned HTTP ${response.status}.`);
 const result=await response.json();
 if(result.failed||!result.success)throw Error(`${method}: ${String(result.reason||'request rejected').replace(/[^a-zA-Z0-9_ -]/g,'').slice(0,100)}`);
 return result;
}
export const remote:Remote=(method,args={})=>callRemote(method,args,token());
/** Verify a credential before persisting it locally. Never return it to the browser. */
export async function connectCredential(secret:string){
 if(process.env.AL_MCP_TOKEN)throw Error('AL_MCP_TOKEN is configured. Test the existing connection or update the server environment first.');
 const result=await callRemote('mainframe_list_characters',{},secret);
 fs.mkdirSync(dataDir,{recursive:true});
 const temporary=credentialFile+'.'+crypto.randomUUID()+'.tmp';
 try{
  fs.writeFileSync(temporary,JSON.stringify({token:secret}),{mode:0o600});
  fs.renameSync(temporary,credentialFile);
 }finally{if(fs.existsSync(temporary))fs.unlinkSync(temporary);}
 return result;
}
// Serialize slot allocation across characters and prevent double clicks from starting duplicate requests.
let occupied=false;
export async function deployCode(character:string,code:string,backupDir:string,call:Remote=remote,progress:(stage:string)=>void=()=>{},prepareOnly=false){
 if(occupied)throw Error('Another deployment is in progress. Wait for it to finish.');
 occupied=true;
 try{
  if(!prepareOnly){
   progress('Checking browser connection');
   const status=await call('browser_code_status',{character});
   if(!status.online)throw Error(`Open ${character} in Adventure Land first. Browser CODE requires an online character.`);
  }
  progress('Choosing dashboard CODE slot');
  const {codes}=await call('list_codes');
  if(!Array.isArray(codes))throw Error('Game returned an invalid CODE slot list.');
  const name='CC_'+character;
  const existing=codes.filter((c:any)=>c.name===name);
  if(existing.length>1)throw Error(`Multiple ${name} slots exist. Rename duplicates in CODE before deploying.`);
  const slot=existing[0]?.slot??Array.from({length:100},(_,i)=>String(100-i)).find(s=>!codes.some((c:any)=>String(c.slot)===s));
  if(!slot)throw Error('No free CODE slot. Free a numeric slot in the game first.');
  if(existing.length){
   const old=await call('get_code',{slot});
   if(typeof old.code?.code!=='string')throw Error('Cannot back up the existing CODE slot.');
   fs.mkdirSync(backupDir,{recursive:true});
   fs.writeFileSync(path.join(backupDir,crypto.randomUUID()+'.json'),JSON.stringify({character,slot,at:new Date().toISOString(),...old.code},null,2));
  }
  progress('Uploading CODE');
  await call('save_code',{slot,name,code});
  progress('Verifying uploaded source');
  const uploaded=await call('get_code',{slot});
  if(uploaded.code?.code!==code)throw Error('Uploaded CODE does not match the build. Start was not requested.');
  if(prepareOnly)return {character,slot,name,stage:'Prepared',confirmed:false,message:'Verified CODE ready for on-demand startup. Character was not started.'};
  progress('Requesting CODE reload');
  await call('browser_code_reload',{character,slot});
  return {character,slot,name,stage:'Start requested',confirmed:false,message:'Upload verified; CODE start/reload requested. Execution of this version is not yet confirmed. Check the game CODE console.'};
 }finally{occupied=false;}
}

/** Restore one verified backup while first preserving the currently deployed slot. */
export async function restoreCode(character:string,backup:{slot:string;name?:string;code:string},backupDir:string,call:Remote=remote){
 if(occupied)throw Error('Another deployment is in progress. Wait for it to finish.');
 occupied=true;
 try{
  const status=await call('browser_code_status',{character});
  if(!status.online)throw Error(`Open ${character} in Adventure Land before rollback.`);
  const current=await call('get_code',{slot:String(backup.slot)});
  if(typeof current.code?.code!=='string')throw Error('Cannot preserve the current CODE before rollback.');
  fs.mkdirSync(backupDir,{recursive:true});
  fs.writeFileSync(path.join(backupDir,crypto.randomUUID()+'.json'),JSON.stringify({character,slot:String(backup.slot),at:new Date().toISOString(),...current.code},null,2));
  const name=backup.name||'CC_'+character;
  await call('save_code',{slot:String(backup.slot),name,code:backup.code});
  const restored=await call('get_code',{slot:String(backup.slot)});
  if(restored.code?.code!==backup.code)throw Error('Rollback verification failed. Reload was not requested.');
  await call('browser_code_reload',{character,slot:String(backup.slot)});
  return {character,slot:String(backup.slot),name,stage:'Rollback requested'};
 }finally{occupied=false;}
}
