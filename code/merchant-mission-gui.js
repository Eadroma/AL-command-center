/** Read-only in-game mission HUD. DOM text is escaped through textContent.
 * Uses coordinator reports, never treats cleanup completion as a boss kill.
 * Browser only; no effect on headless clients or task priorities. */
var MerchantMissionGUI = (function () {
 var root, content, notifications=[], previous='', timer, windows={};
 function makeCloseable(panel,handle,label) {
  var doc=parent.document,key='alcc:hud-hidden:'+character.name+':'+panel.id;
  var launcher=doc.getElementById('alcc-hud-launcher');
  if(!launcher){launcher=doc.createElement('details');launcher.id='alcc-hud-launcher';launcher.style.cssText='position:fixed;right:8px;bottom:8px;z-index:2200;background:#101722;color:#eaf0f8;border:1px solid #394759;border-radius:8px;padding:8px;font:13px Arial,sans-serif;';var heading=doc.createElement('summary');heading.textContent='HUD panels';launcher.appendChild(heading);doc.body.appendChild(launcher);}
  if(windows[panel.id])windows[panel.id].remove();
  // CODE reload resets windows, but the parent game document survives.
  // Also migrate legacy buttons that had no stable identifier.
  var toggleId='alcc-hud-toggle-'+panel.id,closeId='alcc-hud-close-'+panel.id;
  Array.from(launcher.children||[]).forEach(function(button){if(button.id===toggleId||button.textContent===label+' · hidden'||button.textContent===label+' · visible')button.remove();});
  Array.from(handle.children||[]).forEach(function(button){if(button.id===closeId||button.title==='Close panel')button.remove();});
  var reopen=doc.createElement('button');reopen.id=toggleId;reopen.type='button';reopen.style.cssText='display:block;margin-top:8px;background:#1b2533;color:#eaf0f8;border:1px solid #394759;border-radius:5px;padding:7px;cursor:pointer;';launcher.appendChild(reopen);
  function hidden(value){panel.style.display=value?'none':'';reopen.textContent=label+(value?' · hidden':' · visible');try{parent.localStorage.setItem(key,String(value));}catch(e){}}
  var close=doc.createElement('button');close.id=closeId;close.type='button';close.textContent='×';close.title='Close panel';close.setAttribute('aria-label','Close '+label);close.style.cssText='float:right;margin-left:8px;background:transparent;border:0;color:#a7b5c7;font:20px/1 Arial;cursor:pointer;padding:0 4px;';
  close.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();hidden(true);});handle.appendChild(close);
  reopen.addEventListener('click',function(){hidden(false);if(panel.__alccClamp)panel.__alccClamp();});windows[panel.id]=reopen;
  var saved=false;try{saved=parent.localStorage.getItem(key)==='true';}catch(e){}hidden(saved);
 }
 function clampPosition(x,y,width,height,vw,vh) {
  return {x:Math.max(0,Math.min(x,Math.max(0,vw-width))),y:Math.max(0,Math.min(y,Math.max(0,vh-height)))};
 }
 function makeResizable(panel) {
  if(panel.style.resize==='both')return;
  var key='alcc:hud-size:'+character.name+':'+panel.id;
  panel.style.resize='both';panel.style.minWidth='220px';panel.style.maxWidth='calc(100vw - 16px)';panel.style.maxHeight='calc(100vh - 16px)';
  try{var saved=JSON.parse(parent.localStorage.getItem(key));if(saved&&saved.width>=220){panel.style.width=Math.min(saved.width,parent.innerWidth-16)+'px';if(saved.height>=80)panel.style.height=Math.min(saved.height,parent.innerHeight-16)+'px';}}catch(e){}
  panel.addEventListener('toggle',function(){if(!panel.open){panel.__alccExpandedHeight=panel.style.height;panel.style.height='auto';}else if(panel.__alccExpandedHeight)panel.style.height=panel.__alccExpandedHeight;});
  if(parent.ResizeObserver){var observer=new parent.ResizeObserver(function(){if(!panel.isConnected){observer.disconnect();return;}if(panel.open){var r=panel.getBoundingClientRect();try{parent.localStorage.setItem(key,JSON.stringify({width:r.width,height:r.height}));}catch(e){}}});observer.observe(panel);}
 }
 function makeMovable(panel, handle) {
  if(!panel||!handle)return;
  makeResizable(panel);
  if(handle.dataset.alccMovable)return;
  handle.dataset.alccMovable='1'; handle.style.cursor='grab'; handle.style.touchAction='none';handle.style.userSelect='none';
  handle.title='Drag to move · arrow keys to move when focused';
  var storageKey='alcc:merchant-mission-position:'+character.name+':'+panel.id, drag=null, suppressClick=false;
  function place(x,y,save){var r=panel.getBoundingClientRect(),p=clampPosition(x,y,r.width,r.height,parent.innerWidth,parent.innerHeight);panel.style.left=p.x+'px';panel.style.top=p.y+'px';panel.style.right='auto';if(save)try{parent.localStorage.setItem(storageKey,JSON.stringify(p));}catch(e){}}
  try{var saved=JSON.parse(parent.localStorage.getItem(storageKey));if(saved&&isFinite(saved.x)&&isFinite(saved.y))place(Number(saved.x),Number(saved.y),false);}catch(e){}
  handle.addEventListener('pointerdown',function(e){if(e.button!==0||(e.target&&e.target.closest('button')))return;var r=panel.getBoundingClientRect();drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:r.left,top:r.top,moved:false};handle.setPointerCapture(e.pointerId);});
  handle.addEventListener('pointermove',function(e){if(!drag||drag.id!==e.pointerId)return;var dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>4)drag.moved=true;if(drag.moved){handle.style.cursor='grabbing';place(drag.left+dx,drag.top+dy,false);}});
  function finish(e){if(!drag||drag.id!==e.pointerId)return;suppressClick=drag.moved;drag=null;handle.style.cursor='grab';var r=panel.getBoundingClientRect();place(r.left,r.top,true);}
  handle.addEventListener('pointerup',finish);handle.addEventListener('pointercancel',finish);
  handle.addEventListener('click',function(e){if(suppressClick){e.preventDefault();e.stopPropagation();suppressClick=false;}},true);
  handle.addEventListener('keydown',function(e){var deltas={ArrowLeft:[-10,0],ArrowRight:[10,0],ArrowUp:[0,-10],ArrowDown:[0,10]},d=deltas[e.key];if(!d)return;e.preventDefault();var r=panel.getBoundingClientRect();place(r.left+d[0],r.top+d[1],true);});
  panel.__alccClamp=function(){var r=panel.getBoundingClientRect();place(r.left,r.top,false);};
 }
 function describe(snapshot, now) {
  if(!snapshot)return ['No event mission configured'];
  var phases={idle:'Waiting for a boss',forming:'Preparing farmers',engaging:'Fighting / travelling to boss',returning:'Returning and unloading',blocked:'Return needs attention',complete:'Expedition closed (boss kill not verified)'};
  var lines=[(snapshot.event||'Events')+' · '+(phases[snapshot.phase]||snapshot.phase),snapshot.reason||''];
  if(snapshot.startedAt&&snapshot.phase!=='complete')lines.push('Elapsed '+Math.floor(Math.max(0,now-snapshot.startedAt)/60000)+' min');
  (snapshot.participants||[]).forEach(function(p){var stale=!p.reportedAt||now-p.reportedAt>15000;lines.push(p.name+' · '+(!p.online?'Offline':stale?'Report stale':p.returned?'Returned / unloaded':snapshot.phase==='forming'?(p.readinessReason|| (p.ready?'Ready':'Waiting for readiness')):p.ready?'Online':'On mission')+' · deaths '+p.deaths);if(p.metrics)lines.push('  Boss hits '+p.metrics.bossHits+' · damage '+Math.round(p.metrics.bossDamage).toLocaleString());});
  return lines;
 }
 function render() {
  try {
   var doc=parent.document;if(!doc||typeof EventExpedition==='undefined')return;
   if(!root||!root.isConnected){
    var old=doc.getElementById('alcc-merchant-mission');if(old)old.remove();
    root=doc.createElement('details');root.id='alcc-merchant-mission';root.open=true;
    root.style.cssText='position:fixed;right:8px;top:80px;width:340px;overflow:auto;z-index:2100;background:#101722f7;color:#eaf0f8;border:1px solid #394759;border-radius:12px;padding:12px;font:13px/1.5 Arial,sans-serif;box-shadow:0 8px 28px #0006;box-sizing:border-box;';
    var title=doc.createElement('summary');title.textContent='Farmer mission · notifications';title.style.cursor='pointer';root.appendChild(title);
    content=doc.createElement('div');content.style.cssText='overflow-wrap:anywhere;margin:12px 0;font:inherit;display:grid;gap:8px;';root.appendChild(content);doc.body.appendChild(root);makeMovable(root,title);makeCloseable(root,title,'Notifications');
   }
   if(root.__alccClamp)root.__alccClamp();
   ['alcc-merchant-queue','alcc-merchant-production','alcc-merchant-session'].forEach(function(id){var panel=doc.getElementById(id);if(panel)makeResizable(panel);});
   var snap=EventExpedition.snapshot(), now=Date.now();
   var signature=snap?[snap.id,snap.phase,snap.reason,(snap.participants||[]).map(function(p){return p.name+':'+p.online+':'+p.ready+':'+p.returned+':'+(p.readinessReason||'')}).join('|')].join('|'):'disabled';
   if(signature!==previous){previous=signature;notifications.unshift(new Date(now).toLocaleTimeString()+' · '+(snap?snap.phase+' · '+(snap.reason||''):'No mission'));notifications=notifications.slice(0,5);}
   var scroll=root.scrollTop;content.replaceChildren();
   function card(label,text,warning){var box=doc.createElement('div');box.style.cssText='padding:10px;background:#1b2533;border-radius:8px;border-left:3px solid '+(warning?'#e4b85d':'#65d3b4');var caption=doc.createElement('div');caption.textContent=label;caption.style.cssText='font-size:11px;color:#a7b5c7';var value=doc.createElement('div');value.textContent=text;value.style.fontWeight='600';box.appendChild(caption);box.appendChild(value);content.appendChild(box);}
   var lines=describe(snap,now);card('Mission',lines[0],snap&&snap.phase==='blocked');card('Reason',lines[1]||'Waiting for a configured event',snap&&snap.phase==='forming');
   lines.slice(2).forEach(function(line){card(line.indexOf('Elapsed')===0?'Duration':line.indexOf('  Boss')===0?'Observed combat':'Farmer status',line,/stale|needs|below|Dead/.test(line));});
   var heading=doc.createElement('strong');heading.textContent='Recent notifications';heading.style.marginTop='8px';content.appendChild(heading);
   notifications.forEach(function(text){var row=doc.createElement('div');row.textContent=text;row.style.cssText='font-size:12px;color:#a7b5c7;padding:7px 0;border-top:1px solid #2c3a4c';content.appendChild(row);});root.scrollTop=scroll;
  }catch(e){ /* DOM unavailable in headless runtime; no interruption of trading. */ }
 }
 function install(){if(typeof parent==='undefined'||!parent.document)return;render();timer=setInterval(render,2000);}
 return {install:install,describe:describe,makeMovable:makeMovable,makeCloseable:makeCloseable,clampPosition:clampPosition};
})();
MerchantMissionGUI.install();
