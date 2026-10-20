/**
 * Command Center activity runtime. Loaded before CODE starts its loops.
 * Decisions gate new pulls; emergency healing, potions, loot and self-defence stay available.
 * Progress is persisted by rule ID in Adventure Land get/set storage when available.
 */
var RuntimePolicy = (function () {
  var settings = typeof __ALCC !== 'undefined' && __ALCC.automation || {};
  var me = typeof character !== 'undefined' ? character.name : '';
  var now = Date.now(), lastTick = now, lastActionAt = 0, lastActionReason = '';
  var reason = 'Starting', since = now, durations = {}, actions = [], receipts = [];
  var danger = { active: false, reason: '', attackers: 0, hpPercent: 100, incomingDps: 0, healingDps: 0, action: 'none' };
  var recoveryUntil = 0, townAt = 0, observations = [], holding = false;
  var goals = (settings.lootGoals || []).filter(function (g) { return g.enabled && g.characters.indexOf(me) >= 0; });
  var commerce = typeof character !== 'undefined' && character.ctype === 'merchant' ? (settings.commercialGoals || []).filter(function (g) { return g.enabled; }) : [];
  var storagePrefix = 'alcc:policy:v1:' + (__ALCC.profile || 'party') + ':';
  var broadcastAt = 0;
  var riskPeers = {}, riskBroadcastAt = 0, riskSequence = 0;
  function riskRealm() { try { return String(parent.server_region || '') + ':' + String(parent.server_name || parent.server_identifier || ''); } catch (e) { return ''; } }
  function read(key) { try { return typeof get === 'function' && get(storagePrefix + key) || null; } catch (e) { return null; } }
  function write(key, value) { try { if (typeof set === 'function') set(storagePrefix + key, value); } catch (e) {} }
  // Persist death edges, not a volatile combat counter that resets with CODE.
  var riskKey = 'risk:' + (settings.dangers && settings.dangers.runId || 'default') + ':' + me;
  var risk = read(riskKey) || { deaths: 0, rip: !!character.rip };
  write(riskKey, risk);
  var progress = {}, started = {}, commercialProgress = {};
  goals.forEach(function (g) { var v = read('loot:' + g.id + ':' + me); progress[g.id] = v && v.item === g.item ? v.count || 0 : 0; started[g.id] = v && v.startedAt || now; write('loot:' + g.id + ':' + me, { item: g.item, count: progress[g.id], startedAt: started[g.id] }); });
  commerce.forEach(function (g) { var v = read('craft:' + g.id + ':' + me); commercialProgress[g.id] = v && v.item === g.item ? v : { item: g.item, count: 0, spent: 0 }; });
  function entities() { return typeof parent !== 'undefined' && parent.entities || {}; }
  function target() {
    if (typeof cache !== 'undefined' && cache && cache.target) return cache.target;
    return entities()[character.target] || null;
  }
  function distance(entity) { return Math.hypot((entity.real_x == null ? entity.x : entity.real_x) - character.x, (entity.real_y == null ? entity.y : entity.real_y) - character.y); }
  function selfDefence(entity) { return !!entity && (entity.target === me || (__ALCC.farmers || []).indexOf(entity.target) >= 0); }
  function setReason(value) { if (reason !== value) { reason = value; since = Date.now(); } }
  function record(action, result) {
    actions.push({ at: Date.now(), action: String(action).slice(0, 80), result: String(result).slice(0, 180) });
    if (actions.length > 15) actions.shift();
    if (result !== 'success' || action === 'attack' || action === 'heal' || action === 'partyheal') { lastActionAt = Date.now(); lastActionReason = result === 'success' ? action === 'attack' ? 'Attack executed' : 'Healing priority' : String(result).slice(0, 180); }
  }
  var lootSupported = typeof character !== 'undefined' && typeof character.on === 'function';
  function onLoot(data) {
    if (!data || data.gone || !data.id || receipts.indexOf(data.id) >= 0) return;
    receipts.push(data.id); if (receipts.length > 200) receipts.shift();
    goals.forEach(function (g) {
      var quantity = (data.items || []).reduce(function (sum, item) {
        // Party loot is broadcast to every member. Credit the actual recipient only.
        return sum + (item.name === g.item && (item.looter === me || (!data.party && data.opener === me && !item.looter)) ? Number(item.q || 1) : 0);
      }, 0);
      if (quantity > 0) { progress[g.id] += quantity; write('loot:' + g.id + ':' + me, { item: g.item, count: progress[g.id], startedAt: started[g.id] }); }
    });
  }
  function goalRows() {
    return goals.map(function (g) {
      var count = progress[g.id] || 0, began = started[g.id];
      g.characters.filter(function (name) { return name !== me; }).forEach(function (name) { var p = read('loot:' + g.id + ':' + name); if (p && p.item === g.item) { count += p.count || 0; began = Math.min(began, p.startedAt || began); } });
      return { id: g.id, item: g.item, count: count, target: g.quantity, complete: count >= g.quantity, paused: count >= g.quantity && g.action === 'pause', supported: lootSupported, startedAt: began };
    });
  }
  function paused() { return goalRows().some(function (g) { return g.paused; }); }
  function stock(item) { return (character.items || []).reduce(function (sum, it) { return sum + (it && it.name === item && !(it.level || 0) ? Number(it.q || 1) : 0); }, 0); }
  function commerceRows() {
    return commerce.map(function (g) {
      var p = commercialProgress[g.id], recipe = typeof G !== 'undefined' && G.craft && G.craft[g.item];
      var state = p.pending ? 'Unconfirmed transaction: review before new run' : p.count >= g.quantity ? 'complete' : !recipe ? 'recipe unavailable' : !commercialAllowed(g.item) ? 'budget exhausted' : 'waiting for ingredients';
      return { id: g.id, item: g.item, held: p.count, target: g.quantity, spent: p.spent, budget: g.budget, state: state };
    });
  }
  function commercialAllowed(item) {
    var g = commerce.find(function (g) { return g.item === item; });
    if (!g) return true;
    var p = commercialProgress[g.id], recipe = G.craft && G.craft[item];
    if (!recipe || p.pending || p.count >= g.quantity) return false;
    var missingCost = 0;
    (recipe.items || []).forEach(function (row) {
      var need = Math.max(0, Number(row[0] || 1) - (typeof item_count_level === 'function' ? item_count_level(row[1], Number(row[2] || 0)) : 0));
      if (need && typeof craft_shop_for === 'function' && craft_shop_for(row[1])) missingCost += need * Number(G.items[row[1]] && G.items[row[1]].g || 0);
    });
    return p.spent + Number(recipe.cost || 0) + missingCost <= g.budget;
  }
  function commercialBatchLimit(item, requested) {
    var g = commerce.find(function(g) { return g.item === item; });
    if (!g) return requested;
    var p = commercialProgress[g.id], recipe = G.craft && G.craft[item];
    if (!recipe || p.pending) return 0;
    var limit = Math.max(0, Math.min(requested, g.quantity - p.count));
    function costFor(n) {
      var cost = Number(recipe.cost || 0) * n;
      (recipe.items || []).forEach(function(row) {
        if ((Number(row[2]) || 0) !== 0 || typeof craft_shop_for !== 'function' || !craft_shop_for(row[1])) return;
        var held = typeof item_count_level === 'function' ? item_count_level(row[1], 0) : 0;
        cost += Math.max(0, Number(row[0] || 1) * n - held) * Number(G.items[row[1]] && G.items[row[1]].g || 0);
      });
      return cost;
    }
    while (limit > 0 && p.spent + costFor(limit) > g.budget) limit--;
    return limit;
  }
  function charge(item, amount, produced) {
    var g = commerce.find(function (g) { return g.item === item; }); if (!g) return;
    var p = commercialProgress[g.id]; p.spent += Math.max(0, amount); p.count += Math.max(0, produced);
    write('craft:' + g.id + ':' + me, p);
  }
  function reserve(item, amount) {
    var g = commerce.find(function (g) { return g.item === item; }); if (!g) return;
    var p = commercialProgress[g.id];
    if (p.pending || p.spent + amount > g.budget) throw Error('Commercial objective budget / transaction hold');
    p.pending = true; p.reserved = amount; p.spent += amount; write('craft:' + g.id + ':' + me, p);
  }
  function settle(item, actualCost, produced) {
    var g = commerce.find(function (g) { return g.item === item; }); if (!g) return;
    var p = commercialProgress[g.id]; p.spent = Math.max(0, p.spent - (p.reserved || 0) + actualCost); p.count += produced; p.pending = false; p.reserved = 0; write('craft:' + g.id + ':' + me, p);
  }
  function tick() {
    if (typeof character === 'undefined') return;
    var at = Date.now(), dt = Math.max(0, Math.min(1000, at - lastTick)); lastTick = at;
    if (goals.length && typeof send_cm === 'function' && at - broadcastAt >= 10000) {
      broadcastAt = at;
      var peers = [];
      goals.forEach(function (g) { g.characters.forEach(function (name) { if (name !== me && peers.indexOf(name) < 0) peers.push(name); }); });
      peers.forEach(function (name) { try { Promise.resolve(send_cm(name, { type: 'alcc_loot_progress', profile: __ALCC.profile, goals: goals.filter(function (g) { return g.characters.indexOf(name) >= 0; }).map(function (g) { return { id: g.id, item: g.item, count: progress[g.id], startedAt: started[g.id] }; }) })).catch(function () {}); } catch (e) {} });
    }
    if (Object.keys(durations).length < 40 || reason in durations) durations[reason] = (durations[reason] || 0) + dt;
    var d = character.ctype === 'merchant' ? {} : settings.dangers || {}, es = entities(), attackers = Object.keys(es).map(function (key) { return es[key]; }).filter(function (e) { return e && e.type === 'monster' && e.target === me && !e.rip; });
    if (d.enabled && d.maxDeaths > 0 && character.rip && !risk.rip) risk.deaths += 1;
    if (risk.rip !== !!character.rip) { risk.rip = !!character.rip; write(riskKey, risk); }
    danger.deaths = risk.deaths; danger.deathLimit = d.maxDeaths || 0;
    var hp = 100 * character.hp / Math.max(1, character.max_hp), priest = (__ALCC.priests || []).map(function (name) { return es[name]; }).find(function (e) { return e && !e.rip && (!e.map || e.map === character.map) && distance(e) <= (d.healerRange || 200); });
    danger.attackers = attackers.length; danger.hpPercent = hp;
    var incoming = 0, healing = 0;
    observations = observations.filter(function (entry) { return at - entry.at <= 5000; });
    observations.forEach(function (e) { incoming += e.damage; healing += e.heal; });
    danger.incomingDps = incoming / 5; danger.healingDps = healing / 5;
    var cause = hp <= d.retreatHpPercent ? 'Low HP' : attackers.length > d.maxAttackers ? 'Too many attackers' : d.requirePriest && !priest && character.ctype !== 'priest' ? 'Priest unavailable or out of range' : hp < d.resumeHpPercent && incoming > healing && incoming > character.max_hp / 2 ? 'Damage exceeds healing' : '';
    if (danger.reason.indexOf('Team retreat: ') === 0) { danger.active = false; danger.reason = ''; }
    if (d.enabled && !character.rip && cause) { danger.active = true; danger.reason = cause; recoveryUntil = at + 3000; }
    else if (!d.enabled || (hp >= d.resumeHpPercent && !cause && at >= recoveryUntil)) { danger.active = false; danger.reason = ''; }
    if (d.enabled && d.maxDeaths > 0 && risk.deaths >= d.maxDeaths) { danger.active = true; danger.reason = 'Death budget reached (' + risk.deaths + '/' + d.maxDeaths + ')'; }
    // Broadcast local safety only; never echo a peer hold and create a feedback loop.
    var localActive = danger.active || !!character.rip, localReason = character.rip ? 'Dead' : danger.reason;
    if (d.enabled && d.coordinatedRetreat) {
      if (typeof send_cm === 'function' && at - riskBroadcastAt >= 5000) {
        riskBroadcastAt = at; riskSequence += 1;
        (__ALCC.farmers || []).filter(function (name) { return name !== me; }).forEach(function (name) { try { Promise.resolve(send_cm(name, { type: 'alcc_risk', profile: __ALCC.profile, run: d.runId || '', realm: riskRealm(), sequence: riskSequence, active: localActive, reason: String(localReason).slice(0, 180) })).catch(function () {}); } catch (e) {} });
      }
      var peer = Object.keys(riskPeers).find(function (name) { return riskPeers[name].active && at - riskPeers[name].at < 20000; });
      if (peer && !danger.active) { danger.active = true; danger.reason = 'Team retreat: ' + peer + ' — ' + riskPeers[peer].reason; }
    }
    danger.action = danger.active ? d.action || 'hold' : 'none';
    var shouldHold = paused() || danger.active;
    if (shouldHold && !holding && typeof stop === 'function') { try { stop('smart'); } catch (e) {} }
    holding = shouldHold;
    if (danger.active && d.action === 'town' && at - townAt >= 30000 && typeof town === 'function' && !character.rip) {
      townAt = at; try { if (typeof stop === 'function') stop('smart'); Promise.resolve(town()).catch(function (e) { record('town', 'Town failed: ' + String(e && (e.reason || e.message) || e).slice(0, 120)); }); } catch (e) { record('town', String(e)); }
    }
    var t = target(), observation = character.rip ? 'Dead' : paused() ? 'Loot objective complete' : danger.active ? 'Safety: ' + danger.reason : typeof is_disabled === 'function' && is_disabled(character) ? 'Disabled' : !t ? 'No target' : !selfDefence(t) && typeof TeamCoordinator !== 'undefined' && !TeamCoordinator.canEngage() ? 'Waiting for team readiness' : !selfDefence(t) && typeof recurring_boss_waiting_for_priest === 'function' && recurring_boss_waiting_for_priest(t) ? 'Waiting for priest' : distance(t) > (character.range || 0) + (t.size || 0) ? 'Target out of range' : character.mp < (character.mp_cost || 0) ? 'Insufficient attack mana' : typeof is_on_cooldown === 'function' && is_on_cooldown('attack') ? 'Attack / heal cooldown' : 'Ready to attack';
    setReason(at - lastActionAt < 1500 && (observation === 'Ready to attack' || observation === 'Attack / heal cooldown' && lastActionReason === 'Healing priority') ? lastActionReason : observation);
  }
  function allowLoop(name) {
    tick();
    if (name === 'movementLoop' || name === 'huntLoop') return !paused() && !danger.active;
    return true; // Attack gates below retain self-defence and healing during holds.
  }
  function allowTarget(t) { return !(paused() || danger.active) || selfDefence(t); }
  function install() {
    if (lootSupported) character.on('loot', onLoot);
    if (lootSupported) character.on('cm', function (data) {
      var message = data && data.message;
      if (message && message.type === 'alcc_risk') {
        var safety = settings.dangers || {};
        if (character.ctype === 'merchant' || !safety.enabled || !safety.coordinatedRetreat || (__ALCC.farmers || []).indexOf(data.name) < 0 || data.name === me || message.profile !== __ALCC.profile || message.run !== (safety.runId || '') || message.realm !== riskRealm() || typeof message.active !== 'boolean' || typeof message.reason !== 'string' || typeof message.sequence !== 'number' || !isFinite(message.sequence) || message.sequence < 1) return;
        riskPeers[data.name] = { active: message.active, reason: message.reason.slice(0, 180), at: Date.now() };
        return;
      }
      if (!message || message.type !== 'alcc_loot_progress' || message.profile !== __ALCC.profile || !Array.isArray(message.goals)) return;
      message.goals.slice(0, 30).forEach(function (row) {
        var g = goals.find(function (g) { return g.id === row.id && g.item === row.item && g.characters.indexOf(data.name) >= 0 && data.name !== me; });
        if (!g || typeof row.count !== 'number' || !isFinite(row.count) || row.count < 0 || row.count > 1000000000) return;
        var previous = read('loot:' + g.id + ':' + data.name);
        if (!previous || row.count >= (previous.count || 0)) write('loot:' + g.id + ':' + data.name, { item: g.item, count: row.count, startedAt: typeof row.startedAt === 'number' && row.startedAt > 0 && row.startedAt <= Date.now() ? row.startedAt : Date.now() });
      });
    });
    if (lootSupported) character.on('hit', function (data) { observations.push({ at: Date.now(), damage: data.id === me ? Math.max(0, Number(data.damage) || 0) : 0, heal: data.id === me ? Math.max(0, Number(data.heal) || 0) : 0 }); if (observations.length > 100) observations.shift(); });
    ['attack', 'use_skill', 'heal'].forEach(function (name) {
      var original = globalThis[name]; if (typeof original !== 'function') return;
      globalThis[name] = function () {
        var args = arguments, skill = name === 'use_skill' ? String(args[0]) : name, t = name === 'use_skill' ? args[1] : args[0];
        var offensive = name === 'attack' || ['3shot', '5shot', 'supershot', 'huntersmark', 'poisonarrow', 'curse', 'cleave', 'stomp', 'agitate', 'cburst', 'burst', 'taunt', 'fanofknives', 'mentalburst'].indexOf(skill) >= 0;
        if (offensive && (paused() || danger.active)) {
          var targets = (Array.isArray(t) ? t : [t]).map(function (entity) { return entity && typeof entity === 'object' ? entity : entities()[entity]; });
          if (!targets.length || targets.some(function (entity) { return !selfDefence(entity); })) return Promise.reject({ reason: 'Command Center safety / objective hold' });
        }
        try { return Promise.resolve(original.apply(this, args)).then(function (value) { record(skill, value && value.failed ? value.reason || 'failed' : 'success'); return value; }, function (error) { record(skill, error && (error.reason || error.message) || String(error)); throw error; }); }
        catch (error) { record(skill, error && (error.reason || error.message) || String(error)); throw error; }
      };
    });
    var can = globalThis.can_attack;
    if (typeof can === 'function') globalThis.can_attack = function (t) { return allowTarget(t) && can.apply(this, arguments); };
    ['smart_move', 'move'].forEach(function (name) {
      var original = globalThis[name]; if (typeof original !== 'function' || character.ctype === 'merchant') return;
      globalThis[name] = function () {
        if (paused() || danger.active) return Promise.resolve({ failed: true, reason: 'Command Center movement hold' });
        return original.apply(this, arguments);
      };
    });
    setInterval(tick, 250);
  }
  return { install: install, tick: tick, allowLoop: allowLoop, allowTarget: allowTarget, onLoot: onLoot, charge: charge, reserve: reserve, settle: settle, commercialAllowed: commercialAllowed, commercialBatchLimit: commercialBatchLimit, skillBlocked: function (skill) { if (lastActionReason !== 'Skill disabled by loadout: ' + skill || Date.now() - lastActionAt > 1000) record(skill, 'Skill disabled by loadout: ' + skill); }, snapshot: function () { tick(); return { combatGear: typeof CombatGear !== 'undefined' ? CombatGear.snapshot() : undefined, diagnostic: { reason: reason, since: since, updatedAt: Date.now(), target: String(target() && target().id || ''), source: Date.now() - lastActionAt < 1500 && reason === lastActionReason ? 'action' : 'observed', durations: durations, actions: actions }, danger: danger, goals: goalRows(), commerce: commerceRows() }; } };
})();
