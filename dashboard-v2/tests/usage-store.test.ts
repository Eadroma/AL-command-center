import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { readUsage, recordUsage, resetUsage, setUsageEnabled, subscribeUsage, usageStorageAvailable } from '../src/models/usage-store';
let values: Map<string,string>;
beforeEach(()=>{
  values=new Map();
  vi.stubGlobal('window',new EventTarget());
  vi.stubGlobal('localStorage',{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value)});
});
afterEach(()=>vi.unstubAllGlobals());
it('persists only known counters, not supplied private strings, and publishes updates',()=>{
  setUsageEnabled(true);
  const listener=vi.fn(),unsubscribe=subscribeUsage(listener);
  recordUsage('page.team');recordUsage('private-form-value');
  expect(listener).toHaveBeenCalledTimes(1);
  expect([...values.values()].join('')).not.toContain('private-form-value');
  expect(Object.values(readUsage().days)[0]['page.team']?.opens).toBe(1);
  unsubscribe();
});
it('keeps pause preference when history is reset',()=>{
  setUsageEnabled(false);recordUsage('page.bank');expect(readUsage().days).toEqual({});
  resetUsage();expect(readUsage().enabled).toBe(false);
  setUsageEnabled(true);recordUsage('page.bank');expect(Object.values(readUsage().days)[0]['page.bank']?.opens).toBe(1);
});
it('reports a write failure even when subsequent reads still work',()=>{
  // Tracking was enabled earlier; only writes fail now.
  vi.stubGlobal('localStorage',{getItem:()=>JSON.stringify({version:1,enabled:true,startedAt:0,days:{}}),setItem:()=>{throw Error('quota');}});
  const unsubscribe=subscribeUsage(()=>readUsage());
  expect(()=>recordUsage('page.team')).not.toThrow();expect(usageStorageAvailable()).toBe(false);
  unsubscribe();
});
