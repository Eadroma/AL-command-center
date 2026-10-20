/** Serialized, observable merchant operations with explicit outcomes. */
var MerchantTransactions = (function () {
	var current = null, journal = [], sequence = 0;
	function add(row) { journal.push(row); if (journal.length > 60) journal.shift(); }
	function begin(kind, detail) {
		if (current && Date.now() - current.startedAt < 120000) return null;
		current = { id: character.name + ":" + Date.now() + ":" + (++sequence), kind: String(kind), detail: String(detail || ""), state: "running", startedAt: Date.now(), finishedAt: 0, message: "" };
		return current.id;
	}
	function finish(id, state, message) {
		if (!current || current.id !== id) return false;
		current.state = state; current.finishedAt = Date.now(); current.message = String(message || "").slice(0, 180);
		add(current); current = null; return true;
	}
	function commit(id, message) { return finish(id, "committed", message); }
	function fail(id, message) { return finish(id, "failed", message); }
	function snapshot() { return { current: current, journal: journal.slice(), updatedAt: Date.now() }; }
	return { begin: begin, commit: commit, fail: fail, snapshot: snapshot };
})();


/** Task-scoped circuit breaker. Stock/rule changes release a hold; elapsed time does not. */
var MerchantLoopGuard = (function () {
  var rows = {}, holds = {}, lastTask = '';
  var storageKey = 'alcc:merchant-loop-guard:' + character.name + ':' + (typeof __ALCC !== 'undefined' && __ALCC.profile || 'default');
  try { holds = typeof get === 'function' && get(storageKey) || {}; } catch (e) {}
  function stock(task) {
    var counts = {};
    (character.items || []).forEach(function(it) { if (it && it.name !== 'placeholder') { var k = it.name + ':' + (it.level || 0); counts[k] = (counts[k] || 0) + (it.q || 1); } });
    if (task === 'stand') Object.keys(character.slots || {}).forEach(function(slot) { var it = character.slots[slot]; if (slot.indexOf('trade') === 0 && it && !it.b) { var k = it.name + ':' + (it.level || 0); counts[k] = (counts[k] || 0) + (it.q || 1); } });
    // Listing/removal alone is not progress: stand checks count carried and listed copies together.
    // Production upgrades and trades must count as progress; map changes alone do not.
    return JSON.stringify(Object.keys(counts).sort().map(function(k) { return [k, counts[k]]; }));
  }
  function rules() { return JSON.stringify(typeof __ALCC !== 'undefined' ? [__ALCC.workOrder, __ALCC.upgrade, __ALCC.compound, __ALCC.craft, __ALCC.CONFIG && __ALCC.CONFIG.GABRIEL_SELL, __ALCC.npcEnabled, __ALCC.listings, __ALCC.bankDeposit, __ALCC.buy, __ALCC.exchange, __ALCC.standSpot] : []); }
  function signature(task) { return stock(task) + '|' + rules(); }
  function save() { try { if (typeof set === 'function') set(storageKey, holds); } catch (e) {} }
  function allowed(task) {
    if (!holds[task]) return true;
    if (holds[task].signature !== signature(task)) { delete holds[task]; delete rows[task]; save(); return true; }
    return false;
  }
  function suspend(task, reason) {
    if (holds[task]) return;
    holds[task] = { task: task, at: Date.now(), reason: reason, signature: signature(task) }; save();
    if (typeof game_log === 'function') game_log('Merchant loop suspended: ' + task + ' — ' + reason);
  }
  function observe(task, marker) {
    if (!task || !allowed(task)) return;
    var at = Date.now(), sig = signature(task), row = rows[task];
    if (!row || row.signature !== sig || at - row.lastAt > 15000) row = rows[task] = { signature: sig, startedAt: at, lastAt: at, marker: marker, changes: 0, revisits: 0, seen: {} };
    row.lastAt = at;
    if (row.marker !== marker) { row.changes++; if (row.seen[marker]) row.revisits++; row.seen[marker] = true; row.marker = marker; }
    if (row.revisits >= 3 && row.changes >= 6 && at - row.startedAt >= 20000) suspend(task, 'Repeated transitions without an inventory result');
    else if (task !== 'stand' && at - row.startedAt >= 180000) suspend(task, 'No inventory result after three minutes of repeated work');
  }
  function tick(task) {
    lastTask = task || '';
    if (character.rip || character.q && Object.keys(character.q).length) return;
    observe(task, String(character.map || ''));
    var trade = Object.keys(character.slots || {}).filter(function(k) { return k.indexOf('trade') === 0; }).sort().map(function(k) { var it = character.slots[k]; return [k, it && it.name, it && it.level, it && it.b, it && it.price]; });
    observe('stand', JSON.stringify(trade));
  }
  function snapshot() { Object.keys(holds).forEach(allowed); return { task: lastTask, holds: Object.keys(holds).map(function(k) { var row = holds[k]; return { task: row.task, at: row.at, reason: row.reason }; }) }; }
  return { tick: tick, allowed: allowed, snapshot: snapshot };
})();
