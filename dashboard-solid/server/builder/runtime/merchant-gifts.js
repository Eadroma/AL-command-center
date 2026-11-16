
 var gifts=__ALCC.gifts; if(!gifts||!gifts.enabled||!gifts.rules||!gifts.rules.length) return false;
 var sent={}; try{sent=get('gift_sent')||{};}catch(e){sent={};}
 function farmer_have(farmer,name,level){
  if(!farmer) return 0;
  var n=0,items=farmer.items||[];
  for(var i=0;i<items.length;i++){var it=items[i];if(it&&it.name===name&&(it.level||0)===level)n+=it.q||1;}
  if(farmer.slots){for(var slot in farmer.slots){var eq=farmer.slots[slot];if(eq&&eq.name===name&&(eq.level||0)===level)n+=eq.q||1;}}
  return n;
 }
 for(var i=0;i<gifts.rules.length;i++){
  var rule=gifts.rules[i];
  var key=rule.character+':'+rule.item+':'+(rule.level||0);
  var already=sent[key]||0;
  var farmer=get_player(rule.character);
  if(!farmer||farmer.rip) continue;
  var have=Math.max(already,farmer_have(farmer,rule.item,rule.level||0));
  if(have>=rule.quantity) continue;
  var need=rule.quantity-have;
  var items=character.items||[],best=-1;
  for(var j=0;j<items.length;j++){
   var it=items[j]; if(!it||it.l||it.b||it.name!==rule.item) continue;
   if((it.level||0)!==(rule.level||0)) continue;
   best=j; break;
  }
  if(best<0) continue;
  if(typeof near_farmer==='function'&&!near_farmer(rule.character)){
   act('gift '+rule.item+' to '+rule.character);
   await go_to({map:farmer.map,x:farmer.x,y:farmer.y},'gift '+rule.character,40);
   return true;
  }
  var q=Math.min(need,items[best].q||1);
  try{
   await send_item(rule.character,best,q);
   sent[key]=already+q;
   try{set('gift_sent',sent);}catch(e2){}
   game_log('gift '+rule.item+'+'+(rule.level||0)+' x'+q+' -> '+rule.character);
   act('gift '+rule.item+' to '+rule.character);
   return true;
  }catch(e){game_log('gift: '+((e&&e.reason)||e));}
 }
 return false;
