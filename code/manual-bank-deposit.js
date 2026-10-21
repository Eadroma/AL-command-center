/** Explicit one-off deposits selected in the dashboard; no recurring rule changes. */
var ManualBankDeposit = (function () {
 var queue=[], seen={}, running=false, journal={}, storageKey='alcc:manual-deposits:'+character.name;
 try{journal=typeof get==='function'&&get(storageKey)||{};}catch(e){}
 function persist(){if(typeof set==='function')set(storageKey,journal);}
 function result(id,state,message){journal[id].state=state;journal[id].message=String(message||'').slice(0,180);persist();}
 Object.keys(journal).forEach(function(id){var row=journal[id];seen[id]=true;if(row.state==='queued')queue.push(row.command);else if(row.state==='running')result(id,'review','Interrupted deposit: inspect inventory and bank before retrying');});
 function matches(it,selection){return it&&it.name===selection.name&&(it.level||0)===selection.level&&(it.q||1)===selection.quantity&&!it.l&&!it.b&&(!it.oo||it.oo===character.name);}
 function locate(selection,original){
  if(original&&character.items.indexOf(original)>=0&&matches(original,selection))return character.items.indexOf(original);
  var candidates=[];(character.items||[]).forEach(function(it,i){if(matches(it,selection))candidates.push(i);});
  return candidates.length===1?candidates[0]:-1;
 }
 function request(command){
  if(!command||!command.deposit||seen[command.id]||queue.length>=42)return false;
  journal[command.id]={command:command,state:'queued',message:''};persist();seen[command.id]=true;queue.push(command);return true;
 }
 async function tick(){
  if(running||!queue.length||character.rip||chores_in_progress||smart.moving||character.moving||character.q&&(character.q.upgrade||character.q.compound||character.q.exchange))return;
  if(!BankCoordinator.acquire('manual'))return;
  running=true;chores_in_progress=true;
  try{
   // Remember the actual selected objects before movement; refuse replaced slots.
   var work=queue.splice(0).map(function(command){var selection=command.deposit;var original=character.items[selection.slot];return {id:command.id,selection:selection,original:matches(original,selection)?original:null};});
   work=work.filter(function(job){if(job.original)return true;result(job.id,'failed','Selected item changed');game_log('Manual bank deposit skipped: selected item changed');return false;});
   if(!work.length)return;
   await go_to('bank','manual bank deposit');
   for(var wait=0;!character.bank&&wait<20;wait++)await sleep(250);
   if(!character.map||character.map.indexOf('bank')!==0||!character.bank)throw Error('Bank entry unavailable');
   BankCoordinator.stage('bank');
   for(var i=0;i<work.length;i++){
    var job=work[i],slot=locate(job.selection,job.original);
    if(slot<0){result(job.id,'failed','Selected item changed');game_log('Manual bank deposit skipped: '+job.selection.name+' changed');continue;}
    var destination=find_empty_bank_slot(character.items[slot]);
    if(!destination){result(job.id,'failed','Bank has no free compatible space');game_log('Manual bank deposit: no space for '+job.selection.name);continue;}
    var floor=bank_pack_floor(destination.pack);if(character.map!==floor)await smart_move(floor);
    if(character.map!==floor)throw Error('Bank floor unavailable');
    slot=locate(job.selection,job.original);if(slot<0){result(job.id,'failed','Selected item changed during travel');continue;}
    BankCoordinator.begin('deposit',job.selection.name,job.selection.level,job.selection.quantity,destination.pack);
    result(job.id,'running','Deposit issued; awaiting inventory receipt');
    try{await bank_store(slot,destination.pack);
     for(var receiptWait=0;receiptWait<20&&character.items.indexOf(job.original)>=0;receiptWait++)await sleep(250);
     if(character.items.indexOf(job.original)>=0){result(job.id,'review','Server response received but selected item is still carried');continue;}
     result(job.id,'complete','Selected item no longer carried after acknowledged deposit');BankCoordinator.finish(true,'Manual deposit returned successfully');game_log('Manual bank deposit: '+job.selection.name+' +'+job.selection.level+' ×'+job.selection.quantity);}
    catch(e){result(job.id,'review','Deposit response uncertain; inspect bank before retrying');BankCoordinator.finish(false,'Manual deposit failed; no hold');game_log('Manual bank deposit failed: '+(e.reason||e.message||e));}
   }
  }catch(e){if(typeof work!=='undefined')work.forEach(function(job){if(journal[job.id].state==='queued')queue.push(journal[job.id].command);});game_log('Manual bank deposit: '+(e.reason||e.message||e));}
  finally{
   try{if(character.map&&character.map.indexOf('bank')===0)await walk_to(cc_stand_spot(),'return after manual deposit');}
   catch(e){game_log('Manual bank return: '+(e.reason||e.message||e));}
   chores_in_progress=false;running=false;BankCoordinator.release('manual');
  }
 }
 setInterval(tick,500);
 return {request:request,tick:tick,matches:matches,locate:locate,status:function(id){return journal[id]||null;}};
})();
