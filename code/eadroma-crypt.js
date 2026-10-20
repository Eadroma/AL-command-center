/**
 * Eadroma — Crypt kite (Vampirelings)
 * ===================================
 *
 * Separate from the open-world farm. Save as slot 5 (EadromaCrypt).
 * Do not overwrite the hawk/stoneworm slot. Reload this slot only when
 * you are ready to walk to the Cave door and open The Crypt.
 *
 * Hit-and-run
 * -----------
 * Vampireling (vbat): 156k HP, 1240 physical, range 35, speed 24, charge 84,
 * aa:1. Dual Fiery Blades: class 18 + blade 7 + 1.5*6 ≈ 34, so one auto
 * is 1px inside their 35. Walk to the westmost Vampireling, land one
 * attack(), run west past their range, wait the auto cooldown, step in
 * again. Never cleave, stomp, or agitate. Taunt (200) is only if Bill
 * blocks the last few pixels of the step-in. Charge +30 speed, Dash 500,
 * Hard Shell panic-only.
 *
 * Geometry
 * --------
 * Crypt spawn 0,0. Vampireling box [904,-465,1479,-304], seven of them.
 * South of the box is a wall. Kite in the hallway west of the pack,
 * x 620–900, y -660 to -340, and stay ~305 from Bill at 1110,-633.
 * Lucinda (a7) roams the west corridor; path around her 175 bubble,
 * do not bounce to spawn. Instance maps have no smart_move graph;
 * we walk with a local can_move BFS.
 *
 * Entry
 * -----
 * Cave spawn 2 [-193,-1296] is the keyed crypt door. enter("crypt") with
 * no name consumes one cryptkey and creates a random instance id.
 * Passing a name only joins an existing instance. Party joins with
 * enter("crypt", character.in).
 *
 * Party
 * -----
 * AedromaCrypt / DromaCrypt stand west of the tagged Vampireling and
 * deal the damage. This file pings { t:"crypt", map, x, y, id, n }.
 */

var CONFIG = {
	PRIEST: "Aedroma",
	NAME: "Eadroma",
	PARTY: ["Droma", "Aedroma"],
	KEY: "cryptkey",
	FARM: "vbat",
	/** West of the first Vampirelings, outside Bill anger. */
	PULL: { map: "crypt", x: 800, y: -520 },
	PULL_WEST: 660,
	PULL_EAST: 860,
	SPAWN: { map: "crypt", x: 0, y: 0 },
	DOOR: { map: "cave", x: -193, y: -1296 },
	/** Do not camp the keyed door without a key — Phoenix / Mummy Vampire roam there. */
	WAIT_KEY: { map: "main", x: -80, y: -50 },
	/** Server enter range is 120 from cave spawn 2. */
	ENTER_RANGE: 40,
	/** After an auto, run this far past monster.range. */
	PEEL: 42,
	/** Stand this many pixels inside character.range when stepping in. */
	STEP_IN: 3,
	UNIQUE_FLEE: 240,
	CORRIDOR: { x1: 620, y1: -660, x2: 900, y2: -340 },
	MAX_PULL: 1,
	TAUNT_MAX: 200,
	BILL_KEEP: 305,
	BILL_SPAWN: { x: 1109.81, y: -632.68 },
	POT_HP: 0.45,
	POT_MP: 0.35,
	DASH_MP: 120,
	TAUNT_MP: 40,
	SHELL_MP: 480,
	DASH_WHEN: 18,
	SHELL_WHEN: 6,
	CHARGE_WHEN: 30,
	STUCK_MS: 8000
};

var UNIQUE = {
	a1: 1, a2: 1, a3: 1, a4: 1, a5: 1, a6: 1, a7: 1, a8: 1,
	nerfedbat: 1, zapper0: 1
};

function unique_radius(e) {
	if (!e) return CONFIG.UNIQUE_FLEE;
	if (e.mtype === "a2") return CONFIG.BILL_KEEP;
	if (e.mtype === "zapper0") return 320;
	if (e.mtype === "a1") return 200;
	/** Lucinda range 135; 240 used to bounce us spawn↔pocket. */
	if (e.mtype === "a7") return 175;
	return CONFIG.UNIQUE_FLEE;
}

var working = false;
var last_path_key = "";
var last_go_dest = "";
var last_route_switch = 0;
var smart_retry_at = 0;
var smart_fail_key = "";
var smart_fail_n = 0;
var dest_skip_until = {};
var stuck_xy = null;
var stuck_since = 0;
var last_enter_ms = 0;
var last_party_ms = 0;
var last_ping_ms = 0;
var last_key_log = 0;
var last_unique_log = "";
var last_dash_ms = 0;
var sweep_east = true;

function dist2(a, b) {
	if (!a || !b) return 99999;
	var dx = (a.x || 0) - (b.x || 0);
	var dy = (a.y || 0) - (b.y || 0);
	return Math.sqrt(dx * dx + dy * dy);
}

function dest_key(dest) {
	if (!dest) return "";
	if (typeof dest === "string") return dest;
	return (dest.map || character.map) + ":" + Math.round(dest.x) + "," + Math.round(dest.y);
}

function path_log(reason, dest) {
	var key = reason + "->" + dest;
	if (key === last_path_key) return;
	last_path_key = key;
	game_log(reason + " -> " + dest);
}

function same_map_xy(dest) {
	return !!(dest && typeof dest === "object" && dest.x != null && (!dest.map || dest.map === character.map));
}

function smart_target() {
	if (!smart.moving || !smart.map) return null;
	return { map: smart.map, x: smart.x, y: smart.y };
}

function stop_smart() {
	if (smart.moving) {
		try { stop("smart"); } catch (e) {}
	}
	last_go_dest = "";
	stuck_xy = null;
}

function watch_stuck() {
	if (smart.searching && Date.now() - (stuck_since || 0) > 2500) {
		game_log("path: abort stuck smart search");
		stop_smart();
		stuck_since = Date.now();
		return;
	}
	if (!smart.moving) {
		stuck_xy = null;
		return;
	}
	var here = { x: Math.round(character.x), y: Math.round(character.y) };
	if (!stuck_xy || Math.abs(stuck_xy.x - here.x) > 4 || Math.abs(stuck_xy.y - here.y) > 4) {
		stuck_xy = here;
		stuck_since = Date.now();
		return;
	}
	if (Date.now() - stuck_since > CONFIG.STUCK_MS) {
		game_log("path: stuck, re-planning");
		stop_smart();
		smart_retry_at = Date.now() + 1500;
	}
}

function step_toward(x, y) {
	if (character.moving && Math.abs((character.going_x || 0) - x) < 8 && Math.abs((character.going_y || 0) - y) < 8) return true;
	try {
		if (can_move_to(x, y) && can_edge(character.x, character.y, x, y)) {
			move(x, y);
			return true;
		}
		var cx = character.x;
		var cy = character.y;
		var dx = x - cx;
		var dy = y - cy;
		var n = Math.sqrt(dx * dx + dy * dy) || 1;
		if (n > 140) return false;
		var ux = dx / n;
		var uy = dy / n;
		var px = -uy;
		var py = ux;
		var dists = [48, 30, 18];
		var sides = [0, 30, -30, 60, -60, 90, -90];
		for (var di = 0; di < dists.length; di++) {
			for (var si = 0; si < sides.length; si++) {
				var tx = cx + ux * dists[di] + px * sides[si];
				var ty = cy + uy * dists[di] + py * sides[si];
				if (can_move_to(tx, ty) && can_edge(character.x, character.y, tx, ty)) {
					move(tx, ty);
					return true;
				}
			}
		}
	} catch (e) {}
	return false;
}

function on_instance_map() {
	return !!(G.maps[character.map] && G.maps[character.map].instance);
}

function can_edge(ax, ay, bx, by) {
	if (!crypt_segment_safe(ax, ay, bx, by, typeof crypt_approach !== "undefined" ? crypt_approach : null)) return false;
	try {
		return !!can_move({
			map: character.map,
			x: ax,
			y: ay,
			going_x: bx,
			going_y: by,
			base: character.base
		});
	} catch (e) {
		return false;
	}
}

function unique_blocks(x, y) {
	for (var id in parent.entities) {
		var e = parent.entities[id];
		if (!e || e.type !== "monster" || e.rip || !UNIQUE[e.mtype]) continue;
		var keep = unique_radius(e);
		if (Math.hypot(x - e.x, y - e.y) >= keep) continue;
		if (Math.hypot(character.x - e.x, character.y - e.y) < keep) continue;
		return true;
	}
	return false;
}

function bfs_hop(tx, ty) {
	if (can_move_to(tx, ty)) return { x: tx, y: ty };
	var step = 20;
	function key(x, y) { return Math.round(x / step) + "," + Math.round(y / step); }
	var q = [{ x: character.x, y: character.y }];
	var seen = {};
	var came = {};
	seen[key(character.x, character.y)] = 1;
	var i = 0;
	var hit = null;
	var best = null;
	var best_d = 1e15;
	var dirs = [[step, 0], [-step, 0], [0, step], [0, -step], [step, step], [step, -step], [-step, step], [-step, -step]];
	while (i < q.length && i < 2200) {
		var cur = q[i++];
		var d = Math.hypot(cur.x - tx, cur.y - ty);
		if (d < best_d) {
			best_d = d;
			best = cur;
		}
		if (d <= step * 1.5) {
			hit = cur;
			break;
		}
		for (var k = 0; k < dirs.length; k++) {
			var nx = cur.x + dirs[k][0];
			var ny = cur.y + dirs[k][1];
			var kk = key(nx, ny);
			if (seen[kk]) continue;
			if (!can_edge(cur.x, cur.y, nx, ny)) continue;
			if (unique_blocks(nx, ny)) continue;
			seen[kk] = 1;
			came[kk] = cur;
			q.push({ x: nx, y: ny });
		}
	}
	var end = hit || best;
	if (!end) return null;
	var c = end;
	var start_k = key(character.x, character.y);
	for (var n = 0; n < 200; n++) {
		var prev = came[key(c.x, c.y)];
		if (!prev || key(prev.x, prev.y) === start_k) return { x: c.x, y: c.y };
		c = prev;
	}
	return { x: end.x, y: end.y };
}

async function go_to(dest, reason, range, urgent) {
	if (character.c && character.c.town) return;
	if (!dest) return;
	var where = dest;
	var p = same_map_xy(dest) ? dest : null;
	if (dest && typeof dest === "object") {
		where = (dest.map || character.map) + " " + Math.round(dest.x / 50) * 50 + "," + Math.round(dest.y / 50) * 50;
	}
	path_log(reason, where);
	var key = dest_key(dest);
	if (p && range && dist2(character, p) <= range) {
		stop_smart();
		return;
	}
	if (smart.moving) stop_smart();
	if (p) {
		if (can_move_to(p.x, p.y) && can_edge(character.x, character.y, p.x, p.y)) {
			step_toward(p.x, p.y);
			return;
		}
		if (on_instance_map()) {
			if (character.moving && last_go_dest === key) return;
			last_go_dest = key;
			var hop = bfs_hop(p.x, p.y);
			if (hop) step_toward(hop.x, hop.y);
			return;
		}
		if (dist2(character, p) <= 140 && step_toward(p.x, p.y)) return;
	}
	if (on_instance_map()) return;
	if (Date.now() < smart_retry_at) return;
	if (dest_skip_until[key] && Date.now() < dest_skip_until[key]) return;
	last_go_dest = key;
	smart_retry_at = Date.now() + 2000;
	try {
		smart_move(dest).then(function () {
			smart_fail_n = 0;
		}, function (err) {
			var why = (err && err.reason) || "";
			if (why === "interrupted") return;
			smart_retry_at = Date.now() + 3000;
			if (smart_fail_key === key) smart_fail_n++;
			else {
				smart_fail_key = key;
				smart_fail_n = 1;
			}
			if (smart_fail_n >= 3) {
				smart_fail_n = 0;
				dest_skip_until[key] = Date.now() + 30000;
				game_log("path: cannot reach " + where + ", skip 30s");
			}
		});
	} catch (e) {}
}

async function walk_to(x, y, reason) {
	await go_to({ x: x, y: y }, reason, 12, true);
}

function is_ally(name) {
	if (!name) return false;
	if (name === character.name) return true;
	return CONFIG.PARTY.indexOf(name) !== -1;
}

function hit_range(m) {
	return (m && m.range) || 35;
}

function safe_range(m) {
	return hit_range(m) + CONFIG.PEEL;
}

function is_unique(e) {
	return !!(e && e.type === "monster" && !e.rip && UNIQUE[e.mtype]);
}

function unique_keep(e) {
	return unique_radius(e);
}

function is_farm(e) {
	return !!(e && e.type === "monster" && !e.rip && e.mtype === CONFIG.FARM);
}

function each_monster(fn) {
	for (var id in parent.entities) {
		var e = parent.entities[id];
		if (!e || e.type !== "monster" || e.rip) continue;
		fn(e);
	}
}

function nearest_unique() {
	var best = null;
	var best_d = 1e15;
	each_monster(function (e) {
		if (!is_unique(e)) return;
		var d = dist2(character, e);
		if (d < best_d) {
			best_d = d;
			best = e;
		}
	});
	return best;
}

function chasing_vbats() {
	var out = [];
	each_monster(function (e) {
		if (!is_farm(e)) return;
		if (e.target && is_ally(e.target)) out.push(e);
	});
	out.sort(function (a, b) { return dist2(character, a) - dist2(character, b); });
	return out;
}

function idle_vbat() {
	var best = null;
	each_monster(function (e) {
		if (!is_farm(e) || e.target) return;
		if (!best) {
			best = e;
			return;
		}
		if (e.x < best.x - 12) best = e;
		else if (Math.abs(e.x - best.x) <= 12 && dist2(character, e) < dist2(character, best)) best = e;
	});
	return best;
}

function bill_pos() {
	var bill = null;
	each_monster(function (e) {
		if (e.mtype === "a2") bill = e;
	});
	return bill || CONFIG.BILL_SPAWN;
}

function bill_ok(x, y) {
	var b = bill_pos();
	return Math.hypot(x - b.x, y - b.y) >= CONFIG.BILL_KEEP;
}

function attack_cd_ms() {
	try {
		if (!is_on_cooldown("attack")) return 0;
	} catch (e) {}
	var t = parent.next_skill && parent.next_skill.attack;
	if (!t) return 250;
	return Math.max(0, t - Date.now());
}

function clamp_corridor(x, y) {
	var c = CONFIG.CORRIDOR;
	return {
		x: Math.max(c.x1, Math.min(c.x2, x)),
		y: Math.max(c.y1, Math.min(c.y2, y))
	};
}

var crypt_approach = null;
function try_point(x, y) {
	var priest = get_player(CONFIG.PRIEST);
	var p = { x: x, y: y };
	if (priest && !priest.rip && dist2(p, priest) > Math.max((priest.range || 160) - 18, dist2(character, priest)) + 1) return null;
	if (can_move_to(x, y) && can_edge(character.x, character.y, x, y)) return p;
	return null;
}

/** Point at least `want` away from `from`, biased west so we do not walk into Bill. */
function away_point(from, want) {
	var dx = character.x - from.x;
	var dy = character.y - from.y;
	var n = Math.sqrt(dx * dx + dy * dy) || 1;
	var cands = [
		{ x: character.x + (dx / n) * want, y: character.y + (dy / n) * want },
		{ x: character.x - want, y: character.y },
		{ x: character.x - 80, y: character.y - 40 },
		{ x: character.x, y: character.y - want },
		{ x: character.x - 90, y: character.y + 40 },
		{ x: character.x + 40, y: character.y - 80 }
	];
	for (var i = 0; i < cands.length; i++) {
		var p = clamp_corridor(cands[i].x, cands[i].y);
		if (!bill_ok(p.x, p.y)) continue;
		var ok = try_point(p.x, p.y);
		if (ok && dist2(ok, from) >= hit_range(from) + 20) return ok;
	}
	for (var j = 0; j < cands.length; j++) {
		var q = clamp_corridor(cands[j].x, cands[j].y);
		if (!bill_ok(q.x, q.y)) continue;
		var ok2 = try_point(q.x, q.y);
		if (ok2) return ok2;
	}
	return null;
}

function approach_point(from, want) {
	var cands = [
		{ x: from.x - want, y: from.y },
		{ x: from.x - want * 0.85, y: from.y - want * 0.5 },
		{ x: from.x - want * 0.7, y: from.y - want * 0.7 },
		{ x: from.x, y: from.y - want },
		{ x: from.x - want * 0.85, y: from.y + want * 0.4 }
	];
	for (var i = 0; i < cands.length; i++) {
		var p = clamp_corridor(cands[i].x, cands[i].y);
		if (!bill_ok(p.x, p.y)) continue;
		var ok = try_point(p.x, p.y);
		if (ok) return ok;
	}
	return null;
}

function strafe_point(from) {
	var dx = character.x - from.x;
	var dy = character.y - from.y;
	var n = Math.sqrt(dx * dx + dy * dy) || 1;
	var px = -dy / n;
	var py = dx / n;
	var left = clamp_corridor(character.x + px * 100, character.y + py * 100 + 20);
	var right = clamp_corridor(character.x - px * 100, character.y - py * 100 + 20);
	var l_ok = try_point(left.x, left.y);
	var r_ok = try_point(right.x, right.y);
	if (l_ok && r_ok) {
		var l_d = dist2(l_ok, from);
		var r_d = dist2(r_ok, from);
		if (Math.abs(l_d - r_d) < 12) return left.y >= right.y ? l_ok : r_ok;
		return l_d >= r_d ? l_ok : r_ok;
	}
	return l_ok || r_ok || away_point(from, 90);
}

function has_key() {
	return locate_item(CONFIG.KEY) !== -1;
}

function maybe_potion() {
	if (character.rip) return;
	var hp = character.hp / character.max_hp;
	var mp = character.mp / character.max_mp;
	if (hp > CONFIG.POT_HP && mp > CONFIG.POT_MP) return;
	try { use_hp_or_mp(); } catch (e) {}
}

async function keep_party() {
	if (Date.now() - last_party_ms < 8000) return;
	last_party_ms = Date.now();
	var party = get_party() || {};
	for (var i = 0; i < CONFIG.PARTY.length; i++) {
		var name = CONFIG.PARTY[i];
		if (party[name]) continue;
		try { await send_party_invite(name); } catch (e) {}
	}
}

async function ping_party(target, n) {
	if (Date.now() - last_ping_ms < 2000) return;
	last_ping_ms = Date.now();
	var msg = {
		t: "crypt",
		map: character.map,
		in: character.in,
		x: Math.round(character.x),
		y: Math.round(character.y),
		id: target && target.id,
		n: n || 0
	};
	try { await send_cm(CONFIG.PARTY, msg); } catch (e) {}
}

function on_party_invite(name) {
	if (is_ally(name)) accept_party_invite(name);
}

function on_party_request(name) {
	if (is_ally(name)) accept_party_request(name);
}

async function maybe_enter() {
	if (character.map === "crypt") return false;
	if (character.map === "bank" || character.map === "bank_b" || character.map === "bank_u") {
		await go_to({ map: "main", x: 0, y: 0 }, "leave bank", 50);
		return true;
	}
	if (!has_key()) {
		if (Date.now() - last_key_log > 60000) {
			last_key_log = Date.now();
			game_log("crypt: waiting for Crypt Key (mule)");
		}
		await go_to(CONFIG.WAIT_KEY, "wait for key", 40);
		return true;
	}
	if (character.map !== "cave") {
		await go_to(CONFIG.DOOR, "cave door to crypt", CONFIG.ENTER_RANGE);
		return true;
	}
	if (dist2(character, CONFIG.DOOR) > CONFIG.ENTER_RANGE) {
		await go_to(CONFIG.DOOR, "crypt door", CONFIG.ENTER_RANGE);
		return true;
	}
	if (Date.now() - last_enter_ms < 4000) return true;
	last_enter_ms = Date.now();
	if (smart.moving) stop_smart();
	game_log("open crypt (consume key)");
	try {
		await enter("crypt");
		await wait_for(function () { return character.map === "crypt"; }, 8000, 100);
		game_log("crypt instance " + character.in);
		last_ping_ms = 0;
		await ping_party(null, 0);
	} catch (e) {
		game_log("enter crypt: " + ((e && e.reason) || e));
	}
	return true;
}

async function maybe_charge(gap) {
	if (gap > CONFIG.CHARGE_WHEN) return false;
	if (!can_use("charge")) return false;
	try {
		await use_skill("charge");
		return true;
	} catch (e) {
		return false;
	}
}

async function maybe_dash(threat, d) {
	if (d > hit_range(threat) + CONFIG.DASH_WHEN) return false;
	if (Date.now() - last_dash_ms < 1200) return false;
	if (!can_use("dash") || character.mp < CONFIG.DASH_MP) return false;
	var p = away_point(threat, 160);
	if (!p) return false;
	last_dash_ms = Date.now();
	try {
		if (can_move_to(p.x, p.y)) move(p.x, p.y);
		await use_skill("dash");
		return true;
	} catch (e) {
		return false;
	}
}

async function maybe_shell(threat, d) {
	if (d > hit_range(threat) + CONFIG.SHELL_WHEN) return false;
	if (!can_use("hardshell") || character.mp < CONFIG.SHELL_MP) return false;
	try {
		await use_skill("hardshell");
		game_log("crypt: Hard Shell (too close)");
		return true;
	} catch (e) {
		return false;
	}
}

async function maybe_taunt_pack(pack) {
	if (!can_use("taunt") || character.mp < CONFIG.TAUNT_MP) return false;
	for (var i = 0; i < pack.length; i++) {
		var e = pack[i];
		if (!e.target || e.target === character.name) continue;
		if (!is_ally(e.target)) continue;
		if (!is_in_range(e, "taunt")) continue;
		try {
			await use_skill("taunt", e);
			return true;
		} catch (err) {}
	}
	return false;
}

async function taunt_idle(idle) {
	if (!idle) return false;
	if (!can_use("taunt") || character.mp < CONFIG.TAUNT_MP) return false;
	if (dist2(character, idle) > CONFIG.TAUNT_MAX) return false;
	if (dist2(character, idle) < hit_range(idle) + 8) return false;
	if (!is_in_range(idle, "taunt")) return false;
	try {
		change_target(idle);
		await use_skill("taunt", idle);
		game_log("crypt: taunt pull " + Math.round(dist2(character, idle)) + "px");
		return true;
	} catch (e) {
		return false;
	}
}

async function flee_unique(u) {
	var key = (u.mtype || "unique") + ":" + Math.round(u.x) + "," + Math.round(u.y);
	if (last_unique_log !== key) {
		last_unique_log = key;
		game_log("crypt: unique " + (u.mtype || "?") + " at " + Math.round(dist2(character, u)) + "px");
	}
	if (u.mtype === "a7") {
		await go_to(CONFIG.PULL, "around Lucinda", 40, true);
		return;
	}
	if (u.mtype === "a2") {
		await go_to({ map: "crypt", x: CONFIG.PULL_WEST, y: CONFIG.PULL.y }, "west of Bill", 40, true);
		return;
	}
	await go_to(CONFIG.SPAWN, "flee unique", 40, true);
}

async function swing(target) {
	if (!target) return false;
	try {
		change_target(target);
		await attack(target);
		try { reduce_cooldown("attack", character.ping || 0); } catch (e) {}
		return true;
	} catch (e) {
		return false;
	}
}

async function peel(from) {
	crypt_approach = null;
	var want = hit_range(from) + CONFIG.PEEL;
	var p = away_point(from, want);
	if (p) await walk_to(p.x, p.y, "peel");
	else if (character.moving) { try { await move(character.x, character.y); } catch (e) {} }
}

async function kite_mob(threat, pack) {
	var d = distance(character, threat);
	var my_r = character.range || 34;
	var their_r = hit_range(threat);
	if (await maybe_taunt_pack(pack)) return;
	if (d < their_r + 12) {
		if (await maybe_dash(threat, d)) return;
		if (await maybe_shell(threat, d)) return;
		if (await maybe_charge(their_r + CONFIG.PEEL - d)) return;
	}
	if (can_attack(threat)) {
		await swing(threat);
		await peel(threat);
		return;
	}
	if (in_attack_range(threat) || d < their_r + 8) {
		await peel(threat);
		return;
	}
	var gap = d - (my_r - CONFIG.STEP_IN);
	var travel_ms = (Math.max(0, gap) / Math.max(25, character.speed || 55)) * 1000;
	if (attack_cd_ms() <= travel_ms + 120) {
		crypt_approach = threat;
		var inn = approach_point(threat, Math.max(8, my_r - CONFIG.STEP_IN));
		if (inn) await walk_to(inn.x, inn.y, "step in");
		return;
	}
	crypt_approach = null;
	var hold = approach_point(threat, their_r + CONFIG.PEEL);
	if (hold && dist2(character, hold) > 20) await walk_to(hold.x, hold.y, "hold out");
}

async function pull_idle(idle) {
	var d = distance(character, idle);
	if (can_attack(idle)) {
		await swing(idle);
		await peel(idle);
		return;
	}
	crypt_approach = idle;
	var inn = approach_point(idle, Math.max(8, (character.range || 34) - CONFIG.STEP_IN));
	if (!inn || !bill_ok(inn.x, inn.y)) {
		if (d <= CONFIG.TAUNT_MAX && await taunt_idle(idle)) {
			await peel(idle);
			return;
		}
		await go_to(CONFIG.PULL, "bill block", 24);
		return;
	}
	var gap = d - (character.range || 34);
	var travel_ms = (Math.max(0, gap) / Math.max(25, character.speed || 55)) * 1000;
	if (attack_cd_ms() <= travel_ms + 120) {
		await walk_to(inn.x, inn.y, "first auto");
		return;
	}
	await go_to(inn, "first auto", 10, true);
}

async function kite() {
	crypt_approach = null;
	var pack = chasing_vbats();
	var threat = pack[0];
	var idle = idle_vbat();
	var focus = threat || idle;
	if (focus) {
		try { change_target(focus); } catch (e) {}
	}
	await ping_party(focus, pack.length);

	var u = nearest_unique();
	if (u && dist2(character, u) < unique_keep(u)) {
		await flee_unique(u);
		return;
	}

	if (threat) {
		await kite_mob(threat, pack);
		return;
	}

	if (pack.length >= CONFIG.MAX_PULL) return;

	if (idle) {
		await pull_idle(idle);
		return;
	}

	await go_to(CONFIG.PULL, "west of vbats", 28);
}

function loot_if_safe() {
	var pack = chasing_vbats();
	if (pack[0] && dist2(character, pack[0]) < 140) return;
	var u = nearest_unique();
	if (u && dist2(character, u) < unique_keep(u)) return;
	try { loot(); } catch (e) {}
}

setInterval(async function () {
	if (working) return;
	working = true;
	try {
		await tick();
	} catch (error) {
		game_log("crypt: " + (error.reason || error.message || error));
	} finally {
		working = false;
	}
}, 250);

async function tick() {
	if (character.rip) {
		try { await respawn(); } catch (e) {}
		return;
	}
	watch_stuck();
	maybe_potion();
	loot_if_safe();
	await keep_party();
	if (await maybe_enter()) return;
	await kite();
}

game_log("crypt kite: step in, auto, peel");

// BEGIN GENERATED CRYPT SAFETY
/** Shared Crypt path checks, embedded into the three standalone Crypt scripts. */
function crypt_segment_safe(ax, ay, bx, by, approach) {
	var a = { x: ax, y: ay }, b = { x: bx, y: by };
	for (var id in parent.entities) {
		var e = parent.entities[id];
		if (!e || e.type !== "monster" || e.rip || e.hp <= 0) continue;
		var unique = is_unique(e);
		if (!unique && e.mtype !== CONFIG.FARM) continue;
		var pad = unique ? unique_radius(e) : ((e.range || (G.monsters[e.mtype] || {}).range || 35) + 10);
		if (!unique && approach && approach.id === e.id) pad = 8;
		var dx = bx - ax, dy = by - ay;
		var t = Math.max(0, Math.min(1, ((e.x - ax) * dx + (e.y - ay) * dy) / (dx * dx + dy * dy || 1)));
		var closest = Math.hypot(ax + dx * t - e.x, ay + dy * t - e.y);
		// Starting in danger is allowed only when the route does not go deeper.
		if (closest < Math.min(dist2(a, e) - 1, pad)) return false;
		if (dist2(a, e) < pad && dist2(b, e) < dist2(a, e) - 1) return false;
	}
	return true;
}
