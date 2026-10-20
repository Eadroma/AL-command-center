/** Explicit compound targets. Bank stock is checked only during an existing
 * deposit trip, never by repeatedly opening/closing the bank from idle. */
var CompoundProduction = (function () {
  var progressKey = 'alcc:compound-progress:' + character.name + ':' + (typeof __ALCC !== 'undefined' ? __ALCC.profile : 'default');
  var progress = [];
  try { if (typeof get === 'function') progress = get(progressKey) || []; } catch (e) {}
  if (!Array.isArray(progress)) progress = [];
  function record(name, result, scrollGold) {
    var row = progress.find(function (entry) { return entry.item === name; });
    if (!row) { row = { item: name, attempts: 0, successes: 0, destroyed: 0, unconfirmed: 0, scrollGold: 0, updatedAt: 0 }; progress.push(row); }
    row.attempts++;
    if (result && result.success === true) row.successes++;
    else if (result && result.success === false) row.destroyed++;
    else row.unconfirmed++;
    // Count replacement value only for acknowledged consumption, never uncertain actions.
    if (result && typeof result.success === 'boolean') row.scrollGold += Math.max(0, Number(scrollGold) || 0);
    row.updatedAt = Date.now();
    progress = progress.slice(-100);
    try { if (typeof set === 'function') set(progressKey, progress); } catch (e) {}
  }
  function snapshot() { return progress.map(function (row) { return Object.assign({}, row); }); }
  function board() { return typeof __ALCC !== "undefined" && __ALCC.compound || {}; }
  function enabled() { return board().enabled === true; }
  function rule(item) { return enabled() && (board().rules || []).find(function (r) { return r.item === item; }); }
  function owned(item) { return !!item && !item.l && !item.b && (!item.oo || item.oo === character.name); }
  function reserved(item) { return !!item && !!rule(item.name); }
  function eligible(item) {
    var target = item && rule(item.name);
    return !!target && owned(item) && !!(G.items[item.name] && G.items[item.name].compound) && (item.level || 0) < target.maxLevel;
  }
  function complete(item) { var target = item && rule(item.name); return !!target && owned(item) && (item.level || 0) >= target.maxLevel; }
  function depositEligible(item) {
    if (!item || !rule(item.name) || !owned(item)) return false;
    if (complete(item)) return true;
    if (!(item.level > 0)) return false;
    // Keep an actionable trio together, including stock just retrieved from bank.
    // Otherwise bank checks would withdraw and immediately redeposit it forever.
    var matching = (character.items || []).filter(function (part) {
      return eligible(part) && part.name === item.name && (part.level || 0) === item.level;
    }).length;
    return matching < 3;
  }
  async function checkBank() {
    if (!enabled() || !board().checkBankOnDeposit || !character.bank) return;
    if(typeof BankCoordinator!=='undefined'&&BankCoordinator.snapshot().current)return;
    // One actionable trio per rule: do not drain the bank or overfill the bag.
    for (var r = 0; r < board().rules.length; r++) {
      var target = board().rules[r];
      for (var level = target.maxLevel - 1; level >= 0; level--) {
        var carried = (character.items || []).filter(function (it) { return eligible(it) && it.name === target.item && (it.level || 0) === level; }).length;
        if (carried >= 3) break;
        var candidates = [];
        Object.keys(character.bank).forEach(function (pack) {
          if (!Array.isArray(character.bank[pack])) return;
          character.bank[pack].forEach(function (it, slot) {
            if (eligible(it) && it.name === target.item && (it.level || 0) === level) candidates.push({ pack: pack, slot: slot });
          });
        });
        var needed = 3 - carried;
        if (candidates.length < needed || free_slots() < needed + 1) continue;
        for (var i = 0; i < needed; i++) {
          var part = candidates[i];
          var floor = bank_pack_floor(part.pack);
          if (character.map !== floor) { await smart_move(floor); await sleep(500); }
          var current = character.bank[part.pack] && character.bank[part.pack][part.slot];
          if (!eligible(current) || current.name !== target.item || (current.level || 0) !== level) break;
          var before = (character.items || []).filter(function (it) { return it && it.name === target.item && (it.level || 0) === level; }).length;
          await bank_retrieve(part.pack, part.slot);
          await sleep(400);
          var after = (character.items || []).filter(function (it) { return it && it.name === target.item && (it.level || 0) === level; }).length;
          if (after <= before) { game_log("compound bank: withdrawal unconfirmed for " + target.item); return; }
        }
        break;
      }
    }
  }
  return { enabled: enabled, reserved: reserved, eligible: eligible, complete: complete, depositEligible: depositEligible, checkBank: checkBank, record: record, snapshot: snapshot };
})();
