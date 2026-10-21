import {describe,it,expect} from 'vitest';
import vm from 'node:vm';
import {Telemetry,instrument} from '../server/telemetry';
const stats={hp:10,max_hp:20,mp:5,max_mp:10,gold:100,xp:3,level:1,map:'main',target:''};
describe('deployment telemetry',()=>{
 it('retains compound progress and rejects invalid production counters',()=>{
  const t=new Telemetry(),session=t.create('A','hash');
  const compoundProgress=[{item:'lantern',attempts:3,successes:1,destroyed:1,unconfirmed:1,scrollGold:2000,updatedAt:100}];
  t.ingest({ticket:session.ticket,character:'A',sequence:1,stats,logs:[],compoundProgress});
  expect(t.view(session.id)?.compoundProgress).toEqual(compoundProgress);
  expect(()=>t.ingest({ticket:session.ticket,character:'A',sequence:2,stats,logs:[],compoundProgress:[{...compoundProgress[0],scrollGold:-1}]})).toThrow();
 });
 it('retains bounded position history and passes farming context to performance collection',()=>{
  let now=10000;const samples:any[]=[];
  const t=new Telemetry(undefined,()=>now,sample=>samples.push(sample));const session=t.create('A','hash');
  const farmContext={monster:'crab',participants:['A']};
  t.ingest({ticket:session.ticket,character:'A',sequence:1,stats:{...stats,x:10,y:20,server:'EU III'},farmContext,logs:[]});
  now+=5000;
  t.ingest({ticket:session.ticket,character:'A',sequence:2,stats:{...stats,map:'cave',x:30,y:40,server:'EU III'},farmContext,logs:[]});
  expect(t.view(session.id)?.positionHistory).toEqual([{at:10000,map:'main',server:'EU III',x:10,y:20},{at:15000,map:'cave',server:'EU III',x:30,y:40}]);
  expect(samples[1].farmContext).toEqual(farmContext);
  now+=610000;
  t.ingest({ticket:session.ticket,character:'A',sequence:3,stats,logs:[]});
  expect(t.view(session.id)?.positionHistory).toHaveLength(1);
 });
 it('counts loot events without multiplying party shares or wallet transfers',()=>{
  const bodies:any[]=[];
  let onLoot:(event:any)=>void=()=>{};
  let pulse:()=>void=()=>{};
  const context={character:{name:'A',...stats,on:(event:string,fn:any)=>{if(event==='loot')onLoot=fn;}},AbortController,setTimeout:()=>1,clearTimeout:()=>{},setInterval:(fn:any,ms:number)=>{if(ms===5000)pulse=fn;return 1;},fetch:(_url:string,options:any)=>{bodies.push(JSON.parse(options.body));return {then:()=>({then:()=>({catch:()=>({finally:(fn:any)=>fn()})})})};}};
  vm.runInNewContext(instrument('','A','a'.repeat(64),9320),context);
  onLoot({gold:125,items:[{name:'coat',level:0,q:2,looter:'A'},{name:'pants',q:5,looter:'B'}]});onLoot({gold:75});onLoot({gold:-10});
  context.character.gold=999999;
  pulse();
  expect(bodies[1].loot).toEqual({gold:200,items:[{name:'coat',level:0,quantity:2}]});
  const t=new Telemetry(),session=t.create('A','hash');
  t.ingest({...bodies[1],ticket:session.ticket});
  expect(t.view(session.id)?.loot).toEqual({gold:200,items:[{name:'coat',level:0,quantity:2}]});
 });
 it('binds reports to character and ticket, rejects replay and expires liveness',()=>{
  let now=10000;const t=new Telemetry(undefined,()=>now),s=t.create('A','hash');
  const p={ticket:s.ticket,character:'A',sequence:1,stats,logs:['ready']};
  expect(()=>t.ingest({...p,character:'B'})).toThrow('Invalid');
  expect(()=>t.ingest({...p,ticket:'0'.repeat(64)})).toThrow('Invalid');
  expect(t.ingest(p)).toBe(true);expect(t.view(s.id)?.live).toBe(true);
  now+=5000;expect(t.ingest(p)).toBe(false);expect(t.view(s.id)?.logs).toHaveLength(1);
  now+=21000;expect(t.view(s.id)?.live).toBe(false);
  expect(JSON.stringify(t.view(s.id))).not.toContain(s.ticket);
 });
 it('keeps receipts for different builds independent',()=>{
  const t=new Telemetry(),old=t.create('A','old'),next=t.create('A','next');
  t.ingest({ticket:old.ticket,character:'A',sequence:1,stats,logs:[]});
  expect(t.view(next.id)?.live).toBe(false);
 });
 it('stores combat, kite diagnostics, categorized bank data and capture time',()=>{
  let now=12345;const t=new Telemetry(undefined,()=>now),s=t.create('A','hash');
  const combat={startedAt:1,damageDealt:20,damageTakenPhysical:3,damageTakenMagical:4,healing:5,manaRestored:6,kills:1,deaths:0,attacks:2,potions:0,movingMs:50,combatMs:100,healerCoverageMs:90,kiteMoves:3};
  const kite={active:true,threats:[],candidates:[],selected:{x:1,y:2,score:8}};
  t.ingest({ticket:s.ticket,character:'A',sequence:1,stats,combat,kite,bank:[{pack:'items0',slot:1,name:'hpot1',level:0,quantity:10,category:'Potions'}],logs:[]});
  expect(t.view(s.id)).toMatchObject({combat,kite,bankAt:now,bank:[{category:'Potions'}]});
 });
 it('queues authenticated runtime commands and exposes Dragold and bank-sort status',()=>{
  let now=50000;const t=new Telemetry(undefined,()=>now),s=t.create('EadroSell','hash');
  const dragold={scanner:'Eadroma',currentShard:'EUIII',startedAt:1,observations:[{shard:'USI',live:true,spawnAt:0,seenAt:now}]};
  const bankSort={state:'running' as const,phase:'sort',moved:4,merged:1,total:20,updatedAt:now,message:'Sorting bank'};
  t.ingest({ticket:s.ticket,character:'EadroSell',sequence:1,stats,dragold,bankSort,logs:[]});
  const command=t.enqueue('EadroSell','sort_bank');
  expect(command.type).toBe('sort_bank');
  expect(t.takeCommands('EadroSell')).toEqual([command]);
  expect(t.takeCommands('EadroSell')).toEqual([]);
  expect(t.view(s.id)).toMatchObject({dragold,bankSort});
 });
 it('stores movement watchdog state for the runtime inspector',()=>{
  const t=new Telemetry(),s=t.create('A','hash');
  const movement={state:'recovering' as const,moving:true,lastProgressAt:100,stalledForMs:0,attempts:2,recoveries:0,lastAction:'local nudge requested',updatedAt:200,destination:{map:'main',x:20,y:30},history:[]};
  t.ingest({ticket:s.ticket,character:'A',sequence:1,stats,movement,logs:[]});
  expect(t.view(s.id)?.movement).toEqual(movement);
 });
 it('stores active effects with an optional remaining duration',()=>{
  const t=new Telemetry(),s=t.create('A','hash');
  const activeEffects=[{id:'lonewolf',ms:60000},{id:'elixirluck'}];
  t.ingest({ticket:s.ticket,character:'A',sequence:1,stats,activeEffects,logs:[]});
  expect(t.view(s.id)?.activeEffects).toEqual(activeEffects);
 });
 it('queues the Cave Dreams exit command for a live farmer',()=>{
  let now=60000;const t=new Telemetry(undefined,()=>now),s=t.create('Eadroma','hash');
  t.ingest({ticket:s.ticket,character:'Eadroma',sequence:1,stats,logs:[]});
  const command=t.enqueue('Eadroma','exit_cave');
  expect(command.type).toBe('exit_cave');
  expect(t.takeCommands('Eadroma')).toEqual([command]);
 });
 it('rejects oversized logs and invalid stats',()=>{
  const t=new Telemetry(),s=t.create('A','hash');
  expect(()=>t.ingest({ticket:s.ticket,character:'A',sequence:1,stats:{...stats,hp:Infinity},logs:[]})).toThrow();
  expect(()=>t.ingest({ticket:s.ticket,character:'A',sequence:1,stats,logs:['x'.repeat(501)]})).toThrow();
 });
 it('reports only after source initializes and preserves game_log',async()=>{
  const bodies:any[]=[];const messages:string[]=[];
  const context={character:{name:'A',skin:'mwarrior2',stand:true,...stats,s:{lonewolf:{ms:65000}},slots:{helmet:{name:'helmet',level:3,shiny:true},mainhand:{name:'sword',level:7,q:1},trade2:{name:'seashell',q:3,price:500},trade13:{name:'helmet',level:2,q:1,price:1000,b:true}}},AbortController,setTimeout:()=>1,clearTimeout:()=>{},setInterval:()=>1,game_log:(s:string)=>messages.push(s),fetch:async(_url:string,options:any)=>{bodies.push(JSON.parse(options.body));}};
  vm.runInNewContext(instrument('game_log("source initialized");','A','a'.repeat(64),9320),context);
  expect(messages).toEqual(['source initialized']);expect(bodies[0].stats).toMatchObject({hp:10,skin:'mwarrior2'});expect(bodies[0].stand).toEqual([{slot:2,name:'seashell',level:0,quantity:3,price:500,buy:false},{slot:13,name:'helmet',level:2,quantity:1,price:1000,buy:true}]);
  expect(bodies[0].equipment).toEqual([{slot:'helmet',name:'helmet',level:3,quantity:1,shiny:true},{slot:'mainhand',name:'sword',level:7,quantity:1}]);
  expect(bodies[0].hunt).toBe(null);
  expect(bodies[0].network).toEqual({pingMs:0,socketConnected:false});
  expect(bodies[0].standOpen).toBe(true);
  expect(bodies[0].activeEffects).toEqual([{id:'lonewolf',ms:65000}]);
  expect(bodies[0].logs).toContain('Command Center: script initialization completed.');
  bodies.length=0;
  expect(()=>vm.runInNewContext(instrument('throw Error("initialization failed");','A','a'.repeat(64),9320),context)).toThrow();
  expect(bodies).toHaveLength(0);
 });
 it('streams live monsterhunt status and clears when gone',()=>{
  let now=20000;const t=new Telemetry(undefined,()=>now),s=t.create('A','hash');
  expect(t.ingest({ticket:s.ticket,character:'A',sequence:1,stats,hunt:{id:'bee',count:20,ms:600000},logs:[]})).toBe(true);
  expect(t.view(s.id)?.hunt).toEqual({id:'bee',count:20,ms:600000});
  now+=5000;
  expect(t.ingest({ticket:s.ticket,character:'A',sequence:2,stats,hunt:null,logs:[]})).toBe(true);
  expect(t.view(s.id)?.hunt).toBe(null);
 });
 it('includes monsterhunt on instrumented pulse',async()=>{
  const bodies:any[]=[];
  const context={character:{name:'A',...stats,s:{monsterhunt:{id:'goo',c:12,ms:90000}},slots:{},items:[]},AbortController,setTimeout:()=>1,clearTimeout:()=>{},setInterval:()=>1,game_log:()=>{},fetch:async(_url:string,options:any)=>{bodies.push(JSON.parse(options.body));}};
  vm.runInNewContext(instrument('','A','b'.repeat(64),9320),context);
  expect(bodies[0].hunt).toEqual({id:'goo',count:12,ms:90000});
 });
});

it('binds upgrade resolution commands to the fresh pending action', () => {
 let now = 50000; const t = new Telemetry(undefined, () => now), s = t.create('Seller', 'hash');
 t.ingest({ticket:s.ticket, character:'Seller', sequence:1, stats, logs:[], upgradeProduction:[{item:'coat',runId:'one',spent:100,produced:0,quantity:2,budget:1000,pending:true,action:{id:'action',item:'coat',runId:'one',kind:'upgrade',level:1,target:7,cost:100,at:now,outcome:'pending',before:'{}'}}]});
 const resolution = {item:'coat',runId:'one',actionId:'action',outcome:'success' as const,verified:true as const};
 expect(() => t.enqueue('Seller','resolve_upgrade',{...resolution,actionId:'old'})).toThrow();
 expect(t.enqueue('Seller','resolve_upgrade',resolution)).toMatchObject({type:'resolve_upgrade',resolution});
 now += 30000;
 expect(() => t.enqueue('Seller','resolve_upgrade',resolution)).toThrow();
});
it('queues only an unchanged unprotected merchant inventory selection',()=>{
 const t=new Telemetry(),session=t.create('Merchant','hash');const selection={slot:3,name:'coat',level:9,quantity:1};
 t.ingest({ticket:session.ticket,character:'Merchant',sequence:1,stats,logs:[],inventory:[{...selection,locked:false,bound:false,upgradeable:true,sellable:true}]});
 expect(()=>t.enqueueDeposit('Merchant',{...selection,name:'pants'})).toThrow();
 expect(t.enqueueDeposit('Merchant',selection).deposit).toEqual(selection);expect(()=>t.enqueueDeposit('Merchant',selection)).toThrow('already queued');expect(t.takeCommands('Merchant')[0].type).toBe('deposit_bank');
});

describe('telemetry session cleanup',()=>{
 it('retires silent sessions of a redeployed character and keeps live ones',()=>{
  let now=10000;const t=new Telemetry(undefined,()=>now);
  const silent=t.create('A','old'),live=t.create('A','running'),other=t.create('B','hash');
  t.ingest({ticket:live.ticket,character:'A',sequence:1,stats,logs:[]});
  const next=t.create('A','next');t.retire('A',next.id);
  expect(t.view(silent.id)).toBeNull();expect(t.view(live.id)).not.toBeNull();expect(t.view(other.id)).not.toBeNull();expect(t.view(next.id)).not.toBeNull();
 });
});
