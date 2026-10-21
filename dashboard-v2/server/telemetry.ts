import { bankHubSchema } from '../shared/bank-hub';
import { eventExpeditionStatusSchema, expeditionBosses } from '../shared/event-expedition';
import { compoundProgressSchema } from '../shared/compound-progress';
import { upgradeHistorySchema, upgradeProductionRowsSchema, type UpgradeResolution } from '../shared/upgrade-history';
import { analysisTelemetry } from './analysis-telemetry';
import { recordIncidentReplay } from './incident-replay';
import type { ReplayState } from '../src/types/incident-replay';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {z} from 'zod';
import { throttledJsonWriter } from './json-file';
import { ast, sourceDir } from './scripts';
import path from 'node:path';
import { runtimePolicyStatusSchema } from '../shared/automation';

const equipmentItem=z.object({slot:z.string().max(40),name:z.string().max(80),level:z.number().int().min(0).max(20),quantity:z.number().int().positive().max(999999999).default(1),shiny:z.boolean().optional()});
const bankItem=z.object({pack:z.string().max(40),slot:z.number().int().min(0).max(255),name:z.string().max(80),level:z.number().int().min(0).max(20),quantity:z.number().int().positive().max(999999999),category:z.string().max(40).default('Other')});
const huntStatus=z.object({id:z.string().max(80),count:z.number().int().min(0).max(9999),ms:z.number().finite().nonnegative().optional()});
const combat=z.object({startedAt:z.number(),damageDealt:z.number(),damageTakenPhysical:z.number(),damageTakenMagical:z.number(),healing:z.number(),manaRestored:z.number(),kills:z.number().int(),deaths:z.number().int(),attacks:z.number().int(),potions:z.number().int(),movingMs:z.number(),combatMs:z.number(),healerCoverageMs:z.number(),kiteMoves:z.number().int()});
const network=z.object({pingMs:z.number().finite().nonnegative(),socketConnected:z.boolean()});
const failure=z.object({at:z.number(),reason:z.string().max(80),details:z.string().max(240)});
const kite=z.object({active:z.boolean(),phase:z.string().max(24).optional(),at:z.number().optional(),map:z.string().optional(),origin:z.object({x:z.number(),y:z.number()}).nullable().optional(),leash:z.number().optional(),target:z.object({id:z.string(),mtype:z.string(),x:z.number(),y:z.number(),range:z.number(),etaMs:z.number().nonnegative().optional()}).nullable().optional(),healer:z.object({name:z.string(),x:z.number(),y:z.number(),range:z.number()}).nullable().optional(),threats:z.array(z.object({id:z.string(),mtype:z.string(),x:z.number(),y:z.number(),range:z.number(),target:z.string()})).max(30).default([]),candidates:z.array(z.object({x:z.number(),y:z.number(),score:z.number()})).max(72).default([]),selected:z.object({x:z.number(),y:z.number(),score:z.number()}).nullable().optional()});
const caveStatus=z.object({inside:z.boolean(),enabled:z.boolean().optional(),available:z.boolean().optional(),floor:z.number().optional(),remainingMs:z.number().optional(),paused:z.boolean().optional(),amber:z.number().optional(),gold:z.number().optional(),resets:z.number().optional(),last:z.string().max(200).optional()});
const dragoldIntel=z.object({scanner:z.string().max(40),currentShard:z.string().max(20),startedAt:z.number().nonnegative(),observations:z.array(z.object({shard:z.string().max(20),live:z.boolean(),spawnAt:z.number().nonnegative(),seenAt:z.number().nonnegative()})).max(80)});
const bankSortStatus=z.object({state:z.enum(['idle','queued','running','complete','failed']),phase:z.string().max(40),moved:z.number().int().nonnegative(),merged:z.number().int().nonnegative(),total:z.number().int().nonnegative(),updatedAt:z.number().nonnegative(),message:z.string().max(160),commandId:z.string().max(80).optional()});
const runtimeIntent=z.object({state:z.string().max(120),since:z.number().nonnegative(),updatedAt:z.number().nonnegative(),map:z.string().max(80),target:z.string().max(80).optional(),destination:z.object({map:z.string().max(80),x:z.number().finite(),y:z.number().finite()}).nullable().optional(),blockedBy:z.string().max(120).nullable().optional()});
const teamMission=z.object({id:z.string().max(160),leader:z.string().max(40),monster:z.string().max(80),map:z.string().max(80),x:z.number().finite(),y:z.number().finite(),targetId:z.string().max(80),phase:z.string().max(40),at:z.number().nonnegative()});
const coordination=z.object({role:z.enum(['leader','follower']),mission:teamMission.nullable(),ready:z.array(z.string().max(40)).max(8),canEngage:z.boolean(),updatedAt:z.number().nonnegative()});
const merchantTransaction=z.object({id:z.string().max(120),kind:z.string().max(40),detail:z.string().max(180),state:z.enum(['running','committed','failed']),startedAt:z.number().nonnegative(),finishedAt:z.number().nonnegative(),message:z.string().max(180)});
const merchantTransactions=z.object({current:merchantTransaction.nullable(),journal:z.array(merchantTransaction).max(60),updatedAt:z.number().nonnegative()});
const movementPoint=z.object({at:z.number().nonnegative(),state:z.string().max(40),map:z.string().max(80),x:z.number().finite(),y:z.number().finite(),destination:z.object({map:z.string().max(80),x:z.number().finite(),y:z.number().finite()}).nullable().optional(),detail:z.string().max(160)});
const movementWatchdog=z.object({state:z.enum(['idle','monitoring','stalled','recovering','blocked']),moving:z.boolean(),lastProgressAt:z.number().nonnegative(),stalledForMs:z.number().nonnegative(),attempts:z.number().int().nonnegative(),recoveries:z.number().int().nonnegative(),lastAction:z.string().max(200),updatedAt:z.number().nonnegative(),destination:z.object({map:z.string().max(80),x:z.number().finite(),y:z.number().finite()}).nullable().optional(),history:z.array(movementPoint).max(24).default([])});
const activeEffect=z.object({id:z.string().max(80),ms:z.number().finite().nonnegative().optional()});
const farmContext=z.object({activity:z.enum(['farming','events','cave','unknown']).optional(),monster:z.string().max(80),participants:z.array(z.string().max(40)).max(20),build:z.string().max(1500).optional(),effects:z.array(z.string().max(80)).max(64).optional(),goldMultiplier:z.number().finite().nonnegative().optional()});
const lootMetrics=z.object({gold:z.number().finite().nonnegative(),items:z.array(z.object({name:z.string().max(80),level:z.number().int().min(0).max(20),quantity:z.number().int().positive().max(999999999)})).max(500).optional()});
const economyMetrics=z.object({consumablesGold:z.number().finite().nonnegative(),consumed:z.number().int().nonnegative(),unpriced:z.number().int().nonnegative(),npcSalesGold:z.number().finite().nonnegative().optional()});
const buildItem=z.object({name:z.string().max(80),level:z.number().int().min(0).max(20),location:z.enum(['equipment','bag']),slot:z.string().max(40),properties:z.record(z.string().max(40),z.number().finite())});
const loopGuard=z.object({task:z.string().max(40),holds:z.array(z.object({task:z.string().max(40),at:z.number().nonnegative(),reason:z.string().max(180)})).max(8)});
const basePacket=z.object({bankHub:bankHubSchema.optional(),loopGuard:loopGuard.optional(),eventExpedition:eventExpeditionStatusSchema.optional(),compoundProgress:compoundProgressSchema.optional(),upgradeHistory:upgradeHistorySchema.optional(),upgradeProduction:upgradeProductionRowsSchema.optional(),bankCapturedAt:z.number().nonnegative().optional(),economy:economyMetrics.optional(),buildItems:z.array(buildItem).max(160).optional(),ticket:z.string().length(64),character:z.string().max(40),sequence:z.number().int().nonnegative(),stats:z.object({maxXp:z.number().finite().nonnegative().optional(),cc:z.number().finite().optional(),attack:z.number().finite().optional(),frequency:z.number().finite().optional(),speed:z.number().finite().optional(),range:z.number().finite().optional(),tracker:z.object({monsters:z.record(z.string().max(80),z.number().finite().nonnegative()),exchanges:z.record(z.string().max(80),z.number().finite().nonnegative())}).optional(),skin:z.string().max(80).default(''),hp:z.number().finite(),max_hp:z.number().finite(),mp:z.number().finite(),max_mp:z.number().finite(),gold:z.number().finite(),xp:z.number().finite(),level:z.number().finite(),map:z.string().max(80),x:z.number().finite().default(0),y:z.number().finite().default(0),target:z.string().max(80),server:z.string().max(40).optional(),armor:z.number().finite().default(0),resistance:z.number().finite().default(0),evasion:z.number().finite().default(0),goldMultiplier:z.number().finite().nonnegative().default(1),luckMultiplier:z.number().finite().nonnegative().default(1),xpMultiplier:z.number().finite().nonnegative().default(1)}),intent:runtimeIntent.optional(),movement:movementWatchdog.optional(),coordination:coordination.optional(),merchantTransactions:merchantTransactions.optional(),activeEffects:z.array(activeEffect).max(64).default([]),loot:lootMetrics.optional(),farmContext:farmContext.optional(),inventory:z.array(z.object({slot:z.number().int().min(0).max(255),name:z.string().max(80),level:z.number().int().min(0).max(20),quantity:z.number().int().positive().max(999999999),locked:z.boolean(),bound:z.boolean(),upgradeable:z.boolean(),sellable:z.boolean(),transferAllowed:z.boolean().optional(),transferReason:z.string().max(500).optional()})).max(256).default([]),stand:z.array(z.object({slot:z.number().int().min(1).max(30),name:z.string().max(80),level:z.number().int().min(0).max(20),quantity:z.number().int().positive().max(999999999),price:z.number().finite().nonnegative(),buy:z.boolean()})).max(30).optional(),standOpen:z.boolean().optional(),equipment:z.array(equipmentItem).max(32).default([]),bank:z.array(bankItem).max(500).optional(),hunt:huntStatus.nullable().optional(),combat:combat.optional(),network:network.optional(),kite:kite.optional(),cave:caveStatus.optional(),dragold:dragoldIntel.optional(),bankSort:bankSortStatus.optional(),failures:z.array(failure).max(10).default([]),logs:z.array(z.string().max(500)).max(20)});
const commandReceipt=z.object({id:z.string().max(80),state:z.enum(['complete','failed','review']),message:z.string().max(180)});
const packet = basePacket.extend({ commandProtocol:z.literal(2).optional(),commandReceipts:z.array(commandReceipt).max(200).optional(),runtimePolicy: runtimePolicyStatusSchema.optional() });
type RuntimeCommand={id:string;type:'sort_bank'|'exit_cave'|'resolve_upgrade'|'deposit_bank';deposit?:{slot:number;name:string;level:number;quantity:number};resolution?:UpgradeResolution;createdAt:number};
type PositionPoint={at:number;map:string;server:string;x:number;y:number};
type Session={generation?:number;commandProtocol?:2;commandResults?:Array<{id:string;type:string;state:string;message:string;at:number}>;loopGuard?:z.infer<typeof loopGuard>;eventExpedition?:z.infer<typeof eventExpeditionStatusSchema>;compoundProgress?:z.infer<typeof compoundProgressSchema>;upgradeHistory?:z.infer<typeof upgradeHistorySchema>;upgradeProduction?:z.infer<typeof packet>['upgradeProduction'];replay?:ReplayState;economy?:z.infer<typeof economyMetrics>;buildItems?:z.infer<typeof buildItem>[];runtimePolicy?:z.infer<typeof runtimePolicyStatusSchema>;positionHistory?:PositionPoint[];id:string;character:string;ticketHash:string;hash:string;createdAt:number;lastSeen?:number;sequence:number;stats?:z.infer<typeof packet>['stats'];intent?:z.infer<typeof runtimeIntent>;movement?:z.infer<typeof movementWatchdog>;coordination?:z.infer<typeof coordination>;merchantTransactions?:z.infer<typeof merchantTransactions>;activeEffects?:z.infer<typeof activeEffect>[];loot?:z.infer<typeof lootMetrics>;inventory?:z.infer<typeof packet>['inventory'];stand?:z.infer<typeof packet>['stand'];standOpen?:boolean;equipment?:z.infer<typeof packet>['equipment'];bank?:z.infer<typeof packet>['bank'];bankAt?:number;hunt?:z.infer<typeof huntStatus>|null;combat?:z.infer<typeof combat>;network?:z.infer<typeof network>;kite?:z.infer<typeof kite>;cave?:z.infer<typeof caveStatus>;dragold?:z.infer<typeof dragoldIntel>;bankSort?:z.infer<typeof bankSortStatus>;bankHub?:z.infer<typeof bankHubSchema>;commands?:RuntimeCommand[];failures?:z.infer<typeof failure>[];logs:{time:number;message:string}[]};

export class Telemetry {
 private sessions:Record<string,Session>={};
 private persist:()=>void;
 constructor(file?:string,private now=Date.now,private onSample?:(sample:any)=>void){this.persist=throttledJsonWriter(file,()=>this.sessions);if(file&&fs.existsSync(file)){try{this.sessions=JSON.parse(fs.readFileSync(file,'utf8'));}catch{/* A fresh deployment restores telemetry after invalid local state. */}}}
 create(character:string,hash:string){const ticket=crypto.randomBytes(32).toString('hex'),id=crypto.randomUUID();this.sessions[id]={generation:Math.max(0,...Object.values(this.sessions).map(s=>s.generation??s.createdAt))+1,id,character,hash,ticketHash:crypto.createHash('sha256').update(ticket).digest('hex'),createdAt:this.now(),sequence:-1,logs:[]};for(const key of Object.keys(this.sessions))if(this.now()-this.sessions[key].createdAt>7*86400000)delete this.sessions[key];this.persist();return {id,ticket};}
 /** After a verified deploy, older silent sessions of that character only hold stale bank/log snapshots. Live ones keep reporting until reloaded; pending protocol-2 commands move to the newest session on its first packet. */
 retire(character:string,keepId:string){for(const s of Object.values(this.sessions))if(s.character===character&&s.id!==keepId&&!s.commands?.length&&!(s.lastSeen&&this.now()-s.lastSeen<20000))delete this.sessions[s.id];this.persist();}
 remove(id:string){delete this.sessions[id];this.persist();}
 ingest(input:unknown){
  const p=packet.parse(input),digest=crypto.createHash('sha256').update(p.ticket).digest('hex');
  const s=Object.values(this.sessions).find(s=>s.ticketHash===digest&&s.character===p.character);
  if(!s||this.now()-s.createdAt>7*86400000)throw Error('Invalid or expired telemetry ticket. Rebuild CODE.');
  if(Object.values(this.sessions).some(other=>other.character===s.character&&(other.generation??other.createdAt)>(s.generation??s.createdAt)&&other.lastSeen&&this.now()-other.lastSeen<20000))throw Error('Telemetry session superseded by a newer runtime.');
  if(p.sequence<=s.sequence)return false;
  if(s.lastSeen&&this.now()-s.lastSeen<1000)return false;
  if(p.commandProtocol===2){
   s.commandProtocol=2;
   for(const old of Object.values(this.sessions))if(old!==s&&old.character===s.character&&(old.generation??old.createdAt)<(s.generation??s.createdAt)&&old.commandProtocol===2){
    for(const c of old.commands||[])if(!(s.commands||[]).some(row=>row.id===c.id))(s.commands??=[]).push(c);
    old.commands=[];
   }
   for(const receipt of p.commandReceipts||[]){const c=s.commands?.find(row=>row.id===receipt.id);if(!c)continue;
    (s.commandResults??=[]).push({id:c.id,type:c.type,state:receipt.state,message:receipt.message,at:this.now()});s.commands=s.commands!.filter(row=>row.id!==c.id);
   }
   s.commandResults=(s.commandResults||[]).slice(-100);
  }
  s.loopGuard=p.loopGuard;s.eventExpedition=p.eventExpedition;s.compoundProgress=p.compoundProgress;s.upgradeHistory=p.upgradeHistory;s.upgradeProduction=p.upgradeProduction;s.sequence=p.sequence;s.lastSeen=this.now();s.replay=recordIncidentReplay(s.replay,p,s.lastSeen,p.logs);
  if(p.stats.map){(s.positionHistory??=[]).push({at:s.lastSeen,map:p.stats.map,server:p.stats.server||'',x:p.stats.x,y:p.stats.y});s.positionHistory=s.positionHistory.filter(point=>point.at>=this.now()-600000).slice(-120);}s.economy=p.economy;s.buildItems=p.buildItems;s.runtimePolicy=p.runtimePolicy;s.stats=p.stats;s.intent=p.intent;s.movement=p.movement;s.coordination=p.coordination;s.merchantTransactions=p.merchantTransactions;s.activeEffects=p.activeEffects;s.loot=p.loot;s.inventory=p.inventory;s.stand=p.stand;s.standOpen=p.standOpen;s.equipment=p.equipment;
  if(p.bank){s.bank=p.bank;s.bankAt=p.bankCapturedAt ?? this.now();}
  if(p.hunt!==undefined)s.hunt=p.hunt;
  if(p.combat)s.combat=p.combat;if(p.network)s.network=p.network;if(p.kite)s.kite=p.kite;if(p.cave)s.cave=p.cave;if(p.dragold)s.dragold=p.dragold;if(p.bankSort)s.bankSort=p.bankSort;if(p.bankHub)s.bankHub=p.bankHub;s.failures=p.failures;
  s.logs.push(...p.logs.map(message=>({time:this.now(),message})));s.logs=s.logs.slice(-100);this.persist();this.onSample?.({sessionId:s.id,character:s.character,at:s.lastSeen,stats:p.stats,combat:p.combat,loot:p.loot,economy:p.economy,farmContext:p.farmContext,stand:p.stand,inventory:p.inventory,merchantTransactions:p.merchantTransactions});return true;
 }
 enqueue(character:string,type:RuntimeCommand['type'],resolution?:UpgradeResolution){const s=Object.values(this.sessions).filter(entry=>entry.character===character&&!!entry.lastSeen&&this.now()-(entry.lastSeen||0)<20000).sort((a,b)=>(b.lastSeen||0)-(a.lastSeen||0))[0];if(!s)throw Error(`${character} must be online with fresh telemetry.`);if(type==='resolve_upgrade'){const row=s.upgradeProduction?.find(r=>r.item===resolution?.item&&r.runId===resolution?.runId&&r.pending);if(!resolution||!row||(row.action?.id||'legacy')!==resolution.actionId)throw Error('Pending action changed or is no longer reported. Refresh before resolving.');}const command={id:crypto.randomUUID(),type,createdAt:this.now(),...(resolution?{resolution}:{})};if((s.commands?.length||0)>=42)throw Error('Runtime queue is full. Wait for completion receipts.');(s.commands??=[]).push(command);this.persist();return command;}
 enqueueDeposit(character:string,selection:NonNullable<RuntimeCommand['deposit']>){
  const s=Object.values(this.sessions).filter(entry=>entry.character===character&&this.now()-(entry.lastSeen||0)<20000).sort((a,b)=>(b.lastSeen||0)-(a.lastSeen||0))[0];
  const item=s?.inventory?.find(it=>it.slot===selection.slot);
  if(!s||!item||item.name!==selection.name||item.level!==selection.level||item.quantity!==selection.quantity||item.locked||item.bound||item.name==='placeholder')throw Error('Inventory changed or item is protected. Refresh before depositing.');
  if(s.commands?.some(c=>c.type==='deposit_bank'&&c.deposit?.slot===selection.slot))throw Error('This deposit is already queued.');
  if((s.commands?.length||0)>=42)throw Error('Deposit queue is full. Wait for the merchant.');
  const command:RuntimeCommand={id:crypto.randomUUID(),type:'deposit_bank',createdAt:this.now(),deposit:selection};(s.commands??=[]).push(command);this.persist();return command;
 }
 takeCommands(character:string,ticket?:string){
  const digest=ticket?crypto.createHash('sha256').update(ticket).digest('hex'):undefined;
  const s=Object.values(this.sessions).filter(entry=>entry.character===character&&(!digest||entry.ticketHash===digest)).sort((a,b)=>(b.generation??b.createdAt)-(a.generation??a.createdAt))[0];
  if(!s)return [];const commands=s.commands||[];
  if(s.commandProtocol!==2){s.commands=[];this.persist();}
  return commands;
 }

 view(id:string|undefined){const s=id?this.sessions[id]:undefined;if(!s)return null;return {commandQueue:(s.commands||[]).map(c=>({id:c.id,type:c.type,createdAt:c.createdAt,state:'awaiting_receipt'})),commandResults:s.commandResults||[],loopGuard:s.loopGuard,eventExpedition:s.eventExpedition,compoundProgress:s.compoundProgress,incidentReplays:s.replay?.captures||[],economy:s.economy,buildItems:s.buildItems,runtimePolicy:s.runtimePolicy,id:s.id,hash:s.hash,lastSeen:s.lastSeen,live:!!s.lastSeen&&this.now()-s.lastSeen<20000,stats:s.stats,positionHistory:s.positionHistory||[],intent:s.intent,movement:s.movement,coordination:s.coordination,merchantTransactions:s.merchantTransactions,activeEffects:s.activeEffects||[],loot:s.loot,inventory:s.inventory||[],stand:s.stand,standOpen:s.standOpen,equipment:s.equipment||[],bank:s.bank,bankAt:s.bankAt,hunt:s.hunt??null,combat:s.combat,network:s.network,kite:s.kite,cave:s.cave,dragold:s.dragold,upgradeHistory:s.upgradeHistory,upgradeProduction:s.upgradeProduction,bankSort:s.bankSort,bankHub:s.bankHub,failures:s.failures||[],logs:s.logs};}
}

/** Remove only our verified trailing telemetry wrapper, including pre-marker builds.
 * A rollback must get a fresh ticket rather than replay an expired build session. */
export function withoutTelemetry(code: string, character: string): string {
 const nodes = ast(code).body;
 const node = nodes.at(-1), call = node?.expression;
 if (node?.type !== 'ExpressionStatement' || call?.type !== 'CallExpression' || call.arguments.length || call.callee?.type !== 'FunctionExpression') return code;
 const first = call.callee.body.body[0];
 if (first?.type !== 'VariableDeclaration') return code;
 const values = Object.fromEntries(first.declarations.filter((d:any) => d.id.type === 'Identifier' && d.init?.type === 'Literal').map((d:any) => [d.id.name, d.init.value]));
 if (values.expected !== character || typeof values.ticket !== 'string' || !/^[a-f0-9]{64}$/.test(values.ticket) || !/^http:\/\/127\.0\.0\.1:\d+\/api\/telemetry$/.test(values.endpoint)) return code;
 return code.slice(0, node.start);
}

export function instrument(code:string,character:string,ticket:string,port:number){
 return code+`\n; (function(){
 var endpoint=${JSON.stringify(`http://127.0.0.1:${port}/api/telemetry`)}, ticket=${JSON.stringify(ticket)}, expected=${JSON.stringify(character)};
 if(typeof character==='undefined'||character.name!==expected)return;
 ${fs.readFileSync(path.join(sourceDir,'runtime-command-inbox.js'),'utf8')}
 var queue=[],sequence=Date.now(),pending=false,startedAt=Date.now(),lastSample=Date.now(),wasRip=false,failures=[];
 var loot;
 try{if(character.on){loot={gold:0,items:[]};character.on('loot',function(event){var amount=Number(event&&event.gold);if(isFinite(amount)&&amount>0)loot.gold+=amount;(event&&Array.isArray(event.items)?event.items:[]).forEach(function(it){if(!it||it.looter!==expected||!it.name)return;var quantity=Math.max(1,Math.floor(Number(it.q)||1)),level=Math.max(0,Math.min(20,Number(it.level)||0));var row=loot.items.filter(function(row){return row.name===it.name&&row.level===level;})[0];if(row)row.quantity=Math.min(999999999,row.quantity+quantity);else if(loot.items.length<500)loot.items.push({name:String(it.name).slice(0,80),level:level,quantity:quantity});});});}}catch(e){loot=undefined;}
 var runtimeIntent={state:'Starting',since:Date.now(),updatedAt:Date.now(),map:String(character.map||''),target:'',destination:null,blockedBy:null};
 var combat={startedAt:startedAt,damageDealt:0,damageTakenPhysical:0,damageTakenMagical:0,healing:0,manaRestored:0,kills:0,deaths:0,attacks:0,potions:0,movingMs:0,combatMs:0,healerCoverageMs:0,kiteMoves:0};
 ${analysisTelemetry}
 function add(message){try{var text=typeof message==='string'?message:JSON.stringify(message);if(!text)text=String(message);queue.push(text.slice(0,500));if(queue.length>20)queue.shift();}catch(e){try{queue.push(String(message).slice(0,500));}catch(ignore){}}}
 if(typeof game_log==='function'){var original=game_log;game_log=function(){add(arguments[0]);return original.apply(this,arguments);};}
 if(typeof set_message==='function'){var originalSetMessage=set_message;set_message=function(message){var next=String(message||'Idle').slice(0,120);if(next!==runtimeIntent.state){runtimeIntent.state=next;runtimeIntent.since=Date.now();}runtimeIntent.updatedAt=Date.now();return originalSetMessage.apply(this,arguments);};}
 if(typeof window!=='undefined'){window.addEventListener('error',function(e){add('ERROR: '+e.message);});window.addEventListener('unhandledrejection',function(e){add('ERROR: '+String(e.reason));});}
 add('Command Center: script initialization completed.');
 function category(def){var t=String((def&&def.type)||'');if(t==='pot')return 'Potions';if(t==='elixir')return 'Elixirs';if(t==='scroll')return 'Scrolls';if(['weapon','shield','source'].indexOf(t)>=0)return 'Weapons';if(['helmet','chest','pants','shoes','gloves','cape'].indexOf(t)>=0)return 'Armor';if(['ring','earring','amulet','belt','orb'].indexOf(t)>=0)return 'Accessories';if(def&&(def.e||def.exchange))return 'Exchangeables';if(['material','token','box','gem','misc'].indexOf(t)>=0)return 'Materials';return 'Other';}
 try{if(typeof parent!=='undefined'&&parent.socket&&parent.socket.on){parent.socket.on('hit',function(d){var damage=Number(d.damage)||0;if(d.hid===expected){combat.attacks++;combat.damageDealt+=damage;combat.healing+=Number(d.heal||d.lifesteal)||0;combat.manaRestored+=Number(d.manasteal)||0;}if(d.id===expected){if(d.source==='magic'||d.damage_type==='magical')combat.damageTakenMagical+=damage;else combat.damageTakenPhysical+=damage;}});parent.socket.on('kill_credit',function(){combat.kills++;});}}catch(e){}
 function sample(){var now=Date.now(),dt=Math.min(1000,now-lastSample);lastSample=now;if(character.moving)combat.movingMs+=dt;if(character.target)combat.combatMs+=dt;var priest=null,inHealRange=false;try{priest=typeof get_player==='function'&&get_player('Aedroma');inHealRange=!!priest&&Math.hypot(character.x-priest.x,character.y-priest.y)<=(priest.range||160);if(inHealRange)combat.healerCoverageMs+=dt;}catch(e){}if(character.rip&&!wasRip){combat.deaths++;var attackers=0;try{var es=(typeof parent!=='undefined'&&parent.entities)||{};Object.keys(es).forEach(function(k){if(es[k]&&es[k].type==='monster'&&es[k].target===character.name)attackers++;});}catch(e){}var reason='burst damage',details='Death occurred during combat.';if(!priest) {reason='healer unavailable';details='Priest was not visible on the same map.';}else if(!inHealRange){reason='healer out of range';details='Outside the priest healing radius at death.';}else if(attackers>=3){reason='excessive monster count';details=attackers+' monsters were targeting this character.';}else if(typeof ALCombat!=='undefined'&&ALCombat.phase&&ALCombat.phase()==='engage'){reason='lost aggro / re-engagement';details='Death occurred while restoring tank control.';}failures.push({at:now,reason:reason,details:details});if(failures.length>10)failures.shift();add('FAILURE: '+reason+' — '+details);}wasRip=!!character.rip;try{if(typeof ALCombat!=='undefined'&&ALCombat.metrics)combat.kiteMoves=ALCombat.metrics.kiteMoves||0;}catch(e){}}
 setInterval(sample,250);
 function pulse(){
  if(pending)return;pending=true;
  var c=character,logs=queue.splice(0,20),controller=new AbortController();
  var inventory=[];(c.items||[]).forEach(function(it,slot){if(!it)return;var def=(typeof G!=='undefined'&&G.items&&G.items[it.name])||{};inventory.push({slot:slot,name:it.name,level:it.level||0,quantity:it.q||1,locked:!!it.l,bound:!!it.b,upgradeable:!!def.upgrade,sellable:!it.l&&!it.b&&!def.untradeable,transferAllowed:(function(){try{return typeof is_dumpable_slot==='function'?!!is_dumpable_slot(slot):typeof is_protected_item==='function'?!is_protected_item(it):undefined;}catch(e){return undefined;}})(),transferReason:(function(){try{if(typeof is_dumpable_slot!=='function'&&typeof is_protected_item!=='function')return undefined;var allowed=typeof is_dumpable_slot==='function'?!!is_dumpable_slot(slot):!is_protected_item(it);if(it.l)return 'Locked item';if(allowed)return 'Running policy permits transfer';var cfg=typeof CONFIG!=='undefined'?CONFIG:{};var rules=cfg.LOADOUT_ITEMS||[];for(var k=0;k<rules.length;k++){if(rules[k].item===it.name&&(it.level||0)>=(rules[k].minLevel||0))return 'Deployed loadout reserves this item at +'+(rules[k].minLevel||0)+' or higher';}if(/^hpot|^mpot/.test(it.name))return 'Potion supply';if(/^elixir/.test(it.name))return 'Elixir supply';if(it.name==='alloyquiver'||it.name==='quiver'&&(it.level||0)>0)return 'Improved quiver reservation';if(it.name==='tracker'||it.name==='ecape')return 'Utility equipment reservation';if((cfg.KEEP_ITEMS||[]).indexOf(it.name)>=0)return 'Default KEEP_ITEMS reservation / carried-copy quota';return 'Running retention policy (supplies or equipment quota)';}catch(e){return undefined;}})()});});
  var stand=[];for(var sn=1;sn<=30;sn++){var si=(c.slots||{})['trade'+sn];if(si&&si.name)stand.push({slot:sn,name:si.name,level:si.level||0,quantity:si.q||1,price:si.price||0,buy:!!si.b});}
  var equipment=[];var slots=c.slots||{};Object.keys(slots).forEach(function(key){if(key.indexOf('trade')===0)return;var si=slots[key];if(!si||!si.name)return;var row={slot:key,name:si.name,level:si.level||0,quantity:si.q||1};if(si.shiny)row.shiny=true;equipment.push(row);});
  var bank=[],bankAvailable=false,bankCapturedAt=Date.now();
  try{
   var b=c.bank;
   if(!b&&typeof ALCCBankSorter!=='undefined'&&ALCCBankSorter.bankSnapshot){var finalBank=ALCCBankSorter.bankSnapshot();if(finalBank){b=finalBank.bank;bankCapturedAt=finalBank.at;}}
   if(b){bankAvailable=true;
    for(var pack in b){
     if(pack==='gold')continue;
     var list=b[pack];
     if(!list)continue;
     if(typeof list.length==='number'){
      for(var bi=0;bi<list.length;bi++){
       var bit=list[bi];
       if(!bit||!bit.name)continue;
       bank.push({pack:String(pack),slot:bi,name:bit.name,level:bit.level||0,quantity:bit.q||1,category:category((typeof G!=='undefined'&&G.items&&G.items[bit.name])||{})});
      }
     }else{
      for(var bk in list){
       if(!Object.prototype.hasOwnProperty.call(list,bk))continue;
       var bn=+bk;
       if(bk!==String(bn))continue;
       var bit2=list[bk];
       if(!bit2||!bit2.name)continue;
       bank.push({pack:String(pack),slot:bn,name:bit2.name,level:bit2.level||0,quantity:bit2.q||1,category:category((typeof G!=='undefined'&&G.items&&G.items[bit2.name])||{})});
      }
     }
    }
   }
  }catch(e){}
  if(bank.length>500)bank=bank.slice(0,500);
  var activeEffects=[];
  try{var effects=c.s||{};Object.keys(effects).sort().forEach(function(id){if(id==='monsterhunt'||activeEffects.length>=64)return;var effect=effects[id];if(!effect)return;var row={id:String(id).slice(0,80)};var effectMs=Number(effect&&effect.ms);if(isFinite(effectMs)&&effectMs>=0)row.ms=effectMs;activeEffects.push(row);});}catch(e){}
  var hunt=null;
  try{
   var mh=c.s&&c.s.monsterhunt;
   if(mh&&mh.id){
    hunt={id:String(mh.id),count:typeof mh.c==='number'&&isFinite(mh.c)?mh.c:0};
    if(typeof mh.ms==='number'&&isFinite(mh.ms)&&mh.ms>=0)hunt.ms=mh.ms;
   }
  }catch(e){}
  var timeout=setTimeout(function(){controller.abort();},4000);
  function n(v){return typeof v==='number'&&isFinite(v)?v:0;}
  var kd={active:false,threats:[],candidates:[]};try{if(typeof ALCombat!=='undefined'&&ALCombat.debug)kd=ALCombat.debug()||kd;}catch(e){}
  var caveSnap=undefined;try{if(typeof CaveDreams!=='undefined'&&CaveDreams.snapshot)caveSnap=CaveDreams.snapshot();}catch(e){}
  var dragoldSnap=undefined;try{if(typeof DragoldIntel!=='undefined'&&DragoldIntel.snapshot)dragoldSnap=DragoldIntel.snapshot();}catch(e){}
  var bankSortSnap=undefined;try{if(typeof ALCCBankSorter!=='undefined'&&ALCCBankSorter.snapshot)bankSortSnap=ALCCBankSorter.snapshot();}catch(e){}
  var movementSnap=undefined;try{if(typeof MovementWatchdog!=='undefined'&&MovementWatchdog.snapshot)movementSnap=MovementWatchdog.snapshot();}catch(e){}
  var coordinationSnap=undefined;try{if(typeof TeamCoordinator!=='undefined'&&TeamCoordinator.snapshot)coordinationSnap=TeamCoordinator.snapshot();}catch(e){}
  var merchantTransactionsSnap=undefined;try{if(typeof MerchantTransactions!=='undefined'&&MerchantTransactions.snapshot)merchantTransactionsSnap=MerchantTransactions.snapshot();}catch(e){}
  runtimeIntent.map=String(c.map||'');runtimeIntent.target=String(c.target||'');runtimeIntent.blockedBy=c.rip?'dead':null;runtimeIntent.destination=null;try{if(typeof smart!=='undefined'&&smart&&smart.moving)runtimeIntent.destination={map:String(smart.map||c.map||''),x:n(smart.x),y:n(smart.y)};}catch(e){}
  if(movementSnap&&['stalled','recovering','blocked'].indexOf(movementSnap.state)>=0)runtimeIntent.blockedBy=('movement '+movementSnap.state+(movementSnap.lastAction?' — '+movementSnap.lastAction:'')).slice(0,120);
  if(runtimeIntent.state==='Starting'||Date.now()-runtimeIntent.updatedAt>10000){var inferred=c.rip?'Dead':runtimeIntent.destination?'Moving':c.target?'Combat':'Idle';if(inferred!==runtimeIntent.state){runtimeIntent.state=inferred;runtimeIntent.since=Date.now();}}
  var farmSnap;try{var entity=typeof parent!=='undefined'&&parent.entities&&parent.entities[c.target];var party=typeof parent!=='undefined'&&parent.party||{};var participants=Object.keys(party).filter(function(name){return typeof CONFIG==='undefined'||name!==CONFIG.MERCHANT;});if(participants.indexOf(expected)<0)participants.push(expected);var expeditionPhase;try{expeditionPhase=typeof EventExpedition!=='undefined'&&EventExpedition.snapshot().phase;}catch(e){}farmSnap={activity:c.cave?'cave':c.ctype&&c.ctype!=='merchant'?(['forming','engaging','returning'].indexOf(expeditionPhase)>=0||${JSON.stringify(expeditionBosses)}.indexOf(entity&&entity.mtype)>=0?'events':'farming'):undefined,monster:String(entity&&entity.mtype||''),participants:participants.sort().slice(0,20),build:JSON.stringify(equipment.map(function(it){return [it.slot,it.name,it.level];}).sort()),effects:activeEffects.map(function(it){return it.id;}).sort(),goldMultiplier:n(c.goldm||1)};}catch(e){}
  var policySnap;try{if(typeof RuntimePolicy!=='undefined')policySnap=RuntimePolicy.snapshot();}catch(e){}
  try{if(typeof EventExpedition!=='undefined'&&EventExpedition.observeMetrics)EventExpedition.observeMetrics(combat,loot);}catch(e){}
  var trackerSnap;try{var tr=parent.tracker;if(tr&&tr.monsters){trackerSnap={monsters:{},exchanges:{}};['monsters','exchanges'].forEach(function(key){Object.keys(tr[key]||{}).slice(0,500).forEach(function(id){var value=Number(tr[key][id]);if(isFinite(value)&&value>=0)trackerSnap[key][id]=value;});});}}catch(e){}
  var payload={commandProtocol:2,commandReceipts:RuntimeCommandInbox.receipts(),bankHub:typeof BankCoordinator!=='undefined'?BankCoordinator.snapshot():undefined,loopGuard:typeof MerchantLoopGuard!=='undefined'?MerchantLoopGuard.snapshot():undefined,eventExpedition:typeof EventExpedition!=='undefined'?EventExpedition.snapshot():undefined,compoundProgress:typeof CompoundProduction!=='undefined'&&CompoundProduction.snapshot?CompoundProduction.snapshot():undefined,economy:economy,buildItems:analysisItems(),runtimePolicy:policySnap,ticket:ticket,character:expected,sequence:sequence++,stats:{maxXp:isFinite(Number(c.max_xp))?Number(c.max_xp):undefined,cc:isFinite(Number(c.cc))?Number(c.cc):undefined,attack:n(c.attack),frequency:n(c.frequency),speed:n(c.speed),range:n(c.range),tracker:trackerSnap,skin:String(c.skin||''),hp:n(c.hp),max_hp:n(c.max_hp),mp:n(c.mp),max_mp:n(c.max_mp),gold:n(c.gold),xp:n(c.xp),level:n(c.level),map:String(c.map||''),x:n(c.x),y:n(c.y),target:String(c.target||''),server:(function(){try{if(typeof parent!=='undefined'&&parent){if(parent.server_region&&parent.server_name)return String(parent.server_region)+' '+String(parent.server_name);if(parent.server_identifier)return String(parent.server_identifier);}return '';}catch(e){return ''}})(),armor:n(c.armor),resistance:n(c.resistance),evasion:n(c.evasion),goldMultiplier:n(c.goldm||1),luckMultiplier:n(c.luckm||1),xpMultiplier:n(c.xpm||1)},intent:runtimeIntent,movement:movementSnap,coordination:coordinationSnap,merchantTransactions:merchantTransactionsSnap,activeEffects:activeEffects,loot:loot,farmContext:farmSnap,inventory:inventory,stand:stand,standOpen:!!c.stand,equipment:equipment,hunt:hunt,combat:combat,network:(function(){try{var raw=Number(c.ping||(typeof parent!=='undefined'&&(parent.ping||parent.last_ping))||0);return {pingMs:isFinite(raw)&&raw>=0?raw:0,socketConnected:!!(typeof parent!=='undefined'&&parent.socket&&parent.socket.connected!==false)};}catch(e){return {pingMs:0,socketConnected:false};}})(),kite:kd,cave:caveSnap,dragold:dragoldSnap,upgradeHistory:(typeof UpgradeProduction!=='undefined'?UpgradeProduction.history():undefined),upgradeProduction:(typeof UpgradeProduction!=='undefined'?UpgradeProduction.snapshot():undefined),bankSort:bankSortSnap,failures:failures,logs:logs};
  if(bankAvailable){payload.bank=bank;payload.bankCapturedAt=bankCapturedAt;}
  try{fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify(payload)}).then(function(response){return response.json();}).then(function(data){RuntimeCommandInbox.receive((data&&data.commands)||[]);}).catch(function(){}).finally(function(){clearTimeout(timeout);pending=false;});}catch(e){clearTimeout(timeout);pending=false;}
 }
 pulse();setInterval(pulse,5000);
})();\n`;
}

