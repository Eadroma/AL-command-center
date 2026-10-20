/** Read-only target frame, inspired by enhance-comm-ui TargetFrame/EntityInfo.
 * Uses game selection only; never changes the farmer or merchant target.
 */
var MerchantTargetGUI = (function () {
  var root, body, timer;
  function model() {
    var unit = null;
    try { if (typeof get_target === 'function') unit = get_target(); } catch (e) {}
    if (!unit && typeof parent !== 'undefined') unit = parent.ctarget || parent.xtarget || (parent.entities || {})[character.target];
    if (!unit || unit.visible === false) return null;
    function value(key) { return typeof unit[key] === 'number' && isFinite(unit[key]) ? unit[key] : null; }
    var def = typeof G !== 'undefined' && G.monsters && G.monsters[unit.mtype];
    var distance = null, range = typeof character.range === 'number' && isFinite(character.range) ? character.range : null;
    if ((!unit.map || unit.map === character.map) && value('x') !== null && value('y') !== null && typeof character.x === 'number' && typeof character.y === 'number') distance = Math.hypot(unit.x-character.x, unit.y-character.y);
    return { name: String(def && def.name || unit.name || unit.id || 'Selected entity'), type: unit.mtype || unit.ctype || unit.type || 'Entity',
      hp: value('hp'), maxHp: value('max_hp'), mp: value('mp'), maxMp: value('max_mp'), level: value('level'),
      armor: value('armor'), resistance: value('resistance'), distance: distance, range: range,
      target: String(unit.target || ''), dead: !!(unit.dead || unit.rip), effects: Object.keys(unit.s || {}).filter(function (id) { return !!unit.s[id]; }).slice(0,20) };
  }
  function el(tag,text) { var node=parent.document.createElement(tag); if(text!==undefined)node.textContent=text; return node; }
  function metric(label,text) { var row=el('div');row.style.cssText='padding:8px;background:#1b2533;border-radius:6px';var key=el('small',label);key.style.cssText='color:#a7b5c7;display:block';row.appendChild(key);row.appendChild(el('strong',text));body.appendChild(row); }
  function number(value) { return value===null?'Not observed':Math.round(value).toLocaleString(); }
  function resource(label,value,max,color) {
    metric(label,number(value)+(max!==null?' / '+number(max):''));
    if(value===null||max===null||max<=0)return;
    var track=el('div');track.style.cssText='height:8px;background:#ffffff12;border-radius:4px;overflow:hidden';
    track.setAttribute('role','progressbar');track.setAttribute('aria-label','Target '+label);track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax','100');
    var percent=Math.max(0,Math.min(100,value*100/max));track.setAttribute('aria-valuenow',String(Math.round(percent)));
    var fill=el('div');fill.style.cssText='height:100%;width:'+percent+'%;background:'+color;track.appendChild(fill);body.appendChild(track);
  }
  function render() {
    if(typeof parent==='undefined'||!parent.document||typeof MerchantMissionGUI==='undefined')return;
    if(!root||!root.isConnected){
      var old=parent.document.getElementById('alcc-merchant-target');if(old)old.remove();root=el('details');root.id='alcc-merchant-target';root.open=true;
      root.style.cssText='position:fixed;left:360px;top:88px;width:300px;overflow:auto;z-index:2100;background:#101722f5;color:#eaf0f8;border:1px solid #394759;border-radius:12px;padding:12px;font:13px/1.5 Arial,sans-serif;box-shadow:0 8px 28px #0006;box-sizing:border-box';
      var title=el('summary','Target · live observations');root.appendChild(title);body=el('div');body.style.cssText='display:grid;gap:8px;margin-top:12px';root.appendChild(body);parent.document.body.appendChild(root);
      MerchantMissionGUI.makeMovable(root,title);MerchantMissionGUI.makeCloseable(root,title,'Target');
    }
    if(root.style.display==='none'||!root.open)return;
    var scroll=root.scrollTop;body.replaceChildren();var row=model();
    if(!row){body.appendChild(el('strong','No visible target'));body.appendChild(el('p','Click a visible character, monster or NPC in the game to inspect it. This panel never changes the combat target.'));}
    else {
      body.appendChild(el('strong',row.name));body.appendChild(el('small',row.type+(row.level!==null?' · Lv '+row.level:'')+(row.dead?' · Dead entity':'')));
      resource('HP',row.hp,row.maxHp,'#ef8790');if(row.mp!==null||row.maxMp!==null)resource('MP',row.mp,row.maxMp,'#76b1ef');
      var distance=row.distance===null?'Not observed':Math.round(row.distance)+' units';
      if(row.distance!==null&&row.range!==null)distance+=' · '+(row.distance>row.range?'Outside':'Inside')+' merchant range ('+Math.round(row.range)+')';
      metric('Distance from merchant · center to center',distance);
      metric('Entity is targeting',row.target||'None observed');
      if(row.armor!==null)metric('Armor',number(row.armor));if(row.resistance!==null)metric('Resistance',number(row.resistance));
      metric('Active effects',row.effects.length?row.effects.join(' · '):'None observed');
    }
    var note=el('small','Read-only · only directly visible game data. Distance is indicative; it does not guarantee an attack is possible.');note.style.cssText='color:#a7b5c7;overflow-wrap:anywhere';body.appendChild(note);root.scrollTop=scroll;if(root.__alccClamp)root.__alccClamp();
  }
  function safeRender(){try{render();}catch(e){}}
  function stop(){if(timer)clearInterval(timer);if(root)root.remove();}
  function install(){if(typeof parent==='undefined'||!parent.document)return;var old=parent.__alccTargetHud;if(old&&old.stop)old.stop();parent.__alccTargetHud={stop:stop};safeRender();timer=setInterval(safeRender,500);}
  return {model:model,install:install,stop:stop};
})();
MerchantTargetGUI.install();
