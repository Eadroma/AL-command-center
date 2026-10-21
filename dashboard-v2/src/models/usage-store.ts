import { addUsage, freshUsage, isUsageId, parseUsage, type UsageData, type UsageKind } from './usage';
import { pageFromHash } from './navigation';
const key='alcc.dashboard.usage.v1';
const changed='alcc:usage-changed';
let available=true, writeFailed=false;
export function usageStorageAvailable() { return available && !writeFailed; }
export function readUsage(): UsageData {
  try { const data=parseUsage(localStorage.getItem(key));available=true;return data; }
  catch { available=false;return freshUsage(); }
}
function write(data: UsageData) {
  try { localStorage.setItem(key,JSON.stringify(data));available=true;writeFailed=false;window.dispatchEvent(new Event(changed)); }
  catch { available=false;writeFailed=true;window.dispatchEvent(new Event(changed)); }
}
export function recordUsage(id: string, kind: UsageKind='opens') { if(!isUsageId(id))return;const data=readUsage();if(data.enabled)write(addUsage(data,id,kind)); }
export function setUsageEnabled(enabled: boolean) { write({...readUsage(),enabled}); }
export function resetUsage() { write({...freshUsage(),enabled:readUsage().enabled}); }
export function subscribeUsage(listener:()=>void) {
  const storage=(event:StorageEvent)=>{if(event.key===key||event.key===null)listener();};
  window.addEventListener(changed,listener);window.addEventListener('storage',storage);
  return ()=>{window.removeEventListener(changed,listener);window.removeEventListener('storage',storage);};
}
let started=false;
/** Count intentional UI events only. Polls, telemetry and React renders never count. */
export function startUsageTracking() {
  if(started)return;started=true;
  let page=pageFromHash(location.hash);recordUsage(`page.${page}`);
  window.addEventListener('hashchange',()=>{const next=pageFromHash(location.hash);if(next!==page){page=next;recordUsage(`page.${page}`);}});
  document.addEventListener('click',event=>{
    const target=event.target instanceof Element?event.target:null;
    if(!target||target.closest('[data-usage-ignore]'))return;
    const control=target.closest('button,a,summary');
    if(!control||control.matches(':disabled,[aria-disabled="true"],summary,[aria-expanded]'))return;
    const explicit=control.getAttribute('data-usage');
    if(explicit) { recordUsage(explicit,'interactions');return; }
    const scope=control.closest('[data-usage-scope]')?.getAttribute('data-usage-scope');
    if(scope)recordUsage(scope,'interactions');
  },true);
  document.addEventListener('change',event=>{
    const target=event.target instanceof Element?event.target:null;
    if(!target||target.closest('[data-usage-ignore]'))return;
    const scope=target.closest('[data-usage-scope]')?.getAttribute('data-usage-scope');
    if(scope)recordUsage(scope,'interactions');
  },true);
}
