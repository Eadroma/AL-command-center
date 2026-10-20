import fs from 'node:fs';
import path from 'node:path';
import {spawn, type ChildProcess} from 'node:child_process';
import {remote} from './deploy';
const source=path.resolve(process.env.ALCC_CARACAL_DIR || path.join(import.meta.dirname,'../../caracAL'));
const processes=new Map<string,ChildProcess>();
export const caracalAvailable=()=>['config.js','standalones/CharacterCoordinator.js','node_modules/jsdom/package.json'].every(f=>fs.existsSync(path.join(source,f)));
export function caracalStatus(name:string){const child=processes.get(name);return {managed:!!child,processRunning:!!child&&child.exitCode===null,pid:child?.pid};}
export async function stopCaracal(name:string){
 const child=processes.get(name);if(!child)return {stage:'Stopped',message:'No dashboard-managed caracAL process.'};
 await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('caracAL did not stop. Check its local process before restarting.')),10000);child.once('exit',()=>{clearTimeout(timer);resolve();});child.send({type:'shutdown'});});
 return {stage:'Stopped',message:'Dashboard-managed caracAL process stopped.'};
}
export async function startCaracal(name:string,realm:string,code:string,dataDir:string){
 if(!/^[a-zA-Z0-9_-]+$/.test(name))throw Error('Invalid character name.');
 if(!caracalAvailable())throw Error('Local caracAL installation or configuration is missing.');
 const owned=processes.has(name);
 if(owned)await stopCaracal(name);
 const online=owned?{online:false}:await remote('browser_code_status',{character:name});
 if(online.online)throw Error('This character is already online. Log out its existing game client before starting caracAL.');
 const root=path.join(dataDir,'caracal',name);fs.mkdirSync(root,{recursive:true});
 for(const file of fs.readdirSync(source))if(file.endsWith('.js')&&!file.startsWith('config'))fs.copyFileSync(path.join(source,file),path.join(root,file));
 for(const dir of ['src','standalones'])fs.cpSync(path.join(source,dir),path.join(root,dir),{recursive:true});
 if(!fs.existsSync(path.join(root,'node_modules')))fs.symlinkSync(path.join(source,'node_modules'),path.join(root,'node_modules'),'junction');
 if(!fs.existsSync(path.join(root,'game_files')))fs.cpSync(path.join(source,'game_files'),path.join(root,'game_files'),{recursive:true});
 for(const dir of ['CODE','logs','localStorage'])fs.mkdirSync(path.join(root,dir),{recursive:true});
 fs.writeFileSync(path.join(root,'CODE','dashboard.js'),code);
 // Reuse the existing session locally without copying it into generated configuration or logs.
 fs.writeFileSync(path.join(root,'config.js'),'module.exports='+JSON.stringify({session:'',cull_versions:false,enable_TYPECODE:false,log_level:'warn',web_app:{enable_bwi:false,enable_minimap:false,expose_CODE:false,expose_TYPECODE:false},characters:{[name]:{enabled:true,realm,script:'dashboard.js',version:0}}})+';');
 fs.writeFileSync(path.join(root,'managed.cjs'),`
const cp=require('node:child_process');const children=new Set();const original=cp.fork;
cp.fork=function(){const child=original.apply(this,arguments);children.add(child);child.on('exit',()=>children.delete(child));return child;};
let stopping=false;function stop(){if(stopping)return;stopping=true;for(const child of children){try{child.send({type:'closing_client'});}catch{}}
setTimeout(()=>{for(const child of children){try{child.kill();}catch{}}process.exit(0);},1000);}
process.on('disconnect',stop);process.on('message',m=>{if(m&&m.type==='shutdown')stop();});
process.env.AL_SESSION=process.env.AL_SESSION||require(${JSON.stringify(path.join(source,'config.js'))}).session;
if(!process.env.AL_SESSION){process.exit(2);}require('./standalones/CharacterCoordinator.js');
`);
 const child=spawn(process.execPath,[path.join(root,'managed.cjs')],{cwd:root,windowsHide:true,stdio:['ignore','ignore','ignore','ipc']});
 processes.set(name,child);child.once('exit',()=>{if(processes.get(name)===child)processes.delete(name);});
 await new Promise<void>((resolve,reject)=>{child.once('spawn',resolve);child.once('error',()=>{processes.delete(name);reject(Error('Unable to launch caracAL.'));});});
 return {stage:'Headless process started',message:'Waiting for this caracAL version to report telemetry.',runtime:'caracal',confirmed:false};
}
