import { describe, expect, it } from 'vitest';
import { filterStatistics, partyFarmingBalance } from '../src/models/party-statistics';
import type { PerformanceBucket } from '../src/types';
const bucket = (overrides: Partial<PerformanceBucket> = {}): PerformanceBucket => ({
  character:'A',at:10000,elapsedMs:10000,damage:0,healing:0,kills:0,deaths:0,attacks:0,movingMs:2000,combatMs:0,xp:0,gold:0,
  economyElapsedMs:10000,npcSalesElapsedMs:10000,netLootGold:100,npcSalesGold:20,consumablesGold:30,unpriced:0,...overrides,
});
describe('shared statistics filters',()=>{
  it('combines character, time and activity without treating unknown data as farming',()=>{
    const rows=[bucket({farmContext:{monster:'crab',participants:['A']}}),bucket({character:'B',farmContext:{monster:'crab',participants:['B']}}),bucket({at:1000}),bucket({farmContext:{monster:'mrgreen',participants:['A']}}),bucket({map:'main',farmContext:{monster:'goo',participants:['A'],activity:'cave'}}),bucket()];
    expect(filterStatistics(rows,{names:['A'],since:5000,activity:'farming'})).toEqual([rows[0]]);
    expect(filterStatistics(rows,{names:['A'],since:5000,activity:'events'})).toEqual([rows[3]]);
    expect(filterStatistics(rows,{names:['A'],since:5000,activity:'cave'})).toEqual([rows[4]]);
    expect(filterStatistics(rows,{names:[],since:0,activity:'all'})).toEqual([]);
  });
});
describe('observed farming balance',()=>{
  it('uses matched coverage and preserves negative net and measured zero',()=>{
    const result=partyFarmingBalance([bucket({netLootGold:0,npcSalesGold:0,consumablesGold:30}),bucket({npcSalesElapsedMs:undefined,npcSalesGold:999999})],['A'])[0];
    expect(result).toMatchObject({loot:0,sales:0,cost:30,net:-30,netPerHour:-10800,coverage:50,measuredMs:10000});
  });
  it('hides net when prices are unknown and never converts missing measurements into zero',()=>{
    expect(partyFarmingBalance([bucket({unpriced:1})],['A'])[0]).toMatchObject({net:null,netPerHour:null,unpriced:1});
    expect(partyFarmingBalance([],['A'])[0]).toMatchObject({loot:null,sales:null,cost:null,net:null,deaths:null,movingMs:null});
    expect(partyFarmingBalance([bucket({npcSalesElapsedMs:5000})],['A'])[0]).toMatchObject({net:null,coverage:0});
  });
});
