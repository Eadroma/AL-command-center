import { expect, it } from 'vitest';
import { explainDecision } from '../src/models/decision-explanation';
import { decisionDestination } from '../src/models/decision-navigation';
import { farmingProfit } from '../src/models/farming-profit';
import type { PerformanceBucket } from '../src/types';
it('routes explicit pending transactions to the resolution panel and refuses stale explanations', () => {
 const t={live:true,upgradeProduction:[{item:'coat',runId:'one',pending:true,spent:100,produced:0,quantity:1,budget:200,reviewReason:'Missing proof'}]};
 expect(explainDecision(true,t)).toMatchObject({warning:true,source:'reported',action:'Transaction verification'});
 expect(decisionDestination(t)).toMatchObject({page:'merchant',panel:'upgrade-resolution'});
 expect(explainDecision(true,{...t,live:false}).source).toBe('unavailable');
});
it('keeps different builds and buffs separate and includes resale only with identical coverage', () => {
 const row:PerformanceBucket={character:'Ranger',at:10000,elapsedMs:600000,damage:10,healing:0,kills:1,deaths:1,attacks:1,movingMs:60000,combatMs:100000,xp:1,gold:1,netLootGold:1000,consumablesGold:100,consumed:1,unpriced:0,economyElapsedMs:600000,npcSalesGold:300,npcSalesElapsedMs:600000,farmContext:{monster:'crab',participants:['Ranger'],build:'bow7',effects:['lonewolf']}};
 const rows=farmingProfit([row,{...row,farmContext:{...row.farmContext!,build:'bow8'},npcSalesElapsedMs:undefined}]);
 expect(rows).toHaveLength(2);expect(rows[0].netPerHour).toBe(5400);
 expect(rows.find(r=>r.build==='bow7')?.combinedNetPerHour).toBe(7200);
 expect(rows.find(r=>r.build==='bow8')?.combinedNetPerHour).toBeNull();
 expect(rows[0].movementPercent).toBe(10);
});

it('does not call normal cooldown downtime a blocker when combat actions are acknowledged', () => {
 const runtimePolicy={diagnostic:{reason:'Attack / heal cooldown',since:100,updatedAt:100,target:'crab',source:'observed' as const,durations:{},actions:[{at:100,action:'3shot',result:'success'}]},danger:{active:false,reason:'',attackers:0,hpPercent:100,incomingDps:0,healingDps:0,action:'hold'},goals:[],commerce:[]};
 expect(explainDecision(true,{live:true,lastSeen:101,runtimePolicy})).toMatchObject({action:'Combat active',warning:false});
 expect(explainDecision(true,{live:true,standOpen:true,runtimePolicy})).toMatchObject({action:'Merchant activity',warning:false});
});
