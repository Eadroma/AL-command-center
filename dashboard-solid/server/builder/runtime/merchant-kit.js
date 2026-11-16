
 var kit=__ALCC.kit; if(!kit||!kit.enabled||!kit.rules||!kit.rules.length) return false;
 for (var i=0;i<kit.rules.length;i++){
  var rule=kit.rules[i];
  var farmer=get_player(rule.character);
  if(!farmer||farmer.rip) continue;
  var worn=farmer.slots&&farmer.slots[rule.slot];
  if(worn&&worn.name===rule.item&&(worn.level||0)>=rule.minLevel&&(!rule.shiny||worn.shiny)) continue;
  var best=-1,bestLv=-1,bestShiny=false,items=character.items||[];
  for(var j=0;j<items.length;j++){
   var it=items[j]; if(!it||it.l||it.name!==rule.item) continue;
   if((it.level||0)<rule.minLevel) continue; if(rule.shiny&&!it.shiny) continue;
   var lv=it.level||0; if(lv>bestLv||(lv===bestLv&&it.shiny&&!bestShiny)){best=j;bestLv=lv;bestShiny=!!it.shiny;}
  }
  if(best<0){
   if(character.bank&&typeof each_bank_item==='function'&&character.esize>0){
    var found=null;
    each_bank_item(function(bit,pack,slot){
     if(!bit||bit.name!==rule.item) return;
     if((bit.level||0)<rule.minLevel) return; if(rule.shiny&&!bit.shiny) return;
     if(!found||(bit.level||0)>(found.it.level||0)||((bit.level||0)===(found.it.level||0)&&bit.shiny&&!found.it.shiny)) found={pack:pack,slot:slot,it:bit};
    });
    if(found){
     await ensure_stand_closed();
     if(character.map!=='bank'){act('kit bank pull');await go_to('bank','kit from bank');return true;}
     try{await bank_retrieve(found.pack,found.slot);game_log('kit bank '+rule.item+' for '+rule.character);return true;}catch(e){game_log('kit bank: '+((e&&e.reason)||e));}
    }
   }
   continue;
  }
  if(worn&&worn.name===rule.item&&bestLv<=(worn.level||0)&&(!rule.shiny||!!worn.shiny)) continue;
  if(typeof near_farmer==='function'&&!near_farmer(rule.character)){
   act('kit deliver '+rule.item+' to '+rule.character);
   await go_to({map:farmer.map,x:farmer.x,y:farmer.y},'kit '+rule.character,40);
   return true;
  }
  try{
   await send_item(rule.character,best,1);
   game_log('kit handoff '+rule.item+'+'+bestLv+' '+rule.slot+' -> '+rule.character);
   act('kit '+rule.item+' to '+rule.character);
   return true;
  }catch(e){game_log('kit handoff: '+((e&&e.reason)||e));}
 }
 return false;
