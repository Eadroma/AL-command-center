
 var cons=__ALCC.consumables; if(!cons||!cons.enabled||!cons.rules||!cons.rules.length) return false;
 function bag_count(name){var n=0,items=character.items||[];for(var i=0;i<items.length;i++){var it=items[i];if(it&&it.name===name)n+=it.q||1;}return n;}
 function farmer_count(farmer,name){if(!farmer)return 0;var n=0,items=farmer.items||[];for(var i=0;i<items.length;i++){var it=items[i];if(it&&it.name===name)n+=it.q||1;}if(farmer.slots){for(var slot in farmer.slots){var eq=farmer.slots[slot];if(eq&&eq.name===name)n+=eq.q||1;}}return n;}
 for(var i=0;i<cons.rules.length;i++){
  var rule=cons.rules[i];
  var farmer=get_player(rule.character);
  if(!farmer||farmer.rip) continue;
  var have=farmer_count(farmer,rule.item);
  if(have>=rule.minQty) continue;
  var target=rule.targetQty||rule.minQty;
  var maximum=rule.maxQty||target;
  target=Math.min(target,maximum);
  var need=Math.max(0,target-have);
  if(need<1) continue;
  var fromBag=bag_count(rule.item);
  var cfg=typeof CONFIG!=='undefined'&&CONFIG?CONFIG:{};
  var reserve=rule.item===cfg.MPOT?(cfg.SELF_MPOT_RESERVE||0):rule.item===cfg.HPOT?(cfg.SELF_HPOT_RESERVE||0):0;
  var available=Math.max(0,fromBag-reserve);
  if(available<1&&(rule.source==='bank'||rule.source==='either')&&character.bank&&typeof each_bank_item==='function'&&character.esize>0){
   var found=null;
   each_bank_item(function(bit,pack,slot){if(!bit||bit.name!==rule.item)return;if(!found)found={pack:pack,slot:slot};});
   if(found){
    await ensure_stand_closed();
    if(character.map!=='bank'){act('consumable bank');await go_to('bank','consumable from bank');return true;}
    try{await bank_retrieve(found.pack,found.slot);game_log('consumable bank '+rule.item+' for '+rule.character);return true;}catch(e){game_log('consumable bank: '+((e&&e.reason)||e));}
   }
  }
  fromBag=bag_count(rule.item); available=Math.max(0,fromBag-reserve);
  if(available<1) continue;
  if(typeof near_farmer==='function'&&!near_farmer(rule.character)){
   act('consumable '+rule.item+' to '+rule.character);
   await go_to({map:farmer.map,x:farmer.x,y:farmer.y},'consumable '+rule.character,40);
   return true;
  }
  var slot=-1,items=character.items||[];
  for(var j=0;j<items.length;j++){if(items[j]&&items[j].name===rule.item){slot=j;break;}}
  if(slot<0) continue;
  var q=Math.min(need,items[slot].q||1,available);
  try{
   await send_item(rule.character,slot,q);
   game_log('consumable '+rule.item+' x'+q+' -> '+rule.character);
   act('consumable '+rule.item+' to '+rule.character);
   return true;
  }catch(e){game_log('consumable: '+((e&&e.reason)||e));}
 }
 return false;
