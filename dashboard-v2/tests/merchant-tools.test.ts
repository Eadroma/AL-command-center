import vm from 'node:vm';
import { instrument, Telemetry } from '../server/telemetry';
import { expect, it } from 'vitest';
import { merchantMargin } from '../src/models/merchant-margin';
import { clampStandSpot } from '../src/models/stand-spot';
import { filterSearch, searchEntries } from '../src/models/global-search';
import { equipmentProtection } from '../src/models/equipment-protection';
import { initialProfile, scripts } from '../server/scripts';
import type { InventoryItem } from '../src/types';
it('computes material costs, repeated compound failures and negative margin', () => {
  expect(merchantMargin([{quantity:20,unitCost:100},{quantity:1,unitCost:200}],500,1,4000)).toMatchObject({attemptCost:2700,margin:1300});
  expect(merchantMargin([{quantity:3,unitCost:100}],50,.5,600)).toMatchObject({expectedCost:700,margin:-100});
  expect(merchantMargin([{quantity:1,unitCost:NaN}],0,1,100)).toBeNull();
  expect(merchantMargin([{quantity:1,unitCost:1}],0,0,100)).toBeNull();
});
it('clamps stand world coordinates to the existing town schema', () => {
  expect(clampStandSpot(-999,999)).toEqual({map:'main',x:-220,y:160});
  expect(clampStandSpot(-100.2,-19.7)).toEqual({map:'main',x:-100,y:-20});
});
it('searches all terms and provides deep links for settings', () => {
  const entries = searchEntries();
  expect(filterSearch(entries,'STAND position')[0].panel).toBe('merchant-position');
  expect(filterSearch(entries,'equipment protection')[0]).toMatchObject({page:'team',tool:'inventory',panel:'equipment-protections'});
  expect(filterSearch(entries,'not a known setting')).toEqual([]);
});
it('does not infer a runtime decision from saved loadout matches', () => {
  const profile = initialProfile(scripts());
  profile.farming.loadouts.Test = {aoe:{gear:[{slot:'mainhand',item:'ololipop',minLevel:7}],skills:[]},mono:{gear:[],skills:[]},tank:{gear:[],skills:[]}};
  const item = {name:'ololipop',level:0,locked:false,bound:false} as InventoryItem;
  expect(equipmentProtection(profile,'Test',item).runtime).toContain('Unknown');
  expect(equipmentProtection(profile,'Test',item).reason).toContain('No matching');
  expect(equipmentProtection(profile,'Test',{...item,level:7,transferAllowed:false}).reason).toContain('aoe');
  expect(equipmentProtection(profile,'Test',{...item,locked:true}).reason).toBe('Locked item');
});

it('reports actual farmer transfer decisions and retains them through ingestion', () => {
  const bodies: any[] = [];
  const stats = {hp:10,max_hp:10,mp:10,max_mp:10,gold:0,xp:0,level:1,map:'main',target:''};
  const context = {character:{name:'A',...stats,items:[{name:'ololipop',level:7},{name:'ololipop',level:0}]},CONFIG:{LOADOUT_ITEMS:[{item:'ololipop',minLevel:7}]},is_dumpable_slot:(slot:number)=>slot===1,AbortController,setTimeout:()=>1,clearTimeout:()=>{},setInterval:()=>1,fetch:(_url:string,options:any)=>{bodies.push(JSON.parse(options.body));return {then:()=>({then:()=>({catch:()=>({finally:(fn:any)=>fn()})})})};}};
  vm.runInNewContext(instrument('','A','a'.repeat(64),9320),context);
  expect(bodies[0].inventory[0]).toMatchObject({transferAllowed:false,transferReason:'Deployed loadout reserves this item at +7 or higher'});
  expect(bodies[0].inventory[1].transferAllowed).toBe(true);
  const telemetry = new Telemetry(); const session = telemetry.create('A','hash');
  telemetry.ingest({...bodies[0],ticket:session.ticket});
  expect(telemetry.view(session.id)?.inventory?.[0].transferReason).toContain('+7');
});

it('uses the ranger protection function when there is no slot policy', () => {
  const bodies: any[] = [];
  const context = {character:{name:'R',hp:1,max_hp:1,mp:1,max_mp:1,map:'main',items:[{name:'quiver',level:7},{name:'firebow',level:0}]},is_protected_item:(item:any)=>item.name==='quiver',AbortController,setTimeout:()=>1,clearTimeout:()=>{},setInterval:()=>1,fetch:(_url:string,options:any)=>{bodies.push(JSON.parse(options.body));return {then:()=>({then:()=>({catch:()=>({finally:(fn:any)=>fn()})})})};}};
  vm.runInNewContext(instrument('','R','a'.repeat(64),9320),context);
  expect(bodies[0].inventory[0]).toMatchObject({transferAllowed:false,transferReason:'Improved quiver reservation'});
  expect(bodies[0].inventory[1].transferAllowed).toBe(true);
});
