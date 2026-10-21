/** Durable delivery acknowledgements. Interrupted non-idempotent actions require review. */
var RuntimeCommandInbox = (function () {
 var key='alcc:command-inbox:'+character.name, rows={};
 try { rows=typeof get==='function'&&get(key)||{}; } catch(e) {}
 function save(){if(typeof set==='function')set(key,rows);}
 Object.keys(rows).forEach(function(id){var r=rows[id];if(r.state==='running'&&r.command.type!=='deposit_bank'&&r.command.type!=='exit_cave'){r.state='review';r.message='CODE restarted before completion was confirmed';}});
 function terminal(state){return ['complete','failed','review'].indexOf(state)>=0;}
 function finish(r,state,message){r.state=state;r.message=String(message||'').slice(0,180);r.at=Date.now();save();}
 function receive(commands){
  commands.forEach(function(c){if(!c||typeof c.id!=='string'||rows[c.id])return;rows[c.id]={command:c,state:'queued',at:Date.now(),message:''};save();});
  var ids=Object.keys(rows);if(ids.length>200){ids.filter(function(id){return terminal(rows[id].state);}).sort(function(a,b){return rows[a].at-rows[b].at;}).slice(0,ids.length-200).forEach(function(id){delete rows[id];});save();}
  tick();
 }
 function tick(){Object.keys(rows).forEach(function(id){
  var r=rows[id],c=r.command;if(terminal(r.state))return;
  try {
   if(c.type==='deposit_bank'&&typeof ManualBankDeposit!=='undefined'){
    var state=ManualBankDeposit.status&&ManualBankDeposit.status(c.id);
    if(state&&terminal(state.state)){finish(r,state.state,state.message);return;}
    if(!state&&ManualBankDeposit.request(c)) {r.state='running';save();}return;
   }
   if(c.type==='sort_bank'&&typeof ALCCBankSorter!=='undefined'){
    var s=ALCCBankSorter.snapshot();if(s.commandId===id&&['complete','failed'].indexOf(s.state)>=0){finish(r,s.state,s.message);return;}
    if(r.state==='queued'&&!['queued','running'].includes(s.state)) {r.state='running';save();if(!ALCCBankSorter.request(c))finish(r,'failed','Bank sorter declined command');}return;
   }
   if(c.type==='resolve_upgrade'&&typeof UpgradeProduction!=='undefined'){
    r.state='running';save();finish(r,UpgradeProduction.resolve(c)?'complete':'failed','Upgrade resolution processed');return;
   }
   if(c.type==='exit_cave'&&typeof CaveDreams!=='undefined'){
    if(r.state==='running'&&!(character.cave||String(character.map).indexOf('cave')===0)){finish(r,'complete','Observed outside Cave Dreams');return;}
    if(r.state==='queued'||r.state==='running'){r.state='running';save();CaveDreams.requestExit(c);}return;
   }
   finish(r,'failed','This script does not support the requested command');
  } catch(e){finish(r,'review',e&&e.message||'Unconfirmed command; inspect game state');}
 });}
 function receipts(){tick();return Object.keys(rows).filter(function(id){return terminal(rows[id].state);}).slice(-200).map(function(id){return {id:id,state:rows[id].state,message:rows[id].message};});}
 setInterval(tick,1000);
 return {receive:receive,receipts:receipts};
})();
