import {EventEmitter} from 'node:events';
import fs from 'node:fs';
import {spawn} from 'node:child_process';
import {remote} from '../server/deploy';
import {describe,it,expect,vi} from 'vitest';
vi.mock('../server/deploy',()=>({remote:vi.fn(async()=>({online:true}))}));
vi.mock('node:child_process',()=>({spawn:vi.fn()}));
import {startCaracal,stopCaracal,caracalStatus,caracalAvailable} from '../server/caracal';
describe('caracAL ownership guards',()=>{
 it('rejects paths masquerading as character names before launching',async()=>{
  await expect(startCaracal('../other','EUI','code','unused')).rejects.toThrow('Invalid character');
 });
 it('does not stop processes it does not own',async()=>{
  expect(caracalStatus('unmanaged').managed).toBe(false);
  expect((await stopCaracal('unmanaged')).stage).toBe('Stopped');
 });
 it('refuses an existing game connection before preparing or spawning',async()=>{
  if(!caracalAvailable())return;
  await expect(startCaracal('Test','EUI','code','unused')).rejects.toThrow('already online');
  expect(caracalStatus('Test').managed).toBe(false);
 });
 it('launches one isolated character without a copied credential and stops its owned child',async()=>{
  const child:any=new EventEmitter();child.pid=123;child.exitCode=null;child.send=()=>queueMicrotask(()=>child.emit('exit',0));
  vi.mocked(spawn).mockImplementation(()=>{queueMicrotask(()=>child.emit('spawn'));return child;});
  vi.mocked(remote).mockResolvedValue({online:false});
  const exists=vi.spyOn(fs,'existsSync').mockReturnValue(true);
  const mkdir=vi.spyOn(fs,'mkdirSync').mockImplementation(()=>undefined);
  const read=vi.spyOn(fs,'readdirSync').mockReturnValue([] as any);
  const copy=vi.spyOn(fs,'cpSync').mockImplementation(()=>{});
  const write=vi.spyOn(fs,'writeFileSync').mockImplementation(()=>{});
  try{
   const result=await startCaracal('Test','EUIII','generated source','isolated-data');
   expect(result.confirmed).toBe(false);expect(caracalStatus('Test').processRunning).toBe(true);
   const config=write.mock.calls.find(c=>String(c[0]).endsWith('config.js'))![1] as string;
   expect(config).toContain('"session":""');expect(config).toContain('"Test":{"enabled":true,"realm":"EUIII"');expect(config).toContain('"expose_CODE":false');
   expect(vi.mocked(spawn).mock.calls[0][2]).toMatchObject({windowsHide:true,stdio:['ignore','ignore','ignore','ipc']});
   await stopCaracal('Test');expect(caracalStatus('Test').managed).toBe(false);
  }finally{exists.mockRestore();mkdir.mockRestore();read.mockRestore();copy.mockRestore();write.mockRestore();}
 });
});
