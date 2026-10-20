/** Combat-only gloves. Movement always takes priority, even while shooting/kiting. */
var CombatGear = (function () {
  var rule = (__ALCC.automation.combatGear || []).find(function (r) { return r.enabled && r.character === character.name; });
  var busy = false, attemptedAt = 0, actionAt = 0, status = 'disabled';
  function ownsSlot(slot) { return !!rule && slot === 'gloves'; }
  function moving() { return !!character.moving || typeof smart !== 'undefined' && !!smart.moving; }
  function inCombat() {
    if (!rule || character.rip || moving() || typeof is_disabled === 'function' && is_disabled(character)) return false;
    var t = typeof cache !== 'undefined' && cache && cache.target || typeof parent !== 'undefined' && parent.entities && parent.entities[character.target];
    if (t && t.type === 'monster' && !t.rip && (!t.map || t.map === character.map) && (typeof RuntimePolicy === 'undefined' || RuntimePolicy.allowTarget(t))) {
      var near = typeof is_in_range === 'function' ? is_in_range(t, 'attack') : Math.hypot(t.x - character.x, t.y - character.y) <= (character.range || 0);
      if (near) return true;
    }
    return Date.now() - actionAt < 600;
  }
  function countFree() { return (character.items || []).filter(function (item) { return !item; }).length; }
  async function apply(forceTravel) {
    if (!rule || busy || character.rip || !forceTravel && Date.now() - attemptedAt < 400) return false;
    var fight = !forceTravel && inCombat(), wanted = fight ? rule.combatItem : rule.movementItem, minimum = fight ? rule.combatMinLevel : rule.movementMinLevel;
    var current = character.slots && character.slots.gloves;
    if (wanted && current && current.name === wanted && (current.level || 0) >= minimum) { status = fight ? 'combat gloves equipped' : 'movement gloves equipped'; return false; }
    if (!wanted && (!current || current.name !== rule.combatItem)) { status = 'travel · combat gloves removed'; return false; }
    busy = true; attemptedAt = Date.now();
    try {
      if (!wanted) {
        if (!countFree()) { status = 'cannot remove combat gloves · inventory full'; return false; }
        var removed = await unequip('gloves'); if (removed && removed.failed) throw removed;
        status = 'travel · combat gloves removed'; return true;
      }
      if (!G.items[wanted] || G.items[wanted].type !== 'gloves') { status = 'configured item is not gloves'; return false; }
      var slot = -1, level = -1;
      (character.items || []).forEach(function (item, index) { if (item && item.name === wanted && (item.level || 0) >= minimum && (item.level || 0) > level) { slot = index; level = item.level || 0; } });
      if (slot < 0) {
        status = 'missing ' + wanted;
        // Missing travel gloves must not leave the slowing combat pair equipped.
        if (!fight && current && current.name === rule.combatItem && countFree()) { var result = await unequip('gloves'); if (result && result.failed) throw result; }
        return false;
      }
      var equipped = await equip(slot, 'gloves'); if (equipped && equipped.failed) throw equipped;
      status = fight ? 'combat gloves equipped' : 'movement gloves equipped'; return true;
    } catch (e) { status = ('equipment error: ' + String(e && (e.reason || e.message) || e)).slice(0, 180); return false; }
    finally { busy = false; }
  }
  function install() {
    if (!rule) return;
    ['attack', 'use_skill'].forEach(function (name) {
      var original = globalThis[name]; if (typeof original !== 'function') return;
      globalThis[name] = async function () {
        var args = arguments, combat = name === 'attack' || ['3shot', '5shot', 'supershot', 'poisonarrow', 'cleave', 'stomp', 'cburst', 'burst', 'fanofknives', 'mentalburst'].indexOf(args[0]) >= 0;
        if (combat) { actionAt = Date.now(); await apply(); }
        return original.apply(this, args);
      };
    });
    setInterval(function () { apply(); }, 250);
    apply();
  }
  return { ownsSlot: ownsSlot, apply: apply, install: install, snapshot: function () { return { enabled: !!rule, phase: inCombat() ? 'combat' : 'travel', status: status }; } };
})();
