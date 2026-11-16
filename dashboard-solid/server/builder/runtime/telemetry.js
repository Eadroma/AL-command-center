
; (function(){
 var endpoint=__ALCC_ENDPOINT__, ticket=__ALCC_TICKET__, expected=__ALCC_CHARACTER__;
 if(typeof character==='undefined'||character.name!==expected)return;
 __ALCC_COMMAND_INBOX__
 var queue=[],sequence=Date.now(),pending=false,startedAt=Date.now(),lastSample=Date.now(),wasRip=false,failures=[];
 var loot;
 // Per-monster split: kill_credit carries mtype; a chest's drop follows its kill, and loot returns the chest id.
 // shortcut: party shares whose drop went to another member fall back to the last kill within 60 s, exact only when one monster type is farmed.
 try{if(character.on){loot={gold:0,items:[],monsters:{}};var lastKill=null,chestMonster={};var addItem=function(list,it,quantity,level){var row=list.filter(function(row){return row.name===it.name&&row.level===level;})[0];if(row)row.quantity=Math.min(999999999,row.quantity+quantity);else if(list.length<500)list.push({name:String(it.name).slice(0,80),level:level,quantity:quantity});};var monsterRow=function(mtype){mtype=String(mtype||'unknown').slice(0,40);if(!loot.monsters[mtype]&&Object.keys(loot.monsters).length>=100)mtype='unknown';return loot.monsters[mtype]=loot.monsters[mtype]||{kills:0,gold:0,items:[]};};if(typeof parent!=='undefined'&&parent.socket&&parent.socket.on){parent.socket.on('kill_credit',function(d){if(!d||!d.mtype)return;lastKill={mtype:String(d.mtype),at:Date.now()};monsterRow(d.mtype).kills++;});parent.socket.on('drop',function(d){if(!d||!d.id||!lastKill||Date.now()-lastKill.at>2000)return;chestMonster[d.id]=lastKill.mtype;var keys=Object.keys(chestMonster);if(keys.length>200)delete chestMonster[keys[0]];});}character.on('loot',function(event){var mrow=monsterRow(event&&chestMonster[event.id]||(lastKill&&Date.now()-lastKill.at<60000?lastKill.mtype:'unknown'));var amount=Number(event&&event.gold);if(isFinite(amount)&&amount>0){loot.gold+=amount;mrow.gold+=amount;}(event&&Array.isArray(event.items)?event.items:[]).forEach(function(it){if(!it||it.looter!==expected||!it.name)return;var quantity=Math.max(1,Math.floor(Number(it.q)||1)),level=Math.max(0,Math.min(20,Number(it.level)||0));addItem(loot.items,it,quantity,level);addItem(mrow.items,it,quantity,level);});});}}catch(e){loot=undefined;}
 var runtimeIntent={state:'Starting',since:Date.now(),updatedAt:Date.now(),map:String(character.map||''),target:'',destination:null,blockedBy:null};
 var combat={startedAt:startedAt,damageDealt:0,damageTakenPhysical:0,damageTakenMagical:0,healing:0,manaRestored:0,kills:0,deaths:0,attacks:0,potions:0,movingMs:0,combatMs:0,healerCoverageMs:0,kiteMoves:0};
 
 var economy;
 try{if(parent.socket&&parent.socket.on){economy={consumablesGold:0,consumed:0,unpriced:0,npcSalesGold:0};parent.socket.on('game_response',function(data){
  if(data && !data.failed && data.response==='gold_received' && data.cevent==='sell' && Number(data.gold)>0) economy.npcSalesGold+=Number(data.gold);
  if(!data||data.failed||!data.used||data.place!=='equip')return;
  var def=G.items[data.used];
  if(!def||(!def.gives&&def.type!=='elixir'))return;
  economy.consumed++;
  var price=Number(def.g);
  if(isFinite(price)&&price>0)economy.consumablesGold+=price;else economy.unpriced++;
  if(def.type==='pot')combat.potions++;
 });}}catch(e){economy=undefined;}
 function analysisItems(){
  if(typeof G==='undefined'||!G.items)return [];
  var rows=[],keys=['attack','armor','resistance','speed','range','hp','mp','str','dex','int','vit','frequency','mp_cost','mp_reduction','output','crit','critdamage','lifesteal','manasteal','gold','luck'];
  function append(it,location,slot){
   if(!it||!it.name||rows.length>=160)return;
   var def=G.items[it.name];if(!def||['pot','scroll','material','token','box','gem','misc'].indexOf(def.type)>=0)return;
   var props;try{props=typeof parent.calculate_item_properties==='function'?parent.calculate_item_properties(it,{'class':character.ctype,'map':character.map}):typeof item_properties==='function'?item_properties(it):null;}catch(e){return;}
   if(!props)return;var clean={};keys.forEach(function(key){var value=Number(props[key]);if(isFinite(value))clean[key]=value;});
   rows.push({name:it.name,level:it.level||0,location:location,slot:String(slot),properties:clean});
  }
  Object.keys(character.slots||{}).forEach(function(slot){if(slot.indexOf('trade')!==0)append(character.slots[slot],'equipment',slot);});
  (character.items||[]).forEach(function(it,slot){append(it,'bag',slot);});return rows;
 }

 function add(message){try{var text=typeof message==='string'?message:JSON.stringify(message);if(!text)text=String(message);queue.push(text.slice(0,500));if(queue.length>20)queue.shift();}catch(e){try{queue.push(String(message).slice(0,500));}catch(ignore){}}}
 if(typeof game_log==='function'){var original=game_log;game_log=function(){add(arguments[0]);return original.apply(this,arguments);};}
 if(typeof set_message==='function'){var originalSetMessage=set_message;set_message=function(message){var next=String(message||'Idle').slice(0,120);if(next!==runtimeIntent.state){runtimeIntent.state=next;runtimeIntent.since=Date.now();}runtimeIntent.updatedAt=Date.now();return originalSetMessage.apply(this,arguments);};}
 if(typeof window!=='undefined'){window.addEventListener('error',function(e){add('ERROR: '+e.message);});window.addEventListener('unhandledrejection',function(e){var r=e.reason,t;try{t=r&&typeof r==='object'?(r.message||(r.reason?r.reason+(r.place?' @'+r.place:''):JSON.stringify(r))):String(r);}catch(x){t=String(r);}add('ERROR: '+String(t).slice(0,200));});}
 add('Command Center: script initialization completed.');
 function category(def){var t=String((def&&def.type)||'');if(t==='pot')return 'Potions';if(t==='elixir')return 'Elixirs';if(t==='scroll')return 'Scrolls';if(['weapon','shield','source'].indexOf(t)>=0)return 'Weapons';if(['helmet','chest','pants','shoes','gloves','cape'].indexOf(t)>=0)return 'Armor';if(['ring','earring','amulet','belt','orb'].indexOf(t)>=0)return 'Accessories';if(def&&(def.e||def.exchange))return 'Exchangeables';if(['material','token','box','gem','misc'].indexOf(t)>=0)return 'Materials';return 'Other';}
 try{if(typeof parent!=='undefined'&&parent.socket&&parent.socket.on){parent.socket.on('hit',function(d){var damage=Number(d.damage)||0;if(d.hid===expected){combat.attacks++;combat.damageDealt+=damage;combat.healing+=Number(d.heal||d.lifesteal)||0;combat.manaRestored+=Number(d.manasteal)||0;}if(d.id===expected){if(d.source==='magic'||d.damage_type==='magical')combat.damageTakenMagical+=damage;else combat.damageTakenPhysical+=damage;}});parent.socket.on('kill_credit',function(){combat.kills++;});}}catch(e){}
 function sample(){var now=Date.now(),dt=Math.min(1000,now-lastSample);lastSample=now;if(character.moving)combat.movingMs+=dt;if(character.target)combat.combatMs+=dt;var priest=null,inHealRange=false;try{priest=typeof get_player==='function'&&get_player(__ALCC_PRIEST__);inHealRange=!!priest&&Math.hypot(character.x-priest.x,character.y-priest.y)<=(priest.range||160);if(inHealRange)combat.healerCoverageMs+=dt;}catch(e){}if(character.rip&&!wasRip){combat.deaths++;var attackers=0;try{var es=(typeof parent!=='undefined'&&parent.entities)||{};Object.keys(es).forEach(function(k){if(es[k]&&es[k].type==='monster'&&es[k].target===character.name)attackers++;});}catch(e){}var reason='burst damage',details='Death occurred during combat.';if(!priest) {reason='healer unavailable';details='Priest was not visible on the same map.';}else if(!inHealRange){reason='healer out of range';details='Outside the priest healing radius at death.';}else if(attackers>=3){reason='excessive monster count';details=attackers+' monsters were targeting this character.';}else if(typeof ALCombat!=='undefined'&&ALCombat.phase&&ALCombat.phase()==='engage'){reason='lost aggro / re-engagement';details='Death occurred while restoring tank control.';}failures.push({at:now,reason:reason,details:details});if(failures.length>10)failures.shift();add('FAILURE: '+reason+' — '+details);}wasRip=!!character.rip;try{if(typeof ALCombat!=='undefined'&&ALCombat.metrics)combat.kiteMoves=ALCombat.metrics.kiteMoves||0;}catch(e){}}
 setInterval(sample,250);
 // A snapshot that throws while building the payload must not leave pending set: that silenced telemetry for good.
 function pulse(){if(pending)return;pending=true;try{pulseBody();}catch(e){pending=false;add('ERROR: telemetry pulse: '+String(e&&(e.message||e)).slice(0,200));}}
 function pulseBody(){
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
  try{var effects=c.s||{};Object.keys(effects).sort().forEach(function(id){if(id==='monsterhunt'||activeEffects.length>=64)return;var effect=effects[id];if(!effect)return;var row={id:String(id).slice(0,80)};var effectMs=Number(effect&&effect.ms);if(isFinite(effectMs)&&effectMs>=0)row.ms=effectMs;var effectPoints=Number(effect&&effect.p);if(id==='coop'&&isFinite(effectPoints)&&effectPoints>=0)row.points=effectPoints;activeEffects.push(row);});}catch(e){}
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
  var farmSnap;try{var entity=typeof parent!=='undefined'&&parent.entities&&parent.entities[c.target];var party=typeof parent!=='undefined'&&parent.party||{};var participants=Object.keys(party).filter(function(name){return typeof CONFIG==='undefined'||name!==CONFIG.MERCHANT;});if(participants.indexOf(expected)<0)participants.push(expected);var expeditionPhase;try{expeditionPhase=typeof EventExpedition!=='undefined'&&EventExpedition.snapshot().phase;}catch(e){}farmSnap={activity:c.cave?'cave':c.ctype&&c.ctype!=='merchant'?(['forming','engaging','returning'].indexOf(expeditionPhase)>=0||["mrgreen","mrpumpkin","horseman","graveyard","crabxx","franky","icegolem","snowman","dragold","grinch","wabbit","pinkgoo","slenderman","tiger","phoenix","jr","greenjr"].indexOf(entity&&entity.mtype)>=0?'events':'farming'):undefined,monster:String(entity&&entity.mtype||''),participants:participants.sort().slice(0,20),build:JSON.stringify(equipment.map(function(it){return [it.slot,it.name,it.level];}).sort()),effects:activeEffects.map(function(it){return it.id;}).sort(),goldMultiplier:n(c.goldm||1)};}catch(e){}
  var policySnap;try{if(typeof RuntimePolicy!=='undefined')policySnap=RuntimePolicy.snapshot();}catch(e){}
  try{if(typeof EventExpedition!=='undefined'&&EventExpedition.observeMetrics)EventExpedition.observeMetrics(combat,loot);}catch(e){}
  var trackerSnap;try{var tr=parent.tracker;if(tr&&tr.monsters){trackerSnap={monsters:{},exchanges:{}};['monsters','exchanges'].forEach(function(key){Object.keys(tr[key]||{}).slice(0,500).forEach(function(id){var value=Number(tr[key][id]);if(isFinite(value)&&value>=0)trackerSnap[key][id]=value;});});}}catch(e){}
  var payload={commandProtocol:2,commandReceipts:RuntimeCommandInbox.receipts(),bankHub:typeof BankCoordinator!=='undefined'?BankCoordinator.snapshot():undefined,loopGuard:typeof MerchantLoopGuard!=='undefined'?MerchantLoopGuard.snapshot():undefined,eventExpedition:typeof EventExpedition!=='undefined'?EventExpedition.snapshot():undefined,compoundProgress:typeof CompoundProduction!=='undefined'&&CompoundProduction.snapshot?CompoundProduction.snapshot():undefined,economy:economy,buildItems:analysisItems(),runtimePolicy:policySnap,ticket:ticket,character:expected,sequence:sequence++,stats:{maxXp:isFinite(Number(c.max_xp))?Number(c.max_xp):undefined,cc:isFinite(Number(c.cc))?Number(c.cc):undefined,attack:n(c.attack),frequency:n(c.frequency),speed:n(c.speed),range:n(c.range),tracker:trackerSnap,skin:String(c.skin||''),hp:n(c.hp),max_hp:n(c.max_hp),mp:n(c.mp),max_mp:n(c.max_mp),gold:n(c.gold),xp:n(c.xp),level:n(c.level),map:String(c.map||''),x:n(c.x),y:n(c.y),target:String(c.target||''),server:(function(){try{if(typeof parent!=='undefined'&&parent){if(parent.server_region&&parent.server_name)return String(parent.server_region)+' '+String(parent.server_name);if(parent.server_identifier)return String(parent.server_identifier);}return '';}catch(e){return ''}})(),armor:n(c.armor),resistance:n(c.resistance),evasion:n(c.evasion),goldMultiplier:n(c.goldm||1),luckMultiplier:n(c.luckm||1),xpMultiplier:n(c.xpm||1)},intent:runtimeIntent,movement:movementSnap,coordination:coordinationSnap,merchantTransactions:merchantTransactionsSnap,activeEffects:activeEffects,loot:loot,farmContext:farmSnap,inventory:inventory,stand:stand,standOpen:!!c.stand,equipment:equipment,hunt:hunt,combat:combat,network:(function(){try{var raw=Number(c.ping||(typeof parent!=='undefined'&&(parent.ping||parent.last_ping))||0);return {pingMs:isFinite(raw)&&raw>=0?raw:0,socketConnected:!!(typeof parent!=='undefined'&&parent.socket&&parent.socket.connected!==false)};}catch(e){return {pingMs:0,socketConnected:false};}})(),kite:kd,cave:caveSnap,dragold:dragoldSnap,upgradeHistory:(typeof UpgradeProduction!=='undefined'?UpgradeProduction.history():undefined),upgradeProduction:(typeof UpgradeProduction!=='undefined'?UpgradeProduction.snapshot():undefined),bankSort:bankSortSnap,failures:failures,logs:logs};
  if(bankAvailable){payload.bank=bank;payload.bankCapturedAt=bankCapturedAt;}
  try{fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify(payload)}).then(function(response){return response.json();}).then(function(data){RuntimeCommandInbox.receive((data&&data.commands)||[]);}).catch(function(){}).finally(function(){clearTimeout(timeout);pending=false;});}catch(e){clearTimeout(timeout);pending=false;}
 }
 pulse();setInterval(pulse,5000);
})();
