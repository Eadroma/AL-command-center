import type { FastifyPluginAsync } from 'fastify';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { dataDir } from '../config';
import { remote, restoreCode } from '../deploy';
import { log } from '../store';

const directory=path.join(dataDir,'code-backups');
const safeId=(value:string)=>/^[a-f0-9-]{36}$/.test(value)?value:'';
const read=(id:string)=>JSON.parse(fs.readFileSync(path.join(directory,`${safeId(id)}.json`),'utf8'));
const hash=(code:string)=>crypto.createHash('sha256').update(code).digest('hex');
const rows=()=>fs.existsSync(directory)?fs.readdirSync(directory).filter(name=>name.endsWith('.json')).map(name=>({name,mtime:fs.statSync(path.join(directory,name)).mtimeMs})).sort((a,b)=>b.mtime-a.mtime).slice(0,100).flatMap(file=>{try{const value=JSON.parse(fs.readFileSync(path.join(directory,file.name),'utf8'));return [{id:file.name.slice(0,-5),character:value.character,slot:String(value.slot),name:value.name||`CC_${value.character}`,at:value.at,bytes:Buffer.byteLength(value.code||''),hash:hash(value.code||'')}];}catch{return [];}}):[];

export const deploymentHistoryRoute:FastifyPluginAsync=async app=>{
 app.get('/api/deployment-history',async()=>({backups:rows()}));
 app.get<{Params:{id:string}}>('/api/deployment-history/:id/compare',async(req,reply)=>{try{const backup=read(req.params.id);const current=await remote('get_code',{slot:String(backup.slot)});const currentCode=String(current.code?.code||'');const previousLines=String(backup.code||'').split('\n'),currentLines=currentCode.split('\n');return {id:req.params.id,character:backup.character,same:currentCode===backup.code,backupHash:hash(backup.code||''),currentHash:hash(currentCode),backupLines:previousLines.length,currentLines:currentLines.length,lineDelta:currentLines.length-previousLines.length};}catch(error){return reply.code(400).send({error:(error as Error).message});}});
 app.post<{Params:{id:string}}>('/api/deployment-history/:id/rollback',async(req,reply)=>{try{const backup=read(req.params.id);const result=await restoreCode(String(backup.character),backup,directory);await log(`Rollback ${req.params.id.slice(0,8)} requested`,backup.character);return {ok:true,result};}catch(error){return reply.code(409).send({error:(error as Error).message});}});
};
