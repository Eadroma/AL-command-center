/** Dromas: Command Center rogue crab farmer.
 * Fan of Knives takes priority over the shared normal-attack cooldown.
 * No boss events, tank following or automatic resurrection.
 */
var CONFIG = {
  FIXED_FARM: true,
  NAME: 'Dromas',
  MERCHANT: 'EadroSell',
  DEFAULT_FARM: 'crab',
  FARM_INDEPENDENT: true,
  farm: { map: 'main', x: -1200, y: -70 },
  merchantSpot: { map: 'main', x: -100, y: -20 },
  manaReserve: 100,
  skills: { fanofknives: true, mentalburst: true, rspeed: true },
  combatGloves: 'handofmidas',
  travelGloves: 'gloves',
  maxTargets: 5,
  pullHpPercent: 70,
  hpPotionPercent: 75,
  mpPotionPercent: 80,
  dumpFreeSlots: 4,
  keepGold: 50000
};

var cache = { target: null };
function combat_mtype() { return CONFIG.DEFAULT_FARM; }
function is_protected_item(item) { return CrabRogue.protectedItem(item); }
var CrabRogue = (function () {
  var servicing = false, routeBusy = false, retryAt = 0, lastErrorAt = 0, skillRetryAt = 0;
  var glovesBusy = false;
  var burstRetryAt = 0;
  var swiftnessPending = false, swiftnessRetryAt = 0;
  var luckRetryAt = 0;
  var luckVisitAt = 0, luckVisitRetryAt = 0;
  function luckItem() {
    if (typeof __ALCC === 'undefined') return 'elixirluck';
    var rule = typeof dashboard_elixir_rule === 'function' && dashboard_elixir_rule();
    return rule ? rule.item : null;
  }
  function skillEnabled(name) {
    return CONFIG.skills[name] !== false && (typeof StyleLoadout === 'undefined' || StyleLoadout.allows(name));
  }
  function luckActive() {
    var item = luckItem(); if (!item) return true;
    var equipped = character.slots.elixir, status = character.s || {};
    return !!(equipped && equipped.name === item || status[item] ||
      status.elixir && (status.elixir.name === item || status.elixir.f === item));
  }
  function needsLuck() {
    return !luckActive() && !character.items.some(function (item) { return item && item.name === luckItem() && !item.l; });
  }
  async function liquidLuck() {
    if (!ready() || Date.now() < luckRetryAt) return;
    if (luckActive()) return;
    var slot = character.items.findIndex(function (item) { return item && item.name === luckItem() && !item.l; });
    if (slot < 0) return;
    luckRetryAt = Date.now() + 4000;
    await consume(slot);
  }
  async function swiftness() {
    var skill = G.skills.rspeed;
    if (!ready() || !skillEnabled('rspeed') || swiftnessPending || Date.now() < swiftnessRetryAt ||
        character.s && character.s.rspeed || !skill || character.level < skill.level ||
        character.mp < skill.mp || is_on_cooldown('rspeed')) return;
    swiftnessPending = true;
    try { await use_skill('rspeed', character.name); }
    catch (e) { logError(e); }
    finally {
      swiftnessPending = false;
      // Allow the buff update to arrive before another missing-buff check casts.
      swiftnessRetryAt = Date.now() + 1000;
    }
  }
  async function gloves(fighting) {
    if (typeof CombatGear !== 'undefined' && CombatGear.ownsSlot('gloves')) return CombatGear.apply(!fighting);
    if (glovesBusy || character.rip) return;
    var current = character.slots.gloves, wanted = fighting ? CONFIG.combatGloves : CONFIG.travelGloves;
    if (current && current.name === wanted) return;
    var slot = -1;
    character.items.forEach(function (item, index) {
      if (item && item.name === wanted && (slot < 0 || (item.level || 0) > (character.items[slot].level || 0))) slot = index;
    });
    glovesBusy = true;
    try {
      if (slot >= 0) await equip(slot, 'gloves');
      else if (!fighting && current && current.name === CONFIG.combatGloves && character.items.some(function (item) { return !item; })) await unequip('gloves');
    } finally { glovesBusy = false; }
  }
  function range(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function ready() { return !character.rip && !is_disabled(character); }
  function logError(error) {
    if (Date.now() - lastErrorAt < 30000) return;
    lastErrorAt = Date.now();
    game_log('Crab rogue: ' + String(error && (error.reason || error.message) || error));
  }
  function targets() {
    return Object.keys(parent.entities || {}).map(function (id) { return parent.entities[id]; }).filter(function (e) {
      return e && e.type === 'monster' && e.mtype === 'crab' && !e.dead && e.hp > 0 && e.visible !== false &&
        (typeof RuntimePolicy === 'undefined' || RuntimePolicy.allowTarget(e)) &&
        (!e.map || e.map === character.map) && (!e.target || e.target === character.name);
    }).sort(function (a, b) {
      return Number(b.target === character.name) - Number(a.target === character.name) || range(character, a) - range(character, b);
    });
  }
  function fanTargets() {
    var skill = G.skills.fanofknives;
    return targets().filter(function (e) {
      return range(character, e) <= skill.range &&
        (e.target === character.name || character.hp / character.max_hp * 100 >= CONFIG.pullHpPercent);
    }).slice(0, Math.min(CONFIG.maxTargets, skill.max_targets || 5));
  }
  async function combat() {
    cache.target = targets()[0] || null;
    if (!ready() || servicing || character.map !== CONFIG.farm.map) return;
    var burst = G.skills.mentalburst;
    if (burst && skillEnabled('mentalburst') && Date.now() >= burstRetryAt && !is_on_cooldown('mentalburst') &&
        character.mp >= burst.mp + CONFIG.manaReserve &&
        Object.keys(burst.requirements || {}).every(function (stat) { return Number(character[stat] || 0) >= burst.requirements[stat]; })) {
      var burstRange = burst.range || character.range * (burst.range_multiplier || 1) + (burst.range_bonus || 0);
      var burstTarget = targets().filter(function (e) {
        return range(character, e) <= burstRange &&
          (e.target === character.name || character.hp / character.max_hp * 100 >= CONFIG.pullHpPercent);
      }).sort(function (a, b) { return a.hp - b.hp; })[0];
      if (burstTarget) {
        await gloves(!character.moving && !smart.moving);
        try { await use_skill('mentalburst', burstTarget.id); }
        catch (e) { burstRetryAt = Date.now() + 2000; logError(e); }
      }
    }
    var skill = G.skills.fanofknives, belt = character.slots && character.slots.belt;
    if (skill && skillEnabled('fanofknives') && belt && belt.name === 'knifebelt' && character.level >= skill.level &&
        Date.now() >= skillRetryAt && !is_on_cooldown('fanofknives') && !is_on_cooldown('attack') &&
        character.mp >= skill.mp + CONFIG.manaReserve) {
      var pack = fanTargets();
      if (pack.length) {
        await gloves(!character.moving && !smart.moving);
        try { await use_skill('fanofknives', pack.map(function (e) { return e.id; })); }
        catch (e) { skillRetryAt = Date.now() + 2000; logError(e); }
        return;
      }
    }
    var target = targets().find(function (e) {
      return can_attack(e) && (e.target === character.name || character.hp / character.max_hp * 100 >= CONFIG.pullHpPercent);
    });
    if (target && !is_on_cooldown('attack')) { await gloves(!character.moving && !smart.moving); await attack(target); }
  }
  function protectedItem(item) {
    if (item && (CONFIG.KEEP_ITEMS || []).indexOf(item.name) >= 0) return true;
    if (item && (CONFIG.LOADOUT_ITEMS || []).some(function (rule) { return item.name === rule.item && (item.level || 0) >= rule.minLevel; })) return true;
    if (item && typeof __ALCC !== 'undefined' && __ALCC.kit && __ALCC.kit.enabled && __ALCC.kit.rules.some(function (rule) { return rule.character === character.name && rule.item === item.name; })) return true;
    return !item || item.l || item.p || item.b || item.name === 'knifebelt' || item.name === CONFIG.combatGloves || item.name === CONFIG.travelGloves ||
      /^(hpot|mpot|elixir)/.test(item.name) || Number(item.level || 0) > 0;
  }
  async function travel(destination) {
    if (routeBusy || smart.moving || Date.now() < retryAt) return;
    routeBusy = true;
    try { await gloves(false); await smart_move(destination); }
    catch (e) { retryAt = Date.now() + 30000; logError(e); }
    finally { routeBusy = false; }
  }
  async function movement() {
    if (!ready() || typeof RuntimePolicy !== 'undefined' && !RuntimePolicy.allowLoop('movementLoop')) return;
    var dumpable = character.items.some(function (item) { return !protectedItem(item); });
    var luckNeeded = needsLuck() && Date.now() >= luckVisitRetryAt;
    if (luckNeeded) servicing = true;
    if (character.esize <= CONFIG.dumpFreeSlots && dumpable) servicing = true;
    var mule = get_player(CONFIG.MERCHANT);
    if (mule && (!mule.map || mule.map === character.map) && range(character, mule) <= 250) {
      for (var i = 0; i < character.items.length; i++) {
        var item = character.items[i];
        if (!protectedItem(item)) { await send_item(CONFIG.MERCHANT, i, item.q || 1); return; }
      }
      if (character.gold > CONFIG.keepGold + 10000) await send_gold(CONFIG.MERCHANT, character.gold - CONFIG.keepGold);
      if (luckNeeded) {
        if (!luckVisitAt) luckVisitAt = Date.now();
        set_message('Waiting for Liquid Luck');
        if (Date.now() - luckVisitAt < 60000) return;
        // Retry later if the merchant has no stock rather than camping forever.
        luckVisitRetryAt = Date.now() + 60000;
        game_log('Crab rogue: no Liquid Luck received; retrying merchant in one minute.');
      }
      luckVisitAt = 0; servicing = false;
    }
    if (servicing) {
      set_message(luckNeeded ? 'Go merchant / Liquid Luck' : 'Go merchant');
      var party = typeof get_party === 'function' ? get_party() : {};
      var contact = mule || party && party[CONFIG.MERCHANT];
      var destination = contact && contact.map ? { map: contact.map, x: contact.x, y: contact.y } : CONFIG.merchantSpot;
      if (character.map !== destination.map || range(character, destination) > 100) await travel(destination);
      return;
    }
    if (character.map !== CONFIG.farm.map || range(character, CONFIG.farm) > 350) { await travel(CONFIG.farm); return; }
    if (smart.moving || routeBusy) return;
    var target = targets()[0];
    if (!target) { if (range(character, CONFIG.farm) > 70) await travel(CONFIG.farm); return; }
    var hasFan = G.skills.fanofknives && character.level >= G.skills.fanofknives.level && character.slots.belt && character.slots.belt.name === 'knifebelt';
    var reach = hasFan && character.mp >= G.skills.fanofknives.mp + CONFIG.manaReserve ? G.skills.fanofknives.range : character.range;
    if (range(character, target) > Math.max(10, reach - 15)) {
      var d = range(character, target), step = Math.min(40, d - Math.max(10, reach - 20));
      var x = character.x + (target.x - character.x) / d * step, y = character.y + (target.y - character.y) / d * step;
      if (can_move_to(x, y)) { await gloves(false); move(x, y); }
    }
  }
  async function sustain() {
    if (!ready()) return;
    if (typeof wear_dashboard_kit === 'function') await wear_dashboard_kit();
    if (typeof StyleLoadout !== 'undefined') await StyleLoadout.equip();
    if (character.moving || smart.moving || servicing || !targets().some(function (e) {
      return range(character, e) <= (G.skills.fanofknives ? G.skills.fanofknives.range : character.range);
    })) await gloves(false);
    if (character.hp / character.max_hp * 100 < CONFIG.hpPotionPercent && !is_on_cooldown('use_hp')) await use_skill('use_hp');
    else if (character.mp / character.max_mp * 100 < CONFIG.mpPotionPercent && !is_on_cooldown('use_mp')) await use_skill('use_mp');
    loot();
    set_message(servicing ? 'Go merchant' : 'Crabs / Fan of Knives');
  }
  function loop(action, delay) {
    async function tick() {
      try { await action(); } catch (e) { logError(e); }
      setTimeout(tick, delay);
    }
    tick();
  }
  function install() {
    if (character.name !== CONFIG.NAME || character.ctype !== 'rogue') { game_log('Load this script on Dromas (rogue).'); return; }
    if (typeof parent !== 'undefined' && parent.$ && typeof load_code === 'function') {
      load_code('gui', function () { game_log('gui slot missing'); });
    }
    if (typeof stop === 'function') stop('smart');
    loop(liquidLuck, 1000); loop(swiftness, 250); loop(combat, 100); loop(movement, 500); loop(sustain, 500);
    game_log('Dromas: independent crab farming; Fan of Knives priority.');
  }
  return { install: install, combat: combat, movement: movement, targets: targets, protectedItem: protectedItem, gloves: gloves, swiftness: swiftness, liquidLuck: liquidLuck };
})();
CrabRogue.install();
