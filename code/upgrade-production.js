/** Persisted upgrade journal and reservations; uncertain actions are reconciled only with definitive evidence. */
var UpgradeProduction = (function () {
  var historyKey = 'alcc:upgrade-history:' + character.name + ':' + __ALCC.profile;
  function rule(name) { return ((__ALCC.upgrade || {}).rules || []).find(function (r) { return r.item === name; }); }
  function run(r) { return r.production && r.production.enabled ? r.production.runId : 'unbounded'; }
  function key(r) { return 'alcc:upgrade-production:' + character.name + ':' + __ALCC.profile + ':' + r.item + ':' + run(r); }
  function read(r) { try { return get(key(r)) || { spent: 0, produced: 0, pending: false }; } catch (e) { return { spent: 0, produced: 0, pending: true }; } }
  function save(r, state) { set(key(r), state); }
  function history() { return get(historyKey) || { startedAt: Date.now(), entries: [], totals: [] }; }
  function counts(name) { var out = {}; (character.items || []).forEach(function (it) { if (it && it.name === name) { var lv = it.level || 0; out[lv] = (out[lv] || 0) + (it.q || 1); } }); return JSON.stringify(out); }
  function inventoryCounts() {
    var out = {};
    (character.items || []).forEach(function(it) { if (it) { var k = it.name + ':' + (it.level || 0); out[k] = (out[k] || 0) + (it.q || 1); } });
    return out;
  }
  function automatic(r, p, outcome, reason) {
    var a = p.action;
    if (!p.pending || !a) return false;
    a.automatic = true; a.reviewReason = reason;
    if (outcome === 'not_executed') {
      p.pending = false; p.spent = Math.max(0, p.spent - a.cost);
      a.outcome = outcome; a.after = counts(r.item); a.resolvedAt = Date.now(); save(r, p); journal(a, false);
    } else { save(r, p); settle({ rule: r, state: p }, a.kind === 'upgrade' && a.level + 1 >= a.target, outcome); }
    if (a.kind === 'purchase' && typeof upgrade_purchase_state !== 'undefined') { delete upgrade_purchase_state[r.item]; if (typeof save_upgrade_purchase_state === 'function') save_upgrade_purchase_state(); }
    game_log('Upgrade auto-resolved: ' + r.item + ' — ' + outcome + ' — ' + reason);
    return true;
  }
  /** Only a definitive server rejection releases cost; timeouts never do. */
  function observe(ticket, response) {
    if (!ticket || !response || response.failed !== true) return false;
    var reason = String(response.reason || response.response || '');
    var rejected = ['upgrade_no_item', 'upgrade_no_scroll', 'upgrade_incompatible_scroll', 'upgrade_invalid_offering', 'upgrade_cant', 'upgrade_mismatch', 'item_locked', 'distance', 'gold', 'not_enough_gold', 'cant_in_bank'];
    var p = read(ticket.rule);
    if (!p.pending || !p.action || p.action.id !== ticket.state.action.id || rejected.indexOf(reason) < 0) return false;
    return automatic(ticket.rule, p, 'not_executed', 'Server rejected action: ' + reason);
  }
  function proof(a) {
    if (!a.evidence || !a.evidence.inventory || typeof a.evidence.inventory !== 'object') return 'Before-action material evidence unavailable';
    if (a.evidence.map !== character.map) return 'Character changed terrain; inventory evidence is insufficient';
    var before = a.evidence.inventory, after = inventoryCounts(), expected = Object.assign({}, before);
    function delta(key, quantity) { expected[key] = (expected[key] || 0) + quantity; }
    if (a.kind === 'purchase') {
      delta(a.item + ':0', 1);
      if (a.evidence.gold - character.gold !== a.cost) return 'Purchase payment is not confirmed';
    } else {
      if (!a.evidence.scroll) return 'Selected scroll evidence unavailable';
      delta(a.item + ':' + a.level, -1); delta(a.item + ':' + (a.level + 1), 1);
      delta(a.evidence.scroll + ':0', -1);
      if (a.evidence.offering && a.evidence.offering !== 'none') delta(a.evidence.offering + ':0', -1);
    }
    var keys = Object.keys(expected).concat(Object.keys(after)).filter(function(k, i, all) { return all.indexOf(k) === i; });
    return keys.every(function(k) { return (expected[k] || 0) >= 0 && (expected[k] || 0) === (after[k] || 0); }) ? null : 'Inventory changes do not prove a unique outcome';
  }
  function reconcile() {
    ((__ALCC.upgrade || {}).rules || []).forEach(function(r) {
      var p = read(r), a = p.action;
      if (!p.pending) return;
      if (!p.reviewAt) { p.reviewAt = a && a.at || Date.now(); save(r, p); }
      if (Date.now() - p.reviewAt < 15000) return;
      var waiting = character.rip || character.q && (character.q.upgrade || character.q.compound) || (character.items || []).some(function(it) { return it && it.name === 'placeholder'; });
      var disconnected = typeof parent !== 'undefined' && parent.socket && parent.socket.disconnected;
      var reason = waiting || disconnected ? 'Character or inventory is not ready for verification' : a ? proof(a) : 'Legacy reservation has no action evidence';
      if (!reason && a) { automatic(r, p, 'success', 'Exact inventory and material changes confirmed'); return; }
      if (Date.now() - p.reviewAt >= 60000 && p.reviewReason !== reason) {
        p.reviewReason = reason; save(r, p);
        game_log('Upgrade review required: ' + r.item + ' — ' + reason);
      }
    });
  }
  function reserved(name) { var r = rule(name); return !!r && read(r).pending; }
  function total(h, a) { var t = h.totals.find(function (t) { return t.item === a.item && t.level === a.level && t.kind === a.kind; }); if (!t) { t = { item: a.item, level: a.level, kind: a.kind, attempts: 0, successes: 0, destroyed: 0, cost: 0, pendingCost: 0 }; h.totals.push(t); } return t; }
  function journal(a, first) { var h = history(), t = total(h, a); if (first) { t.attempts++; t.cost += a.cost; t.pendingCost = (t.pendingCost || 0) + a.cost; h.entries.push(a); } else { t.pendingCost = Math.max(0, (t.pendingCost || 0) - a.cost); var i = h.entries.findIndex(function (e) { return e.id === a.id; }); if (i >= 0) h.entries[i] = a; else h.entries.push(a); if (a.outcome === 'success') t.successes++; if (a.outcome === 'destroyed') t.destroyed++; if (a.outcome === 'not_executed') { t.attempts = Math.max(0, t.attempts - 1); t.cost = Math.max(0, t.cost - a.cost); } } h.entries = h.entries.slice(-60); h.totals = h.totals.slice(-500); set(historyKey, h); }
  function allowed(name, cost) {
    var r = rule(name); if (!r) return true;
    var paused = r.paused; try { var overrides=get('alcc:upgrade-pauses:'+character.name)||{}; if(typeof overrides[name]==='boolean')paused=overrides[name]; } catch(e) {}
    if(paused)return false;
    var p = read(r); if (p.pending) return false;
    if (!r.production || !r.production.enabled) return true;
    return p.produced < r.production.quantity && p.spent + Math.max(0, cost || 0) <= r.production.budget;
  }
  function begin(name, cost, detail) {
    var r = rule(name); if (!r) return null;
    if (!allowed(name, cost)) throw new Error('Upgrade production limit reached or unresolved action');
    var p = read(r), d = detail || {};
    var action = { id: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10), item: name, runId: run(r), kind: d.kind || 'upgrade', level: d.level || 0, target: r.maxLevel, cost: Math.max(0, cost || 0), at: Date.now(), outcome: 'pending', before: counts(name) };
    action.evidence = { inventory: inventoryCounts(), gold: character.gold, map: character.map, scroll: d.scroll, offering: d.offering };
    p.reviewReason = undefined; p.reviewAt = action.at;
    p.pending = true; p.action = action; p.spent += action.cost; save(r, p); journal(action, true);
    return { rule: r, state: p };
  }
  function settle(ticket, produced, outcome) {
    if (!ticket) return;
    var current = read(ticket.rule); if (!current.pending || !current.action || current.action.id !== ticket.state.action.id) return;
    current.reviewReason = undefined; current.reviewAt = undefined;
    current.pending = false; current.produced += produced ? 1 : 0;
    current.action.outcome = outcome || (current.action.kind === 'purchase' || produced ? 'success' : 'destroyed'); current.action.after = counts(current.action.item); current.action.resolvedAt = Date.now();
    save(ticket.rule, current); journal(current.action, false);
  }
  function resolve(command) {
    var d = command && command.resolution, r = d && rule(d.item); if (!r || d.verified !== true || ['success', 'destroyed', 'not_executed', 'keep_cost_resume'].indexOf(d.outcome) < 0 || run(r) !== d.runId) return false;
    var p = read(r), a = p.action; if (!p.pending || (a ? a.id : 'legacy') !== d.actionId) return false;
    if (!a) { if (d.outcome !== 'keep_cost_resume') return false; p.pending = false; save(r, p); if (typeof upgrade_purchase_state !== 'undefined') { delete upgrade_purchase_state[r.item]; if (typeof save_upgrade_purchase_state === 'function') save_upgrade_purchase_state(); } game_log('Upgrade reservation reviewed: ' + r.item + ' — counters retained'); return true; }
    if (d.outcome === 'keep_cost_resume' || (a.kind === 'purchase' && d.outcome === 'destroyed')) return false;
    if (d.outcome === 'not_executed') { p.pending = false; p.spent = Math.max(0, p.spent - a.cost); a.outcome = 'not_executed'; a.after = counts(r.item); a.resolvedAt = Date.now(); a.manual = true; save(r, p); journal(a, false); }
    else { a.manual = true; save(r, p); settle({ rule: r, state: p }, a.kind === 'upgrade' && d.outcome === 'success' && a.level + 1 >= a.target, d.outcome); }
    // The purchase guard is separate from the production reservation.
    if (a.kind === 'purchase' && typeof upgrade_purchase_state !== 'undefined') { delete upgrade_purchase_state[r.item]; if (typeof save_upgrade_purchase_state === 'function') save_upgrade_purchase_state(); }
    game_log('Upgrade action resolved: ' + r.item + ' — ' + d.outcome + ' — counters retained'); return true;
  }
  function snapshot() {
    return ((__ALCC.upgrade || {}).rules || []).filter(function (r) { return r.production && r.production.enabled || read(r).pending; }).map(function (r) {
      var p = read(r), bounded = r.production && r.production.enabled; return { item: r.item, runId: run(r), spent: p.spent, produced: p.produced, quantity: bounded ? r.production.quantity : 9999999, budget: bounded ? r.production.budget : 2e12, pending: p.pending, action: p.action, reviewReason: p.pending ? p.reviewReason : undefined, reviewAt: p.reviewAt, unbounded: !bounded };
    });
  }
  return { reconcile: reconcile, observe: observe, reserved: reserved, allowed: allowed, begin: begin, settle: settle, resolve: resolve, snapshot: snapshot, history: history };
})();
