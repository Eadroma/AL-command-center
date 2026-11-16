
 // Travel work wins over listing maintenance regardless of whether its lease has been acquired yet.
 if(typeof merchant_work_next==='function'){
  var nextStandWork=merchant_work_next();
  if(['bank','craft'].indexOf(nextStandWork)>=0||nextStandWork==='exchange'&&!(typeof merchant_remote_exchange_available==='function'&&merchant_remote_exchange_available()))return false;
 }
 if(typeof upgrade_target_complete==='function'&&(character.items||[]).some(function(it){return upgrade_target_complete(it)&&!(typeof listing_bank_stock_reserved==='function'&&listing_bank_stock_reserved(it));})) return false;
 var slots = character.slots || {};
 var tradeSlotCount=typeof merchant_trade_capacity==='function'?merchant_trade_capacity():16;
 var buySlotStart=tradeSlotCount-7;
 function shopHasListings(){for(var sn=1;sn<=tradeSlotCount;sn++){var si=slots['trade'+sn];if(si&&!si.b)return true;}return false;}
 var buy=__ALCC.buy||{enabled:false,orders:[],budget:0,reserveGold:0};
 var now=Date.now(),buyPostPending=!!__ALCC._buyPostAt&&now-__ALCC._buyPostAt<10000;
 var manageBuy=buy.managed||buy.enabled||(buy.orders&&buy.orders.length>0);
 var buyOrderCount=(buy.enabled&&buy.orders)?buy.orders.length:0;
 // Reserve only the last eight slots for real buy orders. Capacity follows the game.
 var reserveBuySlots=manageBuy&&buyOrderCount>0;
 var sellSlotMax=reserveBuySlots?buySlotStart-1:tradeSlotCount;
 var buyCandidate=null,hasBuy=false;
 var available=Math.min(buy.budget,Math.max(0,character.gold-buy.reserveGold));
 for(var outside=1;outside<buySlotStart;outside++){var pendingOrder=slots['trade'+outside];if(pendingOrder&&pendingOrder.b)available=Math.max(0,available-pendingOrder.price*(pendingOrder.q||1));}

 // Cancel buy orders outside the managed zone, or every buy when no orders remain.
 if(manageBuy&&!buyPostPending){
  for(var bn=1;bn<=tradeSlotCount;bn++){
   var buySlot=slots['trade'+bn];
   if(!buySlot||!buySlot.b) continue;
   var inBuyZone=bn>=buySlotStart&&bn<=tradeSlotCount;
   if(!reserveBuySlots||!inBuyZone){
    await ensure_stand_closed();
    await unequip('trade'+bn);
    game_log('cleared buy order on trade'+bn);
    return true;
   }
  }
 }

 if(reserveBuySlots)for(var b=0;b<8;b++){
  var order=buy.orders[b],owned=0,desired=0,current=slots['trade'+(buySlotStart+b)];
  if(order){
   (character.items||[]).forEach(function(it){if(it&&it.name===order.item&&(it.level||0)===order.level)owned+=it.q||1;});
   Object.keys(slots).forEach(function(key){var it=slots[key];if(it&&!it.b&&it.name===order.item&&(it.level||0)===order.level)owned+=it.q||1;});
   // The server caps upgradeable/compound equipment wishlists at 99 units.
   // Compare the live slot against that posted batch, not the uncapped target.
   var definition=typeof G!=='undefined'&&G.items?G.items[order.item]:null;
   var batchLimit=definition&&(definition.upgrade||definition.compound)?99:9999;
   desired=Math.min(batchLimit,Math.max(0,order.quantity-owned),Math.floor(available/order.price));available-=desired*order.price;
  }
  if(!buyPostPending&&current&&current.b&&(!order||!desired||current.name!==order.item||(current.level||0)!==order.level||current.price!==order.price||(current.q||1)!==desired)){
   await ensure_stand_closed();await unequip('trade'+(buySlotStart+b));return true;
  }
  if(current&&current.b)hasBuy=true;
  if(order&&desired&&!current&&!buyCandidate&&!buyPostPending)buyCandidate={slot:buySlotStart+b,rule:order,quantity:desired};
 }

 function ruleFor(it) {
  if (!it || it.l || it.b) return null;
  for (var r = 0; r < __ALCC.listings.length; r++) {
   var rule = __ALCC.listings[r];
   if (rule.item === it.name && rule.level === (it.level || 0)) return rule;
  }
  return null;
 }
 for (var n=1;n<=tradeSlotCount;n++) {
  var existing=slots['trade'+n]; if (!existing || existing.b) continue;
  var rule=__ALCC.standEnabled && !(reserveBuySlots&&n>=buySlotStart) ? ruleFor(existing) : null;
  if (!rule || existing.price!==rule.price) {
   await ensure_stand_closed();
   if (character.esize<1) { act('stand paused: free a bag slot to update listings'); return true; }
   await unequip('trade'+n); return true;
  }
 }
 if (!__ALCC.standEnabled&&!buyCandidate&&!hasBuy&&!buyPostPending) { await ensure_stand_closed(); return false; }
 var candidate=-1, selectedRule=null;
 for (var i=0;i<(character.items||[]).length;i++) {
  var item=character.items[i], match=__ALCC.standEnabled?ruleFor(item):null; if(!match)continue;
  if(typeof stand_inventory_allowed==='function'&&!stand_inventory_allowed(item))continue;
  if(item.name==='tracker' && typeof tracker_keep_bag==='function' && bag_named_count('tracker')<=tracker_keep_bag()) continue;
  var listedSlot=null;
  for(var j=1;j<=tradeSlotCount;j++){
   var listedItem=slots['trade'+j];
   if(listedItem&&!listedItem.b&&listedItem.name===item.name&&(listedItem.level||0)===(item.level||0)){listedSlot='trade'+j;break;}
  }
  if(!listedSlot){candidate=i;selectedRule=match;break;}
  // Keep a valid live stack intact. Unequipping it does not merge it with the
  // bag stack: it creates two inventory stacks and causes an unlist/relist loop.
  // The bag surplus is listed naturally after the current trade stack sells.
 }
 if(candidate<0 && !__ALCC.standEnabled&&!shopHasListings()&&!buyCandidate&&!hasBuy&&!buyPostPending) { await ensure_stand_closed(); return false; }
 if(candidate<0&&__ALCC.standEnabled&&typeof maybe_restock_listing_from_bank==='function'){
  if(await maybe_restock_listing_from_bank())return true;
 }
 if(character.c&&(character.c.fishing||character.c.mining))return false;
 function standInventorySlot(){
  if(typeof merchant_stand_item_slot==='function')return merchant_stand_item_slot();
  var preferred=['supercomputer','computer','stand0'],bag=character.items||[];
  for(var p=0;p<preferred.length;p++)for(var i=0;i<bag.length;i++)if(bag[i]&&bag[i].name===preferred[p])return i;
  return typeof find_item==='function'?find_item('stand0'):(typeof locate_item==='function'?locate_item('stand0'):-1);
 }
 var standItem=standInventorySlot();
 var ownsStand=!!(character.stand||character.standed)||standItem>=0||(typeof has_stand==='function'&&has_stand());
 if(!ownsStand)return false;
 var park=SHOP_XY.market;
 var needsStandWork=candidate>=0||!!buyCandidate||buyPostPending;
 // standEnabled means the shop itself is intentional, even while its configured
 // stock is temporarily empty. Keep it parked/open so new drops can be listed.
 var keepListedOpen=__ALCC.standEnabled||shopHasListings()||hasBuy;
 // NPC sell/exchange/dump must beat idle stand reopen. Listings stay on trade
 // slots while the stand is closed, so keepListedOpen alone used to yank the
 // mule back to market every tick and cancel Gabriel/Xyn walks.
 var townChore=(typeof locate_exchange_item==='function'&&locate_exchange_item()!==-1&&!(typeof merchant_remote_exchange_available==='function'&&merchant_remote_exchange_available()))
  ||(typeof bag_needs_dump==='function'&&bag_needs_dump())

  ||(typeof locate_dexscroll_item==='function'&&locate_dexscroll_item()!==-1)

  ||(typeof accessory_work_pending==='function'&&accessory_work_pending());
 // Production batches own travel even when new stand listings are waiting.
 // Posting those listings must not interrupt Xyn or the upgrade NPC.
 if(typeof refresh_production_trip==='function'){
  var standTrip=refresh_production_trip();
  if(standTrip&&!((standTrip==='exchange'||standTrip==='craft')&&typeof merchant_remote_exchange_available==='function'&&merchant_remote_exchange_available()))return false;
 }
 // Leave bank only when there is new list/buy work. On main, also walk back to reopen
 // an already-listed stand that was closed — but not while a town chore is pending.
 if(character.map==='bank'||character.map!=='main'||simple_distance(character,park)>24){
  if(character.map==='bank'&&!needsStandWork) return false;
  if(!needsStandWork&&!keepListedOpen) return false;
  if(!needsStandWork&&townChore) return false;
  act(character.map==='bank'?'leave bank for stand':'town stand');
  await go_to('market','open stand',20);
  return true;
 }
 if(character.moving||smart.moving)return true;
 if(!(character.stand||character.standed)){
  if(!needsStandWork&&townChore) return false;
  if(__ALCC._standRetryAt&&Date.now()-__ALCC._standRetryAt<3000)return true;
  __ALCC._standRetryAt=Date.now();
  var standSlot=standInventorySlot();
  try{
   if(standSlot!==-1)await open_stand(standSlot);else await open_stand();
   for(var openWait=0;openWait<4&&!(character.stand||character.standed);openWait++)await sleep(250);
  }catch(e){game_log('stand: '+((e&&e.reason)||e));act('stand open failed');return true;}
  if(!(character.stand||character.standed)){game_log('stand remains closed after open_stand (slot '+standSlot+')');act('stand still closed');return true;}
  game_log('stand opened (slot '+standSlot+')');
  __ALCC._standRetryAt=0;
  act('stand open · configured listings');
  return true;
 }
 if(buyCandidate){
  var wishlistTx=typeof MerchantTransactions!=='undefined'?MerchantTransactions.begin('stand_buy',buyCandidate.rule.item+' +'+buyCandidate.rule.level+' x'+buyCandidate.quantity+' @'+buyCandidate.rule.price):null;
  if(typeof MerchantTransactions!=='undefined'&&!wishlistTx)return true;
  try{
  await wishlist(buyCandidate.slot,buyCandidate.rule.item,buyCandidate.rule.price,buyCandidate.rule.level,buyCandidate.quantity);
   __ALCC._buyPostAt=Date.now();
   game_log('posted buy order '+buyCandidate.rule.item+' x'+buyCandidate.quantity);
   if(wishlistTx)MerchantTransactions.commit(wishlistTx,'posted trade'+buyCandidate.slot);
  }catch(e){if(wishlistTx)MerchantTransactions.fail(wishlistTx,(e&&e.reason)||e);game_log('wishlist: '+((e&&e.reason)||e));}
  return true;
 }
 if(candidate>=0){
  slots=character.slots||{};
  for(var free=1;free<=sellSlotMax;free++)if(!slots['trade'+free]){
   var current=character.items[candidate];
   if(!current||ruleFor(current)!==selectedRule)return true;
   var listingTx=typeof MerchantTransactions!=='undefined'?MerchantTransactions.begin('stand_sell',current.name+' +'+(current.level||0)+' x'+(current.q||1)+' @'+selectedRule.price):null;
   if(typeof MerchantTransactions!=='undefined'&&!listingTx)return true;
   try{
    await trade(candidate,free,selectedRule.price,current.q||1);
    if(typeof release_listing_bank_stock==='function')release_listing_bank_stock(current);
    game_log('listed '+current.name+' +'+(current.level||0)+' @'+selectedRule.price);
    if(listingTx)MerchantTransactions.commit(listingTx,'posted trade'+free);
   }catch(e){if(listingTx)MerchantTransactions.fail(listingTx,(e&&e.reason)||e);game_log('list: '+((e&&e.reason)||e)+' '+((current&&current.name)||'?'));}
   return true;
  }
  act('stand full · no free trade slot for '+selectedRule.item);
  return true;
 }
 // Idle with stand open: do not consume the tick so upgrades/bank can run.
 act('stand open · configured listings');
 return false;
