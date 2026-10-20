/** Read-only combat meters inspired by enhance-comm-ui meters.
 * Local socket observations only. Mission reports are a separate data source. */
var MerchantCombatGUI=(function(){
 var root,body,select,timer,socket,started=Date.now(),totals={},mode='damage';
 function positive(value){return typeof value==='number'&&isFinite(value)&&value>0?value:0;}
 function member(id){
  if(!id)return null;var name=String(id),entities=typeof parent!=='undefined'&&parent.entities||{};
  if(entities[id]&&entities[id].name)name=entities[id].name;
  if(id===character.id)name=character.name;
  if(name===character.name)return name;
  if(typeof CONFIG!=='undefined'&&CONFIG&&(CONFIG.FARMERS||[]).indexOf(name)>=0)return name;
  if(typeof parent!=='undefined'&&(parent.party_list||[]).indexOf(name)>=0)return name;
  var expedition=typeof __ALCC!=='undefined'&&__ALCC.eventExpedition;
  return expedition&&(expedition.warrior===name||expedition.priest===name)?name:null;
 }
 function entry(name){if(!totals[name]&&Object.keys(totals).length>=40)return null;return totals[name]||(totals[name]={name:name,damage:0,healing:0,taken:0,hits:0});}
 function onHit(data){try{
  if(!data||typeof data!=='object')return;
  var actor=member(data.hid),target=member(data.id),damage=positive(data.damage),healing=positive(data.heal)+positive(data.lifesteal),row;
  if(actor&&(damage||healing)){row=entry(actor);if(row){row.damage+=damage;row.healing+=healing;if(damage)row.hits++;}}
  if(target&&damage){row=entry(target);if(row)row.taken+=damage;}
 }catch(e){}}
 function model(now){var elapsed=Math.max(0,now-started);return Object.keys(totals).map(function(name){var row=totals[name];return {name:name,damage:row.damage,healing:row.healing,taken:row.taken,hits:row.hits,dps:elapsed>0?row.damage*1000/elapsed:null,hps:elapsed>0?row.healing*1000/elapsed:null};});}
 function reset(){totals={};started=Date.now();}
 function el(tag,text){var node=parent.document.createElement(tag);if(text!==undefined)node.textContent=text;return node;}
 function number(value){return value===null?'—':Math.round(value).toLocaleString();}
 function render(){
  if(typeof parent==='undefined'||!parent.document||typeof MerchantMissionGUI==='undefined')return;
  if(!root||!root.isConnected){var old=parent.document.getElementById('alcc-merchant-combat');if(old)old.remove();root=el('details');root.id='alcc-merchant-combat';root.open=true;
   root.style.cssText='position:fixed;left:705px;top:380px;width:340px;max-height:45vh;overflow:auto;z-index:2100;background:#101722f5;color:#eaf0f8;border:1px solid #394759;border-radius:12px;padding:12px;font:13px/1.5 Arial,sans-serif;box-shadow:0 8px 28px #0006;box-sizing:border-box';
   var title=el('summary','Combat meters · observations');root.appendChild(title);var controls=el('div');controls.style.cssText='display:flex;gap:8px;margin-top:12px';select=el('select');select.setAttribute('aria-label','Combat meter statistic');select.style.cssText='flex:1;min-width:0;background:#1b2533;color:#eaf0f8;padding:6px;border:1px solid #394759;border-radius:5px';
   [['damage','Damage'],['dps','DPS'],['healing','Reported healing'],['hps','Reported HPS'],['taken','Damage taken']].forEach(function(choice){var option=el('option',choice[1]);option.value=choice[0];select.appendChild(option);});select.value=mode;select.addEventListener('change',function(){mode=select.value;safeRender();});controls.appendChild(select);
   var clear=el('button','Reset');clear.type='button';clear.title='Reset only these local HUD counters';clear.style.cssText='background:#1b2533;color:#eaf0f8;border:1px solid #394759;border-radius:5px;padding:6px';clear.addEventListener('click',function(){reset();safeRender();});controls.appendChild(clear);root.appendChild(controls);
   body=el('div');body.style.cssText='display:grid;gap:9px;margin-top:12px';root.appendChild(body);parent.document.body.appendChild(root);MerchantMissionGUI.makeMovable(root,title);MerchantMissionGUI.makeCloseable(root,title,'Combat meters');
  }
  if(root.style.display==='none'||!root.open)return;
  var scroll=root.scrollTop,previousReport=body.querySelector('details'),reportOpen=!!(previousReport&&previousReport.open);body.replaceChildren();var rows=model(Date.now()).sort(function(a,b){return (b[mode]||0)-(a[mode]||0);}),max=Math.max(1,...rows.map(function(row){return row[mode]||0;}));
  var duration=el('small','Local observations · '+Math.floor(Math.max(0,Date.now()-started)/60000)+' min since HUD start/reset');duration.style.color='#a7b5c7';body.appendChild(duration);
  if(!rows.length)body.appendChild(el('p','No team combat observed here yet. Farmers outside the merchant’s view are not measured by these local counters.'));
  rows.forEach(function(row){var card=el('div');card.style.cssText='padding:9px;background:#1b2533;border-radius:7px';var line=el('div');line.style.cssText='display:flex;justify-content:space-between;gap:10px';line.appendChild(el('strong',row.name));line.appendChild(el('strong',number(row[mode])));card.appendChild(line);var track=el('div');track.style.cssText='margin-top:7px;height:7px;background:#ffffff12;border-radius:4px;overflow:hidden';var fill=el('div');fill.style.cssText='height:100%;background:#65d3b4;width:'+((row[mode]||0)*100/max)+'%';track.appendChild(fill);card.appendChild(track);body.appendChild(card);});
  try{var mission=typeof EventExpedition!=='undefined'&&EventExpedition.snapshot();if(mission&&(mission.participants||[]).some(function(p){return p.metrics;})){var reports=el('details'),title=el('summary','Latest mission · separate reported totals');reports.open=reportOpen;reports.appendChild(title);reports.appendChild(el('p',mission.event+' · '+mission.phase));(mission.participants||[]).forEach(function(p){if(p.metrics)reports.appendChild(el('p',p.name+' · '+number(p.metrics.bossDamage)+' boss damage · '+number(p.metrics.bossHits)+' hits · '+number(p.metrics.healing)+' reported healing'));});reports.appendChild(el('small','Not added to local counters. A completed mission does not prove a boss kill.'));body.appendChild(reports);}}catch(e){}
  var note=el('small','Rates include idle time since HUD start/reset. Reported healing may include overheal and lifesteal. Missing remote observations are not zero DPS.');note.style.cssText='color:#a7b5c7;overflow-wrap:anywhere';body.appendChild(note);root.scrollTop=scroll;if(root.__alccClamp)root.__alccClamp();
 }
 function safeRender(){try{render();}catch(e){}}
 function stop(){if(timer)clearInterval(timer);if(socket){if(typeof socket.off==='function')socket.off('hit',onHit);else if(typeof socket.removeListener==='function')socket.removeListener('hit',onHit);}if(root)root.remove();}
 function install(){if(typeof parent==='undefined'||!parent.document)return;var old=parent.__alccCombatHud;if(old&&old.stop)old.stop();parent.__alccCombatHud={stop:stop};socket=parent.socket;if(socket&&typeof socket.on==='function')socket.on('hit',onHit);safeRender();timer=setInterval(safeRender,1000);}
 return {model:model,onHit:onHit,reset:reset,install:install,stop:stop};
})();
MerchantCombatGUI.install();
