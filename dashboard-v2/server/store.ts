import { DatabaseSync } from 'node:sqlite';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';
import { desc, eq } from 'drizzle-orm';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { Profile, ScriptInfo } from '../shared/schema';
import {profileSchema,ensureSellerBoards,ensureFarmingBoards} from '../shared/schema';
import {scripts,seedWeaponStyles} from './scripts';
import { cautiousProfile } from '../shared/onboarding';
export const dataDir=process.env.ALCC_DATA_DIR||path.join(process.env.LOCALAPPDATA||os.homedir(),'AdventureLandDashboard');
fs.mkdirSync(dataDir,{recursive:true});
/** Keep one process-local connection; the development watcher recreates it after a restart. */
const sqlite=new DatabaseSync(path.join(dataDir,'command-center.sqlite'));
sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
sqlite.exec(fs.readFileSync(path.join(import.meta.dirname,'migrations/0001.sql'),'utf8'));
export const profiles=sqliteTable('profiles',{id:integer().primaryKey(),version:integer().notNull(),payload:text().notNull(),updatedAt:text().notNull()});
export const events=sqliteTable('events',{id:integer().primaryKey({autoIncrement:true}),time:text().notNull(),character:text().notNull(),level:text().notNull(),message:text().notNull()});
const db=drizzle(async(query,params,method)=>{
  const stmt=sqlite.prepare(query);if(method==='run'){stmt.run(...params as any[]);return {rows:[]};}
  const rows=stmt.all(...params as any[]).map(row=>Object.values(row));return {rows:method==='get'?rows[0]||[]:rows};
});
/** Legacy profiles pinned v1 script ids; prefer the -v2 revision when it exists. */
function migrateScriptIds(profile:{characters?:{script:string}[]},list:ScriptInfo[]){
  const prefer=(id:string)=>(!id||id.endsWith('-v2'))?id:(list.some(s=>s.id===`${id}-v2`)?`${id}-v2`:id);
  profile.characters=(profile.characters||[]).map(c=>({...c,script:prefer(c.script)}));
}
export async function getProfile(seed:Profile){
  let row=(await db.select().from(profiles).where(eq(profiles.id,1)))[0];
  if(!row){await db.insert(profiles).values({id:1,version:1,payload:JSON.stringify(cautiousProfile(seed)),updatedAt:new Date().toISOString()});row=(await db.select().from(profiles))[0];}
  const stored=JSON.parse(row.payload);
  /** Legacy profiles pinned v1 script ids — remap to -v2 before validation. */
  migrateScriptIds(stored,scripts());
  // Explicit disabled automation must stay disabled, including on first installation.
  const profile=seedWeaponStyles(profileSchema.parse(ensureFarmingBoards(ensureSellerBoards(structuredClone(stored)))),scripts());
  const migrated=ensureSellerBoards(structuredClone(profile));
  /** Persist board migrations (legacy upgrade items→rules, minGold) and the script-id migration without bumping the revision. */
  const scriptsChanged=JSON.stringify((stored.characters||[]).map((c:any)=>c.script))!==JSON.stringify((migrated.characters||[]).map((c:any)=>c.script));
  if(scriptsChanged||JSON.stringify(stored.seller?.upgrade)!==JSON.stringify(migrated.seller.upgrade)||JSON.stringify(stored.seller?.ponty)!==JSON.stringify(migrated.seller.ponty)||JSON.stringify(stored.seller?.consumables)!==JSON.stringify(migrated.seller.consumables)||JSON.stringify(stored.seller?.buy)!==JSON.stringify(migrated.seller.buy)||JSON.stringify(stored.farming?.loadouts)!==JSON.stringify(migrated.farming.loadouts)){
    sqlite.prepare('UPDATE profiles SET payload=?, updatedAt=? WHERE id=1').run(JSON.stringify(migrated),new Date().toISOString());
  }
  return {profile:migrated,version:row.version,updatedAt:row.updatedAt};
}
export async function saveProfile(profile:Profile,version:number){
  const updatedAt=new Date().toISOString();
  const payload=ensureFarmingBoards(ensureSellerBoards(structuredClone(profile)));
  const result=sqlite.prepare('UPDATE profiles SET payload=?, version=version+1, updatedAt=? WHERE id=1 AND version=?').run(JSON.stringify(payload),updatedAt,version);
  if(!result.changes)throw Error('This profile changed in another window. Reload before saving.');
  return {profile:payload,version:version+1,updatedAt};
}
export async function log(message:string,character='System',level='info'){
  await db.insert(events).values({time:new Date().toISOString(),character,level,message});
  sqlite.prepare('DELETE FROM events WHERE id < (SELECT COALESCE(MAX(id),0)-2000 FROM events)').run();
}
export async function activity(){return db.select().from(events).orderBy(desc(events.id)).limit(100);}
