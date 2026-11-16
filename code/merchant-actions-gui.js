/** Executable HUD controls. Bank sorting calls the same request entry point
 * used by dashboard telemetry commands, including the existing ALData sync. */
var MerchantActionsGUI=(function(){
 var root,body,button,recallButton,caveButton,cryptButton,cryptAbortButton,cryptResumeButton,timer,sequence=0,feedback='',caveSentAt=0;
 function state(){
  var sorter=typeof ALCCBankSorter!=='undefined'?ALCCBankSorter:null;
  var status=sorter&&typeof sorter.snapshot==='function'?sorter.snapshot():null;
  var busy=!!status&&(status.state==='queued'||status.state==='running');
  var available=!!sorter&&typeof sorter.request==='function'&&character.ctype==='merchant'&&!character.rip;
  return {available:available,busy:busy,status:status,reason:character.rip?'Merchant is dead':character.ctype!=='merchant'?'Merchant only':!sorter?'Bank sorter is not ready':''};
 }
 function requestSort(){
  var current=state();
  if(!current.available||current.busy){feedback=current.busy?'Bank sort already queued or running':current.reason;return false;}
  try{
   var accepted=ALCCBankSorter.request({id:'hud-sort-'+Date.now()+'-'+(++sequence),type:'sort_bank',createdAt:Date.now()});
   feedback=accepted?'Bank sort requested':'Bank sort already queued or running';
   if(accepted&&typeof game_log==='function')game_log('HUD: bank sort requested');
   return !!accepted;
  }catch(e){feedback='Could not request bank sort: '+String(e&&(e.reason||e.message)||e);return false;}
 }
 function recallState(){
  try {var expedition=typeof EventExpedition!=='undefined'?EventExpedition:null;var mission=expedition&&expedition.snapshot();return {available:character.ctype==='merchant'&&!character.rip&&!!expedition&&typeof expedition.recall==='function'&&!!mission&&['forming','engaging'].indexOf(mission.phase)>=0,mission:mission};}catch(e){return {available:false};}
 }
 function requestRecall(){
  if(!recallState().available)return false;
  try{var accepted=EventExpedition.recall();feedback=accepted?'Team recalled: returning to the merchant and unloading loot':'No active expedition to recall';return !!accepted;}catch(e){feedback='Could not recall team: '+String(e&&e.message||e);return false;}
 }
 function caveState(){
  var board=typeof __ALCC!=='undefined'&&__ALCC.eventExpedition||{};
  var farmers=typeof __ALCC!=='undefined'&&Array.isArray(__ALCC.farmers)?__ALCC.farmers:[];
  var reason=character.ctype!=='merchant'?'Merchant only':character.rip?'Merchant is dead':!farmers.length?'No enabled farmers':board.enabled?'Event expedition owns the warrior and priest':typeof send_cm!=='function'?'send_cm unavailable':Date.now()-caveSentAt<15000?'Cave start just sent':'';
  return {available:!reason,reason:reason,farmers:farmers};
 }
 /** Asks every farmer to open one Cave Dreams gather window; the warrior forms the trio at Dorr. */
 async function requestCave(){
  var current=caveState();
  if(!current.available){feedback=current.reason;return false;}
  caveSentAt=Date.now();
  try{
   var visit=typeof cave_info==='function'?await cave_info():null;
   if(visit&&visit.available===false&&!visit.unlimited){feedback='Cave visit already used today'+(visit.resets?' · resets '+new Date(visit.resets).toLocaleTimeString():'');return false;}
  }catch(e){}
  // Leaving first avoids cant_kick when the merchant joined the party before the warrior.
  try{if(character.party&&typeof leave_party==='function')await leave_party();}catch(e){}
  send_cm(current.farmers,{t:'cave',a:'start'});
  feedback='Cave start sent to '+current.farmers.join(', ')+'. The warrior gathers the trio at Dorr.';
  if(typeof game_log==='function')game_log('HUD: cave start requested');
  return true;
 }
 function cryptState(){
  var supply=typeof CryptSupply!=='undefined'?CryptSupply:null;var run=supply&&supply.snapshot?supply.snapshot():null;
  var board=typeof __ALCC!=='undefined'&&__ALCC.eventExpedition||{};var missing=supply&&supply.missingRoster?supply.missingRoster():[];
  var reason=character.ctype!=='merchant'?'Merchant only':character.rip?'Merchant is dead':!supply?'Crypt module is not loaded':run&&run.active?'Crypt run '+run.phase+(run.id?' · '+run.id:''):board.enabled?'Event expedition owns the warrior and priest':missing.length?'Not ready: '+missing.join(', '):!supply.keysAvailable()?'No Crypt Key in bank or bags':'';
  return {available:!reason,reason:reason,run:run};
 }
 /** Warrior, priest and ranger always go together; CryptSupply aborts if one of them answers busy. */
 function requestCrypt(){
  var current=cryptState();if(!current.available){feedback=current.reason;return false;}
  try{var accepted=CryptSupply.start();feedback=accepted?'Crypt start sent to the trio. The merchant brings one key to the Cave door.':'Crypt start refused';if(accepted&&typeof game_log==='function')game_log('HUD: crypt start requested');return !!accepted;}
  catch(e){feedback='Could not start the crypt: '+String(e&&e.message||e);return false;}
 }
 /** Rejoin the last instance by id: no key is spent. */
 function requestCryptResume(){
  var current=cryptState();var supply=typeof CryptSupply!=='undefined'?CryptSupply:null;
  if(!supply||!supply.resumable||!supply.resumable()){feedback='No crypt instance to resume';return false;}
  if(current.run&&current.run.active){feedback=current.reason;return false;}
  try{var ok=supply.resume();feedback=ok?'Crypt resume sent: the trio rejoins '+current.run.id+' without a key.':'Crypt resume refused (trio not ready)';return !!ok;}
  catch(e){feedback='Could not resume the crypt: '+String(e&&e.message||e);return false;}
 }
 function requestCryptAbort(){
  try{var run=typeof CryptSupply!=='undefined'&&CryptSupply.snapshot();if(!run||!run.active)return false;var ok=CryptSupply.abort('HUD abort');feedback=ok?'Crypt abort sent: the trio leaves the instance.':'No active crypt run';return !!ok;}
  catch(e){feedback='Could not abort the crypt: '+String(e&&e.message||e);return false;}
 }
 function cryptLine(run){
  if(!run)return '';var kills=Object.keys(run.kills||{}).map(function(k){return k+' '+run.kills[k];}).join(' · ');
  var mins=run.openedAt?Math.round((Date.now()-run.openedAt)/60000)+' min':'';
  return 'Crypt '+run.phase+(run.id?' · '+run.id:'')+(mins?' · '+mins:'')+(kills?' · '+kills:'')+(run.reason?' · '+run.reason:'');
 }
 function el(tag,text){var node=parent.document.createElement(tag);if(text!==undefined)node.textContent=text;return node;}
 function render(){
  if(typeof parent==='undefined'||!parent.document||typeof MerchantMissionGUI==='undefined')return;
  if(!root||!root.isConnected){var old=parent.document.getElementById('alcc-merchant-actions');if(old)old.remove();root=el('details');root.id='alcc-merchant-actions';root.open=true;
   root.style.cssText='position:fixed;left:12px;top:380px;width:330px;max-height:45vh;overflow:auto;z-index:2100;background:#101722f5;color:#eaf0f8;border:1px solid #394759;border-radius:12px;padding:12px;font:13px/1.5 Arial,sans-serif;box-shadow:0 8px 28px #0006;box-sizing:border-box';
   var title=el('summary','Merchant actions');root.appendChild(title);button=el('button','Sort bank');button.type='button';button.title='Run the same bank sorter as the dashboard';button.style.cssText='display:block;width:100%;margin-top:12px;padding:10px;background:#244a43;color:#eaf0f8;border:1px solid #65d3b4;border-radius:7px;font:600 13px Arial;cursor:pointer';button.addEventListener('click',function(){button.disabled=true;requestSort();safeRender();});root.appendChild(button);
   recallButton=el('button','Recall team');recallButton.type='button';recallButton.title='Recall the active event duo to the merchant to unload loot. The archer keeps farming. Manual clients remain online.';recallButton.style.cssText=button.style.cssText;recallButton.addEventListener('click',function(){requestRecall();safeRender();});root.appendChild(recallButton);
   caveButton=el('button','Start cave');caveButton.type='button';caveButton.title='Send warrior, priest and ranger to Dorr for the daily Cave of Many Dreams. The merchant leaves the party so the trio can enter.';caveButton.style.cssText=button.style.cssText;caveButton.addEventListener('click',function(){caveButton.disabled=true;requestCave().then(safeRender,safeRender);});root.appendChild(caveButton);
   cryptButton=el('button','Start crypt');cryptButton.type='button';cryptButton.style.cssText=button.style.cssText;cryptButton.addEventListener('click',function(){cryptButton.disabled=true;requestCrypt();safeRender();});root.appendChild(cryptButton);
   cryptResumeButton=el('button','Resume crypt');cryptResumeButton.type='button';cryptResumeButton.title='Send warrior, priest and ranger back into the last crypt instance. No key is used.';cryptResumeButton.style.cssText=button.style.cssText;cryptResumeButton.addEventListener('click',function(){cryptResumeButton.disabled=true;requestCryptResume();safeRender();});root.appendChild(cryptResumeButton);
   cryptAbortButton=el('button','Abort crypt');cryptAbortButton.type='button';cryptAbortButton.title='Tell warrior, priest and ranger to leave the crypt now.';cryptAbortButton.style.cssText=button.style.cssText+';background:#4a2430;border-color:#d36585';cryptAbortButton.addEventListener('click',function(){requestCryptAbort();safeRender();});root.appendChild(cryptAbortButton);
   body=el('div');body.style.cssText='display:grid;gap:8px;margin-top:12px';root.appendChild(body);parent.document.body.appendChild(root);MerchantMissionGUI.makeMovable(root,title);MerchantMissionGUI.makeCloseable(root,title,'Merchant actions');
  }
  var current=state();button.disabled=!current.available||current.busy;button.style.opacity=button.disabled?'.5':'1';button.textContent=current.busy?'Sort bank · '+current.status.state:'Sort bank';
  var recall=recallState();recallButton.disabled=!recall.available;recallButton.style.opacity=recall.available?'1':'.5';recallButton.textContent=recall.mission&&['returning','blocked'].indexOf(recall.mission.phase)>=0?'Recall team · returning':'Recall team';
  var cave=caveState();caveButton.disabled=!cave.available;caveButton.style.opacity=cave.available?'1':'.5';caveButton.title=cave.reason||'Send warrior, priest and ranger to Dorr for the daily Cave of Many Dreams. The merchant leaves the party so the trio can enter.';
  var crypt=cryptState();cryptButton.disabled=!crypt.available;cryptButton.style.opacity=crypt.available?'1':'.5';cryptButton.title=crypt.reason||'Take one Crypt Key from the bank, give it to the warrior at the Cave door, then send warrior, priest and ranger into the new instance.';
  cryptAbortButton.hidden=!(crypt.run&&crypt.run.active);
  var canResume=typeof CryptSupply!=='undefined'&&CryptSupply.resumable&&CryptSupply.resumable();cryptResumeButton.hidden=!canResume;cryptResumeButton.disabled=false;
  if(root.style.display==='none'||!root.open)return;
  var scroll=root.scrollTop;body.replaceChildren();
  var explanation=el('p','Closes the stand and sorts each bank floor by category, item name, then highest level first. Uses the dashboard sorter and its ALData upload. Starts only when clicked.');explanation.style.cssText='font-size:12px;color:#a7b5c7;margin:0';body.appendChild(explanation);
  if(current.status){body.appendChild(el('strong',current.status.state+' · '+current.status.phase));body.appendChild(el('div',current.status.message));body.appendChild(el('small',current.status.moved+' moves · '+current.status.merged+' merges'));
   if(current.status.total>0){var progress=el('progress');progress.max=current.status.total;progress.value=Math.min(current.status.total,current.status.moved||0);progress.setAttribute('aria-label','Bank sort moves');progress.style.cssText='width:100%;height:8px;accent-color:#65d3b4';body.appendChild(progress);}
  }
  if(current.reason)body.appendChild(el('p',current.reason));
  if(crypt.run)body.appendChild(el('div',cryptLine(crypt.run)));
  if(feedback){var result=el('div',feedback);result.setAttribute('role','status');result.style.cssText='padding:8px;background:#1b2533;border-radius:6px';body.appendChild(result);}
  var note=el('small','Duplicate requests are blocked while queued or running. Result and progress are also visible in the dashboard.');note.style.color='#a7b5c7';body.appendChild(note);root.scrollTop=scroll;if(root.__alccClamp)root.__alccClamp();
 }
 function safeRender(){try{render();}catch(e){}}
 function stop(){if(timer)clearInterval(timer);if(root)root.remove();}
 function install(){if(typeof parent==='undefined'||!parent.document)return;var old=parent.__alccActionsHud;if(old&&old.stop)old.stop();parent.__alccActionsHud={stop:stop};safeRender();timer=setInterval(safeRender,1000);}
 return {requestCryptResume:requestCryptResume,requestCrypt:requestCrypt,requestCryptAbort:requestCryptAbort,cryptState:cryptState,requestCave:requestCave,caveState:caveState,requestRecall:requestRecall,recallState:recallState,state:state,requestSort:requestSort,install:install,stop:stop};
})();
MerchantActionsGUI.install();
