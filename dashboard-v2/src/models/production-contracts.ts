import type { Profile, CharacterTelemetry } from '../types';
export function productionContracts(profile: Profile, telemetry?: CharacterTelemetry | null) {
  return profile.seller.upgrade.rules.filter(r => r.production?.enabled).map(rule => {
    const run = rule.production!;
    const sample = telemetry?.upgradeProduction?.find(row => row.item === rule.item && row.runId === run.runId);
    const state = !profile.seller.upgrade.enabled ? 'Upgrades disabled' : !sample ? 'Awaiting deployment / sample' : sample.pending ? 'Unconfirmed action' : sample.produced >= run.quantity ? 'Complete' : sample.spent >= run.budget ? 'Budget exhausted' : 'In progress';
    return {rule,run,sample,state,live:!!telemetry?.live,destination:'Bank at target level'};
  });
}
/** Reuse the existing bounded runtime; never reset a previous lot silently. */
export function addProductionContract(profile: Profile, item: string, level: number, quantity: number, budget: number, buyNpc: boolean, runId: string): Profile {
  if(!Number.isInteger(level)||level<1||level>15||!Number.isInteger(quantity)||quantity<1||quantity>9999||!Number.isInteger(budget)||budget<0||budget>2e12||!runId) throw new Error('Invalid contract target, quantity, budget or run ID.');
  if(profile.seller.upgrade.rules.length>=500&&!profile.seller.upgrade.rules.some(r=>r.item===item)) throw new Error('Upgrade rule limit reached.');
  if(profile.seller.upgrade.rules.some(r => r.item === item && r.production?.enabled)) throw new Error('A bounded contract already exists for this item. Edit its existing lot.');
  const previous = profile.seller.upgrade.rules.find(r => r.item === item);
  const rule = {...previous,item,maxLevel:level,buyNpc,production:{enabled:true,quantity,budget,runId}};
  return {...profile,seller:{...profile.seller,upgrade:{...profile.seller.upgrade,rules:[...profile.seller.upgrade.rules.filter(r=>r.item!==item),rule]}}};
}

export function craftContracts(profile: Profile, telemetry?: CharacterTelemetry | null) {
  return profile.automation.commercialGoals.map(goal => {
    const sample=telemetry?.runtimePolicy?.commerce.find(row=>row.id===goal.id);
    return {goal,sample,live:!!telemetry?.live,state:!goal.enabled?'Disabled':sample?.state??'Awaiting deployment / sample',destination:'Protected on merchant'};
  });
}
export function addCraftContract(profile: Profile,item:string,quantity:number,budget:number,id:string):Profile {
  if(!Number.isInteger(quantity)||quantity<1||quantity>9999||!Number.isInteger(budget)||budget<0||budget>2e12||!id)throw new Error('Invalid craft target, budget or ID.');
  if(profile.automation.commercialGoals.length>=30)throw new Error('Craft contract limit reached.');
  if(profile.automation.commercialGoals.some(g=>g.enabled&&g.item===item))throw new Error('An active craft contract already exists for this recipe.');
  return {...profile,automation:{...profile.automation,commercialGoals:[...profile.automation.commercialGoals,{id,enabled:true,item,quantity,budget}]}};
}
