import { expect, it } from 'vitest';
import { initialProfile, scripts } from '../server/scripts';
import { addCraftContract, craftContracts, addProductionContract, productionContracts } from '../src/models/production-contracts';
import { temporaryCharacters } from '../src/models/temporary-characters';
import type { CharacterTelemetry, DeploymentsResponse } from '../src/types';
it('stages one lot without enabling upgrades or resetting another bounded run',()=>{
 const p=initialProfile(scripts());p.seller.upgrade.enabled=false;
 const next=addProductionContract(p,'pants',9,3,200000000,true,'run');
 expect(next.seller.upgrade.enabled).toBe(false);
 expect(next.seller.upgrade.rules.find(r=>r.item==='pants')?.production).toEqual({enabled:true,quantity:3,budget:200000000,runId:'run'});
 expect(()=>addProductionContract(next,'pants',9,3,100,false,'other')).toThrow('already exists');
 expect(()=>addProductionContract(p,'coat',9,1,-1,false,'other')).toThrow('Invalid');
});
it('matches progress by lot ID and keeps pending actions ahead of completion',()=>{
 let p=addProductionContract(initialProfile(scripts()),'pants',9,3,100,true,'run');p.seller.upgrade.enabled=true;
 const sample={live:true,upgradeProduction:[{item:'pants',runId:'old',produced:3,spent:50,quantity:3,budget:100,pending:false}]} as CharacterTelemetry;
 expect(productionContracts(p,sample)[0].sample).toBeUndefined();
 sample.upgradeProduction![0].runId='run';sample.upgradeProduction![0].pending=true;
 expect(productionContracts(p,sample)[0].state).toBe('Unconfirmed action');
 sample.upgradeProduction![0].pending=false;expect(productionContracts(p,sample)[0].state).toBe('Complete');
});
it('separates manual sessions and owned workers and does not present stale state as live',()=>{
 const p=initialProfile(scripts());const seller=p.characters.find(c=>c.ctype==='merchant')!,duo=p.characters.filter(c=>['warrior','priest'].includes(c.ctype));
 duo.forEach(c=>c.enabled=true);seller.enabled=true;
 const data={characters:{[seller.name]:{telemetry:{live:true,eventExpedition:{phase:'blocked',owned:[duo[0].name],participants:duo.map(c=>({name:c.name,online:true,ready:true,returned:false,deaths:0}))}}}}} as unknown as DeploymentsResponse;
 const state=temporaryCharacters(p,data);
 expect(state.rows.find(r=>r.name===duo[0].name)?.condition).toContain('unloading');
 expect(state.rows.find(r=>r.name===duo[1].name)?.condition).toContain('Manual');
 data.characters[seller.name].telemetry!.live=false;
 expect(temporaryCharacters(p,data).rows[0].condition).toContain('unavailable');
});

it('creates craft lots in the existing runtime without replacing active goals',()=>{
 const p=initialProfile(scripts());const next=addCraftContract(p,'wingedboots',3,10000,'craft');
 expect(next.automation.commercialGoals.at(-1)).toEqual({id:'craft',item:'wingedboots',quantity:3,budget:10000,enabled:true});
 expect(()=>addCraftContract(next,'wingedboots',3,10000,'other')).toThrow('already exists');
 expect(craftContracts(next)[0].destination).toBe('Protected on merchant');
});
