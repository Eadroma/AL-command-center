/** Executable HUD controls. Bank sorting calls the same request entry point
 * used by dashboard telemetry commands, including the existing ALData sync. */
var MerchantActionsGUI=(function(){
 var root,body,button,recallButton,timer,sequence=0,feedback='';
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
 function el(tag,text){var node=parent.document.createElement(tag);if(text!==undefined)node.textContent=text;return node;}
 function render(){
  if(typeof parent==='undefined'||!parent.document||typeof MerchantMissionGUI==='undefined')return;
  if(!root||!root.isConnected){var old=parent.document.getElementById('alcc-merchant-actions');if(old)old.remove();root=el('details');root.id='alcc-merchant-actions';root.open=true;
   root.style.cssText='position:fixed;left:12px;top:380px;width:330px;max-height:45vh;overflow:auto;z-index:2100;background:#101722f5;color:#eaf0f8;border:1px solid #394759;border-radius:12px;padding:12px;font:13px/1.5 Arial,sans-serif;box-shadow:0 8px 28px #0006;box-sizing:border-box';
   var title=el('summary','Merchant actions');root.appendChild(title);button=el('button','Sort bank');button.type='button';button.title='Run the same bank sorter as the dashboard';button.style.cssText='display:block;width:100%;margin-top:12px;padding:10px;background:#244a43;color:#eaf0f8;border:1px solid #65d3b4;border-radius:7px;font:600 13px Arial;cursor:pointer';button.addEventListener('click',function(){button.disabled=true;requestSort();safeRender();});root.appendChild(button);
   recallButton=el('button','Recall team');recallButton.type='button';recallButton.title='Recall the active event duo to the merchant to unload loot. The archer keeps farming. Manual clients remain online.';recallButton.style.cssText=button.style.cssText;recallButton.addEventListener('click',function(){requestRecall();safeRender();});root.appendChild(recallButton);
   body=el('div');body.style.cssText='display:grid;gap:8px;margin-top:12px';root.appendChild(body);parent.document.body.appendChild(root);MerchantMissionGUI.makeMovable(root,title);MerchantMissionGUI.makeCloseable(root,title,'Merchant actions');
  }
  var current=state();button.disabled=!current.available||current.busy;button.style.opacity=button.disabled?'.5':'1';button.textContent=current.busy?'Sort bank · '+current.status.state:'Sort bank';
  var recall=recallState();recallButton.disabled=!recall.available;recallButton.style.opacity=recall.available?'1':'.5';recallButton.textContent=recall.mission&&['returning','blocked'].indexOf(recall.mission.phase)>=0?'Recall team · returning':'Recall team';
  if(root.style.display==='none'||!root.open)return;
  var scroll=root.scrollTop;body.replaceChildren();
  var explanation=el('p','Closes the stand and sorts each bank floor by category, item name, then highest level first. Uses the dashboard sorter and its ALData upload. Starts only when clicked.');explanation.style.cssText='font-size:12px;color:#a7b5c7;margin:0';body.appendChild(explanation);
  if(current.status){body.appendChild(el('strong',current.status.state+' · '+current.status.phase));body.appendChild(el('div',current.status.message));body.appendChild(el('small',current.status.moved+' moves · '+current.status.merged+' merges'));
   if(current.status.total>0){var progress=el('progress');progress.max=current.status.total;progress.value=Math.min(current.status.total,current.status.moved||0);progress.setAttribute('aria-label','Bank sort moves');progress.style.cssText='width:100%;height:8px;accent-color:#65d3b4';body.appendChild(progress);}
  }
  if(current.reason)body.appendChild(el('p',current.reason));
  if(feedback){var result=el('div',feedback);result.setAttribute('role','status');result.style.cssText='padding:8px;background:#1b2533;border-radius:6px';body.appendChild(result);}
  var note=el('small','Duplicate requests are blocked while queued or running. Result and progress are also visible in the dashboard.');note.style.color='#a7b5c7';body.appendChild(note);root.scrollTop=scroll;if(root.__alccClamp)root.__alccClamp();
 }
 function safeRender(){try{render();}catch(e){}}
 function stop(){if(timer)clearInterval(timer);if(root)root.remove();}
 function install(){if(typeof parent==='undefined'||!parent.document)return;var old=parent.__alccActionsHud;if(old&&old.stop)old.stop();parent.__alccActionsHud={stop:stop};safeRender();timer=setInterval(safeRender,1000);}
 return {requestRecall:requestRecall,recallState:recallState,state:state,requestSort:requestSort,install:install,stop:stop};
})();
MerchantActionsGUI.install();
