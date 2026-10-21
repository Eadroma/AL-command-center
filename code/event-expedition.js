/** Home-server event workers. The merchant owns lifecycle; workers own travel,
 * readiness and verified unloading. CM leases prevent orphaned boss missions. */
var EventExpedition = (function () {
  var board = typeof __ALCC !== 'undefined' && __ALCC.eventExpedition || {};
  var key = 'alcc:event-expedition:' + character.name + ':' + (__ALCC.profile || 'default');
  var mission = null, reports = {}, assignment = null, leaseAt = 0, busy = false;
  var summaries = [], metrics = null, baseline = null;
  var bossDamage = 0, bossHits = 0, lootItems = {}, seenChests = [];
  var installedAt = Date.now(), lastSend = 0, lastWolfAt = 0, cooldowns = {}, stops = {};
  var deathKey = key + ':worker', deaths = 0, wasDead = !!character.rip, townDone = false, travelling = false, townAt = 0;
  try { mission = typeof get === 'function' ? get(key) : null; } catch (e) {}
  try { var retained = typeof get === 'function' ? get(key + ':summaries') : null; if (Array.isArray(retained)) summaries = retained.slice(-10); } catch (e) {}
  function worker() { return !!board.enabled && [board.warrior, board.priest].indexOf(character.name) >= 0; }
  function merchant() { return character.name === board.merchant; }
  function names() { return [board.warrior, board.priest].filter(Boolean); }
  function save() { try { if (typeof set === 'function') set(key, mission); } catch (e) {} }
  function log(text) { if (typeof game_log === 'function') game_log('Event expedition: ' + text); }
  function home() {
    try { return parent.server_region === __ALCC.homeServer.region && (parent.server_identifier || parent.server_name) === __ALCC.homeServer.name; } catch (e) { return false; }
  }
  function running(name) { return typeof team_child_running === 'function' && team_child_running(name); }
  function live(id) {
    var data = typeof parent !== 'undefined' && parent.S && parent.S[id];
    return !!data && data.live !== false && data.active !== false && (data.live === true || data.active === true || Number(data.hp) > 0);
  }
  function point() { return __ALCC.standSpot || { map: 'main', x: -100, y: -20 }; }
  function near(destination, radius) { return character.map === destination.map && Math.hypot(character.x - destination.x, character.y - destination.y) <= radius; }
  function fresh(name) { var row = reports[name]; return mission && row && Date.now() - row.at < 15000 && row.id === mission.id ? row : null; }
  function returning(reason) {
    if (!mission || mission.phase === 'returning' || mission.phase === 'blocked') return;
    mission.phase = 'returning'; mission.reason = reason; mission.returnAt = Date.now(); save(); log(reason + '; returning and unloading');
  }
  function recall() {
    if (!merchant() || !mission || ['forming', 'engaging'].indexOf(mission.phase) < 0) return false;
    returning('Manual recall from HUD'); lastSend = 0; sendOrders(); return true;
  }
  function sendOrders() {
    if (!mission || Date.now() - lastSend < 3000) return;
    lastSend = Date.now();
    names().forEach(function (name) {
      send_cm(name, { t: 'event_expedition', id: mission.id, event: mission.event, phase: mission.phase, assembly: point(), expiresAt: Date.now() + 20000 });
    });
  }
  function onCm(name, data) {
    if (!data || typeof data !== 'object') return;
    if (merchant() && data.t === 'event_expedition_report' && names().indexOf(name) >= 0) {
      if (!mission || data.id !== mission.id) return;
      reports[name] = { readinessReason: typeof data.readinessReason === 'string' ? data.readinessReason.slice(0,200) : '', metrics: cleanMetrics(data.metrics), id: data.id, ready: !!data.ready, returned: !!data.returned, deaths: Math.max(0, Number(data.deaths) || 0), free: Number(data.free), at: Date.now() };
      (mission.lastReports || (mission.lastReports = {}))[name] = reports[name]; save();
    }
    if (merchant() && mission && ['forming', 'engaging', 'returning'].indexOf(mission.phase) >= 0 && data.t === 'event_expedition_wolf' && (__ALCC.farmers || []).indexOf(name) >= 0) {
      if (lastWolfAt && data.active === false) mission.loneWolfDowntimeMs += Math.min(8000, Date.now() - lastWolfAt);
      lastWolfAt = Date.now(); save();
    }
    if (worker() && name === board.merchant && data.t === 'event_expedition' && typeof data.id === 'string' && board.allowed.indexOf(data.event) >= 0 && ['forming', 'engaging', 'returning', 'blocked'].indexOf(data.phase) >= 0) {
      if (!assignment || assignment.id !== data.id) { var previous = typeof get === 'function' ? get(deathKey) : null; baseline = metrics; bossDamage = 0; bossHits = 0; lootItems = {}; seenChests = []; deaths = previous && previous.id === data.id ? Number(previous.deaths) || 0 : 0; wasDead = !!character.rip; townDone = false; }
      if (assignment && assignment.phase !== data.phase && typeof smart !== 'undefined' && smart.moving) { stop(); travelling = false; }
      if (assignment && assignment.phase !== data.phase && ['returning', 'blocked'].indexOf(data.phase) >= 0) townDone = false;
      assignment = data; leaseAt = Date.now();
    }
  }
  function combatEvent() { return worker() && assignment && assignment.phase === 'engaging' && Date.now() - leaseAt < 20000 ? assignment.event : null; }
  function canCombat(target) {
    if (!worker()) return true;
    if (!combatEvent()) return false;
    var objectives = assignment.event === 'graveyard' ? ['gargoyle', 'ghoul', 'zombie'] : assignment.event === 'horseman' ? ['horseman', 'jackowalker'] : [assignment.event];
    if (target && objectives.indexOf(target.mtype) < 0 && target.target !== character.name) return false;
    {
      var priest = get_player(character.name === board.warrior ? board.priest : board.warrior);
      if (!priest || priest.rip || priest.hp <= 0 || (priest.map && priest.map !== character.map) || distance(character, priest) > 280) return false;
    }
    return true;
  }
  function dumpCount() { return typeof dumpable_count === 'function' ? dumpable_count() : 0; }
  var departureFreeSlots = 5;
  async function unloadOne(releasePotionSpace) {
    var mule = get_player(board.merchant);
    if (!mule || mule.rip || mule.hp <= 0 || (mule.map && mule.map !== character.map) || distance(character, mule) > 250) return;
    for (var slot = 0; slot < (character.items || []).length; slot++) {
      var item = character.items[slot];
      var extraPotions = releasePotionSpace && character.esize < departureFreeSlots && item && /^([hm]pot)[01]$/.test(item.name) && !item.l && !item.b && (!item.oo || item.oo === character.name) && (character.items || []).reduce(function(n,it) { return n + (it && it.name === item.name ? it.q || 1 : 0); },0) - (item.q || 1) >= 1000;
      if (item && !item.l && !item.b && (extraPotions || typeof is_dumpable_slot === 'function' && is_dumpable_slot(slot))) {
        await bounded(send_item(board.merchant, slot, item.q || 1), 10000);
        break; // Wait for the next inventory observation before another transfer.
      }
    }
  }
  function pots(prefix) { return (character.items || []).reduce(function (n, it) { return n + (it && it.name.indexOf(prefix) === 0 ? it.q || 1 : 0); }, 0); }
  function report() {
    if (!board.enabled) return;
    if (worker()) {
      if (character.rip && !wasDead) { deaths++; if (assignment && typeof set === 'function') set(deathKey, { id: assignment.id, deaths: deaths }); }
      wasDead = !!character.rip;
      var destination = assignment && assignment.assembly || point();
      var readinessReason = character.rip ? 'Dead: waiting for revival' : !near(destination, 100) ? 'Travelling to assembly' : dumpCount() > 0 ? 'Unloading carried loot before departure' : character.esize < departureFreeSlots ? 'Needs '+departureFreeSlots+' free inventory slots before departure' : character.hp < character.max_hp * .7 ? 'HP ' + Math.round(100 * character.hp / character.max_hp) + '%; needs 70%' : character.mp < character.max_mp * .2 ? 'MP below 20%' : pots('hpot') < 20 ? 'Needs 20 HP potions' : pots('mpot') < 20 ? 'Needs 20 MP potions' : 'Ready';
      var ready = !character.rip && near(destination, 100) && dumpCount() === 0 && character.esize >= departureFreeSlots && character.hp >= character.max_hp * .7 && character.mp >= character.max_mp * .2 && pots('hpot') >= 20 && pots('mpot') >= 20;
      send_cm(board.merchant, { t: 'event_expedition_report', id: assignment && assignment.id || '', ready: ready, readinessReason: readinessReason, returned: !!assignment && ['returning', 'blocked'].indexOf(assignment.phase) >= 0 && !character.rip && near(destination, 100) && dumpCount() === 0, deaths: deaths, free: character.esize, metrics: workerMetrics() });
    } else if (!merchant() && character.ctype === 'ranger') {
      send_cm(board.merchant, { t: 'event_expedition_wolf', active: !!(character.s && character.s.encouragement_lonewolf) });
    }
  }
  async function merchantTick() {
    if (!merchant() || busy || Date.now() - installedAt < 15000) return;
    busy = true;
    try {
      if (!mission || ['idle', 'complete'].indexOf(mission.phase) >= 0) {
        if (mission && mission.phase === 'complete' && Date.now() - (mission.completedAt || 0) < 300000) return;
        if (!board.enabled || !__ALCC.eventsEnabledMaster || !home() || names().length !== 2) return;
        var event = ['mrgreen', 'mrpumpkin'].concat(board.allowed).filter(function (id, index, all) { return board.allowed.indexOf(id) >= 0 && all.indexOf(id) === index; }).find(function (id) { return live(id) && (!cooldowns[id] || Date.now() >= cooldowns[id]); });
        if (!event) return;
        mission = { id: Date.now().toString(36), event: event, phase: 'forming', reason: 'Waiting for both workers, health and potion stock', startedAt: Date.now(), loneWolfDowntimeMs: 0, owned: [], attempts: {}, returnAt: 0 };
        lastWolfAt = 0; save(); log('forming duo for ' + event);
      }
      if ((!board.enabled || !__ALCC.eventsEnabledMaster) && mission.phase !== 'blocked') returning('Mode disabled');
      if (!home()) returning('Merchant left home server');
      if (mission.phase === 'forming') {
        if (!live(mission.event)) returning('Event ended before departure');
        else if (Date.now() - mission.startedAt > 120000) returning('Startup/readiness timeout');
        else {
          for (var i = 0; i < names().length; i++) {
            var name = names()[i];
            if (running(name)) continue;
            if (mission.attempts[name]) { if (Date.now() - mission.attempts[name] > 45000) returning('Worker did not start; no repeated login loop'); break; }
            // Ownership is granted only after our own successful startup request.
            mission.attempts[name] = Date.now(); save();
            var start = typeof get_start_character_fn === 'function' ? get_start_character_fn() : null;
            if (!start) { returning('start_character unavailable'); break; }
            try {
              var result = await bounded(start(name, 'CC_' + name), 20000);
              if (result && (result.failed || result.success === false)) throw result;
              mission.owned.push(name); save();
            } catch (e) { returning('Worker startup failed: ' + name); }
            break; // one startup per tick
          }
          if (names().every(function (name) { var row = fresh(name); return !!row && row.ready && row.free >= departureFreeSlots; })) { mission.phase = 'engaging'; mission.engagedAt = Date.now(); mission.reason = 'Both workers ready'; save(); log('engaging ' + mission.event); }
        }
      }
      if (mission.phase === 'engaging') {
        if (!live(mission.event)) returning('Event ended');
        else if (Date.now() - mission.startedAt >= board.maxMinutes * 60000) returning('Mission duration limit');
        else if (names().some(function (name) { var row = fresh(name); return !row || row.deaths >= board.maxDeaths || row.free <= 1; })) returning('Worker missing, death limit or inventory full');
      }
      if (mission.phase === 'returning' || mission.phase === 'blocked') {
        // A timeout holds the mission for inspection but must still accept
        // verified late unloading; only owned, returned workers can be stopped.
        for (var j = 0; j < mission.owned.length; j++) {
          var owned = mission.owned[j], status = fresh(owned);
          if (!running(owned)) continue;
          if (!status || !status.returned) continue;
          if (stops[owned] && Date.now() - stops[owned] < 15000) continue;
          var halt = typeof stop_character === 'function' ? stop_character : parent.stop_character;
          if (typeof halt === 'function') { stops[owned] = Date.now(); await bounded(halt(owned), 10000); log('stopped owned worker ' + owned); }
        }
        if (mission.owned.every(function (name) { return !running(name); }) && names().every(function (name) { var row = fresh(name); return !running(name) || !!row && row.returned; })) {
          mission.phase = 'complete'; mission.completedAt = Date.now(); cooldowns[mission.event] = Date.now() + 300000; save(); recordSummary(); log('complete; manual characters kept online');
        } else if (mission.phase !== 'blocked' && Date.now() - mission.returnAt > 240000) { mission.phase = 'blocked'; mission.reason = 'Cleanup incomplete; workers remain online for inspection'; save(); recordSummary(); log(mission.reason); }
      }
      sendOrders();
    } catch (e) { log('lifecycle error: ' + (e.reason || e.message || e)); }
    finally { busy = false; }
  }
  function bounded(value, ms) {
    return new Promise(function (resolve, reject) { var timer = setTimeout(function () { reject(new Error('Action timeout')); }, ms); Promise.resolve(value).then(function (result) { clearTimeout(timer); resolve(result); }, function (error) { clearTimeout(timer); reject(error); }); });
  }
  var travelRetryAt = 0, lastTravelError = '', lastTravelLogAt = 0;
  var townPending = false;
  function inIceArena() {
    return character.map === 'winterland' && Math.hypot(Number(character.x) - 800, Number(character.y) - 450) <= 450;
  }
  function travel(destination) {
    if (travelling || Date.now() < travelRetryAt || (typeof smart !== 'undefined' && smart.moving)) return;
    travelling = true;
    Promise.resolve().then(function () { return typeof OwnedNavigation!=='undefined'?OwnedNavigation.run('expedition:'+String(assignment&&assignment.id||'return'),destination,function(){return smart_move(destination);},60):smart_move(destination); }).then(function () {
      travelRetryAt = 0; lastTravelError = '';
    }).catch(function (e) {
      var reason = String(e && (e.reason || e.message) || e);
      travelRetryAt = Date.now() + (reason === 'route_suspended' ? 30000 : 5000);
      if (reason !== lastTravelError || Date.now() - lastTravelLogAt >= 60000) {
        log('travel failed: ' + reason); lastTravelError = reason; lastTravelLogAt = Date.now();
      }
      // A failed return route needs a fresh town attempt to change its origin.
      if (reason === 'route_suspended' && assignment && ['returning', 'blocked'].indexOf(assignment.phase) >= 0) townDone = false;
    }).then(function () { travelling = false; });
  }
  async function actorTickUnsafe() {
    if (!worker()) return false;
    if (assignment && Date.now() - leaseAt >= 20000 && assignment.phase !== 'returning') { assignment.phase = 'returning'; townDone = false; log('Coordinator lease expired; returning'); }
    if (!assignment) { if (typeof smart !== 'undefined' && smart.moving) stop(); return true; }
    if (assignment.phase === 'engaging') return false;
    if (character.rip) return true;
    if (assignment.phase === 'returning' || assignment.phase === 'blocked') {
      if (townPending) return true;
      if (!townDone || inIceArena()) {
        if (Date.now() - townAt < 15000 && townAt) return true;
        townAt = Date.now(); townPending = true; townDone = false;
        if (typeof smart !== 'undefined' && smart.moving) stop();
        travelling = false;
        try {
          var result = await bounded(typeof OwnedNavigation!=='undefined'?OwnedNavigation.run('expedition-town:'+assignment.id,{map:'main'},function(){return town();}):town(),15000);
          if (result && (result.failed || result.success === false)) throw result;
          // Some clients resolve town before the channel and map update arrive.
          if (inIceArena()) await new Promise(function (resolve) { setTimeout(resolve, 4000); });
          if (inIceArena()) throw new Error('Still in Ice Golem arena after town');
          townDone = true; travelRetryAt = 0;
          log('town return completed');
        } catch (e) { log('town return failed: ' + String(e && (e.reason || e.message) || e)); }
        finally { townPending = false; }
        return true;
      }
      if (!near(assignment.assembly, 75)) { travel(assignment.assembly); return true; }
      await unloadOne();
      return true;
    }
    if (!near(assignment.assembly, 75)) { travel(assignment.assembly); return true; }
    await unloadOne(true);
    // Assembly readiness must not depend on the emergency-only potion threshold.
    if (character.hp < character.max_hp * .7 && typeof use_skill === 'function' && typeof is_on_cooldown === 'function' && !is_on_cooldown('use_hp')) { try { await bounded(use_skill('use_hp'), 5000); } catch(e) {} }
    if (character.mp < character.max_mp * .2 && typeof use_skill === 'function' && typeof is_on_cooldown === 'function' && !is_on_cooldown('use_mp')) { try { await bounded(use_skill('use_mp'), 5000); } catch(e) {} }
    return true;
  }
  async function actorTick() { try { return await actorTickUnsafe(); } catch (e) { log('worker action failed: ' + (e.reason || e.message || e)); return worker(); } }
  function needsReturnService() { return merchant() && mission && ['forming', 'returning', 'blocked'].indexOf(mission.phase) >= 0 && names().some(function (name) {
    // A verified unloading report remains valid after the worker stops sending.
    // Never reuse a terminal report from a different expedition.
    if (mission.phase === 'forming') { var preparing = fresh(name); return running(name) && !(preparing && preparing.ready && preparing.free >= departureFreeSlots); }
    var row = fresh(name) || mission.lastReports && mission.lastReports[name];
    return running(name) && !(row && row.id === mission.id && row.returned);
  }); }
  function cleanMetrics(value) {
    if (!value || typeof value !== 'object') return undefined;
    var out = {}; ['damage', 'bossDamage', 'bossHits', 'healing', 'lootGold', 'attacks'].forEach(function(k) { var n = Number(value[k]); out[k] = isFinite(n) && n >= 0 ? n : 0; });
    if (Array.isArray(value.items)) out.items = value.items.slice(0,40).filter(function(it){return it && typeof it.name === 'string' && it.name.length <= 80 && Number(it.quantity)>0;}).map(function(it){return {name:it.name,level:Math.max(0,Math.min(20,Number(it.level)||0)),quantity:Math.min(999999999,Number(it.quantity))};});
    return out;
  }
  function observeMetrics(combat, loot) {
    if (!worker() || !combat) return;
    metrics = { damage: Number(combat.damageDealt) || 0, healing: Number(combat.healing) || 0, lootGold: Number(loot && loot.gold) || 0, attacks: Number(combat.attacks) || 0 };
    if (assignment && !baseline) baseline = Object.assign({}, metrics);
  }
  function workerMetrics() {
    if (!metrics || !baseline) return undefined;
    var out = { bossDamage: bossDamage, bossHits: bossHits }; Object.keys(metrics).forEach(function(k) { out[k] = Math.max(0, metrics[k] - baseline[k]); }); out.items = Object.keys(lootItems).map(function(k){return lootItems[k];}).slice(0,40); return out;
  }
  function participants() {
    return names().map(function(name) { var row = fresh(name) || mission && mission.lastReports && mission.lastReports[name]; return { name: name, online: running(name), ready: !!row && row.ready, returned: !!row && row.returned, deaths: row ? row.deaths : 0, readinessReason: row && row.readinessReason, metrics: row && row.metrics, reportedAt: row && row.at }; });
  }
  function recordSummary() {
    if (!mission) return;
    var row = { id: mission.id, event: mission.event, phase: mission.phase, reason: mission.reason, startedAt: mission.startedAt, engagedAt: mission.engagedAt, finishedAt: mission.completedAt || Date.now(), owned: mission.owned.slice(), participants: participants() };
    var index = summaries.findIndex(function(entry) { return entry.id === row.id; }); if (index >= 0) summaries[index] = row; else summaries.push(row);
    summaries = summaries.slice(-10); try { if (typeof set === 'function') set(key + ':summaries', summaries); } catch (e) {}
  }
  function snapshot() {
    if (!merchant()) return undefined;
    if (!mission) return board.enabled ? { id: '', event: '', phase: 'idle', reason: 'Waiting for an allowed boss on the home server', startedAt: 0, updatedAt: Date.now(), history: summaries.slice(), loneWolfDowntimeMs: 0, owned: [], participants: names().map(function (name) { return { name: name, online: running(name), ready: false, returned: false, deaths: 0 }; }) } : undefined;
    return { id: mission.id, event: mission.event, phase: mission.phase, reason: mission.reason, startedAt: mission.startedAt, updatedAt: Date.now(), loneWolfDowntimeMs: mission.loneWolfDowntimeMs, owned: mission.owned, history: summaries.slice(), participants: participants() };
  }
  function install() {
    if (board.enabled && worker()) try { if (character.on) character.on('loot', function(data) {
      if (!assignment || !data || !data.id || seenChests.indexOf(data.id) >= 0) return;
      seenChests.push(data.id); seenChests = seenChests.slice(-100);
      (data.items || []).forEach(function(it) {
        if (!it || it.looter !== character.name || !it.name) return;
        var itemKey = it.name + ':' + (it.level || 0);
        if (!lootItems[itemKey]) lootItems[itemKey] = { name: it.name, level: it.level || 0, quantity: 0 };
        lootItems[itemKey].quantity += it.q || 1;
      });
    }); } catch (e) {}
    if (board.enabled && worker()) try { if (parent.socket && parent.socket.on) parent.socket.on('hit', function(data) {
      if (!assignment || assignment.phase !== 'engaging' || Date.now() - leaseAt >= 20000 || data.hid !== character.name) return;
      var target = parent.entities && parent.entities[data.id];
      var bossType = assignment.event === 'graveyard' ? 'gargoyle' : assignment.event;
      if (target && target.mtype === bossType && Number(data.damage) > 0) { bossDamage += Number(data.damage); bossHits++; }
    }); } catch (e) {}
    if (board.enabled && typeof setInterval === 'function') setInterval(function () { try { report(); } catch (e) { log('report failed'); } }, 4000); }
  return { recall: recall, observeMetrics: observeMetrics, worker: worker, onCm: onCm, combatEvent: combatEvent, canCombat: canCombat, merchantTick: merchantTick, actorTick: actorTick, snapshot: snapshot, needsReturnService: needsReturnService, install: install, report: report };
})();
