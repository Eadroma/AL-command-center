/**
 * Command Center event routing shared by every farming script.
 *
 * Adventure Land exposes two different kinds of live content through
 * server.status:
 *   - instanced events declared with G.events[id].join, entered with join(id);
 *   - world bosses, reached with the map/x/y carried by server.status.
 *
 * The dashboard allowlist and the per-character switch remain authoritative.
 */
var EventRouter = (function () {
	var FALLBACK_JOINABLE = ["abtesting", "goobrawl", "crabxx", "franky", "icegolem", "horseman", "graveyard"];
	var EVENT_MONSTERS = {
		goobrawl: ["goo", "rgoo", "bgoo"],
		crabxx: ["crabxx", "crabx"], // Giga Crab summons Huge Crabs during the fight
		franky: ["franky"],
		icegolem: ["icegolem"],
		horseman: ["horseman", "jackowalker"],
		graveyard: ["gargoyle", "ghoul", "zombie"],
		// Boss first (visible_objective order); 5 minions spawn at 75/50/25 % HP and are part of the fight (AOE targets).
		mrgreen: ["mrgreen", "greenjr"],
		mrpumpkin: ["mrpumpkin", "jr"]
	};
	var lastActionAt = 0;
	var lastActionId = "";
	var announced = "";
	var SESSION_KEY = "alcc_event_session_" + ((typeof character !== "undefined" && character.name) || "farmer");
	var END_GRACE_MS = 7000;
	var CHEST_GRACE_MS = 30000;
	var RECOVERY_GIVE_UP_MS = 90000;
	var activeEvent = null;
	var recoveryAttemptAt = 0;
	var searchKey = "";
	var searchIndex = 0;
	var travelPending = false;
	var rangerStepAt = 0;
	// Budget de morts par event : sans lui, chaque respawn renvoyait l'equipe a l'Ice Golem (~140 morts en 40 min).
	var DEATH_LIMIT = 2;
	var ABANDON_KEY = "alcc:events:v1:abandoned:" + ((typeof character !== "undefined" && character.name) || "farmer");
	var abandoned = {};
	try { abandoned = (typeof get === "function" && get(ABANDON_KEY)) || {}; } catch (e) {}
	var wasRip = !!(typeof character !== "undefined" && character.rip);

	function save_abandoned() {
		try { if (typeof set === "function") set(ABANDON_KEY, abandoned); } catch (e) {}
	}

	/** Compte les morts survenues pendant un event (session vue < 60 s) ; abandon a DEATH_LIMIT. */
	function watch_deaths() {
		var rip = !!(character && character.rip);
		var session = load_session();
		if (rip && !wasRip && session && Date.now() - Number(session.seenAt || 0) < 60000) {
			var row = abandoned[session.id] = abandoned[session.id] || { deaths: 0, skip: false };
			row.deaths++;
			if (row.deaths >= DEATH_LIMIT && !row.skip) {
				row.skip = true;
				if (typeof game_log === "function") game_log("Event abandonne apres " + row.deaths + " morts : " + session.id + " (repris au prochain event)", "#FF6B6B");
			}
			save_abandoned();
		}
		wasRip = rip;
	}
	if (typeof setInterval === "function") setInterval(watch_deaths, 500);

	/** L'abandon dure jusqu'a 2 min sans event live, pour ignorer un statut serveur qui clignote. */
	function skipped(id, live) {
		var row = abandoned[id];
		if (!row) return false;
		if (live) { delete row.offSince; return !!row.skip; }
		row.offSince = row.offSince || Date.now();
		if (Date.now() - row.offSince > 120000) { delete abandoned[id]; save_abandoned(); }
		return false;
	}

	function coordinate(value) {
		return value == null || value === "" ? NaN : Number(value);
	}

	/** Hidden bosses announce only a map. Search its entrances and spawn regions,
	 * rather than passing a non-existent permanent monster location to smart_move.
	 * Coordinates remain authoritative as soon as the server reveals them. */
	function search_destination(route) {
		var map = typeof G !== "undefined" && G.maps && G.maps[route.map];
		if (!map) return null;
		var key = route.id + ":" + route.map;
		if (searchKey !== key) { searchKey = key; searchIndex = 0; }
		if (character.map !== route.map) return { map: route.map };
		var points = [];
		function add(x, y) {
			if (isFinite(x) && isFinite(y)) points.push({ map: route.map, x: x, y: y });
		}
		(map.spawns || []).forEach(function (p) { add(p[0], p[1]); });
		(map.monsters || []).forEach(function (pack) {
			var boundaries = pack.boundaries || (pack.boundary ? [pack.boundary] : []);
			boundaries.forEach(function (b) {
				var offset = typeof b[0] === "string" ? 1 : 0;
				if (offset && b[0] !== route.map) return;
				add((b[offset] + b[offset + 2]) / 2, (b[offset + 1] + b[offset + 3]) / 2);
			});
		});
		if (!points.length) return null;
		return points[searchIndex++ % points.length];
	}

	function load_session() {
		if (activeEvent) return activeEvent;
		try {
			var saved = typeof get === "function" ? get(SESSION_KEY) : null;
			if (saved && saved.id) activeEvent = saved;
		} catch (e) {}
		return activeEvent;
	}

	function remember(route) {
		activeEvent = { id: route.id, kind: route.kind, seenAt: Date.now() };
		try { if (typeof set === "function") set(SESSION_KEY, activeEvent); } catch (e) {}
	}

	function clear_session() {
		activeEvent = null;
		try { if (typeof set === "function") set(SESSION_KEY, null); } catch (e) {}
	}

	/** Rescue characters already left at the Ice Golem arena before this router version loaded. */
	function stranded_event() {
		if (!enabled() || __ALCC.events.indexOf("icegolem") < 0 || !character || character.map !== "winterland") return null;
		var dx = Number(character.x) - 800, dy = Number(character.y) - 450;
		return dx * dx + dy * dy <= 450 * 450 ? { id: "icegolem", kind: "join", seenAt: Date.now() - END_GRACE_MS } : null;
	}

	function nearest_chest(range) {
		var best = null, best_d = range;
		try {
			for (var id in parent.chests) {
				var chest = parent.chests[id];
				if (!chest || (chest.map && chest.map !== character.map)) continue;
				var d = distance(character, chest);
				if (d < best_d) { best_d = d; best = chest; }
			}
		} catch (e) {}
		return best;
	}

	async function recover_finished_event() {
		// Entering Cave Dreams proves normal routing has resumed. A stale world-event
		// session must never call town() from a generated dungeon map.
		if ((character && character.cave) || String((character && character.map) || "").indexOf("zone_") === 0) {
			clear_session();
			return false;
		}
		var session = load_session() || stranded_event();
		if (!session) return false;
		activeEvent = session;
		var now = Date.now();
		// A boss chest spawns on the body and opens only within 400px: walk to any
		// chest left nearby before town, or the kill's loot (crypt key) is lost.
		var chest = now - Number(session.seenAt || now) < CHEST_GRACE_MS ? nearest_chest(900) : null;
		if (chest) {
			if (distance(character, chest) > 250 && !character.moving && typeof move === "function") move(chest.x, chest.y);
			return true;
		}
		if (now - Number(session.seenAt || now) < END_GRACE_MS) return true;
		if (now - recoveryAttemptAt < 12000) return true;
		recoveryAttemptAt = now;
		try {
			if (typeof stop === "function" && typeof smart !== "undefined" && smart.moving) stop();
			if (typeof town !== "function") return false;
			// town() can stay pending while mobs hit us; never let it freeze the movement loop.
			var townTimer;
			try {
				await Promise.race([town(), new Promise(function (_, reject) { townTimer = setTimeout(function () { reject({ reason: "town_timeout" }); }, 10000); })]);
			} finally { clearTimeout(townTimer); }
			if (typeof game_log === "function") game_log("Event termine: retour en ville apres " + session.id, "#7CFC9A");
			clear_session();
			announced = "";
			return true;
		} catch (e) {
			// Mobs on us interrupt the town channel forever (priest healing under 5 booboos after Mr Green):
			// after 90 s hand movement back to the follow logic instead of owning it indefinitely.
			if (Date.now() - Number(session.seenAt || 0) > RECOVERY_GIVE_UP_MS) {
				if (typeof game_log === "function") game_log("Event termine: town impossible, reprise du suivi apres " + session.id, "#FFD166");
				clear_session();
				announced = "";
				return false;
			}
			// Keep the session so a transient transport/cooldown failure is retried.
			return true;
		}
	}

	function enabled() {
		return typeof __ALCC !== "undefined" && __ALCC.eventsEnabled === true && Array.isArray(__ALCC.events);
	}

	function status_table() {
		try {
			if (typeof server !== "undefined" && server && server.status) return server.status;
		} catch (e) {}
		try {
			if (typeof parent !== "undefined" && parent && parent.S) return parent.S;
		} catch (e) {}
		return {};
	}

	function joinable(id) {
		try {
			if (typeof G !== "undefined" && G.events && G.events[id]) return G.events[id].join === true;
		} catch (e) {}
		return FALLBACK_JOINABLE.indexOf(id) >= 0;
	}

	function is_live(value, isJoinable) {
		if (!value) return false;
		if (value === true) return true;
		if (typeof value !== "object") return !!value;
		if (value.live === false || value.active === false || value.end === true) return false;
		if (value.live === true || value.active === true || value.state === true) return true;
		if (Number(value.hp) > 0) return true;
		// Goo Brawl and A/B Testing are announced as {end: <date>} without a
		// live flag. A future deadline is an active join window.
		var endAt = value.end instanceof Date ? value.end.getTime() : new Date(value.end || 0).getTime();
		if (isJoinable && isFinite(endAt) && endAt > Date.now()) return true;
		// Joinable events sometimes expose only their signup/session payload.
		if (isJoinable && (value.map || value.x != null || value.join || value.players || value.ms > 0)) return true;
		return false;
	}

	/** Halloween bosses take precedence; preserve configured order for the rest
	 * and never add an event absent from the character's allowlist. */
	function ordered_events() {
		if (!enabled()) return [];
		if (typeof EventExpedition !== "undefined" && EventExpedition.worker()) { var assigned = EventExpedition.combatEvent(); return assigned ? [assigned] : []; }
		var priority = ["mrgreen", "mrpumpkin"];
		return priority.filter(function (id) { return __ALCC.events.indexOf(id) >= 0; }).concat(
			__ALCC.events.filter(function (id) { return priority.indexOf(id) < 0; })
		);
	}

	function next() {
		if (!enabled()) return null;
		// Inside a Cave Dreams run join() and smart_move cannot leave; owning the
		// movement loop there only freezes the cave runner for the whole event.
		if (character && character.cave) return null;
		var statuses = status_table();
		var events = ordered_events();
		var waiting = null;
		for (var i = 0; i < events.length; i++) {
			var id = events[i];
			var canJoin = joinable(id);
			var value = statuses[id];
			var live = is_live(value, canJoin);
			if (skipped(id, live) || !live) continue;
			value = typeof value === "object" ? value : {};
			var candidate = {
				id: id,
				kind: canJoin ? "join" : "boss",
				map: value.map || value.in || "",
				target: value.target || "",
				x: coordinate(value.x),
				y: coordinate(value.y)
			};
			if (ranger_boss(candidate)) {
				var visible = visible_objective(candidate);
				var target = visible ? visible.target : candidate.target;
				// Prioritise actionable bosses. An idle high-priority boss must not
				// suppress attacks on a lower-priority boss already being tanked.
				if (!engaged_by_other(target, candidate) && !(visible && target === character.name)) {
					if (!waiting) waiting = candidate;
					continue;
				}
			}
			return candidate;
		}
		return waiting;
	}

	function active_monster() {
		var route = next();
		return route ? route.id : null;
	}

	function visible_objective(route) {
		if (typeof get_nearest_monster !== 'function') return null;
		var ids = EVENT_MONSTERS[route.id] || [route.id];
		for (var i = 0; i < ids.length; i++) {
			var monster = get_nearest_monster({ type: ids[i] });
			if (monster) return monster;
		}
		return null;
	}

	function accepts(entity) {
		var route = next();
		if (!route || !entity || entity.type !== "monster" || entity.dead || entity.rip || !entity.visible) return false;
		// Franky's mummies are not the objective, but those attacking the team must be killed.
		if (route.id === "franky") return entity.mtype === "franky" || own_team(entity.target);
		// Instanced event maps contain event enemies whose mtype may differ from the
		// event id (for example the coloured goos in Goo Brawl).
		if (route.kind === "join") {
			if (entity.mtype === route.id) return true;
			if (route.id === "abtesting" && String(entity.mtype || "").indexOf("target_") === 0) return true;
			var aliases = EVENT_MONSTERS[route.id] || [];
			if (aliases.indexOf(entity.mtype) >= 0) return true;
			// Map-wide acceptance only on instanced maps: on shared maps (crabxx on main,
			// icegolem on winterland) it made the team farm ordinary mobs such as poisio.
			if (route.id !== "goobrawl" && route.id !== "abtesting") return false;
			return !!route.map && character.map === route.map;
		}
		return entity.mtype === route.id || (EVENT_MONSTERS[route.id] || []).indexOf(entity.mtype) >= 0;
	}

	function visible_event_enemy() {
		try {
			var entities = typeof parent !== "undefined" && parent.entities || {};
			for (var id in entities) if (accepts(entities[id])) return true;
		} catch (e) {}
		return false;
	}

	function log_once(route, message, color) {
		var key = route.id + ":" + message;
		if (announced === key) return;
		announced = key;
		if (typeof game_log === "function") game_log(message, color || "#79c7ff");
	}

	// A boss targeting another player is evidence of engagement. Selecting the
	// boss in a player's UI alone is not enough. Recheck after every death/reset.
	function ranger_boss(route) {
		// Franky (2910 magic, 1.6/s) kills any of our three in seconds: every class waits for an outside tank.
		if (route && route.id === "franky") return true;
		if (route && route.id === 'graveyard') {
			var data = status_table().graveyard;
			return character.ctype === 'ranger' && !!(data && data.gargoyle);
		}
		return !!route && character.ctype === "ranger" && route.id !== "goobrawl" && route.id !== "abtesting";
	}

	function own_team(name) {
		if (!name) return false;
		if (name === character.name) return true;
		try { return typeof get_party === "function" && !!(get_party() || {})[name]; } catch (e) { return false; }
	}

	function engaged_by_other(target, route) {
		if (route && route.id === "franky" && own_team(target)) return false;
		// 2026-11-04 23:00: Franky (cooperative, rage 0) was killed by other players at 23:07 while ours waited for a
		// target that never showed up. For Franky, lost HP (visible or in the server status) means he is being fought.
		if (route && route.id === "franky" && franky_fought(route)) return true;
		return typeof target === "string" && !!target && target !== character.name;
	}

	function franky_fought(route) {
		var b = visible_objective(route);
		if (b && b.max_hp && b.hp < b.max_hp * 0.995) return true;
		var st = status_table().franky;
		return !!(st && typeof st === "object" && Number(st.max_hp) > 0 && Number(st.hp) < Number(st.max_hp) * 0.995);
	}

	/** User (2026-11-04): wait at most 20 min for someone else to engage Franky, then drop it for this event. */
	var FRANKY_WAIT_MS = 20 * 60 * 1000, frankyWaitSince = 0;
	function franky_wait_expired(route) {
		if (!route || route.id !== "franky") return false;
		if (!frankyWaitSince) frankyWaitSince = Date.now();
		if (Date.now() - frankyWaitSince < FRANKY_WAIT_MS) return false;
		abandoned.franky = abandoned.franky || { deaths: 0 };
		abandoned.franky.skip = true;
		save_abandoned();
		frankyWaitSince = 0;
		if (typeof game_log === "function") game_log("Event: personne n'engage franky apres 20 min, abandon", "#FF6B6B");
		return true;
	}

	function can_engage(entity) {
		var route = next();
		if (!ranger_boss(route)) return true;
		if (route.id === "franky") return accepts(entity) && (entity.mtype !== "franky" || engaged_by_other(entity.target, route));
		// Never initiate against an idle boss, but keep defending if its aggro
		// switches to this ranger after arrival. Movement handles the retreat.
		return accepts(entity) && (engaged_by_other(entity.target) || entity.target === character.name);
	}

	async function tick() {
		if (typeof WorldEventIntel !== "undefined" && WorldEventIntel.tick && WorldEventIntel.tick()) return true;
		var route = next();
		if (!route) {
			announced = "";
			return await recover_finished_event();
		}
		remember(route);
		if (ranger_boss(route)) {
			var boss = visible_objective(route);
			// Franky on one of us: walk straight away (speed 48, slower than all three) until an outside tank takes it.
			if (route.id === "franky" && boss && boss.target === character.name) {
				var fx = Number(character.x) - Number(boss.x), fy = Number(character.y) - Number(boss.y), fd = Math.hypot(fx, fy) || 1;
				var away = { x: character.x + fx / fd * 120, y: character.y + fy / fd * 120 };
				if (typeof can_move_to === "function" && can_move_to(away.x, away.y) && typeof move === "function") move(away.x, away.y);
				log_once(route, "Event: Franky me cible, repli", "#FF6B6B");
				return true;
			}
			// Visible state overrides the slower server announcement, including a
			// boss that has become idle or switched its aggro to this ranger.
			if (!engaged_by_other(boss ? boss.target : route.target, route) && !(boss && boss.target === character.name)) {
				if (franky_wait_expired(route)) return false;
				if (typeof stop === "function" && typeof smart !== "undefined" && smart.moving) stop();
				log_once(route, "Event: attente qu'un autre joueur engage " + route.id, "#FFD166");
				return true;
			}
			if (route.id === "franky") frankyWaitSince = 0;
			if (boss) {
				// Keep event ownership even when the boss is visible. Returning false
				// here sends the fixed-farm ranger back to the crab beach, and merely
				// seeing a boss does not mean it is within attack range.
				var range = Number(character.range) || 160;
				var dx = Number(character.x) - Number(boss.x);
				var dy = Number(character.y) - Number(boss.y);
				var separation = Math.hypot(dx, dy);
				if (!isFinite(separation)) return true;
				if (separation >= range * 0.7 && separation <= range * 0.9) {
					if (typeof stop === "function" && typeof smart !== "undefined" && smart.moving) stop();
					return true;
				}
				if (travelPending) return true;
				if (Date.now() - rangerStepAt < 1000) return true;
				// join() can spawn the ranger directly on the boss. Zero separation
				// needs an explicit direction rather than a division by zero.
				var unitX = separation > 0 ? dx / separation : 1;
				var unitY = separation > 0 ? dy / separation : 0;
				var approach = { map: character.map, x: boss.x + unitX * range * 0.8, y: boss.y + unitY * range * 0.8 };
				if (typeof can_move_to === "function" && !can_move_to(approach.x, approach.y)) {
					// The Ice Golem arena has walls: the radial point can be outside
					// walkable terrain. Pick a reachable angle, then a short escape
					// step, instead of repeatedly pathing to an impossible point.
					var reachable = null, bestScore = -Infinity;
					var startAngle = Math.atan2(unitY, unitX);
					for (var angleIndex = 0; angleIndex < 16; angleIndex++) {
						var angle = startAngle + angleIndex * Math.PI / 8;
						var candidates = [
							{ map: character.map, x: boss.x + Math.cos(angle) * range * 0.8, y: boss.y + Math.sin(angle) * range * 0.8 },
							{ map: character.map, x: character.x + Math.cos(angle) * 40, y: character.y + Math.sin(angle) * 40 }
						];
						for (var candidateIndex = 0; candidateIndex < candidates.length; candidateIndex++) {
							var candidate = candidates[candidateIndex];
							if (!can_move_to(candidate.x, candidate.y)) continue;
							var bossDistance = Math.hypot(candidate.x - boss.x, candidate.y - boss.y);
							var score = -Math.abs(bossDistance - range * 0.8);
							if (score > bestScore) { reachable = candidate; bestScore = score; }
						}
					}
					if (!reachable) { log_once(route, "Event: aucun repli marchable vers " + route.id, "#FFD166"); return true; }
					// Hold a reachable firing position when terrain prevents gaining
					// useful distance. Do not oscillate between equivalent escape steps.
					if (bestScore <= -Math.abs(separation - range * 0.8) + 10) return true;
					approach = reachable;
				}
				try {
					if (typeof can_move_to === "function" && can_move_to(approach.x, approach.y) && typeof move === "function") {
						if (typeof stop === "function" && typeof smart !== "undefined" && smart.moving) stop();
						move(approach.x, approach.y);
						rangerStepAt = Date.now();
					} else {
						if (lastActionId === route.id && Date.now() - lastActionAt < 5000) return true;
						lastActionId = route.id;
						lastActionAt = Date.now();
						travelPending = true;
						await smart_move(approach);
					}
				} catch (e) {} finally { travelPending = false; }
				return true;
			}
		}

		if (route.kind === "join") {
			if (visible_event_enemy()) return false;
			var now = Date.now();
			if (lastActionId === route.id && now - lastActionAt < 15000) return true;
			lastActionId = route.id;
			lastActionAt = now;
			if (typeof stop === "function" && typeof smart !== "undefined" && smart.moving) stop();
			try {
				if (typeof join !== "function") return false;
				await join(route.id);
				log_once(route, "Event: " + route.id + " rejoint", "#7CFC9A");
			} catch (e) {
				// The event may be between signup and teleport. The throttle prevents spam.
			}
			return true;
		}

		if (typeof get_nearest_monster === "function" && get_nearest_monster({ type: route.id })) return false;
		if (travelPending) return true;
		var hasCoordinates = route.map && isFinite(route.x) && isFinite(route.y);
		var far = !hasCoordinates || character.map !== route.map || distance(character, route) > 180;
		if (!far) return false;
		var stamp = Date.now();
		if (lastActionId === route.id && stamp - lastActionAt < 5000) return true;
		lastActionId = route.id;
		lastActionAt = stamp;
		var destination = hasCoordinates ? { map: route.map, x: route.x, y: route.y } : search_destination(route);
		if (!destination) {
			log_once(route, "Event: position indisponible pour " + route.id, "#FFD166");
			return true;
		}
		try {
			travelPending = true;
			if (typeof stop === "function" && typeof smart !== "undefined" && smart.moving) stop();
			log_once(route, "Event: trajet vers " + route.id, "#79c7ff");
			await smart_move(destination);
		} catch (e) {} finally { travelPending = false; }
		return true;
	}

	return { next: next, orderedEvents: ordered_events, activeMonster: active_monster, accepts: accepts, canEngage: can_engage, isLive: is_live, tick: tick };
})();
