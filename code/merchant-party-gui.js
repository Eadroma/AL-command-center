/** Party HUD inspired by adventureland-community/userinterface, enhance-comm-ui.
 * Adapted for character CODE: read-only, no observer/chat replacement or React.
 * https://github.com/adventureland-community/userinterface/tree/feature/enhance-comm-ui/enhance-comm-ui
 */
var MerchantPartyGUI = (function () {
  var root, body, timer;
  function model(now) {
    var names = [character.name], entities = typeof parent !== 'undefined' && parent.entities || {};
    function add(name) { if (name && names.indexOf(name) < 0) names.push(name); }
    if (typeof CONFIG !== 'undefined') (CONFIG.FARMERS || []).forEach(add);
    if (typeof CONFIG !== 'undefined' && CONFIG && typeof supply_farmer_names === 'function') supply_farmer_names().forEach(add);
    if (typeof parent !== 'undefined') (parent.party_list || []).forEach(add);
    var mission = null;
    try { if (typeof EventExpedition !== 'undefined') mission = EventExpedition.snapshot(); } catch (e) { /* Runtime reports can initialize after this prelude. */ }
    (mission && mission.participants || []).forEach(function (entry) { add(entry.name); });
    return names.slice(0, 12).map(function (name) {
      var unit = name === character.name ? character : entities[name];
      if (!unit) Object.keys(entities).some(function (id) { if (entities[id] && entities[id].name === name) { unit = entities[id]; return true; } return false; });
      var visible = !!unit && unit.visible !== false;
      var report = typeof farmer_reports !== 'undefined' && farmer_reports[name];
      var age = report && Number.isFinite(report.at) ? Math.max(0, now - report.at) : null;
      function value(key) { return visible && typeof unit[key] === 'number' && isFinite(unit[key]) ? unit[key] : null; }
      return { name: name, role: visible ? unit.ctype || '' : '', source: visible ? name === character.name ? 'Self' : 'Visible nearby' : age !== null && age <= 20000 ? 'Recent report' : age !== null ? 'Old report' : 'Out of sight',
        dead: visible && !!unit.rip, map: visible ? unit.map || character.map : report && report.map || '',
        hp: value('hp'), maxHp: value('max_hp'), mp: value('mp'), maxMp: value('max_mp'),
        target: visible ? String(unit.target || '') : '', age: age,
        hpot: report && typeof report.hpot === 'number' ? report.hpot : null,
        mpot: report && typeof report.mpot === 'number' ? report.mpot : null,
        effects: visible ? Object.keys(unit.s || {}).filter(function (id) { return !!unit.s[id]; }).slice(0, 10) : [] };
    });
  }
  function el(tag, text) { var node = parent.document.createElement(tag); if (text !== undefined) node.textContent = text; return node; }
  function resource(card, label, value, max, color) {
    var row = el('div'); row.style.cssText = 'display:grid;grid-template-columns:24px 1fr 90px;gap:7px;align-items:center;margin-top:7px;font-size:11px';
    row.appendChild(el('span', label));
    var track = el('div'); track.style.cssText = 'height:7px;border-radius:5px;background:#ffffff12;overflow:hidden';
    var fill = el('div'); fill.style.cssText = 'height:100%;background:' + color;
    var known = value !== null && max !== null && max > 0;
    fill.style.width = (known ? Math.max(0, Math.min(100, value * 100 / max)) : 0) + '%';
    track.setAttribute('role', 'progressbar'); track.setAttribute('aria-label', label);
    if (known) track.setAttribute('aria-valuenow', String(Math.round(value * 100 / max)));
    else track.setAttribute('aria-valuetext', 'Not observed');
    track.appendChild(fill); row.appendChild(track);
    var amount = el('span', known ? Math.round(value).toLocaleString() + ' / ' + Math.round(max).toLocaleString() : 'Not observed'); amount.style.textAlign = 'right'; row.appendChild(amount); card.appendChild(row);
  }
  function render() {
    if (typeof parent === 'undefined' || !parent.document || typeof MerchantMissionGUI === 'undefined') return;
    if (!root || !root.isConnected) {
      var doc = parent.document, old = doc.getElementById('alcc-merchant-party'); if (old) old.remove();
      root = el('details'); root.id = 'alcc-merchant-party'; root.open = true;
      root.style.cssText = 'position:fixed;left:12px;top:88px;width:330px;overflow:auto;z-index:2100;background:#101722f5;color:#eaf0f8;border:1px solid #394759;border-radius:12px;padding:12px;font:13px/1.5 Arial,sans-serif;box-shadow:0 8px 28px #0006;box-sizing:border-box';
      var header = el('summary', 'Party · live observations'); root.appendChild(header);
      body = el('div'); body.style.cssText = 'display:grid;gap:9px;margin-top:12px'; root.appendChild(body); doc.body.appendChild(root);
      MerchantMissionGUI.makeMovable(root, header); MerchantMissionGUI.makeCloseable(root, header, 'Party');
    }
    if (root.style.display === 'none' || !root.open) return;
    var scroll = root.scrollTop; body.replaceChildren();
    model(Date.now()).forEach(function (row) {
      var card = el('section'); card.style.cssText = 'background:#1b2533;border-radius:8px;padding:10px;border-left:3px solid ' + (row.dead ? '#ef8790' : row.hp !== null ? '#65d3b4' : '#64748b');
      var heading = el('div'); heading.style.cssText = 'display:flex;justify-content:space-between;gap:8px'; heading.appendChild(el('strong', row.name));
      var status = el('span', row.dead ? 'Dead' : row.source); status.style.cssText = 'color:#a7b5c7;font-size:11px'; heading.appendChild(status); card.appendChild(heading);
      var subtitle = el('div', [row.role, row.map || 'Position unknown'].filter(Boolean).join(' · ')); subtitle.style.cssText = 'font-size:11px;color:#a7b5c7'; card.appendChild(subtitle);
      resource(card, 'HP', row.hp, row.maxHp, '#ef8790'); resource(card, 'MP', row.mp, row.maxMp, '#76b1ef');
      if (row.target) card.appendChild(el('small', 'Target: ' + row.target));
      if (row.effects.length) { var buffs = el('div', row.effects.join(' · ')); buffs.style.cssText = 'font-size:10px;color:#a7b5c7;overflow-wrap:anywhere;margin-top:7px'; card.appendChild(buffs); }
      if (row.age !== null) { var supplies = el('div', 'Potion report ' + Math.floor(row.age / 1000) + 's ago · HP ' + (row.hpot === null ? '—' : row.hpot) + ' · MP ' + (row.mpot === null ? '—' : row.mpot)); supplies.style.cssText = 'font-size:10px;color:#a7b5c7;margin-top:7px'; card.appendChild(supplies); }
      body.appendChild(card);
    });
    var note = el('small', 'HP, MP and effects are shown only for directly observed characters. Out of sight does not mean offline.'); note.style.color = '#a7b5c7'; body.appendChild(note);
    root.scrollTop = scroll; if (root.__alccClamp) root.__alccClamp();
  }
  function stop() { if (timer) clearInterval(timer); if (root) root.remove(); }
  function safeRender() { try { render(); } catch (e) { /* A read-only HUD must never stop merchant CODE. */ } }
  function install() {
    if (typeof parent === 'undefined' || !parent.document) return;
    var previous = parent.__alccPartyHud; if (previous && previous.stop) previous.stop();
    parent.__alccPartyHud = { stop: stop }; safeRender(); timer = setInterval(safeRender, 1000);
  }
  return { model: model, render: render, install: install, stop: stop };
})();
MerchantPartyGUI.install();
