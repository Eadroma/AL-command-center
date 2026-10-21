import type { FastifyPluginAsync } from 'fastify';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { dataDir, port } from '../config';
import { remote, restoreCode } from '../deploy';
import { log } from '../store';
import { deployments, persistDeployments } from '../services/deployments-state';
import { telemetry } from './telemetry';
import { instrument, withoutTelemetry } from '../telemetry';
import { caracalStatus } from '../caracal';
import { wsManager } from '../ws';

const directory=path.join(dataDir,'code-backups');
const safeId=(value:string)=>/^[a-f0-9-]{36}$/.test(value)?value:'';
const read=(id:string)=>JSON.parse(fs.readFileSync(path.join(directory,`${safeId(id)}.json`),'utf8'));
const hash=(code:string)=>crypto.createHash('sha256').update(code).digest('hex');
const rows=()=>fs.existsSync(directory)?fs.readdirSync(directory).filter(name=>name.endsWith('.json')).map(name=>({name,mtime:fs.statSync(path.join(directory,name)).mtimeMs})).sort((a,b)=>b.mtime-a.mtime).slice(0,100).flatMap(file=>{try{const value=JSON.parse(fs.readFileSync(path.join(directory,file.name),'utf8'));return [{id:file.name.slice(0,-5),character:value.character,slot:String(value.slot),name:value.name||`CC_${value.character}`,at:value.at,bytes:Buffer.byteLength(value.code||''),hash:hash(value.code||'')}];}catch{return [];}}):[];

export const deploymentHistoryRoute:FastifyPluginAsync=async app=>{
 app.get('/api/deployment-history',async()=>({backups:rows()}));
 app.get<{Params:{id:string}}>('/api/deployment-history/:id/compare',async(req,reply)=>{try{const backup=read(req.params.id);const current=await remote('get_code',{slot:String(backup.slot)});const currentCode=String(current.code?.code||'');const previousLines=String(backup.code||'').split('\n'),currentLines=currentCode.split('\n');return {id:req.params.id,character:backup.character,same:currentCode===backup.code,backupHash:hash(backup.code||''),currentHash:hash(currentCode),backupLines:previousLines.length,currentLines:currentLines.length,lineDelta:currentLines.length-previousLines.length};}catch(error){return reply.code(400).send({error:(error as Error).message});}});
 app.post<{Params:{id:string}}>('/api/deployment-history/:id/rollback',async(req,reply)=>{
  let character: string | undefined, locked = false, sessionId: string | undefined;
  let mutationStarted = false;
  let previous: Record<string,any> = {};
  try {
   const backup = read(req.params.id);
   if (typeof backup.character !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(backup.character) || typeof backup.code !== 'string' || !/^\d+$/.test(String(backup.slot))) throw Error('Invalid CODE backup.');
   character = backup.character;
   if (deployments[character]?.busy) throw Error('Wait for the current character operation to finish.');
   if (caracalStatus(character).managed) throw Error('Stop the managed headless client before restoring Browser CODE.');
   previous = deployments[character] || {};
   deployments[character] = {...previous,busy:true,stage:'Restoring CODE',confirmed:false};
   locked = true;
   persistDeployments(); wsManager.broadcastRefresh();
   const source = withoutTelemetry(backup.code, character);
   const session = telemetry.create(character, hash(source));
   sessionId = session.id;
   const code = instrument(source, character, session.ticket, port);
   // Clear the replaced identity before a remote mutation can succeed or time out.
   deployments[character] = {character,runtime:'browser',slot:String(backup.slot),telemetryId:sessionId,hash:hash(code),busy:true,confirmed:false,stage:'Restoring CODE',updatedAt:new Date().toISOString()};
   persistDeployments();
   mutationStarted = true;
   const result = await restoreCode(character,{...backup,code},directory);
   deployments[character] = {...deployments[character],...result,busy:false,confirmed:false,message:'Restored CODE verified. Waiting for fresh telemetry from this rollback.'};
   await log(`Rollback ${req.params.id.slice(0,8)} requested`,character);
   return {ok:true,result:deployments[character]};
  } catch(error) {
   if (locked && character) {
    if (!mutationStarted) { deployments[character] = {...previous,busy:false}; if(sessionId)telemetry.remove(sessionId); }
    else deployments[character] = {...deployments[character],busy:false,confirmed:false,stage:'Rollback unconfirmed',message:(error as Error).message};
   }
   return reply.code(409).send({error:(error as Error).message});
  } finally {
   if (locked) { persistDeployments(); wsManager.broadcastRefresh(); }
  }
 });
};
