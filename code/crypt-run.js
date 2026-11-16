/**
 * Crypt run — shared runner for the combat trio (warrior, priest, ranger)
 * ========================================================================
 * Loaded after farmer CODE, like cave-dreams.js. Always the full trio: the
 * merchant (crypt-supply.js) asks the three for "ready" and aborts if one
 * of them is busy. The warrior receives one cryptkey at the Cave door,
 * opens the instance and broadcasts its id; priest and ranger join with
 * enter("crypt", id).
 *
 * Inside, the team only attacks monsters that pass is_safe() (whitelist,
 * no healer attached, nothing dangerous nearby) and walks an ordered
 * waypoint loop computed offline from G.geometry.crypt (smart_move has no
 * graph for instance maps). Monsters in RUN are never fought: flee, and
 * leave the instance if one keeps chasing the party.
 */
var CryptRun = (function () {
	var KEY = "cryptkey";
	var DOOR = { map: "cave", x: -193, y: -1296 };
	var EXIT = { x: 0, y: 0 };            // crypt spawn 0 is the door back to cave spawn 2
	var ENTER_RANGE = 60;                 // server limit is 120 from cave spawn 2
	var GATHER_MS = 10 * 60 * 1000;
	var RUN_MS = 90 * 60 * 1000; // user: 90 min per run (was 60)
	var CHASE_MS = 20000;
	// A chase is answered by stepping out and coming back: the empty instance pauses and keeps its id.
	var RETREAT_MS = 60000, MAX_RETREATS = 3;
	// get/set share one browser localStorage across characters: one key per character.
	var STORE = "alcc:crypt:v1:farmer:" + character.name;
	/** Prior verdicts (design doc): vbat + healer; Lucinda (1092 magical/s, drops 100%) added after the first run. */
	// Farm compass plan (2026-11-02): Vampirelings + Lestat + Lucinda, the priest tanking in its crypt loadout.
	// Bill (wiped the trio) and Orlok (zapper0 traps: 1200 pure/s each, 300 px) stay in RUN.
	var SAFE = { vbat: 1, a3: 1, a7: 1 };
	/** Never fight these; keep this many pixels away. */
	// a2: ~3.1k phys/s outpaced Absorb tanking, and its anger picks anyone within 300 px: keep out of that radius.
	var RUN = { a1: 260, a2: 340, a4: 320, a6: 260, a8: 360, zapper0: 320 };
	/** Not whitelisted but fought back when they attack the party. */
	var KEEP = { a5: 200 };
	var HEALER = "a5", HEALER_REACH = 420, CROWD = 320;
	var VBATS = 7;
	// Run 6: Lestat wandered into the Bill fight. Order: Lucinda, Lestat, then Bill, then the Vampirelings.
	var BOSS_ORDER = ["a7", "a3"];
	// Bill (a2), option B: the free pillar of the Vampireling room (64x96 block, clear ring at 80-120 px).
	// Bill re-paths only when he stops moving, so whoever he chases runs laps around it while the other one
	// hits him; the priest heals from outside his 300 px anger. Needs a rogue as third member (Invisibility).
	// shortcut: one fixed pillar and one try per run, move into the profile once the fight is proven.
	var PILLAR = [1024, -536], ORBIT_R = 90, BILL_ROOM = 300, BILL_MAX_MS = 12 * 60 * 1000, BILL_PRIEST_GAP = 340, BILL_TRIES = 5; // user: 5 engaged fights per key (was 2)

	// Offline BFS on G.geometry.crypt (16 px grid, 8 px wall margin). ENTRY: spawn -> Vampirelings.
	var ENTRY = [[0,0],[-16,-400],[-32,-464],[-192,-496],[-192,-960],[-176,-1040],[-144,-1072],[-64,-1088],[736,-1088],[736,-720],[752,-640],[784,-624],[1136,-624],[1136,-560],[1152,-464],[1184,-384]];
	// LOOP: ordered round through every unique's spawn, starting and ending at the Vampirelings.
	var LOOP = [[1184,-384],[1104,-464],[1104,-640],[864,-624],[720,-624],[720,-1072],[592,-1088],[384,-1088],[384,-1360],[400,-1440],[432,-1472],[592,-1488],[1792,-1488],[1792,-1696],[1808,-1728],[1888,-1744],[2752,-1744],[2752,-1728],[2736,-1088],[2048,-1088],[2048,-880],[2080,-688],[2112,-672],[2752,-672],[2752,-656],[2736,-240],[2720,-208],[2672,-160],[2640,-144],[2240,-144],[2240,272],[2256,320],[2288,336],[2464,416],[2240,336],[2240,-80],[2256,-128],[2288,-144],[2736,-144],[2736,-592],[2720,-624],[2672,-656],[2640,-672],[2000,-672],[2000,-848],[1968,-880],[1440,-880],[1440,-560],[1424,-464],[1328,-448],[1184,-384]];

	// Offline visibility links between route nodes (clear segment, 14 px wall margin), in NODES order:
	// ENTRY then LOOP, duplicates removed. Rebuild: node tools/crypt-route-geo.js <data.js> geo.json, then tools/crypt-route-edges.js <data.js> geo.json.
	var VIS = [[1],[0,2],[1,3],[2,4],[3,5],[4,6],[5,7],[6,8,21,22],[7,9,19,20,21,22],[8,10,19,20],[9,11,19],[10,12,17,18,19],[11,13,16,17,18,19],[12,14,16,17],[13,15,16,17,64],[14,16,64,63],[15,17,12,13,14,64],[16,18,11,12,13,14,19],[17,19,11,12],[18,20,8,9,10,11,12,17],[19,21,8,9,22],[20,22,7,8],[21,23,7,8,20],[22,24],[23,25],[24,26],[25,27],[26,28],[27,29],[28,30],[29,31],[30,32,33],[31,33],[32,34,31],[33,35,36,58,59],[34,36,58,59,60,61],[35,37,34,58,59],[36,38,57,58],[37,39,40,53,54,55,56,57],[38,40,53,54,55,56,57],[39,41,38,42,53,54],[40,42,43,53],[41,43,40,53],[42,44,41,52,53],[43,45,49,50,51,52,53],[44,46,49,50],[45,47,48,49],[46,48,49],[47,49,46],[48,50,44,45,46,47],[49,51,44,45],[50,52,44],[51,53,43,44],[52,54,38,39,40,41,42,43,44],[53,55,38,39,40],[54,56,38,39,57],[55,57,38,39],[56,58,37,38,39,55],[57,59,34,35,36,37],[58,60,34,35,36],[59,61,35],[60,62,35],[61,63],[62,64,15],[63,15,14,16]];

	var run = load();
	var focus = "", last_skip = 0;
	var last_enter = 0, last_cm = 0, last_census = 0, last_log = "", chase_since = 0, last_fought = null, blocked_since = 0;
	var BLOCK_WAIT_MS = 5 * 60 * 1000, last_wrap = 0;
	var bill_hold_at = 0, bill_hold_off = 0, bill_why_at = 0, bill_seen_at = 0;
	/** Why a Bill fight does not start (run 21: an 8.5 min hold with no clue). Mirrors the checks in bill_ready. */
	function bill_why() {
		var bill = monsters().filter(function (m) { return m.mtype === "a2"; })[0];
		var kiter = get_player(role("RANGER", "ranger")), priest = get_player(role("PRIEST", "priest"));
		var pct = function (p) { return p ? Math.round(p.hp / p.max_hp * 100) + "%" : "absent"; };
		return [bill ? "Bill " + Math.round(distance(character, bill)) + " px" + (bill.target ? " on " + bill.target : "") : "Bill out of sight",
			"rogue " + pct(kiter), "priest " + pct(priest), "me " + pct(character), group_near(450) ? "grouped" : "spread"].join(", ");
	}

	function cfg() { return typeof CONFIG !== "undefined" ? CONFIG : {}; }
	function now() { return Date.now(); }
	function load() {
		try { var r = get(STORE); return r && r.runId ? r : null; } catch (e) { return null; }
	}
	function save() { try { set(STORE, run); } catch (e) {} }
	function note(msg) {
		if (msg === last_log) return;
		last_log = msg;
		try { game_log("crypt: " + msg); } catch (e) {}
		if (run) { run.last = String(msg).slice(0, 160); save(); }
	}
	/** The builder never injects a script's own role key (the warrior has no CONFIG.WARRIOR), like cave_roster. */
	function role(key, ctype) { var c = cfg(); return c[key] || (character.ctype === ctype ? character.name : ""); }
	function warrior() { return role("WARRIOR", "warrior"); }
	// The third seat is the ranger or a party rogue: neither script receives its own RANGER key.
	function roster() { return [warrior(), role("PRIEST", "priest"), role("RANGER", character.ctype === "rogue" ? "rogue" : "ranger")].filter(Boolean); }
	/** Members still in the run: one that left (died twice) is no longer waited for. */
	function allies() { return roster().filter(function (n) { return n !== character.name && !(run && run.left && run.left[n]); }); }
	function is_lead() { return character.name === warrior(); }
	function in_crypt() { return character.map === "crypt"; }
	function cm(names, data) { try { if (names.length) send_cm(names, data); } catch (e) {} }
	function d2(a, b) { var dx = a[0] - b[0], dy = a[1] - b[1]; return dx * dx + dy * dy; }
	function here() { return [character.real_x != null ? character.real_x : character.x, character.real_y != null ? character.real_y : character.y]; }

	// ---------------------------------------------------------------- targets

	function monsters() {
		var out = [];
		var ents = (typeof parent !== "undefined" && parent.entities) || {};
		for (var id in ents) {
			var e = ents[id];
			if (e && e.type === "monster" && !e.dead && !e.rip) out.push(e);
		}
		return out;
	}

	/** A safe target: whitelisted, not levelled, no healer attached, nothing dangerous or crowded nearby. */
	function is_safe(m, all, safe) {
		safe = safe || SAFE;
		if (!m || m.dead || !safe[m.mtype]) return false;
		// Run 26: two Vampirelings levelled up on our deaths (230k HP vs 156k) and the trio looped past them for good.
		// User (audit): Vampirelings of any level are pulled, never ignored; bosses stay level 1 only.
		if (m.mtype !== "vbat" && (m.level || 1) > 1) return false;
		for (var i = 0; i < all.length; i++) {
			var o = all[i];
			if (o === m || o.dead || o.mtype === "vbat") continue;
			var d = distance(m, o);
			if (RUN[o.mtype] && d < RUN[o.mtype] + 120) return false;
			if (o.mtype === HEALER && m.mtype !== HEALER && d < HEALER_REACH) return false;
			if (m.mtype !== "vbat" && d < CROWD) return false;
		}
		return true;
	}

	/** Healer first when it is itself safe, then the closest safe target. */
	function pick_target(all, safe) {
		var ok = all.filter(function (m) { return is_safe(m, all, safe); });
		for (var i = 0; i < ok.length; i++) if (ok[i].mtype === HEALER) return ok[i];
		// Boss order (user, run 6): Lucinda, then Lestat, then the rest by distance.
		var rank = function (m) { var r = BOSS_ORDER.indexOf(m.mtype); return r < 0 ? BOSS_ORDER.length : r; };
		ok.sort(function (a, b) { return rank(a) - rank(b) || distance(character, a) - distance(character, b); });
		return ok[0] || null;
	}

	function party_attackers(all) {
		var names = roster();
		return all.filter(function (m) { return m.target && names.indexOf(m.target) >= 0 && !RUN[m.mtype]; })
			.sort(function (a, b) { return distance(character, a) - distance(character, b); });
	}

	function runner_threat(all) {
		var best = null;
		all.forEach(function (m) {
			var r = RUN[m.mtype] || KEEP[m.mtype];
			if (!r || (KEEP[m.mtype] && roster().indexOf(m.target) >= 0)) return; // KEEP monsters on us are fought, not fled
			var d = distance(character, m);
			if (d < r && (!best || d < best.d)) best = { m: m, d: d };
		});
		return best && best.m;
	}

	function safe_list() {
		var list = cfg().CRYPT_SAFE;
		if (!Array.isArray(list) || !list.length) return SAFE;
		var out = {};
		list.forEach(function (k) { if (!RUN[k]) out[k] = 1; });
		return out;
	}

	// ---------------------------------------------------------------- graph

	var NODES = [], EDGES = [];
	(function build() {
		var index = {};
		function add(p) {
			var k = p[0] + "," + p[1];
			if (!(k in index)) { index[k] = NODES.length; NODES.push(p); EDGES.push([]); }
			return index[k];
		}
		[ENTRY, LOOP].forEach(function (line) {
			var prev = -1;
			line.forEach(function (p) {
				var i = add(p);
				if (prev >= 0 && prev !== i) { EDGES[prev].push(i); EDGES[i].push(prev); }
				prev = i;
			});
		});
		if (VIS.length === NODES.length) EDGES = VIS;
	})();

	/** Closest node; with `reachable`, the closest of the 12 nearest that passes it, or -1. */
	function nearest_node(p, reachable) {
		var order = NODES.map(function (n, i) { return i; }).sort(function (a, b) { return d2(NODES[a], p) - d2(NODES[b], p); });
		if (!reachable) return order[0];
		for (var i = 0; i < order.length && i < 12; i++) if (reachable(NODES[order[i]])) return order[i];
		return -1;
	}

	/** Bubbles to walk around: RUN monsters always, KEEP monsters unless they already fight us.
	 * Remembered 30 s after the last sighting: a monster at the edge of view flickers in and out
	 * of parent.entities, which flipped the route every second (Marceline at the north-east corner). */
	var DANGER_MEMORY_MS = 30000, remembered = {};
	function dangers() {
		var names = roster(), t = now(), out = [];
		monsters().forEach(function (m) {
			var r = RUN[m.mtype] || (KEEP[m.mtype] && names.indexOf(m.target) < 0 ? KEEP[m.mtype] : 0);
			if (r) remembered[m.id || (m.mtype + Math.round(m.x))] = { x: m.x, y: m.y, r: r, at: t, mtype: m.mtype };
			else delete remembered[m.id];
		});
		Object.keys(remembered).forEach(function (k) {
			if (t - remembered[k].at > DANGER_MEMORY_MS) delete remembered[k];
			else out.push(remembered[k]);
		});
		return out;
	}

	/** True when segment a-b stays outside every danger bubble. */
	function seg_clear(a, b, ds) {
		for (var i = 0; i < (ds || []).length; i++) {
			var d = ds[i], vx = b[0] - a[0], vy = b[1] - a[1], len = vx * vx + vy * vy;
			var t = len ? Math.max(0, Math.min(1, ((d.x - a[0]) * vx + (d.y - a[1]) * vy) / len)) : 0;
			var px = a[0] + t * vx - d.x, py = a[1] + t * vy - d.y;
			if (px * px + py * py < d.r * d.r) return false;
		}
		return true;
	}

	/** Node indices from a to b along the corridor graph (BFS), avoiding danger bubbles, or null. */
	function route(a, b, ds) {
		var prev = {}, queue = [a];
		prev[a] = -1;
		while (queue.length) {
			var c = queue.shift();
			if (c === b) break;
			EDGES[c].forEach(function (n) { if (!(n in prev) && seg_clear(NODES[c], NODES[n], ds)) { prev[n] = c; queue.push(n); } });
		}
		if (!(b in prev)) return null;
		var path = [];
		for (var cur = b; cur !== -1; cur = prev[cur]) path.unshift(cur);
		return path;
	}

	function can_go(p) { return typeof can_move_to !== "function" || can_move_to(p[0], p[1]); }

	/** Walk inside the instance around danger bubbles. False when no safe route exists. */
	function walk_xy(x, y, ignore) {
		// A bubble we already stand in must not block the way out of it.
		var me = here(), dest = [x, y], ds = dangers().filter(function (d) { return d.mtype !== ignore && d2(me, [d.x, d.y]) > d.r * d.r; });
		if (d2(me, dest) < 12 * 12) return true;
		var step = dest;
		if (!can_go(dest) || !seg_clear(me, dest, ds)) {
			var direct = function (n) { return can_go(n) && seg_clear(me, n, ds); };
			var start = nearest_node(me, direct);
			var path = start >= 0 ? route(start, nearest_node(dest), ds) : null;
			if (!path) return false;
			step = NODES[path[0]];
			for (var i = path.length - 1; i >= 0; i--) if (direct(NODES[path[i]])) { step = NODES[path[i]]; break; }
		}
		if (character.moving && character.going_x === step[0] && character.going_y === step[1]) return true;
		try { move(step[0], step[1]); } catch (e) {}
		return true;
	}

	/** Progress watch: true when the character has not moved 15 px for `ms` while heading to `key`.
	 * Movement, not distance to the goal: a detour around a danger first moves away from it. */
	var progress = { key: "", pos: null, at: 0 };
	function stalled(key, d, ms) {
		var me = here();
		if (progress.key !== key || !progress.pos || d2(me, progress.pos) > 15 * 15) progress = { key: key, pos: me, at: now() };
		return now() - progress.at > ms;
	}

	function flee(threat) {
		var me = here(), t = [threat.x, threat.y], best = null, bd = -1;
		NODES.forEach(function (n) {
			if (d2(n, me) > 600 * 600 || !can_go(n)) return;
			var d = d2(n, t);
			if (d > bd) { bd = d; best = n; }
		});
		if (best) try { move(best[0], best[1]); } catch (e) {}
	}

	// ---------------------------------------------------------------- run state

	function busy_reason() {
		if (character.rip) return "dead";
		if (typeof CaveDreams !== "undefined" && (CaveDreams.inCave() || (CaveDreams.reservingParty && CaveDreams.reservingParty()))) return "cave";
		var ex = typeof __ALCC !== "undefined" && __ALCC.eventExpedition;
		if (ex && ex.enabled && (character.ctype === "warrior" || character.ctype === "priest")) return "event expedition";
		if (run && run.phase !== "leaving") return "already in run " + run.runId;
		return "";
	}

	function finish(reason) {
		if (!run || run.phase === "leaving") return;
		if (is_lead()) cm(allies().concat([cfg().MERCHANT].filter(Boolean)), { t: "crypt", a: "done", runId: run.runId, reason: reason, kills: run.kills || {} });
		else cm([warrior()], { t: "crypt", a: "left", runId: run.runId, reason: reason });
		run.phase = "leaving";
		run.reason = reason;
		note("run over: " + reason);
		save();
	}

	function on_cm(name, data) {
		if (!data || data.t !== "crypt" || !data.runId) return;
		var c = cfg();
		if (name === c.MERCHANT) {
			if (data.a === "start" && roster().indexOf(character.name) >= 0) {
				var busy = busy_reason();
				cm([name], { t: "crypt", a: busy ? "busy" : "ready", runId: data.runId, reason: busy, hasKey: is_lead() && has_key() });
				if (!busy) {
					run = { runId: String(data.runId).slice(0, 40), phase: "gather", at: now(), rejoins: 0, kills: {}, wp: 0, rounds: 0, retreats: 0 };
					if (typeof data.id === "string" && data.id) { run.id = data.id.slice(0, 64); run.openedAt = now(); run.resumed = true; }
					save();
					note(run.id ? "resume of " + run.id + " requested by " + name : "start requested by " + name);
				}
			}
			if (data.a === "abort" && run && data.runId === run.runId) finish("abort");
		}
		if (is_lead() && run && data.runId === run.runId && data.a === "left" && roster().indexOf(name) >= 0) {
			// Without the priest nobody tanks: end the run. Without the ranger the duo carries on.
			if (name === role("PRIEST", "priest")) { finish("priest out"); return; }
			run.left = run.left || {};
			run.left[name] = true;
			save();
			note(name + " left the run: " + (data.reason || "?"));
		}
		if (is_lead() && run && data.runId === run.runId && data.a === "marc_end" && roster().indexOf(name) >= 0) {
			if (data.reason === "killed") count_kill("a6");
			marc_stop(String(data.reason || "?").slice(0, 40));
		}
		if (is_lead() && run && data.runId === run.runId && data.a === "stuck" && roster().indexOf(name) >= 0 && isFinite(data.x) && isFinite(data.y)) {
			run.fetch = { name: name, x: Number(data.x), y: Number(data.y), at: now() };
		}
		// Run 23: the lead lost sight of Bill while the rogue still fought him: allies report their own sightings.
		if (is_lead() && run && run.bill && data.runId === run.runId && data.a === "bill_seen" && roster().indexOf(name) >= 0) run.bill.seen = now();
		if (name === warrior() && run && data.runId === run.runId && !is_lead()) {
			if (data.a === "open" && typeof data.id === "string") { run.id = data.id.slice(0, 64); run.openedAt = now(); save(); }
			if (data.a === "done") { run.phase = "leaving"; run.reason = data.reason; save(); }
			if (data.a === "retreat") begin_retreat(Number(data.until) || now() + RETREAT_MS);
			// Bill fight on/off: refreshed every 3 s by the lead, expires on its own if the lead goes quiet.
			if (data.a === "bill") {
				if (data.on) { run.bill = run.bill || { at: now() }; run.billUntil = now() + 10000; }
				else { run.bill = null; run.billUntil = 0; }
				save();
			}
			if (data.a === "marc") {
				if (data.on) { run.marc = run.marc || { at: now() }; run.marcUntil = now() + 10000; }
				else { run.marc = null; run.marcUntil = 0; }
				save();
			}
			// Tank position by message: followers find it even when it is out of sight.
			if (data.a === "pos" && isFinite(data.x) && isFinite(data.y) && in_crypt()) last_lead = [Number(data.x), Number(data.y)];
		}
	}

	function has_key() {
		var items = character.items || [];
		for (var i = 0; i < items.length; i++) if (items[i] && items[i].name === KEY) return true;
		return false;
	}

	/** Every whitelisted monster is dead: 7 Vampirelings and each safe unique (Lestat, Lucinda) once.
	 *  Nothing else in the crypt is worth the risk, so the run stops instead of finishing the round. */
	function objective_done() {
		var kills = (run && run.kills) || {};
		if ((kills.vbat || 0) < VBATS) return false;
		return Object.keys(safe_list()).every(function (m) { return m === "vbat" || (kills[m] || 0) >= 1; });
	}

	function count_kill(mtype) {
		var m = String(mtype).slice(0, 20);
		run.kills = run.kills || {};
		run.kills[m] = (run.kills[m] || 0) + 1;
		run.progressAt = now();
		note("killed " + m + " (" + run.kills[m] + ")"); // the count also defeats the log de-duplication
		save();
		cm([cfg().MERCHANT].filter(Boolean), { t: "crypt", a: "kill", runId: run.runId, mtype: m });
	}

	/** kill_credit never arrived inside the instance (three runs): the lead counts a kill when a monster it saw
	 *  under 20% HP within 400 px disappears or dies. A gap between ticks (retreat, re-entry) forgets the watch list. */
	var dying = {}, last_watch = 0, counted = {};
	function watch_kills(all) {
		if (!is_lead()) return;
		if (now() - last_watch > 3000) dying = {};
		last_watch = now();
		var alive = {};
		all.forEach(function (m) {
			alive[m.id] = 1;
			// Run 17: Bill was counted dead at 02:22 and again at 02:23 (likely out of the lead's view while low): a counted monster seen again is uncounted.
			if (counted[m.id] && run.kills && run.kills[m.mtype] > 0) { run.kills[m.mtype]--; note("not dead: " + m.mtype + " back in sight"); save(); }
			delete counted[m.id];
			// Run 22: Bill (low) left the lead's view at ~380 px twice and was counted dead; he is only counted from 250 px.
			if (m.max_hp && m.hp < m.max_hp * 0.2 && distance(character, m) < (m.mtype === "a2" ? 250 : 400)) dying[m.id] = m.mtype;
			else if (m.mtype === "a2" && dying[m.id]) delete dying[m.id];
		});
		Object.keys(dying).forEach(function (id) {
			if (alive[id]) return;
			count_kill(dying[id]);
			counted[id] = 1;
			delete dying[id];
		});
	}

	// ---------------------------------------------------------------- outside

	async function enter_crypt(name) {
		if (now() - last_enter < 4000) return;
		last_enter = now();
		try { if (smart.moving) stop("smart"); } catch (e) {}
		try {
			await (name ? enter("crypt", name) : enter("crypt"));
			if (in_crypt()) {
				if (run.entered && !run.returning) run.rejoins = (run.rejoins || 0) + 1;
				run.entered = true;
				run.returning = false;
				run.outNoted = false;
				// Run 4: the tank went back in and walked deep while the priest was still in town, then Bill cut her off.
				// After every entry the lead holds at the door until the whole party is inside with it.
				run.regroupAt = now();
				save();
			}
		} catch (e) {
			var why = String((e && e.reason) || e);
			note("enter: " + why);
			// The instance is gone (server restart): nothing to come back to.
			if (name && /invalid/.test(why)) finish("instance gone");
		}
	}

	function begin_retreat(until) {
		if (!run || run.phase === "leaving") return;
		run.phase = "retreat";
		run.bill = null;
		run.retreatUntil = Math.min(until, now() + 5 * RETREAT_MS);
		run.retreats = (run.retreats || 0) + 1;
		save();
		note("retreat " + run.retreats + ", back in at " + new Date(run.retreatUntil).toLocaleTimeString());
	}

	/** Lead only: tell the party to step out, wait and come back to the same instance. */
	function order_retreat(reason) {
		// Run 42: "Bill on the priest" ended the fight, bill_stop ordered the recovery retreat and the caller its own:
		// two retreats in one second (2 of the 3 allowed). A retreat already under way is not ordered again.
		if (run.phase === "retreat" && now() < (run.retreatUntil || 0)) return;
		if ((run.retreats || 0) >= MAX_RETREATS) { finish(reason + " (" + MAX_RETREATS + " retreats)"); return; }
		var until = now() + RETREAT_MS;
		cm(allies().concat([cfg().MERCHANT].filter(Boolean)), { t: "crypt", a: "retreat", runId: run.runId, until: until, reason: reason });
		begin_retreat(until);
	}

	async function outside() {
		if ((run.deaths || 0) >= 2) { finish(is_lead() ? "wipe" : "died twice"); return true; }
		// Outside without a retreat order: log why (a death, or something that moved us out), then go back in.
		if (run.entered && !run.returning && !run.outNoted) {
			run.outNoted = true;
			note("outside the instance (deaths " + (run.deaths || 0) + ", hp " + character.hp + "/" + character.max_hp + ")");
		}
		if (character.map !== DOOR.map || distance(character, DOOR) > ENTER_RANGE) {
			if (!smart.moving) smart_move(DOOR).catch(function () {});
			set_message("Crypt: to door");
			return true;
		}
		if (run.id) { if (run.resumed && !run.entered) run.returning = true; await enter_crypt(run.id); return true; }
		if (!is_lead()) { set_message("Crypt: wait open"); return true; }
		if (!has_key()) {
			if (now() - last_cm > 10000) { last_cm = now(); cm([cfg().MERCHANT].filter(Boolean), { t: "crypt", a: "at_door", runId: run.runId }); }
			set_message("Crypt: wait key");
			return true;
		}
		note("open crypt (consumes one key)");
		await enter_crypt(null);
		if (in_crypt() && character.in) {
			run.id = character.in;
			run.openedAt = now();
			save();
			cm(allies().concat([cfg().MERCHANT].filter(Boolean)), { t: "crypt", a: "open", runId: run.runId, id: run.id, at: run.openedAt });
			note("instance " + run.id);
		}
		return true;
	}

	// ---------------------------------------------------------------- inside

	function lead_player() { return get_player(warrior()); }

	function party_ready() {
		var p = get_player(role("PRIEST", "priest"));
		// Run 21: the warrior pulled the Vampirelings right after the Bill fight, hurt and with the priest cut off, and died.
		if (character.hp < character.max_hp * 0.7) return false;
		// Run 26: the priest (the tank) died to the first Vampireling 40 s after Bill: she must be healed up first too.
		// Run 28: she died tanking Vampirelings with 394 MP left after the Bill fight: a pull needs 40% of her mana.
		return !!(p && !p.rip && distance(character, p) < 350 && p.mp >= Math.max(400, (p.max_mp || 0) * 0.4) && (!p.max_hp || p.hp >= p.max_hp * 0.7)) && group_near(450);
	}

	/** Both allies inside and within `r` (visible): the tank never runs ahead alone. */
	function group_near(r) {
		var me = character;
		// Same map and instance: right after entering, the old Cave entities still answered (run 6 "regrouped" at once).
		return allies().every(function (n) { var p = get_player(n); return p && !p.rip && (!p.map || p.map === me.map) && (!p.in || !me.in || p.in === me.in) && distance(me, p) < r; });
	}

	var last_pos_ping = 0;
	function ping_position() {
		if (now() - last_pos_ping < 3000) return;
		last_pos_ping = now();
		cm(allies(), { t: "crypt", a: "pos", runId: run.runId, x: Math.round(character.x), y: Math.round(character.y) });
	}

	function group_close() {
		var me = character;
		return allies().every(function (n) { var p = get_player(n); return p && !p.rip && distance(me, p) < 160; }); // above the ranger's 130 px follow distance, or the round deadlocks
	}

	function census(all) {
		if (!is_lead() || now() - last_census < 5000) return;
		var seen = {}, fresh = false;
		run.seen = run.seen || {};
		all.forEach(function (m) {
			if (m.mtype === "vbat" || m.mtype === "nerfedbat") return;
			if (!run.seen[m.mtype]) fresh = true;
			seen[m.mtype] = { x: Math.round(m.x), y: Math.round(m.y), hp: m.hp, max_hp: m.max_hp, safe: is_safe(m, all, safe_list()) };
			run.seen[m.mtype] = seen[m.mtype];
		});
		if (!fresh) return;
		last_census = now();
		save();
		cm([cfg().MERCHANT].filter(Boolean), { t: "crypt", a: "census", runId: run.runId, seen: seen });
	}

	async function fight(tgt) {
		try { change_target(tgt); } catch (e) {}
		var d = distance(character, tgt), ok = function (s) { return typeof can_use !== "function" || can_use(s); };
		if ((character.ctype === "warrior" || character.ctype === "ranger" || character.ctype === "rogue") && await wait_for_pull(tgt, d)) return true;
		if (character.ctype === "warrior") {
			// No taunt: the priest tanks with Absorb Sins.
			if (!is_in_range(tgt)) walk_xy(tgt.x, tgt.y);
		} else if (character.ctype === "ranger" || character.ctype === "rogue") {
			// Lestat/Bill splash their target's neighbours: shoot from max range, away from the tank and priest.
			// The party rogue (stars, 120 px) takes the ranger's place with the same spacing.
			var spot = ranger_spot(tgt);
			if (d > character.range - 10) walk_xy(tgt.x, tgt.y);
			else if (spot) walk_xy(spot[0], spot[1]);
			if (character.ctype === "ranger") {
				if (tgt.max_hp >= 100000 && character.mp >= 240 && ok("huntersmark")) try { await use_skill("huntersmark", tgt); } catch (e2) {}
				if (character.mp >= 400 && ok("supershot")) try { await use_skill("supershot", tgt); } catch (e3) {}
			}
		} else if (character.ctype === "priest") {
			// The priest tanks: pull every monster hitting the warrior or the ranger (Absorb Sins, 240 px).
			var victim = absorb_victim();
			if (victim && character.mp >= 200 && ok("absorb")) {
				if (distance(character, victim) > 220) walk_xy(victim.x, victim.y);
				else try { await use_skill("absorb", victim.name); } catch (e6) {}
			} else if (!tgt.target && !RUN[tgt.mtype]) {
				// The priest opens every fight: the others wait until she holds the target.
				if (d > character.range - 20) walk_xy(tgt.x, tgt.y);
				else try { await attack(tgt); } catch (e7) {}
			} else follow(100);
			// Run 36: Curse on every Vampireling (400 MP per 5 s) left her with 118 MP and she died: keep half for heals.
			if (d < character.range && character.mp >= Math.max(400, (character.max_mp || 0) * 0.5) && ok("curse")) try { await use_skill("curse", tgt); } catch (e4) {}
			return true; // heal shares the attack cooldown; healLoop owns it
		}
		if (typeof can_attack === "function" ? can_attack(tgt) : is_in_range(tgt)) try { await attack(tgt); } catch (e5) {}
		return true;
	}

	/** Warrior and rogue/ranger hold back until the priest has the target (Bill has his own mode). True while waiting.
	 *  Fallback: after 8 s on the same target without her pull (priest gone, absorb on cooldown) they fight. */
	var pull_wait = { id: "", at: 0 };
	async function wait_for_pull(tgt, d) {
		var priest = role("PRIEST", "priest"), p = get_player(priest);
		if (!p || p.rip || tgt.target === priest) return false;
		var id = tgt.id || tgt.mtype + Math.round(tgt.x);
		if (pull_wait.id !== id) pull_wait = { id: id, at: now() };
		if (now() - pull_wait.at > 8000) return false;
		// Keep out of the monster's reach while the priest pulls; stay on her side.
		if (d < 160) {
			var me = here(), len = d || 1, ux = (me[0] - tgt.x) / len, uy = (me[1] - tgt.y) / len;
			var back = [tgt.x + ux * 180, tgt.y + uy * 180];
			if (can_go(back)) try { move(back[0], back[1]); } catch (e) {}
			else walk_xy(p.x, p.y);
		}
		set_message("Crypt: wait for the priest's pull");
		return true;
	}

	/** Where the ranger should stand: on the ray from the target through itself at range-20, pushed 100 px sideways
	 *  off an ally closer than 80 px. Null when the current spot is already fine. */
	var ALLY_GAP = 80;
	function ranger_spot(tgt) {
		var me = here(), want = character.range - 20, d = Math.sqrt(d2(me, [tgt.x, tgt.y])) || 1;
		var crowded = allies().some(function (n) { var p = get_player(n); return p && !p.rip && d2(me, [p.x, p.y]) < ALLY_GAP * ALLY_GAP; });
		if (!crowded && d >= want - 40) return null;
		var ux = (me[0] - tgt.x) / d, uy = (me[1] - tgt.y) / d;
		var base = [tgt.x + ux * want, tgt.y + uy * want];
		// Run 4: the sideways push hit a corridor wall and walk_xy fell back to the junction the rogue already stood
		// on, stacked on the priest. Take the first candidate reachable in a straight line instead.
		var tries = crowded ? [[base[0] - uy * 100, base[1] + ux * 100], [base[0] + uy * 100, base[1] - ux * 100], base] : [base];
		tries.push([tgt.x + ux * (want - 30), tgt.y + uy * (want - 30)]);
		for (var i = 0; i < tries.length; i++) if (can_go(tries[i])) return tries[i];
		return null;
	}

	/** Ally (not the priest) that a crypt monster is targeting, so the priest can absorb it. */
	function absorb_victim() {
		var names = roster(), best = null;
		monsters().forEach(function (m) {
			if (!m.target || m.target === character.name || names.indexOf(m.target) < 0) return;
			if (RUN[m.mtype]) return; // never walk into Bill/Orlok to absorb: the retreat handles them
			var p = get_player(m.target);
			if (p && !p.rip && (!best || distance(character, p) < distance(character, best))) best = p;
		});
		return best;
	}

	/** Followers never walk ahead alone: a lost tank means its last seen spot, else hold position. */
	var last_lead = null;
	function follow(keep) {
		var lead = lead_player(), moving = true;
		if (lead && !lead.rip) last_lead = [lead.x, lead.y];
		else {
			if (last_lead && d2(here(), last_lead) > 40 * 40) moving = walk_xy(last_lead[0], last_lead[1]);
			set_message("Crypt: tank lost");
			report_cut_off(moving);
			return;
		}
		if (distance(character, lead) > keep) moving = walk_xy(lead.x, lead.y);
		report_cut_off(moving);
	}

	/** No safe route to the tank for 15 s (run 4: the priest behind Bill): ask the tank to come and fetch us. */
	var cut_since = 0, last_cut_cm = 0;
	function report_cut_off(moving) {
		if (moving) { cut_since = 0; return; }
		if (!cut_since) { cut_since = now(); return; }
		if (now() - cut_since < 15000 || now() - last_cut_cm < 10000) return;
		last_cut_cm = now();
		var me = here();
		note("cut off from the tank, asking to be fetched");
		cm([warrior()], { t: "crypt", a: "stuck", runId: run.runId, x: Math.round(me[0]), y: Math.round(me[1]) });
	}

	function next_wp() {
		run.wp = (run.wp || 0) + 1;
		if (run.wp >= LOOP.length) { run.wp = 0; run.rounds = (run.rounds || 0) + 1; }
		save();
	}

	/** Round starts at the Vampirelings (LOOP[0]); an unreachable or guarded waypoint is skipped. */
	/** A safe route to p exists (same test as walk_xy, without moving). */
	function reachable(p) {
		var me = here(), ds = dangers().filter(function (d) { return d2(me, [d.x, d.y]) > d.r * d.r; });
		if (can_go(p) && seg_clear(me, p, ds)) return true;
		var start = nearest_node(me, function (n) { return can_go(n) && seg_clear(me, n, ds); });
		return start >= 0 && !!route(start, nearest_node(p), ds);
	}

	function roam() {
		if (run.wp == null || run.wp >= LOOP.length) run.wp = 0;
		var me = here(), p = LOOP[run.wp], d = Math.sqrt(d2(p, me));
		if (d > 40) {
			var moving = walk_xy(p[0], p[1]);
			// Bill parks on the Vampirelings and blocks every route: the key is spent, so wait for him to roam off
			// (up to BLOCK_WAIT_MS of blocked time per run) instead of burning the whole round in a minute.
			if (moving) blocked_since = 0;
			else {
				// Run 19: Lucinda and Lestat dead, Bill parked by the Vampirelings: skipping his waypoints sent the trio
				// round the far side of the map (and past Marceline) for 15 min. Only Bill left in the way: hold at the
				// edge of his bubble, flagged as blocking for a minute already, so the Bill fight starts once he is in sight.
				// Not bill_pending(): the 20 min wait is for idling after the objective; Bill blocking the Vampirelings is fought.
				// Run 21: the hold lasted 8.5 min with no fight and no reason logged: log why every minute, give up after 3 min.
				// Run 23: from the waypoint nearest the pillar Bill was out of sight, so the loop bounced 5 <-> 13: Bill seen in
				// the last 2 min counts as in the way too.
				if (bosses_done() && bill_left() && now() > bill_hold_off && (now() - bill_seen_at < 120000 || dangers().some(function (dd) { return dd.mtype === "a2"; }))) {
					if (!blocked_since || now() - blocked_since < 60000) { if (!blocked_since) { note("Bill in the way, holding for the fight"); bill_hold_at = bill_why_at = now(); } blocked_since = now() - 61000; }
					if (now() - bill_hold_at > 3 * 60000) { note("Bill hold over after 3 min (" + bill_why() + "), going on"); bill_hold_off = now() + 2 * 60000; bill_hold_at = 0; }
					else {
						if (now() - bill_why_at > 60000) { bill_why_at = now(); note("Bill hold: " + bill_why()); }
						set_message("Crypt: Bill in the way");
						return;
					}
				}
				// Run 13: the lead waited 5 min on each blocked waypoint (20 min lost) while Lestat was reachable further
				// along the loop. Go on to the next waypoint that has a safe route; hold only when none has.
				for (var k = 1; k < LOOP.length; k++) {
					var j = (run.wp + k) % LOOP.length;
					if (!reachable(LOOP[j])) continue;
					// Going back along the loop twice in a minute is ping-pong across the map (run 13): hold instead.
					if (j < run.wp && now() - last_wrap < 60000) break;
					// Run 19: only Bill left, the loop ping-ponged between waypoints 5 and 20 without ever seeing him. Instead of
					// going back round, go to the reachable waypoint nearest the pillar: Bill comes in sight and the hold starts the fight.
					if (j < run.wp && bosses_done() && bill_left()) {
						var best = -1;
						for (var q = 0; q < LOOP.length; q++) if (q !== run.wp && (best < 0 || d2(LOOP[q], PILLAR) < d2(LOOP[best], PILLAR)) && reachable(LOOP[q])) best = q;
						if (best >= 0) j = best;
					}
					if (j < run.wp) last_wrap = now();
					note("route to waypoint " + run.wp + " blocked, going on to " + j); run.wp = j; save(); blocked_since = 0; return;
				}
				if (!blocked_since) { blocked_since = now(); note("route blocked, holding up to " + BLOCK_WAIT_MS / 60000 + " min"); }
				if (now() - blocked_since < BLOCK_WAIT_MS) { set_message("Crypt: route blocked, waiting"); return; }
			}
			// Throttled: a passing danger must not burn through the whole round in a second.
			if ((!moving || stalled("wp" + run.wp, d, 6000)) && now() - last_skip > 3000) { last_skip = now(); note("skip waypoint " + run.wp + (moving ? " (stalled)" : " (no safe route)")); next_wp(); }
			return;
		}
		if (!group_close()) { set_message("Crypt: regroup"); return; }
		next_wp();
	}

	async function exit_crypt() {
		var me = here(), d = Math.sqrt(d2(me, [EXIT.x, EXIT.y]));
		if (d > 40) {
			// A guarded corridor can make the walk out impossible: teleport to town instead of looping.
			if (stalled("exit", d, 15000) && typeof town === "function") { note("exit walk stalled, using town()"); progress.at = now(); try { await town(); } catch (e0) {} return; }
			walk_xy(EXIT.x, EXIT.y);
			return;
		}
		try { await transport("cave", 2); } catch (e) { note("exit: " + ((e && e.reason) || e)); }
	}

	// ---------------------------------------------------------------- Marceline after the objective
	// User (run 13): one attempt per key, once everything else is dead, so a failure costs nothing. The rogue alone
	// pulls her at 115 px, leads her to the Bill pillar and runs the ring, hitting only while she is 100-120 px away
	// (her Weakness aura is 100 px, 20 s of -30 speed; one hit ~7.6k kills him). The priest follows to Curse her from
	// 150-190 px: Marceline has no anger and her rage only takes someone within 35 px in front of her.
	var MARC_HOME = [2747, -1735], MARC_MS = 12 * 60 * 1000, last_marc_ping = 0, marc_low = false;
	function marc_on() { return !!(run && run.marc && (is_lead() || now() < (run.marcUntil || 0))); }
	function marc_ping(force) {
		if (!force && now() - last_marc_ping < 3000) return;
		last_marc_ping = now();
		cm(allies(), { t: "crypt", a: "marc", runId: run.runId, on: !!run.marc });
	}
	function marc_ready() {
		// Opt-in since run 15: her aura slows the rogue at the pull, the priest cannot keep up, her corner is a dead end.
		if (cfg().CRYPT_MARCELINE !== true || run.marcDone || ((run.kills || {}).a6 || 0) > 0) return false;
		var k = get_player(role("RANGER", "ranger")), kname = role("RANGER", "ranger");
		if (run.left && run.left[kname]) return false;
		return !(k && k.ctype && k.ctype !== "rogue");
	}
	function marc_stop(reason) {
		if (!run || !run.marc) return;
		run.marc = null; run.marcDone = true; save();
		note("Marceline attempt over: " + reason);
		if (is_lead()) marc_ping(true);
	}
	function marc_report(reason) { cm([warrior()], { t: "crypt", a: "marc_end", runId: run.runId, reason: reason }); }

	/** Step away from Marceline to `want` px: straight away first, else up to ~100° off that line (a wall), preferring
	 *  spots towards the pillar room (her corner is a dead end). Falls back to flee(). */
	function marc_step_out(m, want) {
		var me = here(), base = Math.atan2(me[1] - m.y, me[0] - m.x), best = null, score = Infinity;
		[0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8].forEach(function (da) {
			var a = base + da, p = [m.x + Math.cos(a) * want, m.y + Math.sin(a) * want];
			if (!can_go(p)) return;
			var sc = Math.abs(da) * 200 + Math.sqrt(d2(p, PILLAR)) * 0.2;
			if (sc < score) { score = sc; best = p; }
		});
		if (best) { try { move(best[0], best[1]); } catch (e) {} return true; }
		flee(m);
		return false;
	}

	// Rogue vs Marceline (user, runs 26-28: rogue + Curse + Snowflakes). Speeds: rogue 92 (62 weakened); Marceline 32
	// idle, 86 chasing, 66 cursed, 26 cursed and frozen. Her Weakness aura is 100 px, one hit (~8.9k) kills him, his
	// range is 120. Run 28: he never hit her (waited for a priest who was in Curse range but far from him), then stood
	// still while she roamed onto him and hit her in melee with Invisibility on cooldown. So, in this order:
	// 1 hidden: walk off to 150+ px, then come out; 2 last resort: vanish under 60 px; 3 weakened: keep 260+ px;
	// 4 never closer than 105 px (95 frozen), whatever her target, and never attack inside it; 5 pull from 112 px
	// only with the priest able to Curse her (within 250 px of her) or her already cursed; 6 engaged: hold ~115 px,
	// step out under 112 when she is on him, and hit whenever he is between the floor and 120 px.
	async function marc_rogue(m) {
		var me = character, ok = function (sk) { return typeof can_use !== "function" || can_use(sk); };
		var hidden = me.s && me.s.invis;
		if (!m) {
			if (marc_low) { marc_low = false; marc_report("killed"); return true; }
			walk_xy(MARC_HOME[0], MARC_HOME[1], "a6");
			set_message("Crypt: looking for Marceline");
			return true;
		}
		var d = distance(me, m), mine = m.target === me.name, frozen = !!(m.s && m.s.frozen), cursed = !!(m.s && m.s.cursed);
		// Like Bill (run 22): low and close, else she may just have walked out of view (audit, 2026-11-04).
		if (m.max_hp && m.hp < m.max_hp * 0.2 && d < 250) marc_low = true;
		else if (d >= 250) marc_low = false;
		var floor = frozen ? 95 : 105;
		var hit = async function () { if (d >= floor && d <= 120 && (typeof can_attack !== "function" || can_attack(m))) { try { change_target(m); } catch (e2) {} try { await attack(m); } catch (e3) {} } };
		if (hidden) {
			if (d < 150) { marc_step_out(m, 210); set_message("Crypt: Marceline, hidden, walking off"); return true; }
			try { stop("invis"); } catch (e1) {}
		}
		if (d < 60 && !frozen && ok("invis")) { try { await use_skill("invis"); invis_at = now(); } catch (e) {} note("vanished from a6"); return true; }
		if (me.s && me.s.weakness && !frozen) {
			if (d < 260) marc_step_out(m, 280);
			set_message("Crypt: Marceline, keeping off (weakened)");
			return true;
		}
		if (d < floor) { marc_step_out(m, 135); set_message("Crypt: Marceline too close, stepping out"); return true; }
		if (!m.target) {
			var pr = get_player(role("PRIEST", "priest"));
			if (!cursed && (!pr || pr.rip || distance(pr, m) > 250)) {
				if (d < 160) marc_step_out(m, 180);
				set_message("Crypt: Marceline, waiting for the priest's Curse");
				return true;
			}
			if (d > 120) { var p = toward_bill(m, 112); if (can_go(p)) { try { move(p[0], p[1]); } catch (e7) {} } else walk_xy(p[0], p[1], "a6"); }
			else await hit();
			set_message("Crypt: Marceline pull");
			return true;
		}
		if (mine && !frozen && d < 112) marc_step_out(m, 135);
		else if (d > 120) { var q = toward_bill(m, 114); if (can_go(q)) { try { move(q[0], q[1]); } catch (e4) {} } else walk_xy(q[0], q[1], "a6"); }
		await hit();
		set_message(mine ? "Crypt: Marceline kite" : "Crypt: Marceline on " + m.target + ", hitting");
		return true;
	}

	// Warrior Hard Shell rotation on Marceline (user, run 32). Her hits are all physical: Hard Shell (8 s, 16 s cooldown)
	// blocks them, but she weakens whoever stands in her 100 px aura (86 -> 56 speed), so the warrior cannot outrun a
	// cursed Marceline (66) once the shell ends. Scare (jacko orb, 5 s cooldown, server: every monster targeting you
	// drops its pursuit) ends it instead: she has no target, and the rogue's next hit (1.6/s) makes her his (a hit only
	// retargets a monster with no target). The rogue then kites her (92 vs 66) until Hard Shell is back, and Taunt
	// (200 px, steals from friendly targets) takes her again. Taunt at once whatever the shell when she is on the priest.
	async function marc_warrior(m) {
		marc_ping();
		if (now() - run.marc.at > MARC_MS) { marc_stop("12 min"); return true; }
		var me = character, ok = function (sk) { return typeof can_use !== "function" || can_use(sk); };
		var shell = me.s && me.s.hardshell, rogue = get_player(role("RANGER", "ranger"));
		if (!m) {
			var rp = rogue, pp = !rogue && typeof get_party === "function" ? (get_party() || {})[role("RANGER", "ranger")] : null;
			if (!rp && pp && pp.map === me.map && pp.x != null) rp = pp;
			if (rp && !rp.rip) { if (distance(me, rp) > 200) walk_xy(rp.x, rp.y, "a6"); }
			else walk_xy(MARC_HOME[0], MARC_HOME[1], "a6");
			set_message("Crypt: Marceline, following the rogue");
			return true;
		}
		var d = distance(me, m), mine = m.target === me.name, left = shell ? (shell.ms != null ? shell.ms : 8000) : 0;
		if (mine) {
			if (!shell && d < 150 && ok("hardshell")) { try { await use_skill("hardshell"); } catch (e1) {} shell = true; left = 8000; }
			if (shell) {
				if (left < 1200 && ok("scare")) { try { await use_skill("scare"); } catch (e2) {} note("Marceline: Hard Shell ending, Scare (back to the rogue)"); return true; }
				if (typeof can_attack === "function" ? can_attack(m) : is_in_range(m)) { try { change_target(m); } catch (e3) {} try { await attack(m); } catch (e4) {} }
				set_message("Crypt: Marceline on me, Hard Shell, hit");
				return true;
			}
			// No shell and she is on us: drop her now, then get clear (Charge: +30 speed, beats the Weakness).
			if (ok("scare")) { try { await use_skill("scare"); } catch (e5) {} note("Marceline on me without Hard Shell, Scare"); }
			if (ok("charge")) try { await use_skill("charge"); } catch (e6) {}
			marc_step_out(m, 220);
			set_message("Crypt: Marceline on me, no Hard Shell, out");
			return true;
		}
		var onPriest = m.target === role("PRIEST", "priest");
		var onAlly = !!m.target && roster().indexOf(m.target) >= 0;
		var pr = get_player(role("PRIEST", "priest"));
		// Opening pull with the priest in Curse range of her (she curses once Marceline has a target).
		var opening = !m.target && pr && !pr.rip && distance(pr, m) <= 250;
		var ready = ok("hardshell") && ok("taunt") && me.mp >= 600 && me.hp > me.max_hp * 0.7;
		if ((onPriest && ok("taunt")) || ((onAlly || opening) && ready)) {
			if (d > 190) { var tp = toward_bill(m, 180); if (can_go(tp)) { try { move(tp[0], tp[1]); } catch (e7) {} } else walk_xy(tp[0], tp[1], "a6"); }
			else try { await use_skill("taunt", m); } catch (e8) {}
			set_message(onPriest ? "Crypt: Marceline on the priest, taunt" : "Crypt: Marceline, Hard Shell ready, taunt");
			return true;
		}
		// Waiting for Hard Shell: out of her Weakness aura (100 px) and her 32 px aggro, in Taunt reach (200 px).
		if (d < 150) marc_step_out(m, 180);
		else if (d > 240) { var hp = toward_bill(m, 200); if (can_go(hp)) { try { move(hp[0], hp[1]); } catch (e9) {} } else walk_xy(hp[0], hp[1], "a6"); }
		set_message("Crypt: Marceline on " + (m.target || "nobody") + ", waiting for Hard Shell");
		return true;
	}

	async function marc_priest(m) {
		var me = character, ok = function (sk) { return typeof can_use !== "function" || can_use(sk); };
		var rogue = get_player(role("RANGER", "ranger"));
		if (!m) {
			// Run 26: the rogue out of sight left her standing at the entry for the whole attempt (never cursed).
			// Out of sight: walk to his party position, else to Marceline's corner.
			var rp = rogue, pp = !rogue && typeof get_party === "function" ? (get_party() || {})[role("RANGER", "ranger")] : null;
			if (!rp && pp && pp.map === me.map && pp.x != null) rp = pp;
			if (rp && !rp.rip) { if (distance(me, rp) > 250) walk_xy(rp.x, rp.y, "a6"); }
			else walk_xy(MARC_HOME[0], MARC_HOME[1], "a6");
			set_message("Crypt: Marceline, following the rogue");
			return true;
		}
		var d = distance(me, m);
		if (m.target === me.name) { flee(m); set_message("Crypt: Marceline on me"); return true; }
		if (d > 190) { var p = toward_bill(m, 175); walk_xy(p[0], p[1], "a6"); }
		// Run 28: a blocked straight step left the rogue standing while she roamed onto him; same for the priest.
		else if (d < 150) marc_step_out(m, 170);
		// Curse only once she is on someone else: a Curse on an idle Marceline could pull her onto the priest.
		var curse = m.s && m.s.cursed, ending = !curse || (curse.ms != null && curse.ms < 1500);
		if (m.target && ending && d <= 200 && character.mp >= 400 && ok("curse")) try { await use_skill("curse", m); } catch (e1) {}
		set_message(m.target ? "Crypt: Marceline, curse" : "Crypt: Marceline, in Curse range, waiting for the pull");
		return true;
	}

	// ---------------------------------------------------------------- Bill at the pillar

	var last_seen_ping = 0, last_bill_ping = 0, bill_dir = 1, invis_at = 0, priest_hunted_since = 0, bill_takeover = false;
	// Engaged fights this run (a start that never reached Bill does not count); the old flag counts as one.
	function bill_tries() { return run.billTries || 0; }
	// Where the trio waits for Bill once the rest is done: the Vampireling pack spot, ~220 px from the pillar.
	var BILL_WAIT = [1184, -384], BILL_WAIT_MS = 20 * 60 * 1000; // user: 20 min (was 10)
	/** Lucinda and Lestat (when on the safe list) are dead: Bill comes next. */
	function bosses_done() {
		var k = (run && run.kills) || {}, safe = safe_list();
		return BOSS_ORDER.every(function (m) { return !safe[m] || (k[m] || 0) > 0; });
	}
	/** Bill still to fight: a try left, not killed, and the 10 min wait for him not over. */
	function bill_pending() { return bill_left() && !(run.billWaitAt && now() - run.billWaitAt >= BILL_WAIT_MS); }
	/** Bill in sight within 600 px of the pillar: worth waiting for. Out of sight or farther: farm meanwhile (user, run 7). */
	function bill_near(all) {
		return (all || []).some(function (m) { return m.mtype === "a2" && d2([m.x, m.y], PILLAR) < 600 * 600; });
	}
	/** Safe targets for a new pull: the Vampirelings wait for Bill only while he is near the pillar. */
	function target_list(all) {
		var safe = safe_list();
		if (!bill_pending() || !bill_near(all)) return safe;
		var out = {};
		Object.keys(safe).forEach(function (k) { if (k !== "vbat") out[k] = 1; });
		return out;
	}
	/** A Bill fight is still worth waiting for: enabled, a try left, not killed, and the third member is a rogue. */
	function bill_left() {
		if (cfg().CRYPT_BILL === false || bill_tries() >= BILL_TRIES || ((run.kills || {}).a2 || 0) > 0) return false;
		// Run 20: the rogue left the run (died twice) and the duo would have waited 20 min for a fight it cannot start.
		if (run.left && run.left[role("RANGER", "ranger")]) return false;
		var k = get_player(role("RANGER", "ranger"));
		return !(k && k.ctype && k.ctype !== "rogue");
	}
	function bill_on() { return !!(run && run.bill && (is_lead() || now() < (run.billUntil || 0))); }
	function bill_ping(force) {
		if (!force && now() - last_bill_ping < 3000) return;
		last_bill_ping = now();
		cm(allies(), { t: "crypt", a: "bill", runId: run.runId, on: !!run.bill });
	}

	/** Lead only: Bill idle in the pillar room, a healthy rogue and priest with us, no other RUN monster around. */
	function bill_ready(all, bill) {
		// One real fight per run: a start that never reached Bill (run 4: "Bill lost" after 15 s) does not count.
		// Idle, or already on one of us (waiting by the pillar, his anger picks someone within 300 px).
		// Run 13: Bill idled on the only corridor east and Lestat was behind him: when Bill keeps the route blocked
		// (held or ping-ponging for a minute), fight him first; the rogue pulls him to the pillar.
		// Runs 19 and 23: fights started away from the pillar after Lucinda and Lestat both wiped the trio. The route
		// exception is only for reaching the bosses (run 13); after them Bill is fought only by the pillar.
		var blocking = !bosses_done() && ((blocked_since && now() - blocked_since > 60000) || (last_wrap && now() - last_wrap < 60000));
		if (!bosses_done() && !blocking) return false;
		// Run 17: the tick Bill died his entity was still listed, so a second fight started on a dead Bill.
		if (!bill_left() || !bill || bill.dead || bill.hp <= 0 || (bill.target && roster().indexOf(bill.target) < 0)) return false;
		// Run 39: Bill engaged on the warrior in the west corridor with Lestat next to it; the "fight him wherever he is"
		// path skipped every check and Lestat killed the rogue. No fight at all with a live boss within 600 px of Bill.
		if (all.some(function (m) { return BOSS_ORDER.indexOf(m.mtype) >= 0 && distance(m, bill) < 600; })) return false;
		// Bill already on one of us (user, run 7): fight him wherever he is, the chased one runs to the pillar.
		var engaged = !!bill.target && roster().indexOf(bill.target) >= 0;
		// Run 24: the run 13 exception started a fight with Bill far from the pillar and the trio died; a blocking Bill is
		// only fought when he is near enough for the rogue to lead him to the pillar.
		var room = blocking ? 400 : BILL_ROOM;
		if (!engaged && d2([bill.x, bill.y], PILLAR) > room * room) return false;
		// Run 4: Bill was seen idle at the pillar from Lucinda's corridor (850 px away) and the one try was spent.
		if (!engaged && !blocking && d2(here(), PILLAR) > 400 * 400) return false;
		var kiter = get_player(role("RANGER", "ranger")), priest = get_player(role("PRIEST", "priest"));
		if (kiter && kiter.ctype && kiter.ctype !== "rogue") return false;
		// Run 7: Bill on the rogue already drains his HP, so HP and grouping checks made us retreat (and he died).
		// Run 19: Bill on the warrior while the rogue was still outside after a death: the fight started, the warrior
		// took over and died. No rogue in sight, no fight (the flee logic handles a Bill on us).
		if (engaged) return !!kiter && !kiter.rip;
		if (!kiter || kiter.rip || kiter.hp < kiter.max_hp * 0.8) return false;
		if (!priest || priest.rip || character.hp < character.max_hp * 0.8) return false;
		if (!group_near(450)) return false;
		// Run 35: the "Bill blocks the way" fight started with Lucinda at the pillar; the rogue's ring ran into her, she
		// chased him into the Vampireling pack and he died. A live boss near the pillar rules the fight out too.
		return !all.some(function (m) { return ((RUN[m.mtype] && m.mtype !== "a2") || BOSS_ORDER.indexOf(m.mtype) >= 0) && d2([m.x, m.y], PILLAR) < (RUN[m.mtype] ? 600 * 600 : 450 * 450); });
	}

	function bill_stop(reason) {
		run.bill = null;
		save();
		note("Bill fight over: " + reason);
		bill_ping(true);
		// Runs 28-29: the Vampirelings (Bill's pillar is in their room) jumped the trio right after the fight and the
		// priest died with 214-394 MP: under 40% HP her potion loop drinks HP pots only (shared 2 s cooldown). Step out
		// 60 s to refill (250 MP/s from pots) before anything else.
		var p = is_lead() && run.phase !== "retreat" ? get_player(role("PRIEST", "priest")) : null;
		if (p && !p.rip && ((p.max_hp && p.hp < p.max_hp * 0.7) || (p.max_mp && p.mp < p.max_mp * 0.5))) order_retreat("recover after Bill");
	}

	/** Next point on the ring around the pillar, running away from Bill; the direction flips only once he is
	 *  clearly ahead (hysteresis), or the runner would stop dead in front of him. */
	function orbit_point(bill) {
		var me = here(), tm = Math.atan2(me[1] - PILLAR[1], me[0] - PILLAR[0]), tb = Math.atan2(bill.y - PILLAR[1], bill.x - PILLAR[0]);
		if (Math.sin(tm - tb) * bill_dir < -0.3) bill_dir = -bill_dir;
		var a = tm + bill_dir * 0.6, radii = [ORBIT_R, ORBIT_R + 20, ORBIT_R - 10];
		for (var i = 0; i < radii.length; i++) {
			var p = [PILLAR[0] + radii[i] * Math.cos(a), PILLAR[1] + radii[i] * Math.sin(a)];
			if (can_go(p)) return p;
		}
		return null;
	}

	/** The point "want" px from Bill on the line towards me. Runs 8-9: walking to Bill's own position put the rogue
	 *  inside his 35 px reach and two hits killed him; the rogue never comes closer than this. */
	/** When the rogue vanishes from a RUN monster m at distance d, one rule for every fight (audit, 2026-11-04).
	 *  User (run 26): far too often, which spent Invisibility before it mattered. A frozen monster crawls; at full HP
	 *  one hit (~1.8k of 3.5k) is survivable, so vanish late, earlier only when hurt. Marceline (8.9k hits, Weakness
	 *  aura 100 px): under 60 px unless frozen, a last resort (marc_rogue keeps him 105+ px away). */
	function vanish_now(m, d) {
		var frozen = !!(m.s && m.s.frozen), hpf = character.hp / (character.max_hp || 1);
		if (m.mtype === "a6") return d < 60 && !frozen;
		return frozen ? d < 45 && hpf < 0.5 : d < 60 || (d < 100 && hpf < 0.6);
	}
	function toward_bill(bill, want) {
		var me = here(), dx = me[0] - bill.x, dy = me[1] - bill.y, len = Math.hypot(dx, dy) || 1;
		return [bill.x + dx / len * want, bill.y + dy / len * want];
	}
	function go(x, y) {
		if (can_go([x, y])) { try { move(x, y); } catch (e) {} }
		else walk_xy(x, y, "a2");
	}

	/** Whoever Bill chases runs laps; the other one hits him; the priest stays out of his anger radius. */
	async function bill_tick(bill) {
		var me = character, d = distance(me, bill), mine = bill.target === character.name;
		var ok = function (s) { return typeof can_use !== "function" || can_use(s); };
		var shell = me.s && me.s.hardshell, hidden = me.s && me.s.invis;
		if (is_lead()) {
			bill_ping();
			var kiter = get_player(role("RANGER", "ranger")), priest = role("PRIEST", "priest");
			// Run 8: the rogue died twice and the warrior kept the fight alone until he died too.
			var kname = role("RANGER", "ranger");
			// User (run 12): when the rogue is out (dead, left, or hidden and out of sight) the warrior takes over instead.
			bill_takeover = !kiter || !!kiter.rip || !!(run.left && run.left[kname]);
			// Run 14: the 8 min counted from the start, including 6 min of a stuck pull, cut a fight going at 2k/s.
			// Count from the engagement, and just stop (a retreat does not shake Bill off a paused instance).
			if (now() - (run.bill.engagedAt || now()) > BILL_MAX_MS) { bill_stop("too long"); return true; }
			// No party retreat for a low rogue (run 7): Bill keeps his target through a paused instance, so stepping out
			// does not shake him. The rogue vanishes when Bill closes in instead.
			if (bill.target === priest) {
				if (!priest_hunted_since) priest_hunted_since = now();
				if (now() - priest_hunted_since > 10000) { bill_stop("Bill on the priest"); order_retreat("Bill on the priest"); return true; }
			} else priest_hunted_since = 0;
			if (!run.bill.cry && bill.target && ok("warcry")) { run.bill.cry = true; try { await use_skill("warcry"); } catch (e0) {} }
		}
		if (character.ctype === "priest") {
			// Heals come from the priest script's own loop (poison cuts them). She steps in for a hurt ally or a missing
			// Curse (-20 speed, -20% damage, +20% taken), then steps back out of Bill's 300 px anger radius.
			var reach = (character.range || 200) - 20;
			var hurt = [lead_player(), get_player(role("RANGER", "ranger"))].filter(function (p) { return p && !p.rip && p.hp < p.max_hp * 0.5; })[0];
			if (mine) {
				// Run 7: at speed 60 she can neither outrun Bill nor reach the pillar (died in 10 s). Run to the warrior,
				// who taunts him off her (200 px).
				var tank = lead_player();
				if (tank && !tank.rip && distance(me, tank) > 60) go(tank.x, tank.y);
				else { var run_to = orbit_point(bill); if (run_to) try { move(run_to[0], run_to[1]); } catch (e7) {} }
				set_message("Crypt: Bill on me, to the warrior");
				return true;
			}
			// User (audit): Curse 100% of the fight. Cursed, Bill chases at 76 (96 uncursed): the warrior (86) and the
			// rogue (92) outrun him, which the Hard Shell rotation needs. Curse lasts 5 s on a 5 s cooldown, so she stays
			// at casting range (no more walking out to 340 px) and recasts as soon as it is ending; a hurt ally only pulls
			// her away while the Curse still has time left. go() ignores Bill's avoid circle (run 6: cut off after a cast).
			var curse = bill.s && bill.s.cursed, ending = !curse || (curse.ms != null && curse.ms < 1500);
			if (ending && character.mp >= 400 && d <= reach + 15 && ok("curse")) try { await use_skill("curse", bill); } catch (e8) {}
			if (hurt && !ending && distance(me, hurt) > reach) { go(hurt.x, hurt.y); set_message("Crypt: Bill, healing " + hurt.name); return true; }
			// Aim for Curse range, not Bill himself: move() keeps going and walked her into him.
			if (d > reach || d < reach - 50) { var cast = toward_bill(bill, reach - 10); go(cast[0], cast[1]); }
			set_message(ending ? "Crypt: Bill, curse" : "Crypt: Bill cursed, holding range");
			return true;
		}
		// The rogue fights Bill alone (user, run 6): the warrior waits outside his 300 px anger radius and never hits him,
		// so the anger can only pick the rogue (or the priest while she curses). He still leads: pings and retreat calls.
		if (character.ctype === "warrior" && !mine && bill.target === role("PRIEST", "priest")) {
			// Bill on the priest: go in and Taunt him off her; Bill then runs on the warrior (ring + Hard Shell).
			if (d > 190) { var tp = toward_bill(bill, 180); go(tp[0], tp[1]); }
			else if (ok("taunt")) try { await use_skill("taunt", bill); } catch (e12) {}
			set_message("Crypt: Bill on the priest, taunt");
			return true;
		}
		if (character.ctype === "warrior" && !mine && bill_takeover) {
			// Rogue out: pull Bill onto the warrior with Taunt; the ring and Hard Shell below take it from there.
			if (d > 190) { var tk = toward_bill(bill, 180); go(tk[0], tk[1]); }
			else if (ok("taunt")) try { await use_skill("taunt", bill); } catch (e15) {}
			set_message("Crypt: rogue out, warrior takes Bill");
			return true;
		}
		// User (run 25): Hard Shell rotation. Bill on the rogue and Hard Shell ready: Taunt him over, take 8 s of hits
		// under the shell; once it ends, step out of his 300 px anger radius so he goes back to the rogue.
		// Audit: uncursed and unfrozen Bill chases at 96 > her 86, so the step-out after the shell cannot work: wait for it.
		if (character.ctype === "warrior" && !mine && bill.target === role("RANGER", "ranger") && ok("hardshell") && ok("taunt") &&
			bill.s && (bill.s.cursed || bill.s.frozen) && me.mp >= 600 && me.hp > me.max_hp * 0.7) {
			if (d > 190) { var rp = toward_bill(bill, 180); go(rp[0], rp[1]); }
			else try { await use_skill("taunt", bill); } catch (e19) {}
			set_message("Crypt: Hard Shell rotation, taunt");
			return true;
		}
		if (character.ctype === "warrior" && !mine) {
			if (d < BILL_PRIEST_GAP + 20) {
				var away = toward_bill(bill, BILL_PRIEST_GAP + 40);
				if (can_go(away)) try { move(away[0], away[1]); } catch (e10) {}
				else flee(bill);
			}
			set_message("Crypt: Bill, rogue fights, waiting");
			return true;
		}
		if (mine) {
			// Bill covers ~25 px per 250 ms tick at speed 96: vanish at 100 px, not at contact (runs 8-9).
			// Warrior: Hard Shell as soon as Bill is close, the only time he hits Bill (user, run 12).
			if (d < (character.ctype === "rogue" ? 100 : 150)) {
				if (character.ctype === "warrior" && !shell && ok("hardshell")) try { await use_skill("hardshell"); shell = true; } catch (e2) {}
			}
			if (character.ctype === "rogue" && !hidden && ok("invis") && vanish_now(bill, d)) try { await use_skill("invis"); invis_at = now(); hidden = true; } catch (e3) {}
			// Hard Shell pins speed to 10: stand and take it; otherwise run the ring (reach it first when far from it).
			// Rotation: shell over and the rogue still in the fight: leave the anger radius instead of running the ring.
			// Run 26: Bill often stays on her anyway (down to 3.7k HP between shells): under 50% she runs the ring instead.
			if (!shell && character.ctype === "warrior" && !bill_takeover && !ok("hardshell") && me.hp >= me.max_hp * 0.5) {
				var exit_pt = toward_bill(bill, BILL_PRIEST_GAP + 40);
				if (can_go(exit_pt)) try { move(exit_pt[0], exit_pt[1]); } catch (e20) {}
				else flee(bill);
				set_message("Crypt: Hard Shell over, back to the rogue");
				return true;
			}
			if (!shell) {
				var far = d2(here(), PILLAR) > (ORBIT_R + 60) * (ORBIT_R + 60), o = far ? null : orbit_point(bill);
				if (far) { var ang = Math.atan2(me.y - PILLAR[1], me.x - PILLAR[0]); go(PILLAR[0] + ORBIT_R * Math.cos(ang), PILLAR[1] + ORBIT_R * Math.sin(ang)); }
				else if (o) try { move(o[0], o[1]); } catch (e4) {}
				if (character.ctype === "warrior") { set_message("Crypt: Bill on me, no Hard Shell, run"); return true; }
			}
			set_message(shell ? "Crypt: Bill on me, Hard Shell, hit" : "Crypt: Bill on me, pillar");
		} else if (!bill.target) {
			// The rogue pulls from the ring; the warrior keeps out of the anger radius until Bill has a target.
			if (character.ctype !== "rogue") {
				// Run 6: flee() sent the warrior to the far side of the room; wait just outside the anger radius.
				if (d < 320) { var hold = toward_bill(bill, 330); if (can_go(hold)) try { move(hold[0], hold[1]); } catch (e11) {} }
				else if (d > 450 && is_lead()) { var nb = toward_bill(bill, 380); go(nb[0], nb[1]); } // run 19: stay in view
				set_message("Crypt: Bill pull");
				return true;
			}
			// Run 23: he came out of Invisibility next to an idle Bill, pulled at once with it on its 12 s cooldown and died
			// (49 px). No pull without Invisibility ready: wait 200+ px off until it is back.
			if (character.ctype === "rogue" && !hidden && typeof can_use === "function" && !can_use("invis")) {
				if (d < 200) { var wait_pt = toward_bill(bill, 220); if (can_go(wait_pt)) try { move(wait_pt[0], wait_pt[1]); } catch (e18) {} }
				set_message("Crypt: Bill pull, waiting for Invisibility");
				return true;
			}
			// Run 14: "reach the ring first, then pull" flip-flopped at the 130 px edge while Bill idled 360 px off the
			// pillar. Walk straight to 110 px from Bill and hit him; once he chases, the ring rule brings him to the pillar.
			if (d > character.range - 10) { var pull = toward_bill(bill, 110); if (can_go(pull)) go(pull[0], pull[1]); else walk_xy(pull[0], pull[1], "a2"); }
		} else {
			var reach = character.ctype === "rogue" ? character.range - 15 : 30;
			if (d > reach) { var near = character.ctype === "rogue" ? toward_bill(bill, 110) : [bill.x, bill.y]; go(near[0], near[1]); }
			// Run 11: Bill chasing the warrior round the pillar passed 40 px from the rogue; an anger switch then hits
			// before the next check. Step back out to 115 px whenever he comes closer than 100.
			else if (character.ctype === "rogue" && d < 100) { var back = toward_bill(bill, 115); if (can_go(back)) try { move(back[0], back[1]); } catch (e13) {} }
			set_message("Crypt: hit Bill");
		}
		// After vanishing, stay hidden until Bill picks someone else (attacking reveals the rogue).
		// Run 12: Invisibility only comes back 12 s after reappearing, and the rogue died ~3 min into a clean fight.
		// Stay hidden while Bill has no target or is on us (up to 8 s), and never reappear with him within 150 px.
		// User (run 12): once Bill is on someone else the rogue must come back out, or he stays hidden for good.
		if (hidden) {
			var onOther = !!bill.target && bill.target !== character.name;
			// Run 14: Bill idle far from the pillar while the rogue stayed hidden: nobody pulled. Bill idle and 150+ px
			// away means there is nothing to hide from: come out and pull.
			// Run 14 again: an idle Bill wandering at ~110 px with 27k HP left kept the rogue hidden for good. An idle Bill is
			// not chasing anyone: come out and pull as soon as he is 90 px or more away.
			if (!bill.target && d >= 90) { try { stop("invis"); } catch (e17) {} hidden = false; }
			else if (!onOther && (d < 150 || now() - invis_at < 8000)) return true;
			if (onOther && d < 110) return true; // the step-back above takes him to 115 px first
			if (onOther) { try { stop("invis"); } catch (e16) {} hidden = false; }
		}
		if (typeof can_attack === "function" ? can_attack(bill) : is_in_range(bill)) {
			try { change_target(bill); } catch (e5) {}
			try { await attack(bill); } catch (e6) {}
		}
		return true;
	}

	/** Run 29 (Marceline attempt) and run 37 (Bill fight, the priest killed by a roaming Marceline): the special fight
	 *  modes return before the usual RUN checks, so any other RUN monster on or near us comes first. The rogue vanishes
	 *  when it is close, everyone else flees. True when it acted. */
	async function avoid_other(all, skip) {
		var other = all.filter(function (m) { return RUN[m.mtype] && m.mtype !== skip && (m.target === character.name || distance(character, m) < RUN[m.mtype]); })
			.sort(function (a, b) { return distance(character, a) - distance(character, b); })[0];
		if (!other) return false;
		var od = distance(character, other);
		if (character.ctype === "rogue" && !(character.s && character.s.invis) && vanish_now(other, od) && (typeof can_use !== "function" || can_use("invis"))) {
			try { await use_skill("invis"); invis_at = now(); } catch (e19) {}
			note("vanished from " + other.mtype);
		} else flee(other);
		set_message("Crypt: avoiding " + other.mtype);
		return true;
	}

	async function inside() {
		var all = monsters(), c = cfg();
		watch_kills(all);
		var bill = all.filter(function (m) { return m.mtype === "a2"; })[0];
		if (bill) bill_seen_at = now();
		if (is_lead() && !run.bill && bill_ready(all, bill)) {
			run.bill = { at: now() };
			save();
			run.progressAt = now();
			note("Bill fight at the pillar");
			bill_ping(true);
		}
		// Run 36: Lucinda (135 px range, 72 charge) walked into the Bill fight and targeted the rogue; the Bill logic never
		// looks at her, so he stood 6 s at 10 px from her with the Vampirelings around and died. A boss on the rogue
		// during the Bill fight: vanish (pursuit stops on an invisible target), else step away from her.
		var boss_on_me = character.ctype === "rogue" && bill_on() && !(character.s && character.s.invis) &&
			all.filter(function (m) { return BOSS_ORDER.indexOf(m.mtype) >= 0 && m.target === character.name; })[0];
		if (boss_on_me) {
			if (typeof can_use !== "function" || can_use("invis")) { try { await use_skill("invis"); invis_at = now(); } catch (e20) {} note("vanished from " + boss_on_me.mtype + " during the Bill fight"); }
			else marc_step_out(boss_on_me, 220);
			set_message("Crypt: " + boss_on_me.mtype + " on me in the Bill fight");
			return true;
		}
		if (bill_on() && await avoid_other(all, "a2")) return true;
		if (bill_on()) {
			if (bill) {
				run.bill.seen = now(); run.bill.x = bill.x; run.bill.y = bill.y;
				if (!is_lead() && now() - last_seen_ping > 3000) { last_seen_ping = now(); cm([warrior()].filter(Boolean), { t: "crypt", a: "bill_seen", runId: run.runId }); }
				run.bill.low = !!(bill.max_hp && bill.hp < bill.max_hp * 0.2 && distance(character, bill) < 250);
				if (is_lead() && !run.bill.engaged && roster().indexOf(bill.target) >= 0) { run.bill.engaged = true; run.bill.engagedAt = now(); run.billTries = bill_tries() + 1; save(); }
				// Run 39: a boss walking into the Bill fight (Lucinda run 36, Lestat run 39) killed the rogue. Stop and step out.
				var joined = is_lead() && all.filter(function (m) { return BOSS_ORDER.indexOf(m.mtype) >= 0 && (distance(m, bill) < 350 || roster().indexOf(m.target) >= 0); })[0];
				if (joined) { bill_stop(joined.mtype + " joined the fight"); order_retreat(joined.mtype + " joined the Bill fight"); return true; }
				return await bill_tick(bill);
			}
			// Out of sight: dead if we last saw him low (watch_kills counts it), lost after 15 s otherwise.
			if (is_lead() && (run.bill.low || now() - (run.bill.seen || run.bill.at) > 15000)) bill_stop(run.bill.low ? "Bill killed" : "Bill lost");
			// Run 23: no ping while the lead could not see Bill, so the rogue dropped the fight and led Bill into the group.
			else if (is_lead() && run.bill) bill_ping();
		}
		if (marc_on()) {
			if (await avoid_other(all, "a6")) return true;
			var marc = all.filter(function (m) { return m.mtype === "a6"; })[0];
			if (character.ctype === "rogue") return await marc_rogue(marc);
			if (character.ctype === "warrior" && is_lead()) return await marc_warrior(marc);
			if (character.ctype === "priest") return await marc_priest(marc);
		}
		if (is_lead()) {
			// Any RUN monster on any member, near or far from the tank: the whole party steps out.
			var hunter = all.filter(function (m) { return RUN[m.mtype] && roster().indexOf(m.target) >= 0 && !(m.mtype === "a6" && marc_on()); })[0];
			if (hunter) { order_retreat(hunter.mtype + " on " + hunter.target); return true; }
			// Run 26: the priest died to a Vampireling and the warrior and rogue kept fighting without heals; both died.
			// Priest dead (or off the crypt map per party data) while something is on us: step out together.
			var pname = role("PRIEST", "priest"), pr = get_player(pname), pp = typeof get_party === "function" ? (get_party() || {})[pname] : null;
			var priestDown = (pr && pr.rip) || (!pr && pp && pp.map && pp.map !== character.map);
			if (priestDown && all.some(function (m) { return roster().indexOf(m.target) >= 0; })) { order_retreat("priest down"); return true; }
			// Run 36: step out before she dies dry, not after (heals stop under ~200 MP).
			if (pr && !pr.rip && pr.max_mp && pr.mp < pr.max_mp * 0.15 && all.some(function (m) { return roster().indexOf(m.target) >= 0; })) { order_retreat("priest out of mana"); return true; }
		}
		// Run 11: Invisibility only ends on an attack, so a rogue who vanished and then had nothing to fight stayed
		// hidden for 15 min, the lead never saw him and waited at the door. Reappear once nothing avoided is on or near him.
		if (character.ctype === "rogue" && character.s && character.s.invis && now() - invis_at > 3000) {
			// Run 20: he reappeared with Bill 200+ px away, Bill came back and killed him with Invisibility on its 12 s
			// cooldown. Stay hidden while any avoided monster is within 450 px (Bill covers 250 px in about 2.5 s).
			var lurking = all.some(function (m) { return RUN[m.mtype] && (m.target === character.name || distance(character, m) < 450); });
			if (!lurking) { try { stop("invis"); } catch (e14) {} note("reappeared"); }
		}
		// Run 7: Bill killed the rogue (3.2k HP) in about a second before any fight logic ran. Vanish first.
		if (character.ctype === "rogue" && !(character.s && character.s.invis) && (typeof can_use !== "function" || can_use("invis"))) {
			var close = all.filter(function (m) { return RUN[m.mtype] && m.target === character.name && vanish_now(m, distance(character, m)); })[0];
			if (close) { try { await use_skill("invis"); invis_at = now(); note("vanished from " + close.mtype); } catch (e0) {} return true; }
		}
		var threat = runner_threat(all);
		if (threat) {
			flee(threat);
			if (roster().indexOf(threat.target) >= 0) {
				// A RUN monster kills in seconds (two deaths to Bill): step out at once instead of after CHASE_MS.
				if (RUN[threat.mtype] && is_lead()) { chase_since = 0; order_retreat(threat.mtype + " on " + threat.target); return true; }
				if (!chase_since) chase_since = now();
				if (is_lead() && now() - chase_since > CHASE_MS) { chase_since = 0; order_retreat("chased by " + threat.mtype); }
			}
			return true;
		}
		chase_since = 0;
		census(all);
		var attackers = party_attackers(all), tgt = null, regrouping = false;
		if (is_lead()) {
			if (run.regroupAt) {
				// The client keeps the Cave door entities for a moment after entering ("regrouped" at once, runs 6-7).
				regrouping = now() - run.regroupAt < 3000 || !group_near(300);
				if (!regrouping) { run.regroupAt = 0; save(); note("party regrouped"); }
				else if (now() - run.regroupAt > 5 * 60 * 1000) { finish("party did not regroup"); return true; }
			}
			// Stay on the current fight until it dies: crypt monsters regenerate once left alone.
			var held = focus && parent.entities[focus];
			if (held && (held.dead || held.rip)) held = null;
			tgt = (held && held.type === "monster" ? held : null) || attackers[0] || (!regrouping && party_ready() ? pick_target(all, target_list(all)) : null);
			focus = tgt ? tgt.id : "";
			if (tgt) run.rounds = 0;
		} else {
			var lead = lead_player(), id = lead && lead.target;
			var lt = id && parent.entities[id];
			tgt = lt && (attackers.indexOf(lt) >= 0 || is_safe(lt, all, safe_list())) ? lt : attackers[0] || null;
		}
		if (tgt) return await fight(tgt);
		if (is_lead()) {
			ping_position();
			var vb = (run.kills && run.kills.vbat) || 0;
			// Run 15: jumping to the next reachable waypoint wraps the loop fast, so 2 rounds came after 4 min with 6
			// Vampirelings still alive. Give up on them only after 4 rounds.
			var done = objective_done() || (vb >= VBATS && (run.rounds || 0) >= 1) || (run.rounds || 0) >= 4;
			// Objective done but a Bill try left: wait for him in the Vampireling room by the pillar (10 min max).
			// Lucinda and Lestat dead (or the rest done): wait for Bill by the pillar before the Vampirelings.
			// Vampirelings left and Bill far away: farm them meanwhile; all dead: wait for Bill until the time is up.
			var wait_bill = (done || bosses_done()) && bill_pending() && (done || bill_near(all));
			if (done && !wait_bill && !run.marc && marc_ready()) { run.marc = { at: now() }; save(); note("objective done, Marceline attempt (rogue alone, priest curses)"); marc_ping(true); }
			if (run.marc) {
				marc_ping();
				if (now() - run.marc.at > MARC_MS) marc_stop("12 min");
				else {
					if (d2(here(), BILL_WAIT) > 40 * 40) walk_xy(BILL_WAIT[0], BILL_WAIT[1]);
					set_message("Crypt: Marceline attempt, holding");
					return true;
				}
			}
			if (done && !wait_bill) { finish(objective_done() ? "objective done" : "cleared"); return true; }
			// Runs 27 and 38: Orlok or Bill parked by the Vampirelings with the east corridor blocked too: the loop jumped
			// between blocked waypoints for 10+ min (jumps never finish a round). Run 40: 10 min cut a run with Bill and the 7
			// Vampirelings left (8 min lost fetching a cut-off rogue). No kill and no Bill fight for 15 min: end.
			if (!wait_bill && now() - (run.progressAt || run.openedAt || run.at) > 15 * 60 * 1000) { finish("no progress for 15 min"); return true; }
			if (!group_near(300)) {
				// A member that reports itself cut off (no safe route to us) is fetched; otherwise wait where we are.
				var f = run.fetch;
				if (f && now() - f.at < 30000) {
					var fetching = walk_xy(f.x, f.y);
					note(fetching ? "fetching " + f.name : f.name + " cut off, both sides blocked");
					set_message(fetching ? "Crypt: fetching " + f.name : "Crypt: " + f.name + " cut off, both sides blocked");
					return true;
				}
				// After the Bill fight the warrior stood 490 px off and the others did not come (run 12): when an ally is
				// in sight but far, the lead walks to it instead of waiting.
				var far_ally = allies().map(function (n) { return get_player(n); }).filter(function (p) { return p && !p.rip && distance(character, p) >= 300; })[0];
				if (far_ally && !regrouping) { walk_xy(far_ally.x, far_ally.y); set_message("Crypt: joining " + far_ally.name); return true; }
				set_message(regrouping ? "Crypt: regroup at the door" : "Crypt: wait for the party");
				return true;
			}
			// Run 21: after Lestat the loop went on from the far side of the map; start the Vampireling part from their room.
			if (bosses_done() && !run.vbatStart) { run.vbatStart = true; run.wp = 0; save(); }
			if (wait_bill) {
				if (!run.billWaitAt) { run.billWaitAt = now(); save(); note((done ? "objective done" : "Lucinda and Lestat done") + ", waiting for Bill at the pillar"); }
				if (d2(here(), BILL_WAIT) > 40 * 40) walk_xy(BILL_WAIT[0], BILL_WAIT[1]);
				set_message("Crypt: waiting for Bill");
				return true;
			}
			roam();
		} else follow(character.ctype === "ranger" ? 130 : 90);
		set_message("Crypt " + ((run.kills && run.kills.vbat) || 0) + "/" + VBATS);
		return true;
	}

	// ---------------------------------------------------------------- tick

	/** Returns true while the crypt run owns this character's movement. */
	async function tick() {
		if (!run) {
			if (in_crypt()) { await exit_crypt(); return true; } // lost in an instance with no run
			return false;
		}
		if (run.phase === "leaving") {
			if (in_crypt()) { await exit_crypt(); return true; }
			run = null;
			save();
			// User (run 14): crypt loot like +0 Crypt rings and earrings stayed in the bags, because the dump trip only
			// starts with nearly full bags. Out of the crypt, hand whatever is dumpable to the merchant.
			try { if (typeof dumpable_count === "function" && dumpable_count() > 0 && typeof state !== "undefined" && state) { state.dumpInProgress = true; note("run over, taking the loot to the merchant"); } } catch (e) {}
			return false;
		}
		if (run.phase === "retreat") {
			if (in_crypt()) { await exit_crypt(); return true; }
			if (now() < run.retreatUntil) {
				if (character.map !== DOOR.map || distance(character, DOOR) > ENTER_RANGE) { if (!smart.moving) smart_move(DOOR).catch(function () {}); }
				set_message("Crypt: back in " + Math.ceil((run.retreatUntil - now()) / 1000) + "s");
				return true;
			}
			run.phase = "gather";
			run.returning = true;
			run.wp = 0;
			save();
			note("going back in " + run.id);
		}
		if (!run.openedAt && now() - run.at > GATHER_MS) { finish("gather timeout"); return true; }
		if (run.openedAt && now() - run.openedAt > RUN_MS) { finish("timeout"); return true; }
		// Deaths are counted by watch_rip (also on its own 250 ms timer), never guessed from re-entries (run 4).
		watch_rip();
		if (character.rip) return true;
		// Run 4: an abort + new start while still inside left the tank fighting in the old instance with no key at the door.
		if (in_crypt() && character.in && character.in !== run.id) { set_message("Crypt: leaving an old instance"); await exit_crypt(); return true; }
		if (in_crypt()) return await inside();
		return await outside();
	}

	// Run 7: the farmers' movement loops return early while dead and never reach tick(), so three deaths went
	// uncounted ("deaths 0" after a wipe). Watch the dead state on our own timer.
	function watch_rip() {
		if (!run || run.phase === "leaving") return;
		// Only deaths inside the crypt count (run 13: the rogue died to a scorpion on his way to the Cave door).
		if (character.rip && !run.ripSeen && in_crypt()) {
			run.ripSeen = true; run.deaths = (run.deaths || 0) + 1;
			// What was around at the moment of death: the next one can be diagnosed from the log alone.
			var near = monsters().filter(function (m) { return !m.dead; }).sort(function (a, b) { return distance(character, a) - distance(character, b); })[0];
			var ready = typeof can_use !== "function" ? "?" : can_use("invis") ? "ready" : "cooldown";
			if (run.marc && character.ctype === "rogue") marc_report("rogue died");
			note("died in the crypt (" + run.deaths + ")" + (near ? " · nearest " + near.mtype + " " + Math.round(distance(character, near)) + " px, on " + (near.target || "nobody") : "") + (character.ctype === "rogue" ? " · invis " + ready : "") + " · mp " + character.mp);
		}
		else if (!character.rip && run.ripSeen) { run.ripSeen = false; save(); }
	}
	if (typeof setInterval === "function") setInterval(watch_rip, 250);

	// Other loops (dump, hunt, events) must not smart_move off an instance map: there is no path.
	try {
		if (typeof smart_move === "function" && !smart_move.__alcc_crypt_guard) {
			var raw_smart_move = smart_move;
			smart_move = function (destination) {
				var same_map = destination && typeof destination === "object" && "x" in destination && (!destination.map || destination.map === character.map);
				if (in_crypt() && !same_map) return Promise.reject({ reason: "crypt_same_map_only", place: "smart_move" });
				return raw_smart_move.apply(this, arguments);
			};
			smart_move.__alcc_crypt_guard = true;
		}
	} catch (e) {}

	return {
		tick: tick,
		onCm: on_cm,
		inside: in_crypt,
		/** Monster whose loadout style applies in the crypt: the current safe target, else the Vampirelings. */
		/** Monster being fought; a heal retargets the priest onto an ally, so the last fight holds for 10 s
		 *  (otherwise the loadout flips between Lantern and Candleward every tick). */
		monster: function () {
			var t = typeof parent !== "undefined" && parent.entities && parent.entities[character.target];
			if (t && t.type === "monster" && SAFE[t.mtype]) last_fought = { mtype: t.mtype, at: now() };
			return last_fought && now() - last_fought.at < 10000 ? last_fought.mtype : "vbat";
		},
		active: function () { return !!run; },
		/** The warrior must not dump the key back to the merchant while a run is on. */
		keeps: function (it) { return !!run && !!it && it.name === KEY; },
		snapshot: function () { return run ? { runId: run.runId, phase: run.phase, id: run.id || "", kills: run.kills || {}, last: run.last || "" } : null; },
		isSafe: is_safe,
		pickTarget: pick_target,
		route: route,
		nodes: function () { return NODES; },
		nearestNode: nearest_node,
		segClear: seg_clear,
		walk: walk_xy
	};
})();
