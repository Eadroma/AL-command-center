/** Shared source, embedded by tools/embed-combat.cjs into standalone CODE slots. */
/** Projectile, pack-density, and time-to-death ideas adapted from earthiverse/adventureland-bots (MIT). */
var ALCombat = (function () {
	var state = null, lastMove = 0, lastPoint = null, backgroundBusy = false;
	var cache = { at: 0, map: "", instance: null, all: [], monsters: [], players: [], byId: {} };
	var diagnostics = { active: false, candidates: [], threats: [], selected: null };
	var metrics = { kiteMoves: 0, decisions: 0, rejected: 0, lastMoveAt: 0 };
	var healthHistory = {};
	var performance = {};
	try { performance = get("al_target_performance") || {}; } catch (e) {}
	var combatPhase = "idle";
	function setPhase(phase) { combatPhase = phase || "idle"; }
	function phase() { return combatPhase; }
	function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
	function hitboxDistance(a, b) {
		if (!a || !b || (a.map && b.map && a.map !== b.map) || (a.in && b.in && a.in !== b.in)) return 99999999;
		var ax = a.real_x == null ? a.x : a.real_x, ay = a.real_y == null ? a.y : a.real_y;
		var bx = b.real_x == null ? b.x : b.real_x, by = b.real_y == null ? b.y : b.real_y;
		var al = ax - Number(a.width || 0) / 2, ar = ax + Number(a.width || 0) / 2, at = ay - Number(a.height || 0), ab = ay;
		var bl = bx - Number(b.width || 0) / 2, br = bx + Number(b.width || 0) / 2, bt = by - Number(b.height || 0), bb = by;
		return Math.hypot(Math.max(bl - ar, al - br, 0), Math.max(bt - ab, at - bb, 0));
	}
	function damageMultiplier(defense) {
		var d = Number(defense || 0), reduction = 0, bands = [[0,.001],[100,.001],[200,.00095],[300,.0009],[400,.00082],[500,.0007],[600,.0006],[700,.0005]];
		for (var i = 0; i < bands.length; i++) reduction += Math.max(0, Math.min(100, d - bands[i][0])) * bands[i][1];
		if (d > 800) reduction += (d - 800) * .0004;
		if (d < 0) reduction -= Math.min(50, -d) * .001;
		return Math.max(.05, Math.min(1.32, 1 - reduction));
	}
	function live(e) { return e && !e.rip && e.hp > 0 && (!e.map || e.map === character.map); }
	function snapshot(force) {
		var now = Date.now(), instance = character.in;
		if (!force && now - cache.at < 50 && cache.map === character.map && cache.instance === instance) return cache;
		var all = [], mobs = [], players = [], byId = {}, entities = (typeof parent !== "undefined" && parent.entities) || {};
		Object.keys(entities).forEach(function (id) { var e = entities[id]; if (!live(e)) return; all.push(e); byId[id] = e; if (e.type === "monster") mobs.push(e); else if (e.type === "character") players.push(e); });
		cache = { at: now, map: character.map, instance: instance, all: all, monsters: mobs, players: players, byId: byId };
		return cache;
	}
	function monsters() { return snapshot().monsters; }
	function ally(name) {
		return name === character.name || name === CONFIG.PRIEST || name === CONFIG.PARTNER || name === CONFIG.WARRIOR
			|| name === CONFIG.MAGE || (CONFIG.PARTY || []).indexOf(name) >= 0;
	}
	function inDanger() { return monsters().some(function (e) { return e.target && ally(e.target); }); }
	function enabled() { return CONFIG.KITE_ENABLED !== false; }
	function active() { return enabled() && state && Date.now() - state.at < 1500 && state.map === character.map && state.instance === character.in; }
	function release() { state = null; lastPoint = null; }
	function engage(target, tank) {
		if (!enabled() || !live(target)) { release(); return false; }
		if (!state || state.id !== target.id || state.map !== character.map || state.instance !== character.in) {
			state = { id: target.id, mtype: target.mtype, origin: { x: character.x, y: character.y }, engaged: true, startedAt: Date.now(), startHp: character.hp };
		}
		state.engaged = true;
		state.map = character.map; state.instance = character.in; state.at = Date.now(); state.tank = tank && tank.name;
		update();
		return true;
	}
	function range(e) { return e.range || (G.monsters[e.mtype] || {}).range || 32; }
	function observe(e) {
		var now = Date.now(), rows = healthHistory[e.id] || [];
		rows.push([now, e.hp]); while (rows.length > 40 || (rows[0] && now - rows[0][0] > 15000)) rows.shift();
		healthHistory[e.id] = rows; return rows;
	}
	function timeToDeath(e) {
		var rows = observe(e), first = rows[0], last = rows[rows.length - 1];
		if (!first || first === last || last[0] <= first[0] || last[1] >= first[1]) return Infinity;
		return Math.max(0, e.hp / ((first[1] - last[1]) / (last[0] - first[0])));
	}
	function pendingDeath(e) {
		if (e.s && e.s.burned && Number(e.s.burned.intensity || 0) * Math.max(1, Number(e.s.burned.ms || 0) / 1000) / 5 >= e.hp) return true;
		var projectiles = (typeof parent !== "undefined" && parent.projectiles) || {};
		var pending = 0; Object.keys(projectiles).forEach(function (id) { var p = projectiles[id]; if (p && (p.target === e.id || p.id === e.id)) pending += Number(p.damage || 0); });
		return pending > 0 && pending >= e.hp;
	}
	function splashEquipped() {
		var slots = character.slots || {}, a = (G.items && G.items[(slots.mainhand || {}).name]) || {}, b = (G.items && G.items[(slots.offhand || {}).name]) || {};
		return !!(a.blast || a.explosion || b.blast || b.explosion);
	}
	function scoreTarget(e, options) {
		options = options || {};
		if (!live(e) || e.type !== "monster" || (options.allowed && !options.allowed(e))) return -Infinity;
		var def = (G.monsters && G.monsters[e.mtype]) || {}, d = hitboxDistance(character, e), maxHp = Math.max(1, e.max_hp || e.hp || 1), value = 0;
		if (options.preferredType && e.mtype === options.preferredType) value += 900;
		if (options.current && e.id === options.current) value += 240;
		if (e.target === character.name) value += 260;
		else if (e.target && ally(e.target)) value += 190;
		else if (e.target && !def.cooperative) value -= 260;
		if (def.boss || def.rage || e.rage) value += 180;
		if (def.cooperative) value += 120;
		if (pendingDeath(e)) value -= 1200;
		if (e.s && e.s.cursed) value += 75;
		if (e.s && e.s.marked) value += 65;
		var learned = performance[e.mtype];
		if (learned && learned.kills) {
			var averageMs = learned.totalMs / learned.kills, averageLoss = learned.hpLoss / learned.kills;
			value += Math.min(180, 6000000 / Math.max(1000, averageMs));
			value -= Math.min(220, averageLoss * 260);
		}
		value += (1 - e.hp / maxHp) * 140;
		if (splashEquipped()) {
			var blastRadius = Math.max(16, Number(character.explosion || 180) / 3.6), outer = damageMultiplier(Number(e.armor || 0) - 2 * Number(character.apiercing || 0));
			value += outer * 70;
			value += monsters().filter(function (other) { return other.id !== e.id && hitboxDistance(other, e) <= blastRadius; }).reduce(function (sum, other) { return sum + 55 * outer * damageMultiplier(other.armor || 0); }, 0);
		}
		var party = snapshot().players.filter(function (p) { return ally(p.name) && p.name !== character.name; });
		if (!e.target && party.length) {
			var ours = d, closest = Math.min.apply(null, party.map(function (p) { return dist(p, e); }));
			if (closest + 15 < ours) value -= 90;
		}
		value -= d * (options.distanceWeight == null ? 0.55 : options.distanceWeight);
		return value;
	}
	function bestTarget(list, options) {
		var best = null, score = -Infinity;
		(list || monsters()).forEach(function (e) { var s = scoreTarget(e, options); if (s > score) { score = s; best = e; } });
		return best;
	}
	function segmentDistance(a, b, e) {
		var dx = b.x - a.x, dy = b.y - a.y, d = dx * dx + dy * dy;
		var t = d ? Math.max(0, Math.min(1, ((e.x - a.x) * dx + (e.y - a.y) * dy) / d)) : 0;
		return dist({ x: a.x + dx * t, y: a.y + dy * t }, e);
	}
	function cooldown() {
		var next = parent.next_skill && parent.next_skill.attack;
		return next ? Math.max(0, Number(next) - Date.now()) : (is_on_cooldown("attack") ? 250 : 0);
	}
	function point(target, tank, pack) {
		var melee = character.ctype === "warrior";
		var reach = Math.max(8, (character.range || 25) - 3);
		var hp = character.hp / character.max_hp;
		var cd = cooldown();
		var theirRange = range(target);
		// Long-range enemies cannot be outranged by small melee steps. Circle near
		// our reach instead of retreating hundreds of pixels and losing all DPS.
		var shortRange = theirRange < 100;
		var incoming = pack.filter(function (e) { return e.target === character.name; }).reduce(function (sum, e) { return sum + Number(e.attack || ((G.monsters[e.mtype] || {}).attack) || 0); }, 0);
		var panic = hp < (CONFIG.KITE_PANIC_RATIO || 0.45) || incoming > character.hp * 0.55;
		var retreat = melee && state.engaged && (cd > 120 || panic);
		var want = melee ? (retreat && shortRange ? theirRange + 28 : reach) : Math.max(16, reach - 12);
		var healer = melee ? get_player(CONFIG.PRIEST) : (character.ctype === "priest" ? tank : get_player(CONFIG.PRIEST));
		if (!live(healer)) healer = null;
		var healReach = healer ? Math.max(25, (character.ctype === "priest" ? character.range : healer.range || 160) - 18) : 0;
		var threats = pack.filter(function (e) {
			var def = G.monsters[e.mtype] || {};
			return e.id === target.id || !!e.target || !!e.rage || !!def.rage || !!def.aggro;
		});
		function bounds(p) {
			if (dist(p, state.origin) > (CONFIG.KITE_LEASH || 240)) return false;
			if (target.mtype === "stoneworm" && character.map === "spookytown") {
				if (p.x > 500 || p.y < 37 || p.y > 221) return false;
			}
			if (target.mtype === "booboo" && character.map === "spookytown" && p.x > 340) return false;
			if (healer && dist(p, healer) > Math.max(healReach, dist(character, healer)) + 1) return false;
			return true;
		}
		function score(p) {
			var value = -Math.abs(hitboxDistance(p, target) - want) * 2 - dist(character, p) * 0.08;
			for (var i = 0; i < threats.length; i++) {
				var e = threats[i], r = range(e);
				var pad = r + 12;
				// A melee entry deliberately crosses the selected target's attack edge.
				if (e.id === target.id && (melee || r >= reach)) pad = melee ? (retreat && shortRange ? r + 12 : 8) : Math.min(r + 12, reach - 12);
				var before = hitboxDistance(character, e);
				if (segmentDistance(character, p, e) < Math.min(before - 2, pad)) return -Infinity;
				var clearance = hitboxDistance(p, e) - pad;
				value += Math.min(0, clearance) * 6;
				/** Prefer routes with breathing room from secondary attack circles. */
				if (e.id !== target.id) value += Math.min(50, Math.max(0, clearance)) * 0.35;
				if (retreat && e.target === character.name) value += Math.min(30, dist(p, e) - before) * (panic ? 4 : 1);
			}
			if (healer) value -= Math.max(0, dist(p, healer) - healReach) * 4;
			for (var j = 0; j < snapshot().players.length; j++) { var friend = snapshot().players[j]; if (friend.name !== character.name && ally(friend.name) && dist(p, friend) < 18) value -= (18 - dist(p, friend)) * 9; }
			return value;
		}
		var best = null, bestScore = score(character) + 3, debugCandidates = [];
		var steps = [18, 36, 60];
		for (var s = 0; s < steps.length; s++) {
			for (var i = 0; i < 24; i++) {
				var angle = i * Math.PI / 12;
				var p = { x: character.x + Math.cos(angle) * steps[s], y: character.y + Math.sin(angle) * steps[s] };
				if (!bounds(p) || !can_move_to(p.x, p.y)) { metrics.rejected++; continue; }
				var value = score(p);
				debugCandidates.push({ x: Math.round(p.x), y: Math.round(p.y), score: isFinite(value) ? Math.round(value) : -99999 });
				if (value > bestScore) { bestScore = value; best = p; }
			}
		}
		metrics.decisions++;
		var eta = timeToDeath(target);
		diagnostics = { active: true, phase: combatPhase, at: Date.now(), map: character.map, origin: state.origin, leash: CONFIG.KITE_LEASH || 240,
			target: { id: target.id, mtype: target.mtype, x: target.x, y: target.y, range: range(target) },
			healer: healer && { name: healer.name, x: healer.x, y: healer.y, range: healReach },
			threats: threats.slice(0, 30).map(function (e) { return { id: e.id, mtype: e.mtype, x: e.x, y: e.y, range: range(e), target: e.target || "" }; }),
			candidates: debugCandidates.slice(0, 72), selected: best && { x: Math.round(best.x), y: Math.round(best.y), score: Math.round(bestScore) } };
		if (isFinite(eta)) diagnostics.target.etaMs = Math.round(eta);
		return best;
	}
	function update() {
		if (!active() || character.rip || (character.c && character.c.town) || (character.s && (character.s.stunned || character.s.frozen))) return;
		var target = get_entity(state.id);
		if (!live(target)) {
			if (state && state.mtype && target && (target.rip || target.hp <= 0)) {
				var row = performance[state.mtype] || { kills: 0, totalMs: 0, hpLoss: 0 };
				row.kills++; row.totalMs += Math.max(1, Date.now() - state.startedAt); row.hpLoss += Math.max(0, (state.startHp - character.hp) / Math.max(1, character.max_hp));
				performance[state.mtype] = row; try { set("al_target_performance", performance); } catch (e) {}
			}
			release(); return;
		}
		var tank = state.tank && get_player(state.tank);
		var p = point(target, tank, monsters());
		if (typeof smart !== "undefined" && smart.moving) stop_smart();
		if (!p) {
			// Cancel an old approach/retreat when its destination is no longer safe.
			if (character.moving && Date.now() - lastMove >= 150) {
				Promise.resolve(move(character.x, character.y)).catch(function () {});
				lastMove = Date.now(); lastPoint = null;
			}
			return;
		}
		if (Date.now() - lastMove < 150) return;
		if (character.moving && lastPoint && dist(lastPoint, p) < 12) return;
		lastMove = Date.now(); lastPoint = p;
		metrics.kiteMoves++; metrics.lastMoveAt = lastMove;
		Promise.resolve(move(p.x, p.y)).catch(function () {});
	}
	// Communication has its own guard; slow CMs never hold the combat tick.
	async function background(tasks) {
		if (backgroundBusy) return;
		backgroundBusy = true;
		try { for (var i = 0; i < tasks.length; i++) await tasks[i](); }
		catch (e) { /* Existing helpers report actionable errors. */ }
		finally { backgroundBusy = false; }
	}
	setInterval(function () { try { update(); } catch (e) { release(); game_log("combat movement: " + (e.message || e)); } }, 100);
	function debug() { if (!active()) diagnostics.active = false; return diagnostics; }
	return { engage: engage, active: active, release: release, inDanger: inDanger, background: background, point: point, update: update, setPhase: setPhase, phase: phase, performance: performance,
		snapshot: snapshot, scoreTarget: scoreTarget, bestTarget: bestTarget, timeToDeath: timeToDeath, pendingDeath: pendingDeath, hitboxDistance: hitboxDistance, debug: debug, metrics: metrics };
})();
