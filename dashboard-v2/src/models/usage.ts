/** Static feature names only: never store DOM text, form values, characters or tokens. */
export const USAGE_FEATURES = [
  ['page.team','Team','Pages'],['page.merchant','Merchant','Pages'],['page.bank','Bank','Pages'],
  ['tool.setup','Team setup','Team'],['tool.farming','Farming & events','Team'],['tool.inventory','Equipment & bags','Team'],['tool.insights','Activity & insights','Team'],
  ['team.map','Live positions','Team'],['team.attention','Needs attention','Team'],['team.changes','Review pending changes','Team'],
  ['team.preview','Deployment preview & rollback','Team'],['team.checklist','Preparation checklist','Team'],['team.scripts','Script catalogue','Team'],
  ['team.targets','Farming targets & loadouts','Team'],['team.events','Events & bosses','Team'],['team.cave','Cave Dreams','Team'],
  ['insights.combat','Combat performance','Insights'],['insights.operations','Operations & movement','Insights'],['insights.incidents','Incidents','Insights'],['insights.history','Performance history','Insights'],['insights.loot','Loot estimates','Insights'],['insights.activity','Activity log','Insights'],
  ['merchant.settings','Merchant settings','Merchant'],['merchant.tools','Planning tools','Merchant'],
  ['merchant.overview','Overview & supervisor','Merchant settings'],['merchant.supplies','Team supplies','Merchant settings'],['merchant.production','Production','Merchant settings'],['merchant.trading','Trading','Merchant settings'],
  ['merchant-kit','Kit delivery','Merchant rules'],['merchant-cons','Consumables','Merchant rules'],['merchant-gifts','Permanent gifts','Merchant rules'],['merchant-team','Team supervisor','Merchant rules'],
  ['merchant-up','Upgrades','Merchant rules'],['merchant-ex','Exchanges','Merchant rules'],['merchant-craft','Crafting','Merchant rules'],['merchant-compound','Compound','Merchant rules'],['merchant-stand','Stand listings','Merchant rules'],['merchant-buy','Buy wishlist','Merchant rules'],['merchant-npc','NPC sales','Merchant rules'],['merchant-ponty','Ponty','Merchant rules'],
  ['bank.actions','Bank actions & deposit rules','Bank'],['search','Global search','Tools'],
  ['action.save','Save profile','Actions'],['action.discard','Discard edits','Actions'],['action.deploy','Deploy saved profile','Actions'],['action.stop','Stop characters','Actions'],['action.refresh','Refresh dashboard','Actions'],['action.sort','Sort bank','Actions'],
] as const;
export type UsageId = typeof USAGE_FEATURES[number][0];
export type UsageKind = 'opens' | 'interactions';
export interface UsageCount { opens: number; interactions: number; lastUsed: number; }
export interface UsageData { version: 1; enabled: boolean; startedAt: number; days: Record<string, Partial<Record<UsageId,UsageCount>>>; }
const known = new Set<string>(USAGE_FEATURES.map(row => row[0]));
export function isUsageId(value: unknown): value is UsageId { return typeof value === 'string' && known.has(value); }
export function localDay(at: number) { const d=new Date(at); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
/** Opt-in: nothing is counted until the user turns tracking on. */
export function freshUsage(now=Date.now()): UsageData { return {version:1,enabled:false,startedAt:now,days:{}}; }
/** Validate persisted data and drop unknown keys instead of echoing arbitrary imported data. */
export function parseUsage(raw: string | null, now=Date.now()): UsageData {
  try {
    const value=JSON.parse(raw ?? 'null');
    if(value?.version!==1 || typeof value.enabled!=='boolean' || !Number.isFinite(value.startedAt) || !value.days || typeof value.days!=='object') return freshUsage(now);
    const result=freshUsage(Math.min(now,Math.max(0,value.startedAt))); result.enabled=value.enabled;
    const cutoff=new Date(now);cutoff.setDate(cutoff.getDate()-89);
    for(const [day,rows] of Object.entries(value.days)) {
      if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||day<localDay(cutoff.getTime())||day>localDay(now)||!rows||typeof rows!=='object')continue;
      const safe: Partial<Record<UsageId,UsageCount>>={};
      for(const [id,row] of Object.entries(rows)) {
        if(!isUsageId(id)||!row||typeof row!=='object')continue;
        const r=row as UsageCount;
        if(![r.opens,r.interactions].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=10000000)||!Number.isFinite(r.lastUsed)||r.lastUsed>now)continue;
        safe[id]={opens:r.opens,interactions:r.interactions,lastUsed:Math.max(0,r.lastUsed)};
      }
      result.days[day]=safe;
    }
    return result;
  } catch { return freshUsage(now); }
}
export function addUsage(data: UsageData, id: string, kind: UsageKind, now=Date.now()): UsageData {
  if(!data.enabled||!isUsageId(id)) return data;
  const result=parseUsage(JSON.stringify(data),now),day=localDay(now);
  const rows=result.days[day]??={};
  const row=rows[id]??={opens:0,interactions:0,lastUsed:now};
  row[kind]=Math.min(10000000,row[kind]+1); row.lastUsed=now;
  return result;
}
export function usageRows(data: UsageData, period: 7|30|90, now=Date.now()) {
  const cutoff=new Date(now);cutoff.setDate(cutoff.getDate()-period+1);
  return USAGE_FEATURES.map(([id,label,group])=>{
    let opens=0,interactions=0,lastUsed=0,activeDays=0;
    for(const [day,values] of Object.entries(data.days)) {
      if(day<localDay(cutoff.getTime())||day>localDay(now))continue;
      const row=values[id]; if(!row)continue;
      opens+=row.opens;interactions+=row.interactions;lastUsed=Math.max(lastUsed,row.lastUsed);if(row.opens+row.interactions>0)activeDays++;
    }
    return {id,label,group,opens,interactions,lastUsed,activeDays,total:opens+interactions};
  });
}
export const DISCLOSURE_USAGE: Record<string,UsageId> = {
  'Live positions':'team.map','Needs attention':'team.attention','Review pending changes':'team.changes',
  'Preview saved deployment':'team.preview','Preparation checklist':'team.checklist','Script catalogue':'team.scripts',
  'Farming targets & loadouts':'team.targets','Events & bosses':'team.events','Cave Dreams':'team.cave',
  'Combat performance':'insights.combat','Operations & movement':'insights.operations','Incidents':'insights.incidents',
  'Performance history':'insights.history','Loot estimates':'insights.loot','Activity log':'insights.activity',
};
export const DIALOG_USAGE: Record<string,UsageId> = {
  'Team setup':'tool.setup','Farming & events':'tool.farming','Equipment & bags':'tool.inventory','Activity & insights':'tool.insights',
  'Merchant settings':'merchant.settings','Planning tools':'merchant.tools','Bank actions & deposit rules':'bank.actions',
};
