/** Read-only instrumentation: game-confirmed consumption and game-calculated item properties. */
export const analysisTelemetry = `
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
`;
