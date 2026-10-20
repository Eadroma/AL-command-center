/**
 * Shared movement watchdog for generated Command Center scripts.
 *
 * It observes real coordinate progress while the game reports an active move.
 * Recovery escalates across one stall episode: cancel the stale route, try a
 * short local step, then use town only when the character is in a safe map and
 * outside combat/events. Business loops remain responsible for choosing and
 * restarting the intended route.
 */
var MovementWatchdog = (function () {
	var STALL_MS = 15000;
	var ACTION_COOLDOWN_MS = 10000;
	var EPISODE_TTL_MS = 120000;
	var MIN_PROGRESS = 6;
	var NUDGE_DISTANCE = 36;
	var last_position = null;
	var last_progress_at = Date.now();
	var last_action_at = 0;
	var episode_at = 0;
	var busy = false;
	var history = [];
	var routeFailures = {}, blockedRoute = null, lastBlockedAt = 0;
	var last_trace_key = "";
	var status = {
		state: "idle",
		moving: false,
		lastProgressAt: last_progress_at,
		stalledForMs: 0,
		attempts: 0,
		recoveries: 0,
		lastAction: "",
		updatedAt: Date.now(),
		destination: null,
	};

	function now() { return Date.now(); }
	function current_position() {
		return { map: String(character.map || ""), x: Number(character.x) || 0, y: Number(character.y) || 0 };
	}
	function destination() {
		try {
			if (typeof smart !== "undefined" && smart && smart.moving) {
				return { map: String(smart.map || character.map || ""), x: Number(smart.x) || 0, y: Number(smart.y) || 0 };
			}
		} catch (e) {}
		return null;
	}
	function movement_expected() {
		try { return !!character.moving || !!(typeof smart !== "undefined" && smart && smart.moving); }
		catch (e) { return !!character.moving; }
	}
	function made_progress(position) {
		if (!last_position || last_position.map !== position.map) return true;
		return Math.hypot(position.x - last_position.x, position.y - last_position.y) >= MIN_PROGRESS;
	}
	function stop_route() {
		try { if (typeof stop === "function") stop(); } catch (e) {}
	}
	function event_active() {
		try { return typeof EventRouter !== "undefined" && EventRouter.activeMonster && !!EventRouter.activeMonster(); }
		catch (e) { return false; }
	}
	function is_instance_map(map) {
		if (/^(bank|bank_b|bank_u|bank_s|zone_)/.test(map)) return true;
		try { return !!(typeof G !== "undefined" && G.maps && G.maps[map] && G.maps[map].instance); }
		catch (e) { return false; }
	}
	function under_attack() {
		try {
			var entities = (typeof parent !== "undefined" && parent.entities) || {};
			for (var id in entities) {
				var entity = entities[id];
				if (entity && entity.type === "monster" && entity.target === character.name) return true;
			}
		} catch (e) {}
		return false;
	}
	function town_is_safe() {
		if (character.rip || character.target || under_attack() || event_active()) return false;
		if (is_instance_map(String(character.map || ""))) return false;
		try { if (typeof CaveDreams !== "undefined" && CaveDreams.inCave && CaveDreams.inCave()) return false; } catch (e) {}
		try { if (character.q && Object.keys(character.q).length) return false; } catch (e) {}
		return typeof town === "function";
	}
	function nudge() {
		var directions = [[1, 0], [0, 1], [-1, 0], [0, -1], [0.7, 0.7], [-0.7, 0.7], [-0.7, -0.7], [0.7, -0.7]];
		var start = status.attempts % directions.length;
		for (var offset = 0; offset < directions.length; offset++) {
			var direction = directions[(start + offset) % directions.length];
			var x = (Number(character.x) || 0) + direction[0] * NUDGE_DISTANCE;
			var y = (Number(character.y) || 0) + direction[1] * NUDGE_DISTANCE;
			try {
				if (typeof can_move_to === "function" && !can_move_to(x, y)) continue;
				if (typeof move === "function") { move(x, y); return true; }
			} catch (e) {}
		}
		return false;
	}
	function note(action, state) {
		status.lastAction = String(action || "").slice(0, 200);
		status.state = state;
		status.updatedAt = now();
		trace(state, action, current_position(), status.destination);
		try { if (typeof game_log === "function") game_log("movement watchdog: " + status.lastAction); } catch (e) {}
	}
	function trace(state, detail, position, destination) {
		var key = [state, position.map, Math.round(position.x / 25), Math.round(position.y / 25), destination && destination.map, destination && Math.round(destination.x / 25), destination && Math.round(destination.y / 25), detail || ""].join(":");
		if (key === last_trace_key) return;
		last_trace_key = key;
		history.push({ at: now(), state: String(state || "idle"), map: position.map, x: Math.round(position.x), y: Math.round(position.y), destination: destination, detail: String(detail || "").slice(0, 160) });
		if (history.length > 24) history.shift();
	}
	async function recover() {
		status.attempts++;
		episode_at = now();
		last_action_at = episode_at;
		if (status.attempts === 1) {
			stop_route();
			note("cancelled stale route", "recovering");
			return;
		}
		if (status.attempts === 2) {
			stop_route();
			var moved = nudge();
			note(moved ? "local nudge requested" : "local nudge unavailable", moved ? "recovering" : "blocked");
			return;
		}
		if (!town_is_safe()) {
			note("town recovery blocked by current context", "blocked");
			return;
		}
		stop_route();
		note("safe town recovery requested", "recovering");
		try {
			await town();
			status.recoveries++;
			note("safe town recovery completed", "monitoring");
		} catch (error) {
			note("town recovery failed: " + String((error && error.reason) || error || "unknown"), "blocked");
		}
	}
	/** Stop repeated failed path requests, without blocking different destinations. */
	function install_route_guard() {
		if (typeof smart_move !== 'function') return;
		var original_move = smart_move.__alcc_original || smart_move;
		smart_move = function(destination, callback) {
			var args = arguments, receiver = this, origin = current_position();
			var routeKey;
			try { routeKey = typeof destination === 'number' ? JSON.stringify([destination, callback]) : JSON.stringify(destination); } catch (e) { return original_move.apply(receiver, args); }
			var row = routeFailures[routeKey];
			if (row && (row.origin.map !== origin.map || Math.hypot(origin.x-row.origin.x,origin.y-row.origin.y)>=MIN_PROGRESS || now()-row.lastAt>120000 && !row.held)) { delete routeFailures[routeKey]; row = null; }
			if (row && row.held) {
				blockedRoute = routeKey; lastBlockedAt = now();
				if (typeof callback === 'function') callback(false, 'route_suspended');
				return Promise.reject({ reason: 'route_suspended', destination: destination });
			}
			if (blockedRoute !== routeKey) blockedRoute = null;
			var promise;
			try { promise = original_move.apply(receiver, args); } catch (e) { promise = Promise.reject(e); }
			return Promise.resolve(promise).then(function(result) {
				delete routeFailures[routeKey]; if (blockedRoute === routeKey) blockedRoute = null; return result;
			}, function(error) {
				var reason = String(error && (error.reason || error.message) || error || 'unknown');
				if (['invalid', 'failed', 'path_not_found'].indexOf(reason) < 0) throw error;
				var position = current_position();
				if (position.map !== origin.map || Math.hypot(position.x-origin.x,position.y-origin.y)>=MIN_PROGRESS) { delete routeFailures[routeKey]; throw error; }
				var failure = routeFailures[routeKey] || { origin: origin, count: 0, held: false };
				failure.count++; failure.lastAt = now(); routeFailures[routeKey] = failure;
				if (Object.keys(routeFailures).length > 30) delete routeFailures[Object.keys(routeFailures)[0]];
				if (failure.count >= 3) {
					failure.held = true; blockedRoute = routeKey; lastBlockedAt = now();
					note('Route suspended after three failures: ' + String(routeKey).slice(0,80) + ' — ' + reason.slice(0,60), 'blocked');
				}
				throw error;
			});
		};
		smart_move.__alcc_original = original_move;
	}
	async function tick() {
		if (busy || typeof character === "undefined") return false;
		busy = true;
		try {
			var at = now();
			var position = current_position();
			var moving = movement_expected();
			status.moving = moving;
			status.destination = destination();
			status.updatedAt = at;
			if (blockedRoute && routeFailures[blockedRoute] && now()-lastBlockedAt<10000) {
				var held = routeFailures[blockedRoute];
				if (held.origin.map === position.map && Math.hypot(position.x-held.origin.x,position.y-held.origin.y)<MIN_PROGRESS) { status.state = 'blocked'; return false; }
				delete routeFailures[blockedRoute]; blockedRoute = null;
			}
			trace(moving ? "moving" : "idle", "", position, status.destination);
			if (made_progress(position)) {
				last_position = position;
				last_progress_at = at;
				status.lastProgressAt = at;
				status.stalledForMs = 0;
				status.state = moving ? "monitoring" : "idle";
				if (episode_at && at - episode_at > EPISODE_TTL_MS) status.attempts = 0;
				return false;
			}
			last_position = position;
			if (!moving) {
				last_progress_at = at;
				status.lastProgressAt = at;
				status.stalledForMs = 0;
				status.state = "idle";
				if (episode_at && at - episode_at > EPISODE_TTL_MS) status.attempts = 0;
				return false;
			}
			status.stalledForMs = Math.max(0, at - last_progress_at);
			status.state = status.stalledForMs >= STALL_MS ? "stalled" : "monitoring";
			if (status.stalledForMs < STALL_MS || at - last_action_at < ACTION_COOLDOWN_MS) return false;
			await recover();
			last_progress_at = now();
			status.lastProgressAt = last_progress_at;
			status.stalledForMs = 0;
			return true;
		} finally { busy = false; }
	}
	function snapshot() {
		return {
			state: status.state,
			moving: status.moving,
			lastProgressAt: status.lastProgressAt,
			stalledForMs: status.stalledForMs,
			attempts: status.attempts,
			recoveries: status.recoveries,
			lastAction: status.lastAction,
			updatedAt: status.updatedAt,
			destination: status.destination,
			history: history.slice(),
		};
	}
	install_route_guard();
	setInterval(function () { tick().catch(function () {}); }, 1000);
	return { tick: tick, snapshot: snapshot, safeToTown: town_is_safe };
})();
