/** Visible enemies / observed aggro, inspired by enhance-comm-ui Enemies/ThreatTable.
 * Target observations are not numerical threat scores. Never issues combat commands. */
var MerchantEnemiesGUI=(function(){
 var root,body,filter,timer,mode='all';
 function model(){
  var entities=typeof parent!=='undefined'&&parent.entities||{},names=[character.name];
  if(typeof CONFIG!=='undefined'&&CONFIG)(CONFIG.FARMERS||[]).forEach(function(name){if(names.indexOf(name)<0)names.push(name);});
  if(typeof parent!=='undefined')(parent.party_list||[]).forEach(function(name){if(names.indexOf(name)<0)names.push(name);});
  if(typeof __ALCC!=='undefined'&&__ALCC.eventExpedition)[__ALCC.eventExpedition.warrior,__ALCC.eventExpedition.priest].forEach(function(name){if(name&&names.indexOf(name)<0)names.push(name);});
  return Object.keys(entities).map(function(id){var unit=entities[id];if(!unit||unit.type!=='monster'||unit.visible===false||unit.dead||unit.rip||unit.hp===0||unit.map&&unit.map!==character.map)return null;
   var def=typeof G!=='undefined'&&G.monsters&&G.monsters[unit.mtype],target=entities[unit.target],targetName=target&&target.name||String(unit.target||'');
   if(character.id&&unit.target===character.id)targetName=character.name;
   var distance=null;if([unit.x,unit.y,character.x,character.y].every(function(n){return typeof n==='number'&&isFinite(n);}))distance=Math.hypot(unit.x-character.x,unit.y-character.y);
   return {id:id,sprite:unit.mtype||'',name:def&&def.name||unit.mtype||unit.name||id,hp:typeof unit.hp==='number'&&isFinite(unit.hp)?unit.hp:null,maxHp:typeof unit.max_hp==='number'&&isFinite(unit.max_hp)?unit.max_hp:null,
    distance:distance,target:targetName,team:names.indexOf(targetName)>=0,self:targetName===character.name};
  }).filter(Boolean).sort(function(a,b){return Number(b.team)-Number(a.team)||(a.distance===null?Infinity:a.distance)-(b.distance===null?Infinity:b.distance)||a.id.localeCompare(b.id);});
 }
 function el(tag,text){var node=parent.document.createElement(tag);if(text!==undefined)node.textContent=text;return node;}
 function render(){
  if(typeof parent==='undefined'||!parent.document||typeof MerchantMissionGUI==='undefined')return;
  if(!root||!root.isConnected){var old=parent.document.getElementById('alcc-merchant-enemies');if(old)old.remove();root=el('details');root.id='alcc-merchant-enemies';root.open=true;
   root.style.cssText='position:fixed;left:360px;top:380px;width:330px;max-height:45vh;overflow:auto;z-index:2100;background:#101722f5;color:#eaf0f8;border:1px solid #394759;border-radius:12px;padding:12px;font:13px/1.5 Arial,sans-serif;box-shadow:0 8px 28px #0006;box-sizing:border-box';
   var title=el('summary','Enemies & aggro · visible area');root.appendChild(title);filter=el('select');filter.setAttribute('aria-label','Visible enemy filter');filter.style.cssText='width:100%;margin-top:10px;padding:6px;background:#1b2533;color:#eaf0f8;border:1px solid #394759;border-radius:5px';
   [['all','All visible monsters'],['team','Targeting the team'],['self','Targeting the merchant']].forEach(function(choice){var option=el('option',choice[1]);option.value=choice[0];filter.appendChild(option);});filter.value=mode;filter.addEventListener('change',function(){mode=filter.value;safeRender();});root.appendChild(filter);
   body=el('div');body.style.cssText='display:grid;gap:8px;margin-top:10px';root.appendChild(body);parent.document.body.appendChild(root);MerchantMissionGUI.makeMovable(root,title);MerchantMissionGUI.makeCloseable(root,title,'Enemies & aggro');
  }
  if(root.style.display==='none'||!root.open)return;
  var scroll=root.scrollTop;body.replaceChildren();var all=model(),rows=all.filter(function(row){return mode==='all'||mode==='team'&&row.team||mode==='self'&&row.self;});
  body.appendChild(el('small',all.length+' visible · '+all.filter(function(row){return row.team;}).length+' targeting the team'));
  if(!rows.length)body.appendChild(el('p',mode==='all'?'No living monsters visible from the merchant.':'No visible monsters match this filter.'));
  rows.slice(0,24).forEach(function(row){var card=el('section');card.style.cssText='padding:9px;background:#1b2533;border-radius:8px;border-left:3px solid '+(row.team?'#ef8790':'#64748b');
   var heading=el('div');heading.style.cssText='display:flex;align-items:center;gap:8px';
   if(row.sprite&&typeof MerchantEventsGUI!=='undefined')heading.appendChild(MerchantEventsGUI.bossIcon({id:row.sprite,name:row.name}).cloneNode(true));heading.appendChild(el('strong',row.name));card.appendChild(heading);
   card.appendChild(el('div','HP '+(row.hp===null?'Not observed':Math.round(row.hp).toLocaleString())+(row.maxHp===null?'':' / '+Math.round(row.maxHp).toLocaleString())));
   if(row.hp!==null&&row.maxHp>0){var progress=el('progress');progress.max=row.maxHp;progress.value=Math.max(0,Math.min(row.hp,row.maxHp));progress.setAttribute('aria-label',row.name+' HP');progress.style.cssText='width:100%;height:7px;accent-color:#ef8790';card.appendChild(progress);}
   card.appendChild(el('div','Target: '+(row.target||'None observed')));var distance=el('small',row.distance===null?'Distance not observed':Math.round(row.distance)+' units from merchant');distance.style.color='#a7b5c7';card.appendChild(distance);body.appendChild(card);
  });
  if(rows.length>24)body.appendChild(el('small','Showing the first 24 of '+rows.length+' matches.'));
  var note=el('small','Local visibility only, not remote farmer vision. Aggro means the reported target; it is not a threat ranking.');note.style.color='#a7b5c7';body.appendChild(note);root.scrollTop=scroll;if(root.__alccClamp)root.__alccClamp();
 }
 function safeRender(){try{render();}catch(e){}}
 function stop(){if(timer)clearInterval(timer);if(root)root.remove();}
 function install(){if(typeof parent==='undefined'||!parent.document)return;var old=parent.__alccEnemiesHud;if(old&&old.stop)old.stop();parent.__alccEnemiesHud={stop:stop};safeRender();timer=setInterval(safeRender,1000);}
 return {model:model,install:install,stop:stop};
})();
MerchantEnemiesGUI.install();
