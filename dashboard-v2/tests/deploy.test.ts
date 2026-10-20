import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {deployCode,restoreCode} from '../server/deploy';
describe('Browser CODE deployment',()=>{
 it('verifies upload before requesting reload and reports unconfirmed',async()=>{
  const calls:string[]=[];
  const result=await deployCode('Test','source','unused',async(method)=>{
   calls.push(method);
   if(method==='browser_code_status')return {online:true};
   if(method==='list_codes')return {codes:[]};
   if(method==='get_code')return {code:{code:'source'}};
   return {success:true,queued:true};
  });
  expect(calls).toEqual(['browser_code_status','list_codes','save_code','get_code','browser_code_reload']);
  expect(result.confirmed).toBe(false);expect(result.slot).toBe('100');
 });
 it('does not upload when offline',async()=>{
  const calls:string[]=[];
  await expect(deployCode('Test','source','unused',async(m)=>{calls.push(m);return {online:false};})).rejects.toThrow('Open Test');
  expect(calls).toEqual(['browser_code_status']);
 });
 it('does not start mismatched uploaded code',async()=>{
  const calls:string[]=[];
  await expect(deployCode('Test','source','unused',async(m)=>{
   calls.push(m);return m==='browser_code_status'?{online:true}:m==='list_codes'?{codes:[]}:{code:{code:'different'}};
  })).rejects.toThrow('does not match');
  expect(calls).not.toContain('browser_code_reload');
 });
 it('stops after upload failure',async()=>{
  const calls:string[]=[];
  await expect(deployCode('Test','source','unused',async(m)=>{
   calls.push(m);if(m==='save_code')throw Error('Upload failed');return m==='browser_code_status'?{online:true}:{codes:[]};
  })).rejects.toThrow('Upload failed');expect(calls).not.toContain('browser_code_reload');
 });
 it('backs up current CODE and verifies a rollback before reload',async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'alcc-rollback-'));
  const calls:string[]=[];
  const result=await restoreCode('Test',{slot:'42',name:'CC_Test',code:'old source'},directory,async(method,args)=>{
   calls.push(method);
   if(method==='browser_code_status')return {online:true};
   if(method==='get_code')return {code:{name:'CC_Test',code:calls.filter(call=>call==='get_code').length===1?'current source':'old source'}};
   expect(args).toBeTruthy();return {success:true};
  });
  expect(result.stage).toBe('Rollback requested');
  expect(calls).toEqual(['browser_code_status','get_code','save_code','get_code','browser_code_reload']);
  const saved=JSON.parse(fs.readFileSync(path.join(directory,fs.readdirSync(directory)[0]),'utf8'));
  expect(saved.code).toBe('current source');
 });
});
