import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {scripts,initialProfile,sourceDir,ast,variables,seedWeaponStyles} from '../server/scripts';
import {adaptSource,buildBundle,effectiveConfig,validateProfile,merchantStandBody,merchantConsumablesBody} from '../server/builder';
import {profileSchema,worldBosses,formatDuration} from '../shared/schema';
const list=scripts();
function setup(name='Eadroma') {const p=initialProfile(list);const c=p.characters.find(c=>c.name===name)!;const s=list.find(s=>s.id===c.script)!;const source=fs.readFileSync(path.join(sourceDir,s.filename),'utf8');return{p,c,s,source};}
function fn(code:string,name:string,context:Record<string,unknown>={}){const node=ast(code).body.find((n:any)=>n.type==='FunctionDeclaration'&&n.id.name===name);return vm.runInNewContext(`(${code.slice(node.start,node.end)})`,context);}
describe('profile configuration',()=>{
 it('rejects follow cycles, including multi-character loops',()=>{const {p}=setup();p.characters[0].follow='Droma';expect(profileSchema.safeParse(p).success).toBe(false);});
 it('rejects incompatible scripts and unmanaged field types',()=>{const {p,c}=setup();c.script='droma-ranger';expect(()=>validateProfile(p,list)).toThrow('compatible');c.script='eadroma-warrior';c.overrides={HP_POT_RATIO:3};expect(()=>validateProfile(p,list)).toThrow('between 0 and 1');});
 it('retains standalone trade-sell target and user settings',()=>{const {p,c}=setup();c.script='stand-sell';c.overrides={MERCHANT:'TestBuyer',MIN_PRICE:50};const s=list.find(s=>s.id==='stand-sell')!;validateProfile(p,list);expect(effectiveConfig(p,c,s).MERCHANT).toBe('TestBuyer');});
 it('allows stand listings regardless of source NEVER_SELL tables',()=>{const {p}=setup();p.seller.listings=[{item:'ololipop',level:0,price:1100000},{item:'fireblade',level:0,price:100}];expect(()=>validateProfile(p,list)).not.toThrow();});
 it('allows upgrade rules for items the source marked NEVER_UPGRADE',()=>{const {p}=setup();p.seller.upgrade.rules=[{item:'wcap',maxLevel:7}];expect(()=>validateProfile(p,list)).not.toThrow();});
 it('defaults and injects a configurable stand park spot',async()=>{const {p}=setup('EadroSell');expect(p.seller.standSpot).toEqual({map:'main',x:-100,y:-20});p.seller.standSpot={map:'main',x:80,y:-20};const built=await buildBundle(p,'EadroSell');expect(built.code).toMatch(/"standSpot"\s*:\s*\{\s*"map"\s*:\s*"main"\s*,\s*"x"\s*:\s*80\s*,\s*"y"\s*:\s*-20\s*\}/);expect(built.code).toContain('SHOP_XY.market');expect(built.code).toContain('__ALCC.standSpot');});
 it('injects the advanced stand tick into the merchant v2 loop',async()=>{const {p}=setup('EadroSell');const built=await buildBundle(p,'EadroSell');expect(built.code).toContain('shopHasListings');expect(built.code).toContain('configured listings');expect(built.code).toContain('maybe_keep_shop');expect(built.code).toContain('maybe_restock_listing_from_bank');});
 it('loads the merchant transaction engine before runtime loops and journals stand work',async()=>{const {p}=setup('EadroSell');const built=await buildBundle(p,'EadroSell');expect(built.code.indexOf('var MerchantTransactions')).toBeLessThan(built.code.indexOf('async function teamStartLoop'));expect(built.code).toContain("MerchantTransactions.begin(\"stand_buy\"");expect(built.code).toContain("MerchantTransactions.begin(\"stand_sell\"");});
 it('adds merchant defaults to existing saved profiles without losing NPC rules',()=>{const {p}=setup();const old=JSON.parse(JSON.stringify(p));delete old.seller.exchange;delete old.seller.upgrade;delete old.seller.standSpot;delete old.seller.bankDeposit;const restored=profileSchema.parse(old);expect(restored.seller.npcItems).toEqual(p.seller.npcItems);expect(restored.seller.exchange.items).toContain('gem0');expect(restored.seller.upgrade.rules.some(r=>r.item==='hpants'&&r.maxLevel===7)).toBe(true);expect(restored.seller.standSpot).toEqual({map:'main',x:-100,y:-20});expect(restored.seller.bankDeposit).toEqual({enabled:true,items:[]});});
 it('injects a strict recurring bank allowlist into merchant builds',async()=>{const {p}=setup('EadroSell');p.seller.bankDeposit={enabled:true,items:['seashell','feather0']};const built=await buildBundle(p,'EadroSell');expect(built.code).toMatch(/"bankDeposit"\s*:\s*\{\s*"enabled"\s*:\s*true\s*,\s*"items"\s*:\s*\[\s*"seashell"\s*,\s*"feather0"\s*\]/);});
 it('migrates legacy upgrade items+maxLevel into per-item rules',()=>{const restored=profileSchema.parse({name:'Legacy',server:{region:'EU',name:'III'},characters:[{name:'EadroSell',ctype:'merchant',enabled:true,runtime:'browser',script:'eadrosell-merchant',follow:'',events:false,job:'hunt',overrides:{}}],farming:{defaultMonster:'goo',hunts:false,allowedHunts:[],rareVisits:false,style:{}},events:{enabled:false,allowed:[],style:{}},seller:{npcEnabled:true,npcItems:[],standEnabled:false,listings:[],upgrade:{enabled:true,items:['fireblade','hpants'],maxLevel:9}}});expect(restored.seller.upgrade.rules).toEqual([{item:'fireblade',maxLevel:9},{item:'hpants',maxLevel:9}]);expect(restored.seller.upgrade.minGold).toBe(0);expect(restored.seller.ponty.minGold).toBe(200000);});
 it('seeds missing AOE/Mono from warrior WEAPONS.pack without clobbering picks',()=>{
  const {p}=setup();
  p.farming.allowedHunts=['booboo','bat','bee'];
  p.farming.style={bat:'aoe'};
  const seeded=seedWeaponStyles(p,list);
  expect(seeded.farming.style.booboo).toBe('mono');
  expect(seeded.farming.style.bee).toBe('aoe');
  expect(seeded.farming.style.bat).toBe('aoe');
  expect(seeded.events.style.crabxx).toBe('mono');
  expect(seeded.events.style.goobrawl).toBe('aoe');
 });
 it('persists custom Ponty lists through profile parse',()=>{
  const {p}=setup();
  p.seller.ponty={enabled:true,minGold:150000,items:['fireblade','shield']};
  const round=profileSchema.parse(JSON.parse(JSON.stringify(p)));
  expect(round.seller.ponty.items).toEqual(['fireblade','shield']);
  expect(round.seller.ponty.minGold).toBe(150000);
 });
 it('maps exchange enablement, minimums and upgrade targets into CONFIG',()=>{const {p,c,s}=setup('EadroSell');p.seller.exchange.items=['gem0'];p.seller.exchange.minimum={gem0:5};p.seller.upgrade.rules=[{item:'hpants',maxLevel:5},{item:'fireblade',maxLevel:9}];p.seller.upgrade.minGold=75000;p.seller.ponty={enabled:true,minGold:250000,items:['ololipop']};let config=effectiveConfig(p,c,s);expect(config.EXCHANGE_ITEMS).toEqual(['gem0']);expect(config.EXCHANGE_MIN).toEqual({gem0:5});expect(config.UPGRADE_MAX).toBe(9);expect(config.UPGRADE_GOLD_MIN).toBe(75000);expect(config.PONTY_GOLD_KEEP).toBe(250000);p.seller.exchange.enabled=false;config=effectiveConfig(p,c,s);expect(config.EXCHANGE_ITEMS).toEqual([]);});
});
describe('generated code behavior',()=>{
 it('does not keep the merchant stand closed for an upgrade that cannot run',()=>{
  const {source}=setup('EadroSell');
  const context:any={
   character:{items:[{name:'fireblade',level:4}]},
   locate_upgrade_item:()=>0,
   upgrade_scroll_for:()=> 'scroll1',
   item_count:()=>0,
   find_compound_set:()=>null,
   next_upgrade_purchase:()=>null,
  };
  expect(fn(source,'upgrade_work_pending',context)()).toBe(false);
  context.item_count=()=>1;
  expect(fn(source,'upgrade_work_pending',context)()).toBe(true);
 });
 it('holds a recurring boss pull until the priest reaches the warrior',()=>{
  const {source}=setup('Eadroma');
  const context:any={
   boss_peek:{phase:'dragold'},
   CONFIG:{PRIEST:'Aedroma',movement:{priestMaxDist:350}},
   character:{name:'Eadroma'},
   cache:{alliesUnderAttack:[]},
   is_team_ready_for_hunt:()=>false,
  };
  const waits=fn(source,'recurring_boss_waiting_for_priest',context);
  expect(waits({mtype:'dragold'})).toBe(true);
  expect(waits({mtype:'dragold',target:'Eadroma'})).toBe(false);
  expect(waits({mtype:'jr'})).toBe(false);
  context.is_team_ready_for_hunt=()=>true;
  expect(fn(source,'recurring_boss_waiting_for_priest',context)({mtype:'dragold'})).toBe(false);
 });
 it('checks the recurring-boss priest barrier before honoring an active smart move',()=>{
  const {source}=setup('Eadroma');
  const movement=fn(source,'movementLoop').toString();
  expect(movement.indexOf('recurring_boss_waiting_for_priest(target)')).toBeLessThan(movement.indexOf('if (smart.moving)'));
  expect(movement).toContain('if (smart.moving || character.moving) stop()');
 });
 it('banks only items explicitly present in the dashboard allowlist',()=>{
  const {source}=setup('EadroSell');
  const context:any={__ALCC:{bankDeposit:{enabled:true,items:['seashell']}},CONFIG:{BANK_NEVER:{}},upgrade_target_complete:()=>false,is_protected_item:()=>false,cc_upgrade_enabled:()=>false};
  const shouldBank=fn(source,'should_bank_item',context);
  expect(shouldBank({name:'seashell',level:0})).toBe(true);
  expect(shouldBank({name:'fireblade',level:8})).toBe(false);
  context.__ALCC.bankDeposit.items=[];
  expect(shouldBank({name:'seashell',level:0})).toBe(false);
  context.__ALCC.bankDeposit.enabled=false;
  context.__ALCC.bankDeposit.items=['seashell'];
  expect(shouldBank({name:'seashell',level:0})).toBe(false);
 });
 it('starts an allowlisted bank deposit without waiting for a full bag',()=>{
  const {source}=setup('EadroSell');
  const loop=fn(source,'townChoresLoop').toString();
  expect(loop).toContain('has_bankable && !same_failure_backoff');
  expect(loop).not.toContain('has_bankable && bag_is_full()');
  expect(loop).toContain('last_bank_failure_signature');
  expect(loop).toContain('!immediate_bankable && sell_slot >= 0');
  expect(loop).toContain('!immediate_bankable && await run_next_craft()');
 });
 it('finds bank capacity across every floor without treating unloaded packs as empty',()=>{
  const {source}=setup('EadroSell');
  const full=Array.from({length:42},()=>({name:'seashell',level:0,q:1}));
  const context:any={character:{map:'bank',bank:{items0:full,items8:full,items24:[]}},G:{items:{seashell:{s:1}}},game_log:()=>{}};
  context.get_available_bank_packs=fn(source,'get_available_bank_packs',context);
  const hasSpace=fn(source,'has_bank_space',context);
  const findSlot=fn(source,'find_empty_bank_slot',context);
  const floor=fn(source,'bank_pack_floor',context);
  expect(hasSpace()).toBe(true);
  expect(findSlot({name:'seashell',level:0,q:1})).toEqual({pack:'items24',slot:0,merge:false});
  expect(floor('items24')).toBe('bank_u');
  context.character.bank={items0:[{name:'leather',level:0,q:120}]};
  context.G.items.leather={s:9999};
  expect(findSlot({name:'leather',level:0,q:3})).toEqual({pack:'items0',slot:0,merge:true});
  expect(source).toContain('await bank_store(best_i, bslot.pack);');
  expect(source).not.toContain('await bank_store(best_i, bslot.pack, bslot.slot);');
  context.character.bank={items0:full,items8:full};
  expect(hasSpace()).toBe(false);
 });
 it('uses one awaited smart-move bank transition instead of door polling',()=>{
  const {source}=setup('EadroSell');
  const start=source.indexOf('async function townChoresLoop');
  const end=source.indexOf('// ============================================================================\n// 9. UPGRADE LOOP',start);
  const loop=source.slice(start,end);
  expect(loop).toContain('await smart_move("bank")');
  expect(loop).not.toContain('await use_nearest_door()');
  expect(loop).toContain('if (chores_in_progress && !bank_dump_active)');
 });
 it('caps warrior hunt deaths and abandons the contract at the configured limit',()=>{
  const {p,c,s,source}=setup('Eadroma');
  const {code}=adaptSource(source,p,c,s);
  let now=1_000_000;
  const logs:string[]=[];
  const saved:any[]=[];
  const ctx:any={
   CONFIG:{hunts:{maxWipes:3,wipeTimeoutMs:60_000},HUNT_WIPE_MAX:3},
   HUNT_ALLOW:{booboo:1},hunt_wipes:{booboo:{n:2,until:now+60_000,last:0}},
   Date:{now:()=>now},set:(key:string,value:any)=>saved.push([key,value]),game_log:(message:string)=>logs.push(message),
  };
  ctx.active_hunt_wipe=fn(code,'active_hunt_wipe',ctx);
  ctx.note_hunt_wipe=fn(code,'note_hunt_wipe',ctx);
  ctx.hunt_should_try=fn(code,'hunt_should_try',ctx);
  expect(ctx.note_hunt_wipe('booboo')).toBe(3);
  expect(ctx.hunt_wipes.booboo.n).toBe(3);
  expect(ctx.hunt_should_try('booboo')).toBe(false);
  now+=31_000;
  expect(ctx.note_hunt_wipe('booboo')).toBe(3);
  expect(ctx.hunt_wipes.booboo.n).toBe(3);
  expect(logs.filter(message=>message.includes('contrat ignore')).length).toBe(1);
  expect(saved.length).toBeGreaterThan(0);
 });
 it('resets an expired hunt failure window before counting a new death',()=>{
  const {p,c,s,source}=setup('Eadroma');
  const {code}=adaptSource(source,p,c,s);
  const now=2_000_000;
  const ctx:any={CONFIG:{hunts:{maxWipes:3,wipeTimeoutMs:60_000},HUNT_WIPE_MAX:3},hunt_wipes:{bat:{n:40,until:now-1,last:now-90_000}},Date:{now:()=>now},set:()=>{},game_log:()=>{}};
  ctx.active_hunt_wipe=fn(code,'active_hunt_wipe',ctx);
  ctx.note_hunt_wipe=fn(code,'note_hunt_wipe',ctx);
  expect(ctx.note_hunt_wipe('bat')).toBe(1);
  expect(ctx.hunt_wipes.bat.n).toBe(1);
 });
 it('excludes an abandoned hunt from targeting and falls back to a safe monster',()=>{
  const {p,c,s,source}=setup('Eadroma');
  const {code}=adaptSource(source,p,c,s);
  const ctx:any={
   character:{name:'Eadroma'},CONFIG:{PRIEST:'Aedroma'},
   cache:{target:null,priestEntity:null,alliesUnderAttack:[],monstersInCleaveRange:[],mobCount:0,partyMembers:[],lastUpdate:0,ttl:0},
   G:{skills:{cleave:{range:160}}},Date:{now:()=>100},get_player:()=>null,get_party:()=>({Eadroma:{}}),
   farm_monster:()=> 'crab',abandoned_hunt_id:()=> 'booboo',distance:(_:any,e:any)=>e.distance,
   parent:{entities:{danger:{type:'monster',mtype:'booboo',visible:true,dead:false,target:'Eadroma',distance:5},safe:{type:'monster',mtype:'crab',visible:true,dead:false,target:null,distance:20}}},
  };
  const update=fn(code,'updateCache',ctx);
  update();
  expect(ctx.cache.target.mtype).toBe('crab');
  expect(ctx.cache.mobCount).toBe(1);
  expect(ctx.cache.monstersInCleaveRange.map((mob:any)=>mob.mtype)).toEqual(['crab']);
  const fallback=fn(code,'hunt_fallback_monster',{CONFIG:{DEFAULT_FARM:'crab'}});
  expect(fallback('crab')).toBe('goo');
  expect(fallback('booboo')).toBe('crab');
 });
 it('changes hunt/default settings and disables old control polling without modifying source',async()=>{const {p,c,s,source}=setup();p.farming.defaultMonster='crab';p.farming.allowedHunts=['crab'];p.farming.hunts=false;p.farming.rareVisits=false;const {code}=adaptSource(source,p,c,s);const vars=variables(code);expect((vars.CONFIG as any).DEFAULT_FARM).toBe('crab');expect(vars.HUNT_ALLOW).toEqual({crab:1});const huntFnName = code.includes("function hunt_should_try") ? "hunt_should_try" : "maybe_daisy"; expect(fn(code, huntFnName)()).toBe(false);expect(fn(code,'pick_party_hunt')()).toBe(null);expect(fn(code,'poll_board')()).toBeUndefined();expect(fs.readFileSync(path.join(sourceDir,s.filename),'utf8')).toBe(source);});
 it('uses a character farm target independently from the party hunt',()=>{const {p,c,s}=setup('Droma');p.farming.defaultMonster='stoneworm';c.farmMonster='cgoo';const config=effectiveConfig(p,c,s) as any;expect(config.DEFAULT_FARM).toBe('cgoo');expect(config.FARM_INDEPENDENT).toBe(true);const warrior=p.characters.find(x=>x.name==='Eadroma')!;const warriorScript=list.find(x=>x.id===warrior.script)!;expect((effectiveConfig(p,warrior,warriorScript) as any).DEFAULT_FARM).toBe('stoneworm');});
 it('injects AOE style for the everyday farm even when the hunt list did not set it',()=>{
  const {p,c,s}=setup('Droma');
  p.farming.defaultMonster='crab';
  p.farming.style={};
  const config=effectiveConfig(p,c,s) as any;
  expect(config.PACK_STYLE.crab).toBe('aoe');
  p.farming.style={crab:'mono'};
  expect((effectiveConfig(p,c,s) as any).PACK_STYLE.crab).toBe('mono');
  p.farming.style={crab:'tank'};
  expect((effectiveConfig(p,c,s) as any).PACK_STYLE.crab).toBe('tank');
 });
 it('injects per-character AOE/Mono/Tank loadouts and keeps tank off AOE shots',()=>{
  const {p,c,s,source}=setup('Droma');
  p.farming.style={crab:'tank'};
  p.farming.loadouts={Droma:{aoe:{gear:[],skills:['5shot']},mono:{gear:[],skills:[]},tank:{gear:[{slot:'mainhand',item:'firebow',minLevel:5}],skills:['supershot','huntersmark']}}};
  const cfg=effectiveConfig(p,c,s) as any;
  expect(cfg.PACK_STYLE.crab).toBe('tank');
  expect(cfg.STYLE_LOADOUTS.tank.skills).toEqual(['supershot','huntersmark']);
  expect(cfg.STYLE_LOADOUTS.tank.gear[0].item).toBe('firebow');
  const {code}=adaptSource(source,p,c,s);
  expect(code).toContain('var StyleLoadout');
  expect((effectiveConfig(p,p.characters.find(x=>x.name==='Eadroma')!,list.find(x=>x.id==='eadroma-warrior')!) as any).WEAPONS.pack.crab).toBe('fireblade');
 });
 it('wires merchant TEAM_SLOTS so start_character can launch every farmer',()=>{
  const {p,c,s,source}=setup('EadroSell');
  const cfg=effectiveConfig(p,c,s) as any;
  expect(cfg.TEAM_SLOTS).toEqual({Eadroma:'CC_Eadroma',Aedroma:'CC_Aedroma',Droma:'CC_Droma'});
  expect(cfg.FARMERS).toEqual(expect.arrayContaining(['Eadroma','Aedroma','Droma']));
  const {code,warnings}=adaptSource(source,p,c,s);
  expect(code).toContain('fn(name, slot)');
  expect(code).toContain('"CC_Eadroma"');
  expect(code).toContain('"CC_Aedroma"');
  expect(code).toContain('"CC_Droma"');
  expect(warnings.some(w=>w.includes('start_character')&&w.includes('Aedroma'))).toBe(true);
  const warrior=setup('Eadroma');
  expect(adaptSource(warrior.source,warrior.p,warrior.c,warrior.s).code).toContain('function maybe_start_team() {return false;}');
 });
 it('limits and disables merchant team supervision from the profile',()=>{
  const {p,c,s}=setup('EadroSell');
  p.seller.teamSupervisor={enabled:true,characters:['Droma']};
  let cfg=effectiveConfig(p,c,s) as any;
  expect(cfg.TEAM_SLOTS).toEqual({Droma:'CC_Droma'});
  expect(cfg.TEAM_SUPERVISOR_ENABLED).toBe(true);
  p.seller.teamSupervisor.enabled=false;
  cfg=effectiveConfig(p,c,s) as any;
  expect(cfg.TEAM_SUPERVISOR_ENABLED).toBe(false);
 });
 it('starts a selected standalone rogue instead of the ranger',()=>{
  const {p,c,s}=setup('EadroSell');
  p.seller.teamSupervisor={enabled:true,characters:['Dromas'],soloGuard:true,standaloneSlots:{Dromas:'CC_Dromas'}};
  const cfg=effectiveConfig(p,c,s) as any;
  expect(cfg.TEAM_SLOTS).toEqual({Dromas:'CC_Dromas'});
  expect(cfg.FARMERS).toContain('Dromas');
  expect(profileSchema.safeParse(p).success).toBe(true);
 });
 it('filters out disallowed live events before choosing one',()=>{const {p,c,s,source}=setup();p.events.allowed=['icegolem'];const {code}=adaptSource(source,p,c,s);const choose=fn(code,'pick_live_event',{__ALCC:{eventsEnabled:true,events:['icegolem']},JOIN_EVENTS:["franky","icegolem"],server_status:()=>({franky:{live:true},icegolem:{live:true}}),status_is_live:()=>true,event_def:()=>({join:true}),event_has_instance:()=>true});expect(choose().name).toBe('icegolem');});
 it('maps an individual follow target and preserves source override values',()=>{const {p,c,s}=setup('Aedroma');c.follow='Droma';c.overrides={HEAL_HP_RATIO:.65};const cfg=effectiveConfig(p,c,s);expect(cfg.PARTNER).toBe('Droma');expect(cfg.HEAL_HP_RATIO).toBe(.65);});
 it('dumps excess priest keep-list copies while preserving the equipped quota',()=>{
  const {p,c}=setup('Aedroma');c.script='aedroma-priest-v2';const s=list.find(entry=>entry.id===c.script)!;const source=fs.readFileSync(path.join(sourceDir,s.filename),'utf8');
  const {code}=adaptSource(source,p,c,s);
  const ctx:any={character:{items:[{name:'vstaff'},{name:'vstaff'},{name:'hpot1',q:100},{name:'ringsj'}],slots:{mainhand:{name:'lmace'}}},CONFIG:{KEEP_ITEMS:['lmace','vstaff','hpot1']}};
  ctx.is_potion_name=fn(code,'is_potion_name',ctx);
  ctx.equipped_count=fn(code,'equipped_count',ctx);
  ctx.max_keep_count=fn(code,'max_keep_count',ctx);
  ctx.is_dumpable_slot=fn(code,'is_dumpable_slot',ctx);
  expect(ctx.is_dumpable_slot(0)).toBe(false);
  expect(ctx.is_dumpable_slot(1)).toBe(true);
  expect(ctx.is_dumpable_slot(2)).toBe(false);
  expect(ctx.is_dumpable_slot(3)).toBe(true);
 });
 it('keeps a priest dump active when item transfer fails instead of reporting success',async()=>{
  const {p,c}=setup('Aedroma');c.script='aedroma-priest-v2';const s=list.find(entry=>entry.id===c.script)!;const source=fs.readFileSync(path.join(sourceDir,s.filename),'utf8');
  const {code}=adaptSource(source,p,c,s);
  const logs:string[]=[];
  const ctx:any={character:{items:[{name:'ringsj'}],slots:{},gold:0},CONFIG:{MERCHANT:'EadroSell',KEEP_ITEMS:[]},get_player:()=>({x:0,y:0}),distance:()=>0,send_item:async()=>{throw Error('receiver full');},send_gold:async()=>{},sleep_ms:async()=>{},game_log:(message:string)=>logs.push(message)};
  ctx.is_potion_name=fn(code,'is_potion_name',ctx);
  ctx.equipped_count=fn(code,'equipped_count',ctx);
  ctx.max_keep_count=fn(code,'max_keep_count',ctx);
  ctx.is_dumpable_slot=fn(code,'is_dumpable_slot',ctx);
  ctx.dumpable_count=fn(code,'dumpable_count',ctx);
  const dump=fn(code,'dump_items_to_mule',ctx);
  await expect(dump()).resolves.toBe(false);
  expect(logs.some(message=>message.includes('receiver full'))).toBe(true);
  expect(logs.some(message=>message.includes('Dump incomplet'))).toBe(true);
 });
 it('keeps disabled NPC sales off',()=>{const {p,c,s,source}=setup('EadroSell');p.seller.npcEnabled=false;const {code}=adaptSource(source,p,c,s);const sell=fn(code,'should_sell',{__ALCC:{npcEnabled:false}});expect(sell({name:'wcap'})).toBe(false);});
 it('filters upgrades by per-item dashboard targets',()=>{const {p,c,s,source}=setup('EadroSell');const {code}=adaptSource(source,p,c,s);const upgrade=fn(code,'should_upgrade',{__ALCC:{upgrade:{enabled:true,minGold:0,rules:[{item:'hpants',maxLevel:7},{item:'fireblade',maxLevel:9},{item:'wcap',maxLevel:5}]}},CONFIG:{UPGRADE_MAX:9},character:{gold:1e9},G:{items:{hpants:{upgrade:true},fireblade:{upgrade:true},wcap:{upgrade:true}}},item_grade:()=>2});expect(upgrade({name:'hpants',level:6})).toBe(true);expect(upgrade({name:'hpants',level:7})).toBe(false);expect(upgrade({name:'fireblade',level:8})).toBe(true);expect(upgrade({name:'fireblade',level:9})).toBe(false);expect(upgrade({name:'wcap',level:1})).toBe(true);expect(upgrade({name:'wattire',level:1})).toBe(false);});
 it('blocks upgrades when mule gold is below the dashboard min',()=>{const {p,c,s,source}=setup('EadroSell');p.seller.upgrade.minGold=100000;const {code}=adaptSource(source,p,c,s);const upgrade=fn(code,'should_upgrade',{__ALCC:{upgrade:{enabled:true,minGold:100000,rules:[{item:'hpants',maxLevel:7}]}},CONFIG:{UPGRADE_GOLD_MIN:100000},character:{gold:50000},G:{items:{hpants:{upgrade:true}}},item_grade:()=>2});expect(upgrade({name:'hpants',level:1})).toBe(false);});
 it('sells NPC allowlist items even when source NEVER_SELL would block them',()=>{const {p,c,s,source}=setup('EadroSell');p.seller.npcEnabled=true;p.seller.npcItems=['wshoes'];p.seller.upgrade.enabled=false;p.seller.exchange.enabled=false;p.seller.standEnabled=false;const {code}=adaptSource(source,p,c,s);const sell=fn(code,'should_sell',{__ALCC:{npcEnabled:true,buy:{enabled:false,orders:[]},exchange:{enabled:false,items:[]},upgrade:{enabled:false,rules:[]},standEnabled:false,listings:[],kit:{enabled:false,rules:[]},consumables:{enabled:false,rules:[]}},CONFIG:{GABRIEL_SELL:['wshoes']},NEVER_SELL:{wshoes:1}});expect(sell({name:'wshoes'})).toBe(true);expect(sell({name:'wcap'})).toBe(false);});
 it('preserves finished Wanderer upgrade pieces for bank deposit',()=>{const {p,c,s,source}=setup('EadroSell');p.seller.npcItems=['wgloves','wshoes'];p.seller.upgrade.rules=[{item:'wgloves',maxLevel:7},{item:'wshoes',maxLevel:7}];const {code}=adaptSource(source,p,c,s);const context={__ALCC:{npcEnabled:true,buy:{enabled:false,orders:[]},exchange:{enabled:false,items:[]},upgrade:{enabled:true,rules:p.seller.upgrade.rules},standEnabled:false,listings:[],kit:{enabled:false,rules:[]},consumables:{enabled:false,rules:[]},gifts:{enabled:false,rules:[]}},CONFIG:{GABRIEL_SELL:p.seller.npcItems},character:{name:'EadroSell'}};const sell=fn(code,'should_sell',{...context,upgrade_target_complete:(it:any)=>(it.level||0)>=7});expect(sell({name:'wgloves',level:6})).toBe(false);expect(sell({name:'wgloves',level:7})).toBe(false);expect(sell({name:'wshoes',level:8})).toBe(false);});
 it('compiles each supplied runnable script',async()=>{for(const s of list.filter(s=>s.id!=='gui')){const {p}=setup();let c=p.characters.find(c=>c.ctype===s.ctype);if(!c){c={...p.characters[0],name:'Test_'+s.ctype,ctype:s.ctype as any,follow:'',events:false};p.characters.push(c);}c.script=s.id;const built=await buildBundle(p,c.name);expect(()=>ast(built.code)).not.toThrow();expect(built.hash).toMatch(/^[0-9a-f]{64}$/);}},20000);
});
describe('recurring boss farming',()=>{
 it('seeds the board from the warrior source BOSS_CHECKS',()=>{
  const {p}=setup();
  expect(p.farming.bossChecks.enabled).toBe(true);
  expect(p.farming.bossChecks.rules).toEqual([{boss:'jr',everyMinutes:240},{boss:'greenjr',everyMinutes:240},{boss:'dragold',everyMinutes:120}]);
 });
 it('defaults the board on profiles saved before it existed',()=>{
  const {p}=setup();
  const old=JSON.parse(JSON.stringify(p));delete old.farming.bossChecks;
  expect(profileSchema.parse(old).farming.bossChecks.rules).toEqual([{boss:'jr',everyMinutes:240},{boss:'greenjr',everyMinutes:240}]);
 });
 it('rejects duplicate and unknown bosses',()=>{
  const {p}=setup();
  p.farming.bossChecks.rules=[{boss:'jr',everyMinutes:60},{boss:'jr',everyMinutes:120}];
  expect(profileSchema.safeParse(p).success).toBe(false);
  p.farming.bossChecks.rules=[{boss:'goldenbat',everyMinutes:60}];
  expect(profileSchema.safeParse(p).success).toBe(false);
 });
 it('injects the configured intervals as the BOSS_CHECKS table',()=>{
  const {p,c,s,source}=setup();
  p.farming.bossChecks.rules=[{boss:'fvampire',everyMinutes:30},{boss:'stompy',everyMinutes:60}];
  expect(variables(adaptSource(source,p,c,s).code).BOSS_CHECKS).toEqual([{boss:'fvampire',everyMinutes:30},{boss:'stompy',everyMinutes:60}]);
  p.farming.bossChecks.enabled=false;
  expect(variables(adaptSource(source,p,c,s).code).BOSS_CHECKS).toEqual([]);
 });
 it('checks the boss that is furthest past its own interval',()=>{
  const {p,c,s,source}=setup();
  p.farming.bossChecks.rules=[{boss:'jr',everyMinutes:240},{boss:'fvampire',everyMinutes:30}];
  const {code}=adaptSource(source,p,c,s);
  const ctx:any={BOSS_CHECKS:p.farming.bossChecks.rules,boss_peek:{at:{jr:Date.now()-9*3600e3,fvampire:Date.now()-3600e3},phase:'',started:0},G:{monsters:{jr:{name:'Jr.'},fvampire:{name:'Ms. Dracul'}}},set:()=>{},game_log:()=>{}};
  ctx.save_boss_peek=fn(code,'save_boss_peek',ctx);
  ctx.boss_check_rules=fn(code,'boss_check_rules',ctx);
  ctx.boss_check_rule=fn(code,'boss_check_rule',ctx);
  ctx.boss_name=fn(code,'boss_name',ctx);
  ctx.fmt_minutes=fn(code,'fmt_minutes',ctx);
  ctx.boss_check_every=fn(code,'boss_check_every',ctx);
  ctx.due_boss_check=fn(code,'due_boss_check',ctx);
  expect(ctx.due_boss_check()).toBe('jr');
  expect(fn(code,'start_boss_check',ctx)()).toBe('jr');
  expect(ctx.boss_check_every('fvampire')).toBe('30m');
  expect(ctx.boss_check_every('jr')).toBe('4h');
 });
 it('stops scheduled camp walks when the board is off',()=>{
  const {p,c,s,source}=setup();
  p.farming.bossChecks.enabled=false;
  const {code}=adaptSource(source,p,c,s);
  expect(fn(code,'scheduled_boss_farm')()).toBe(null);
  expect(fn(code,'live_boss_check')()).toBe(null);
 });
 it('keeps opportunistic rares separate from scheduled checks',()=>{
  const {p,c,s,source}=setup();
  p.farming.rareVisits=false;
  const {code}=adaptSource(source,p,c,s);
  expect(fn(code,'nearby_phoenix')()).toBe(null);
  expect(code).toContain('due_boss_check');
 });
 it('describes every listed boss with a real respawn window',()=>{
  for(const b of worldBosses)expect(b.respawn).toBeGreaterThan(0);
  expect(formatDuration(worldBosses.find(b=>b.id==='jr')!.respawn)).toBe('7h 12m');
  expect(formatDuration(2160)).toBe('36m');
 });
});
describe('merchant stand adapter',()=>{
 it.each(['computer','supercomputer'])('opens directly from %s in inventory slot zero',async(device)=>{
  const opens:number[]=[];
  const character:any={slots:{},items:[{name:device},{name:'stand0'}],map:'main',esize:4,stand:false};
  const {run}=stand({character,has_stand:()=>false,locate_item:()=>1,open_stand:async(slot:number)=>{opens.push(slot);character.stand='cstand';}});
  expect(await run()).toBe(true);
  expect(opens).toEqual([0]);
 });
 it('can open the Computer stand during a stationary craft batch',async()=>{
  const opens:number[]=[];
  const character:any={slots:{},items:[{name:'computer'}],map:'main',esize:4,stand:false};
  const {run}=stand({character,has_stand:()=>false,refresh_production_trip:()=> 'craft',merchant_remote_exchange_available:()=>true,open_stand:async(slot:number)=>{opens.push(slot);character.stand='cstand';}});
  expect(await run()).toBe(true);
  expect(opens).toEqual([0]);
 });
 function stand(extra:Record<string,unknown>={}){const calls:any[]=[];const ctx:any={__ALCC:{standEnabled:true,listings:[{item:'seashell',level:0,price:1234}]},character:{slots:{},items:[{name:'seashell',q:3}],map:'main',esize:4,stand:true},NEVER_SELL:{fireblade:1},is_heavy_piece:()=>false,is_vampire_armor:()=>false,ensure_stand_closed:async()=>calls.push('closed'),stand_has_listings:()=>false,has_stand:()=>true,SHOP_XY:{market:{}},simple_distance:()=>0,smart:{moving:false},sleep:async()=>{},trade:async(...args:any[])=>calls.push(args),game_log:()=>{},act:()=>{},...extra};return {run:vm.runInNewContext(`(async function(){${merchantStandBody}})`,ctx),calls};}
 it('uses extra sale slots on a 24-slot stand and allows bank-withdrawn finished gear',async()=>{
  const slots:any={},listings:any[]=[];for(let i=1;i<=8;i++){slots['trade'+i]={name:'stock'+i,level:0,price:100};listings.push({item:'stock'+i,level:0,price:100});}
  listings.push({item:'coat',level:9,price:150000000,bankReserve:1});
  const {run,calls}=stand({merchant_trade_capacity:()=>24,upgrade_target_complete:()=>true,listing_bank_stock_reserved:()=>true,stand_inventory_allowed:()=>true,__ALCC:{standEnabled:true,listings,buy:{managed:true,enabled:true,budget:0,reserveGold:0,orders:[{item:'seashell',level:0,price:100,quantity:1}]}},character:{gold:1000,slots,items:[{name:'coat',level:9}],map:'main',esize:4,stand:true}});
  await run();expect(calls).toContainEqual([0,9,150000000,1]);
 });
 it('places buys in the last eight slots of an expanded stand',async()=>{
  const wishes:any[]=[];const {run}=stand({merchant_trade_capacity:()=>24,__ALCC:{standEnabled:false,listings:[],buy:{enabled:true,budget:100,reserveGold:0,orders:[{item:'seashell',level:0,price:100,quantity:1}]}},character:{gold:100,slots:{},items:[],map:'main',esize:4,stand:true},wishlist:async(...args:any[])=>wishes.push(args)});
  await run();expect(wishes).toEqual([[17,'seashell',100,0,1]]);
 });
 it('posts eight orders in the last two rows without using sale slots',async()=>{
  const wishes:any[]=[];const slots:any={};
  const orders=Array.from({length:8},(_,i)=>({item:'item'+i,level:0,price:100,quantity:1}));
  const cfg:any={standEnabled:false,listings:[],buy:{managed:true,enabled:true,budget:800,reserveGold:200,orders}};
  const {run}=stand({__ALCC:cfg,character:{gold:1000,slots,items:[],map:'main',esize:4,stand:true},wishlist:async(slot:number,item:string,price:number,level:number,quantity:number)=>{wishes.push(slot);slots['trade'+slot]={b:true,name:item,price,level,q:quantity};}});
  for(let i=0;i<8;i++){cfg._buyPostAt=0;await run();}
  expect(wishes).toEqual([9,10,11,12,13,14,15,16]);
 });
 it('preserves a server-capped equipment order and posts the next wishlist',async()=>{
  const wishes:any[]=[];const removed:string[]=[];
  const orders=[{item:'ololipop',level:0,price:100,quantity:100},{item:'froststaff',level:0,price:100,quantity:10}];
  const {run}=stand({G:{items:{ololipop:{upgrade:true},froststaff:{upgrade:true}}},__ALCC:{standEnabled:false,listings:[],buy:{managed:true,enabled:true,budget:20000,reserveGold:0,orders}},character:{gold:20000,slots:{trade9:{name:'ololipop',level:0,price:100,q:99,b:true}},items:[],map:'main',esize:4,stand:true},unequip:async(s:string)=>removed.push(s),wishlist:async(...a:any[])=>wishes.push(a)});
  await run();expect(removed).toEqual([]);expect(wishes).toEqual([[10,'froststaff',100,0,10]]);
 });
 it('lists only a matching unlocked item at the configured price',async()=>{const {run,calls}=stand();await run();expect(calls).toContainEqual([0,1,1234,3]);});
 it('lists items when an explicit stand rule matches',async()=>{
  const {run,calls}=stand({__ALCC:{standEnabled:true,listings:[{item:'ololipop',level:0,price:1100000}]},character:{slots:{},items:[{name:'ololipop',q:2}],map:'main',esize:4,stand:true}});
  await run();expect(calls).toContainEqual([0,1,1100000,2]);
 });
 it('does not list locked items',async()=>{const {run,calls}=stand({character:{slots:{},items:[{name:'seashell',q:3,l:'locked'}],map:'main',esize:4,stand:true}});await run();expect(calls).toEqual([]);});
 it('opens an enabled stand even when configured stock is temporarily empty',async()=>{
  const opens:number[]=[];const character:any={slots:{},items:[],map:'main',esize:4,stand:false,x:-100,y:-20};
  const {run}=stand({character,locate_item:()=>3,open_stand:async(slot:number)=>{opens.push(slot);character.stand=true;}});
  expect(await run()).toBe(true);expect(opens).toEqual([3]);
 });
 it('waits for the asynchronous stand state before reporting success',async()=>{
  const logs:string[]=[];let waits=0;
  const character:any={slots:{},items:[],map:'main',esize:4,stand:false,x:-100,y:-20};
  const {run}=stand({character,locate_item:()=>3,open_stand:async()=>{},sleep:async()=>{waits++;if(waits===2)character.stand=true;},game_log:(message:string)=>logs.push(message)});
  expect(await run()).toBe(true);
  expect(waits).toBe(2);
  expect(logs).toContain('stand opened (slot 3)');
  expect(logs.some(message=>message.includes('remains closed'))).toBe(false);
 });
 it('closes outdated listings and waits when inventory is full',async()=>{const {run,calls}=stand({character:{slots:{trade1:{name:'seashell',price:10}},items:[],esize:0}});expect(await run()).toBe(true);expect(calls).toEqual(['closed']);});
 it('caps buy quantities by owned stock, budget and gold reserve',async()=>{
  const wishes:any[]=[];
  const {run}=stand({__ALCC:{standEnabled:false,listings:[],buy:{managed:true,enabled:true,budget:500,reserveGold:800,orders:[{item:'seashell',level:0,price:100,quantity:10}]}},character:{gold:1100,slots:{},items:[{name:'seashell',q:8}],map:'main',esize:4,stand:true},wishlist:async(...args:any[])=>wishes.push(args)});
    await run();expect(wishes).toEqual([[9,'seashell',100,0,2]]);
 });
 it('does not count the managed buy slot against its own budget',async()=>{
  const wishes:any[]=[];
  const {run}=stand({__ALCC:{standEnabled:false,listings:[],buy:{managed:true,enabled:true,budget:1000,reserveGold:0,orders:[{item:'seashell',level:0,price:100,quantity:10}]}},character:{gold:1000,slots:{trade9:{b:true,name:'seashell',price:100,q:10}},items:[],map:'main',esize:4,stand:true},wishlist:async(...args:any[])=>wishes.push(args)});
  await run();expect(wishes).toEqual([]);
 });
 it('does not cancel a buy order during the post grace window',async()=>{
  const removed:string[]=[];
  const {run}=stand({__ALCC:{standEnabled:false,listings:[],_buyPostAt:Date.now(),buy:{managed:true,enabled:true,budget:1000,reserveGold:0,orders:[{item:'seashell',level:0,price:100,quantity:10}]}},character:{slots:{trade9:{b:true,name:'seashell',price:100,q:3}},items:[],map:'main',esize:4,stand:true},unequip:async(s:string)=>removed.push(s)});
  await run();expect(removed).toEqual([]);
 });
 it('does not repost while the game is still updating the buy slot',async()=>{
  const wishes:any[]=[];
  const {run}=stand({__ALCC:{standEnabled:false,listings:[],buy:{managed:true,enabled:true,budget:500,reserveGold:800,orders:[{item:'seashell',level:0,price:100,quantity:2}]}},character:{gold:1100,slots:{},items:[],map:'main',esize:4,stand:true},wishlist:async(...args:any[])=>wishes.push(args)});
    await run();await run();expect(wishes).toEqual([[9,'seashell',100,0,2]]);
 });
  it('passes buy level before quantity to the Browser CODE wishlist helper',async()=>{
   const wishes:any[]=[];
   const {run}=stand({__ALCC:{standEnabled:false,listings:[],buy:{managed:true,enabled:true,budget:150000000,reserveGold:0,orders:[{item:'tshirt9',level:0,price:15000000,quantity:10}]}},character:{gold:150000000,slots:{},items:[],map:'main',esize:4,stand:true},wishlist:async(...args:any[])=>wishes.push(args)});
   await run();expect(wishes).toEqual([[9,'tshirt9',15000000,0,10]]);
  });
 it('posts no buy order when reserve leaves no available gold',async()=>{
  const wishes:any[]=[];
  const {run}=stand({__ALCC:{standEnabled:false,listings:[],buy:{managed:true,enabled:true,budget:500,reserveGold:1000,orders:[{item:'seashell',level:0,price:100,quantity:10}]}},character:{gold:900,slots:{},items:[],map:'main',esize:4,stand:true},wishlist:async(...args:any[])=>wishes.push(args)});
  await run();expect(wishes).toEqual([]);
 });
 it('cancels managed orders after the final rule is removed',async()=>{
  const removed:string[]=[];
  const {run}=stand({__ALCC:{standEnabled:false,listings:[],buy:{managed:true,enabled:false,budget:500,reserveGold:0,orders:[]}},character:{gold:900,slots:{trade9:{b:true,name:'seashell',price:100,q:1}},items:[],esize:0},unequip:async(s:string)=>removed.push(s)});
  await run();expect(removed).toEqual(['trade9']);
 });
 it('opens the stand before listing so trade() does not cant_equip',async()=>{
  const opens:any[]=[];const trades:any[]=[];
  const character:any={slots:{},items:[{name:'seashell',q:3,level:0}],map:'main',esize:4,stand:false,x:0,y:0};
  const {run}=stand({
   character,
   locate_item:(n:string)=>n==='stand0'?5:-1,
   open_stand:async(slot?:number)=>{opens.push(slot??'bare');character.stand=true;},
   trade:async(...args:any[])=>trades.push(args),
  });
  expect(await run()).toBe(true);
  expect(opens).toEqual([5]);
  expect(trades).toEqual([]);
 });
 it('leaves the bank before trying to open the stand',async()=>{
  const moves:any[]=[];
  const {run}=stand({
   character:{slots:{},items:[{name:'seashell',q:3}],map:'bank',esize:4,stand:false},
   go_to:async(...a:any[])=>moves.push(a),
   open_stand:async()=>{throw Error('should not open in bank');},
   trade:async()=>{throw Error('should not trade in bank');},
  });
  expect(await run()).toBe(true);
  expect(moves[0][0]).toBe('market');
 });
 it('walks back on main to reopen a closed stand that already has listings',async()=>{
  const moves:any[]=[];const opens:any[]=[];
  const {run}=stand({
   __ALCC:{standEnabled:true,listings:[{item:'tracker',level:0,price:5000000}]},
   character:{slots:{trade1:{name:'tracker',level:0,price:5000000}},items:[],map:'main',esize:4,stand:false,x:40,y:-23},
   stand_has_listings:()=>true,
   simple_distance:()=>98,
   go_to:async(...a:any[])=>moves.push(a),
   open_stand:async()=>opens.push('opened'),
   unequip:async()=>{throw Error('should not unequip matching listing');},
  });
  expect(await run()).toBe(true);
  expect(moves[0][0]).toBe('market');
  expect(opens).toEqual([]);
 });
 it('does not leave the bank only to reopen an idle listed stand',async()=>{
  const moves:any[]=[];
  const {run}=stand({
   __ALCC:{standEnabled:true,listings:[{item:'tracker',level:0,price:5000000}]},
   character:{slots:{trade1:{name:'tracker',level:0,price:5000000}},items:[],map:'bank',esize:4,stand:false},
   stand_has_listings:()=>true,
   go_to:async(...a:any[])=>moves.push(a),
   unequip:async()=>{throw Error('should not unequip in bank idle');},
  });
  expect(await run()).toBe(false);
  expect(moves).toEqual([]);
 });
 it('clears stray buy orders on sell slots when no buy rules remain',async()=>{
  const removed:string[]=[];
  const {run}=stand({
   __ALCC:{standEnabled:true,listings:[{item:'monstertoken',level:0,price:500000}],buy:{managed:true,enabled:true,budget:0,reserveGold:0,orders:[]}},
   character:{slots:{trade8:{b:true,name:'hpants',price:468001,q:5},trade1:{name:'tracker',price:5000000}},items:[{name:'monstertoken',q:3,level:0}],map:'main',esize:4,stand:true},
   unequip:async(s:string)=>removed.push(s),
  });
  await run();
  expect(removed).toEqual(['trade8']);
 });
 it('lists into slots 13+ when 1-12 are full and buy orders are empty',async()=>{
  const calls:any[]=[];
  const full:Record<string,unknown>={};
  for(let n=1;n<=12;n++)full['trade'+n]={name:'ololipop',level:0,price:1100000};
  const {run}=stand({
   __ALCC:{standEnabled:true,listings:[{item:'monstertoken',level:0,price:500000},{item:'ololipop',level:0,price:1100000}],buy:{managed:true,enabled:true,budget:0,reserveGold:0,orders:[]}},
   character:{slots:full,items:[{name:'monstertoken',q:23,level:0}],map:'main',esize:4,stand:true},
   trade:async(...args:any[])=>calls.push(args),
   stand_has_listings:()=>true,
  });
  await run();
  expect(calls).toContainEqual([0,13,500000,23]);
 });
 it('keeps a valid stackable listing stable when the bag has surplus',async()=>{
  const removed:string[]=[];
  const {run}=stand({
   __ALCC:{standEnabled:true,listings:[{item:'tombkey',level:0,price:500000}]},
   character:{slots:{trade9:{name:'tombkey',price:500000,q:17}},items:[{name:'tombkey',q:4,level:0}],map:'main',esize:4,stand:true},
   G:{items:{tombkey:{s:50}}},
   unequip:async(s:string)=>removed.push(s),
   stand_has_listings:()=>true,
   trade:async()=>{throw Error('should keep the existing listing');},
  });
  expect(await run()).toBe(false);
  expect(removed).toEqual([]);
 });
 it('stays in bank when stand is idle so upgrades can run',async()=>{
  const moves:any[]=[];
  const {run}=stand({
   character:{slots:{trade1:{name:'seashell',price:1234,q:1}},items:[],map:'bank',esize:4,stand:false},
   go_to:async(...a:any[])=>moves.push(a),
   stand_has_listings:()=>true,
  });
  expect(await run()).toBe(false);
  expect(moves).toEqual([]);
 });

});

describe('merchant v2 source safety',()=>{
 function sourceStand(extra:Record<string,unknown>={}){
  const source=fs.readFileSync(path.join(sourceDir,'eadrosell-merchant-v2.js'),'utf8');
  const calls:any[]=[];
  const character:any={rip:false,stand:true,standed:false,slots:{},items:[],gold:100000,map:'main'};
  const context:any={
   character,chores_in_progress:false,
   merchant_trade_capacity:()=>16,stand_inventory_allowed:()=>true,release_listing_bank_stock:()=>{},exchange_space_pause:false,
   cc_stand_enabled:()=>true,
   refresh_production_trip:()=>null,
   cc_listings:()=>[{item:'glolipop',level:0,price:1100000}],
   cc_stand_spot:()=>({map:'main',x:0,y:0}),
   near_point:()=>true,find_item:()=>0,
   close_stand:async()=>{calls.push('closed');character.stand=false;},
   ensure_stand_closed:async()=>{calls.push('closed');character.stand=false;},
   unequip:async(slot:string)=>calls.push(['unequip',slot]),
   trade:async(...args:any[])=>calls.push(['trade',...args]),
   open_stand:async()=>{character.stand=true;},
   game_log:(message:string)=>calls.push(['log',message]),set_message:()=>{},
   sleep:async()=>{throw Error('STOP');},
   ...extra,
  };
  return {run:fn(source,'standLoop',context),calls,character};
 }
 it('publishes stand listings atomically at the configured price',async()=>{
  const {p}=setup('EadroSell');
  const merchant=p.characters.find(c=>c.name==='EadroSell')!;
  merchant.script='eadrosell-merchant-v2';
  p.seller.standEnabled=true;
  p.seller.listings=[{item:'glolipop',level:0,price:1100000}];
  const built=await buildBundle(p,'EadroSell');
  expect(built.code).toContain('await trade(found_slot, ti2, rule.price, listing_qty)');
  expect(built.code).not.toContain('await equip(found_slot, "trade" + ti2)');
  expect(built.code).not.toContain('set_trade("trade" + ti2');
  expect(built.code).toContain('"item": "glolipop", "level": 0, "price": 11e5');
  expect(built.code).toContain('Number(live_listing.price) === Number(audit_rule.price)');
  expect(built.code).toContain('await unequip("trade" + audit_slot)');
 });
 it('removes a live 1-gold listing before repricing it',async()=>{
  const {run,calls,character}=sourceStand();
  character.slots.trade1={name:'glolipop',level:0,price:1};
  await expect(run()).rejects.toThrow('STOP');
  expect(calls).toContain('closed');
  expect(calls).toContainEqual(['unequip','trade1']);
  expect(calls.some(call=>Array.isArray(call)&&call[0]==='trade')).toBe(false);
 });
 it('uses trade with the configured price and full stack quantity',async()=>{
  const {run,calls,character}=sourceStand();
  character.items=[{name:'glolipop',level:0,q:4}];
  await expect(run()).rejects.toThrow('STOP');
  expect(calls).toContainEqual(['trade',0,1,1100000,4]);
 });
 it('does not reopen an unsafe listing when the inventory cannot receive it',async()=>{
  const {run,calls,character}=sourceStand({
   unequip:async()=>{throw Error('inventory full');},
   open_stand:async()=>calls.push('opened'),
  });
  character.slots.trade1={name:'glolipop',level:0,price:1};
  await expect(run()).rejects.toThrow('STOP');
  expect(calls).toContain('closed');
  expect(calls).not.toContain('opened');
  expect(calls.some(call=>Array.isArray(call)&&call[0]==='trade')).toBe(false);
 });
});
describe('consumables + kit board',()=>{
 it('embeds consumable rules and farmer elixir helper in farm bundles',async()=>{
  const {p}=setup('Aedroma');
  p.seller.consumables={enabled:true,rules:[{character:'Aedroma',item:'elixirint0',minQty:2,targetQty:4,maxQty:8,mode:'elixir',source:'either'}]};
  const built=await buildBundle(p,'Aedroma');
  expect(built.code).toContain('"consumables"');
  expect(built.code).toContain('elixirint0');
  expect(built.code).toContain('use_dashboard_consumables');
  expect((built.config as any).KEEP_ITEMS).toContain('elixirint0');
 });
 it('keeps the dashboard elixir authoritative over the ranger default',async()=>{
  const {p}=setup('Droma');
  p.seller.consumables={enabled:true,rules:[{character:'Droma',item:'elixirluck',minQty:1,targetQty:2,maxQty:4,mode:'elixir',source:'either'}]};
  const built=await buildBundle(p,'Droma');
  expect(built.code).toContain('dashboard_elixir_rule');
  expect(built.code).toContain('dashboard_elixir_rule()) return');
  const consumed:number[]=[];
  const context:any={
   __ALCC:{consumables:p.seller.consumables},
   character:{name:'Droma',slots:{elixir:{name:'elixirdex0'}},s:{},items:[{name:'elixirluck'}]},
   consume:async(slot:number)=>consumed.push(slot),game_log:()=>{},Date,
  };
  const active=fn(built.code,'dashboard_elixir_active',context);
  const useConfigured=fn(built.code,'use_dashboard_consumables',{...context,dashboard_elixir_rule:()=>p.seller.consumables.rules[0],dashboard_elixir_active:active});
  expect(active(p.seller.consumables.rules[0])).toBe(false);
  await useConfigured();
  expect(consumed).toEqual([0]);
  context.character.slots.elixir={name:'elixirluck'};
  expect(active(p.seller.consumables.rules[0])).toBe(true);
  context.character.slots.elixir=null;
  context.character.s.elixirluck={ms:1};
  expect(active(p.seller.consumables.rules[0])).toBe(true);
 });
 it('injects merchant consumable handoff and reserves items from NPC sales',()=>{
  const {p,c,s,source}=setup('EadroSell');
  p.seller.consumables={enabled:true,rules:[{character:'Aedroma',item:'elixirint0',minQty:2,targetQty:4,maxQty:8,mode:'elixir',source:'bank'}]};
  const {code}=adaptSource(source,p,c,s);
  expect(code).toContain('consumable bank');
  expect(code).toContain('maybe_dashboard_consumables');
  const sell=fn(code,'should_sell',{__ALCC:{npcEnabled:true,buy:{enabled:false,orders:[]},exchange:{enabled:false,items:[]},upgrade:{enabled:false,items:[]},standEnabled:false,listings:[],kit:{enabled:false,rules:[]},consumables:{enabled:true,rules:[{item:'elixirint0'}]},CONFIG:{GABRIEL_SELL:['elixirint0']}},CONFIG:{GABRIEL_SELL:['elixirint0']}});
  expect(sell({name:'elixirint0'})).toBe(false);
 });
 it('hands seller-bag gifts to farmers and keeps those items',async()=>{
  const {p}=setup('Droma');
  p.seller.gifts={enabled:true,rules:[{character:'Droma',item:'firebow',level:7,quantity:1}]};
  const built=await buildBundle(p,'Droma');
  expect((built.config as any).KEEP_ITEMS).toContain('firebow');
  const mule=setup('EadroSell');
  mule.p.seller.gifts={enabled:true,rules:[{character:'Droma',item:'firebow',level:7,quantity:1}]};
  const {code}=adaptSource(mule.source,mule.p,mule.c,mule.s);
  expect(code).toContain('maybe_dashboard_gifts');
  expect(code).toContain('gift_sent');
  const sell=fn(code,'should_sell',{__ALCC:{npcEnabled:true,buy:{enabled:false,orders:[]},exchange:{enabled:false,items:[]},upgrade:{enabled:false,items:[]},standEnabled:false,listings:[],kit:{enabled:false,rules:[]},consumables:{enabled:false,rules:[]},gifts:{enabled:true,rules:[{item:'firebow'}]}},CONFIG:{GABRIEL_SELL:['firebow']}});
  expect(sell({name:'firebow'})).toBe(false);
 });
 it('delivers from mule bag when farmer is short',async()=>{
  const sent:any[]=[];
  const ctx:any={
   __ALCC:{consumables:{enabled:true,rules:[{character:'Aedroma',item:'elixirint0',minQty:2,targetQty:4,maxQty:8,mode:'elixir',source:'mule'}]}},
   character:{items:[{name:'elixirint0',q:5}],map:'main',bank:null,esize:10},
   get_player:()=>({rip:false,map:'main',x:0,y:0,items:[{name:'elixirint0',q:1}],slots:{}}),
   near_farmer:()=>true,send_item:async(...a:any[])=>sent.push(a),game_log:()=>{},act:()=>{},
   ensure_stand_closed:async()=>{},go_to:async()=>{},each_bank_item:()=>{},bank_retrieve:async()=>{}
  };
  await vm.runInNewContext(`(async function(){${merchantConsumablesBody}})`,ctx)();
  expect(sent).toEqual([['Aedroma',0,3]]);
 });
 it('skips bank pulls when source is mule-only',async()=>{
  const bankCalls:any[]=[];
  const ctx:any={
   __ALCC:{consumables:{enabled:true,rules:[{character:'Aedroma',item:'elixirint0',minQty:2,targetQty:4,maxQty:8,mode:'elixir',source:'mule'}]}},
   character:{items:[],map:'main',bank:{items0:[{name:'elixirint0',q:3}]},esize:10},
   get_player:()=>({rip:false,map:'main',x:0,y:0,items:[],slots:{}}),
   near_farmer:()=>true,send_item:async()=>{},game_log:()=>{},act:()=>{},
   ensure_stand_closed:async()=>{},go_to:async(...a:any[])=>bankCalls.push(a),
   each_bank_item:(fn:any)=>{fn({name:'elixirint0',q:3},'items0',0);},bank_retrieve:async(...a:any[])=>bankCalls.push(['retrieve',...a])
  };
  await vm.runInNewContext(`(async function(){${merchantConsumablesBody}})`,ctx)();
  expect(bankCalls).toEqual([]);
 });
});
describe('daily dungeon',()=>{
  function caveApi(cave?:any,extra:Record<string,unknown>={}){
   const ctx:any={character:{rip:false,ctype:'warrior',name:'Eadroma',map:'zone_run_0',x:100,y:100,cave:cave||null},CONFIG:{DAILY_DUNGEON:true,DAILY_DUNGEON_BUY:false,WARRIOR:'Eadroma',PRIEST:'Aedroma',RANGER:'Droma',MERCHANT:'EadroSell',PARTY:['Aedroma','Droma'],PARTY_GUESTS:['EadroSell']},__ALCC:{dailyDungeon:true},game_log:()=>{},get:()=>({}),set:()=>{},...extra};
  vm.runInNewContext(fs.readFileSync(path.join(sourceDir,'cave-dreams.js'),'utf8'),ctx);
  return ctx.CaveDreams;
 }
 it('defaults the farming switch off on new and legacy profiles',()=>{
  const {p}=setup();
  expect(p.farming.dailyDungeon).toBe(false);
  const old=JSON.parse(JSON.stringify(p));delete old.farming.dailyDungeon;
  expect(profileSchema.parse(old).farming.dailyDungeon).toBe(false);
 });
 it('keeps the farming switch on through profile parse',()=>{
  const {p}=setup();
  p.farming.dailyDungeon=true;
  expect(profileSchema.parse(JSON.parse(JSON.stringify(p))).farming.dailyDungeon).toBe(true);
 });
 it('injects DAILY_DUNGEON and appends the cave runner to farmers',()=>{
  const {p,c,s,source}=setup();
  p.farming.dailyDungeon=true;
  const {code,warnings}=adaptSource(source,p,c,s);
  expect((variables(code).CONFIG as any).DAILY_DUNGEON).toBe(true);
  expect(code).toContain('var __ALCC');
  expect(code).toContain('"dailyDungeon":true');
  expect(code).toContain('var CaveDreams');
  expect(code).toContain('cave_enter');
  expect(warnings.some(w=>w.includes('Cave of Many Dreams'))).toBe(true);
  const priest=setup('Aedroma');
  priest.p.farming.dailyDungeon=true;
  expect(adaptSource(priest.source,priest.p,priest.c,priest.s).code).toContain('var CaveDreams');
  const ranger=setup('Droma');
  ranger.p.farming.dailyDungeon=true;
  const rangerCode=adaptSource(ranger.source,ranger.p,ranger.c,ranger.s).code;
  expect((variables(rangerCode).CONFIG as any).DAILY_DUNGEON).toBe(true);
  const mule=setup('EadroSell');
  mule.p.farming.dailyDungeon=true;
  expect(adaptSource(mule.source,mule.p,mule.c,mule.s).code).not.toContain('var CaveDreams');
 });
 it('does not list cave-dreams as a runnable Command Center script',()=>{
  expect(list.some(s=>s.id==='cave-dreams'||s.filename==='cave-dreams.js')).toBe(false);
 });
 it('reserves an exact three-farmer roster and rejects the merchant',()=>{
  const trio:any={Eadroma:{name:'Eadroma'},Aedroma:{name:'Aedroma'},Droma:{name:'Droma'}};
  const api=caveApi({run:'run',floor:0,objectives:[],doors:[]},{get_party:()=>trio});
  expect(Array.from(api.roster())).toEqual(['Eadroma','Aedroma','Droma']);
  expect(api.exactParty()).toBe(true);
  expect(api.allowsPartyMember('EadroSell')).toBe(false);
  trio.EadroSell={name:'EadroSell'};
  expect(api.exactParty()).toBe(false);
 });
 it('prioritizes an unlocked down staircase over optional respawning camps',()=>{
  const api=caveApi({run:'run',floor:0,doors:[{down:true,locked:false,x:500,y:500}],objectives:[{id:'0:farm:1',kind:'farm',required:false,done:false,floor:0,x:120,y:120}]});
  expect(api.nextGoal()).toMatchObject({kind:'door',why:'stairs down',x:500,y:500});
 });
 it('moves a resolved escort to the locked down-door landing',()=>{
  const phrase='event.dreams.e23.name';
  const api=caveApi({run:'run',floor:0,choice:{resolved:true,result:'e23_0',title_message:{phrase}},doors:[{down:true,locked:true,x:880,y:640}],objectives:[{id:'0:1',kind:'encounter',required:true,done:false,floor:0,x:200,y:200,name_message:{phrase}}]});
  expect(api.nextGoal()).toMatchObject({kind:'escort',why:'escort to stairs',x:880,y:640});
 });
 it('keeps resume and cave actor conversations in the generated runner',()=>{
  const source=fs.readFileSync(path.join(sourceDir,'cave-dreams.js'),'utf8');
  expect(source).toContain('Number(info.resume.remaining_ms) > 0');
  expect(source).toContain('await cave_enter()');
  expect(source).toContain('if (is_cave_monster(e)) continue;');
  expect(source).not.toContain('e.type === "monster") continue');
  expect(source).toContain('if (in_cave()) {');
  expect(source).toContain('cave_local_step(x, y)');
  expect(source.indexOf('if (in_cave()) {')).toBeLessThan(source.indexOf('if (typeof go_to === "function")'));
 });
 it('uses cave allegiance and never targets allies, victims, or the Dark Mage',()=>{
  const api=caveApi();
  expect(api.isHostile({type:'monster',mtype:'cave_guard',cave:{side:'enemy'}})).toBe(true);
  expect(api.isHostile({type:'monster',mtype:'cave_guard',cave:{side:'ally'}})).toBe(false);
  expect(api.isHostile({type:'monster',mtype:'cave_hostage',cave:{side:'victim'}})).toBe(false);
  expect(api.isHostile({type:'monster',mtype:'cave_darkmage',cave:{side:'enemy'}})).toBe(false);
 });
 it('uses the warrior as the only cave leader even when the farming board calls the ranger a leader',()=>{
  const warrior=caveApi(undefined,{character:{rip:false,ctype:'warrior',name:'Eadroma',map:'zone_run_0',x:0,y:0,cave:null},my_role:()=> 'Leader'});
  const ranger=caveApi(undefined,{character:{rip:false,ctype:'ranger',name:'Droma',map:'zone_run_0',x:0,y:0,cave:null},my_role:()=> 'Leader'});
  expect(warrior.isLeader()).toBe(true);
  expect(ranger.isLeader()).toBe(false);
 });
 it('makes a follower leave when the warrior is outside the cave run',async()=>{
  let now=1_000_000,exits=0;
  class Clock extends Date { static now(){return now;} }
  const character:any={rip:false,ctype:'priest',name:'Aedroma',map:'zone_run_0',x:100,y:100,cave:{run:'run',floor:0,remaining_ms:600000,objectives:[],doors:[]}};
  const api=caveApi(character.cave,{
   character,Date:Clock,parent:{entities:{},chests:{}},set_message:()=>{},
   get_player:(name:string)=>name==='Eadroma'?{name,map:'main',x:800,y:1100,cave:null}:null,
   cave_exit:async()=>{exits++;character.cave=null;character.map='main';}
  });
  await api.tick('follow');
  expect(exits).toBe(0);
  now+=8001;
  await api.tick('follow');
  expect(exits).toBe(1);
 });
 it('ignores personal revive choices while alive and selects the free doorway while dead',()=>{
  const choice={id:'death',options:[
   {id:'landing',effect:'revive',label:'Revive at the doorway — free'},
   {id:'nera',effect:'revive',amber:3,label:'Ask Nera to revive us'}
  ]};
  const alive=caveApi();
  expect(alive.pickOption(choice)).toBe(null);
  const dead=caveApi(undefined,{character:{rip:true,ctype:'warrior',name:'Eadroma',map:'zone_run_0',x:0,y:0,cave:null}});
  expect(dead.pickOption(choice).id).toBe('landing');
 });
 it('prioritizes a hostile attacking any party member outside the destination room',()=>{
  const attacker={id:'aggro',type:'monster',mtype:'cave_guard',x:800,y:800,target:'Aedroma',cave:{side:'enemy'}};
  const roomMob={id:'room',type:'monster',mtype:'cave_guard',x:110,y:110,cave:{side:'enemy'}};
  const api=caveApi(undefined,{
   parent:{entities:{aggro:attacker,room:roomMob}},
   distance:(a:any,b:any)=>Math.hypot(a.x-b.x,a.y-b.y),
   is_party_member:(name:string)=>name==='Aedroma'
  });
  expect(api.pickTarget({kind:'room',x:100,y:100},true).id).toBe('aggro');
 });
 it('refuses the wolf pen, Dark Mage, and six-guard double fight',()=>{
  const api=caveApi();
  const choice={id:'t1',options:[
   {id:'wolves',effect:'wolves',label:'Open the level 100 wolf pen'},
   {id:'dark',effect:'bad_fight',fight:['cave_darkmage',1],label:'Challenge the Dark Mage'},
   {id:'six',effect:'bad_double',label:'Fight six guards at once'},
   {id:'hunt',effect:'hunt',label:'Hunt nearby cavespiders'}
  ]};
  expect(api.pickOption(choice).id).toBe('hunt');
  expect(api.scoreOption(choice.options[0],choice)).toBe(-1);
  expect(api.scoreOption(choice.options[1],choice)).toBe(-1);
  expect(api.scoreOption(choice.options[2],choice)).toBe(-1);
 });
 it('walks unfinished CAVE INFO rooms before the open mainland exit',()=>{
  const api=caveApi({
   run:'run',floor:0,gold:5000,amber:36,
   doors:[
    {to:'main',locked:false,x:10,y:10},
    {down:true,locked:true,x:20,y:20}
   ],
   objectives:[
    {name:'The Shop with One Item',kind:'merchant',done:true,floor:0,required:true,x:30,y:30},
    {name:'Move the Caravan',kind:'escort',done:false,floor:0,required:true,x:400,y:400}
   ]
  });
  const goal=api.nextGoal();
  expect(goal.why).toBe('Move the Caravan');
  expect(goal.x).toBe(400);
  expect(goal.kind).toBe('room');
 });
 it('continues past the doorway shop instead of opening a buy',()=>{
  const api=caveApi();
  const labeled={id:'shop',options:[
   {id:'open',label:'Open the shop'},
   {id:'go',label:'Continue'}
  ]};
  expect(api.pickOption(labeled).id).toBe('go');
  const merchant={id:'e31',shop:{room:'door'},options:[
   {id:'e31_0',effect:'inspect',label:'Open the shop'},
   {id:'e31_1',effect:'leave',label:'Keep our gold and move on.'}
  ]};
  expect(api.pickOption(merchant).id).toBe('e31_1');
 });
});

describe('finished upgrade stand policy',()=>{
 it('allows finished coat listings with a bank reserve and protects intermediate levels',()=>{
  const {p}=setup('EadroSell');p.seller.standEnabled=true;p.seller.upgrade.enabled=true;p.seller.upgrade.rules=[{item:'coat',maxLevel:9}];
  p.seller.listings=[{item:'coat',level:9,price:10000000,bankReserve:2}];expect(()=>validateProfile(p,list)).not.toThrow();
  p.seller.listings[0].level=10;expect(()=>validateProfile(p,list)).not.toThrow();
  p.seller.listings[0].level=8;expect(()=>validateProfile(p,list)).toThrow('below its upgrade target');
 });
});

it('matches game stand capacity for merchant levels and the custom stand',()=>{
 const source=fs.readFileSync(path.join(sourceDir,'eadrosell-merchant-v2.js'),'utf8');const character:any={ctype:'merchant',level:70};const capacity=fn(source,'merchant_trade_capacity',{character});
 expect(capacity()).toBe(24);character.level=80;expect(capacity()).toBe(30);character.level=69;expect(capacity()).toBe(16);character.stand='cstand';expect(capacity()).toBe(24);
});
