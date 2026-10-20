/** Read-only merchant HUDs. Session counters begin at installation; gold balance
 * changes include transfers, production and banking and are never called profit. */
var MerchantOperationsGUI = (function () {
 var panels={}, timer, started=Date.now(), last=started, moving=0, deaths=0, dead=!!character.rip, goldStart=Number(character.gold)||0, lootGold=0, npcGold=0, items={}, seen=[];
 function number(n){return Math.round(Number(n)||0).toLocaleString();}
 function queueLines(){
  var txn=typeof MerchantTransactions!=='undefined'?MerchantTransactions.snapshot():null;
  var guard=typeof MerchantLoopGuard!=='undefined'?MerchantLoopGuard.snapshot():null;
  var next=typeof merchant_work_next==='function'?merchant_work_next():'';
  var active=txn&&txn.current;
  var lines=['Now: '+(active?active.kind+' · '+active.detail:character.moving?'Travelling':character.stand?'Stand open':'No transaction reported'),'Next eligible: '+(next||'Idle')];
  var blockers=[];
  (guard&&guard.holds||[]).forEach(function(h){blockers.push(h.task+': '+h.reason);});
  if(typeof UpgradeProduction!=='undefined')UpgradeProduction.snapshot().filter(function(r){return r.pending;}).forEach(function(r){blockers.push(r.item+': '+(r.reviewReason||'Waiting for confirmation'));});
  if(character.rip)blockers.push('Dead');
  lines.push('Blocked: '+(blockers.length?blockers.join('\n'):'None reported'));
  lines.push('Next is eligibility, not a scheduled action.');return lines;
 }
 function productionLines(){
  var lines=[];
  if(typeof UpgradeProduction!=='undefined')UpgradeProduction.snapshot().forEach(function(r){lines.push('Upgrade '+r.item+' · '+(r.unbounded?'Unbounded':r.produced+'/'+r.quantity+' finished'),'Spent '+number(r.spent)+' gold · '+(r.unbounded?'No lot budget':'Remaining '+number(Math.max(0,r.budget-r.spent))+' gold'),r.pending?'Verification: '+(r.reviewReason||'pending'):'');});
  if(typeof craft_batch!=='undefined'&&craft_batch)lines.push('Craft '+craft_batch.item+' · '+craft_batch.remaining+' remaining in current batch');
  if(typeof CompoundProduction!=='undefined')CompoundProduction.snapshot().forEach(function(r){lines.push('Compound '+r.item+' · '+r.successes+'/'+r.attempts+' attempts succeeded · '+r.destroyed+' destroyed','Confirmed scroll value '+number(r.scrollGold)+' gold · '+r.unconfirmed+' unconfirmed');});
  if(!lines.length)lines.push('No production progress reported');
  lines.push('Costs are recorded material values, not profit.');return lines.filter(Boolean);
 }
 function sessionLines(){return ['Merchant session · '+Math.floor((Date.now()-started)/60000)+' min','Wallet change '+number((Number(character.gold)||0)-goldStart)+' gold (not profit)','Loot gold '+number(lootGold)+' · NPC sale receipts '+number(npcGold),'Deaths '+deaths+' · moving '+Math.floor(moving/1000)+' sec','Loot items: '+(Object.keys(items).length?Object.keys(items).map(function(k){return k+' ×'+items[k];}).join(', '):'None observed'),'Merchant only; starts when this HUD loads. Transfers are not loot.'];}
 var inheritedSession=null;
 function element(tag,text,cls){var node=parent.document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;}
 function metric(body,label,value,help){var box=element('div',undefined,'alcc-kpi');box.appendChild(element('span',label,'alcc-label'));box.appendChild(element('strong',value));if(help)box.appendChild(element('small',help));body.appendChild(box);}
 function note(body,text){body.appendChild(element('p',text,'alcc-note'));}
 function style(){var doc=parent.document;if(doc.getElementById('alcc-operations-style'))return;var css=element('style');css.id='alcc-operations-style';css.textContent=`
 .alcc-ops{position:fixed;left:8px;width:340px;max-width:calc(100vw - 16px);max-height:55vh;overflow:auto;z-index:2100;background:rgba(16,23,34,.97);color:#eaf0f8;border:1px solid #394759;border-radius:12px;box-shadow:0 8px 28px #0006;font:13px/1.5 Arial,sans-serif;box-sizing:border-box;color-scheme:dark;}
 .alcc-ops>summary{padding:12px 14px;font-weight:700;letter-spacing:.2px;border-bottom:1px solid #2a3546;list-style-position:inside;}
 .alcc-ops:not([open])>summary{border-bottom:0;}.alcc-body{padding:12px;display:grid;gap:10px;}.alcc-label,.alcc-kpi small{display:block;color:#9babbe;font-size:11px;}.alcc-kpi{min-width:0;padding:10px;background:#1b2533;border:1px solid #2c3a4c;border-radius:8px;overflow-wrap:anywhere;}.alcc-kpi strong{display:block;font-size:17px;margin-top:3px;line-height:1.3;}.alcc-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;}.alcc-note{margin:0;color:#a7b5c7;font-size:11px;}.alcc-step{border-left:3px solid #65d3b4;padding:8px 10px;background:#1b2533;border-radius:0 8px 8px 0;overflow-wrap:anywhere;}.alcc-step strong{display:block;}.alcc-warning{border-color:#e4b85d;color:#f4d58c;}.alcc-status{display:inline-block;font-size:11px;font-weight:400;color:#72d9b9;margin-left:8px;}.alcc-lot{padding:10px;background:#1b2533;border:1px solid #2c3a4c;border-radius:8px;}.alcc-lot header{display:flex;justify-content:space-between;gap:8px;}.alcc-ops progress{width:100%;height:7px;accent-color:#72d9b9;margin:8px 0;}.alcc-lot p{margin:5px 0;font-size:12px;overflow-wrap:anywhere;}.alcc-items{margin:0;padding-left:18px;font-size:12px;}
 `;doc.head.appendChild(css);}
 function panel(id,title,top,build){
  var doc=parent.document,row=panels[id];
  if(!row||!row.root.isConnected){var root=doc.getElementById(id), summary;if(root){summary=root.querySelector('summary');var freshHandle=summary.cloneNode(true);delete freshHandle.dataset.alccMovable;summary.replaceWith(freshHandle);summary=freshHandle;Array.from(root.children).forEach(function(child){if(child!==summary)child.remove();});}else{root=doc.createElement('details');root.id=id;root.open=false;root.style.top=top+'px';summary=doc.createElement('summary');root.appendChild(summary);doc.body.appendChild(root);}
   root.className='alcc-ops';var left=root.style.left,positionTop=root.style.top;root.removeAttribute('style');root.style.top=positionTop||top+'px';if(left)root.style.left=left;
   summary.textContent=title;var body=element('div',undefined,'alcc-body');root.appendChild(body);MerchantMissionGUI.makeMovable(root,summary);MerchantMissionGUI.makeCloseable(root,summary,title);row=panels[id]={root:root,body:body};}
  var scroll=row.root.scrollTop,expanded=Array.from(row.body.querySelectorAll('details')).map(function(d){return d.open;});row.body.replaceChildren();build(row.body);Array.from(row.body.querySelectorAll('details')).forEach(function(d,i){d.open=!!expanded[i];});row.root.scrollTop=scroll;if(row.root.__alccClamp)row.root.__alccClamp();
 }
 function queueView(body){var lines=queueLines();['Current activity','Next eligible task','Blockers'].forEach(function(label,i){var text=lines[i].replace(/^(Now: |Next eligible: |Blocked: )/,'');var box=element('div',undefined,'alcc-step'+(i===2&&text!=='None reported'?' alcc-warning':''));box.appendChild(element('span',label,'alcc-label'));box.appendChild(element('strong',text));body.appendChild(box);});note(body,'The next task is a candidate, not a scheduled action.');}
 function productionView(body){var rows=typeof UpgradeProduction!=='undefined'?UpgradeProduction.snapshot():[];
  rows.forEach(function(r){var card=element('section',undefined,'alcc-lot'),head=element('header');head.appendChild(element('strong',r.item));head.appendChild(element('span',r.pending?'Verifying':!r.unbounded&&r.produced>=r.quantity?'Complete':'Upgrade',r.pending?'alcc-warning':'alcc-status'));card.appendChild(head);
   card.appendChild(element('p',r.unbounded?'Continuous run':r.produced+' / '+r.quantity+' finished'));if(!r.unbounded){var progress=element('progress');progress.max=Math.max(1,r.quantity);progress.value=Math.min(r.quantity,r.produced);progress.setAttribute('aria-label',r.item+' finished pieces');card.appendChild(progress);}
   card.appendChild(element('p','Spent '+number(r.spent)+' gold'));card.appendChild(element('p',r.unbounded?'No lot budget':'Budget remaining '+number(Math.max(0,r.budget-r.spent))+' gold','alcc-note'));if(r.pending)card.appendChild(element('p',r.reviewReason||'Waiting for confirmation','alcc-warning'));body.appendChild(card);});
  if(typeof craft_batch!=='undefined'&&craft_batch)metric(body,'Current craft batch',craft_batch.item,craft_batch.remaining+' pieces remaining');
  var compounds=typeof CompoundProduction!=='undefined'?CompoundProduction.snapshot():[];compounds.forEach(function(r){var card=element('section',undefined,'alcc-lot');card.appendChild(element('strong',r.item+' · compound'));card.appendChild(element('p',r.successes+' successes · '+r.destroyed+' destroyed · '+r.attempts+' attempts'));card.appendChild(element('p','Scroll value '+number(r.scrollGold)+' gold','alcc-note'));if(r.unconfirmed)card.appendChild(element('p',r.unconfirmed+' unconfirmed','alcc-warning'));body.appendChild(card);});if(!body.childNodes.length)note(body,'No production progress reported.');note(body,'Recorded material cost, not profit. Craft shows the current batch only.');}
 function sessionView(body){var lines=inheritedSession?inheritedSession():sessionLines(),grid=element('div',undefined,'alcc-grid');
  metric(grid,'Session duration',lines[0].replace('Merchant session · ',''));metric(grid,'Wallet change',lines[1].replace('Wallet change ','').replace(' (not profit)',''),'Includes purchases and transfers');
  var gold=lines[2].split(' · '),activity=lines[3].split(' · ');metric(grid,'Loot gold',gold[0].replace('Loot gold ',''));metric(grid,'NPC sale receipts',(gold[1]||'').replace('NPC sale receipts ',''));metric(grid,'Deaths',activity[0].replace('Deaths ',''));metric(grid,'Time moving',(activity[1]||'').replace('moving ',''));body.appendChild(grid);
  var loot=element('details'),title=element('summary','Observed loot');loot.appendChild(title);loot.appendChild(element('p',lines[4].replace('Loot items: ',''),'alcc-note'));body.appendChild(loot);note(body,'Merchant only · since HUD installation. Wallet change is not profit; transfers are not loot.');}
 function render(){try{if(!parent.document||typeof MerchantMissionGUI==='undefined')return;style();panel('alcc-merchant-queue','Merchant queue',80,queueView);panel('alcc-merchant-production','Production',132,productionView);panel('alcc-merchant-session','Session report',184,sessionView);}catch(e){}}
 function tick(){var now=Date.now(),dt=Math.min(2500,Math.max(0,now-last));last=now;if(character.moving)moving+=dt;if(character.rip&&!dead)deaths++;dead=!!character.rip;render();}
 function onLoot(data){if(!data)return;if(data.id){if(seen.indexOf(data.id)>=0)return;seen.push(data.id);seen=seen.slice(-200);}var amount=Number(data.gold);if(isFinite(amount)&&amount>0)lootGold+=amount;(data.items||[]).forEach(function(it){if(!it||it.looter!==character.name||!it.name)return;var key=it.name+' +'+(it.level||0);if(!items[key]&&Object.keys(items).length>=100)return;items[key]=(items[key]||0)+(Number(it.q)||1);});}
 function onResponse(data){if(data&&!data.failed&&data.response==='gold_received'&&data.cevent==='sell'&&Number(data.gold)>0)npcGold+=Number(data.gold);}
 function install(){if(typeof parent==='undefined'||!parent.document)return;try{if(!inheritedSession){if(character.on)character.on('loot',onLoot);if(parent.socket&&parent.socket.on)parent.socket.on('game_response',onResponse);}}catch(e){}render();timer=setInterval(tick,1000);}
 return {install:install,queueLines:queueLines,productionLines:productionLines,sessionLines:sessionLines,adoptSession:function(reader){inheritedSession=reader;}};
})();
MerchantOperationsGUI.install();
