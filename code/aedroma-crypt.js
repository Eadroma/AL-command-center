/**
 * Aedroma — Crypt priest
 * ======================
 *
 * Companion to eadroma-crypt.js. Save as slot 6 (AedromaCrypt).
 * Join Eadroma's instance, stand west of the kite, and keep the party
 * alive. Heal shares the attack cooldown, so heal always wins over a
 * shot. Curse the tagged Vampireling (slow + 20% less damage). Party
 * Heal when the tank is actually low. Absorb Sins if Droma gets tagged.
 * Do not walk into range 35. Do not spend Essence of Life on Revive.
 */

var CONFIG = {
	NAME: "Aedroma",
	WARRIOR: "Eadroma",
	RANGER: "Droma",
	FARM: "vbat",
	DOOR: { map: "cave", x: -193, y: -1296 },
	ENTER_RANGE: 40,
	HIT_PAD: 16,
	UNIQUE_FLEE: 240,
	/** Vampirelings hit 1240. Heal any real chip, not only sub-85%. */
	HEAL_RATIO: 0.96,
	HEAL_MISSING: 180,
	SELF_RATIO: 0.9,
	SELF_CRITICAL: 0.45,
	PARTYHEAL_HP: 0.72,
	PARTYHEAL_MP: 400,
	CURSE_MP: 400,
	ABSORB_MP: 200,
	STUCK_MS: 8000
};

var UNIQUE = {
	a1: 1, a2: 1, a3: 1, a4: 1, a5: 1, a6: 1, a7: 1, a8: 1,
	nerfedbat: 1, zapper0: 1
};

function unique_radius(e) {
	if (!e) return CONFIG.UNIQUE_FLEE;
	if (e.mtype === "a2") return 305;
	if (e.mtype === "zapper0") return 320;
	if (e.mtype === "a1") return 200;
	if (e.mtype === "a7") return 175;
	return CONFIG.UNIQUE_FLEE;
}

var working = false;
var last_crypt = null;
var last_enter_ms = 0;
var last_path_key = "";
var last_go_dest = "";
var last_route_switch = 0;
var smart_retry_at = 0;
var smart_fail_key = "";
var smart_fail_n = 0;
var dest_skip_until = {};
var stuck_xy = null;
var stuck_since = 0;

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

function stop_smart() {
	if (smart.moving) {
		try { stop("smart"); } catch (e) {}
	}
	last_go_dest = "";
	stuck_xy = null;
}

function watch_stuck() {
	if (smart.searching && Date.now() - (stuck_since || 0) > 2500) {
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
		smart_move(dest).then(function () { smart_fail_n = 0; }, function (err) {
			if (err && err.reason === "interrupted") return;
			smart_retry_at = Date.now() + 3000;
			if (smart_fail_key === key) smart_fail_n++;
			else { smart_fail_key = key; smart_fail_n = 1; }
			if (smart_fail_n >= 3) {
				smart_fail_n = 0;
				dest_skip_until[key] = Date.now() + 30000;
			}
		});
	} catch (e) {}
}

function is_ally(name) {
	return name === CONFIG.WARRIOR || name === CONFIG.RANGER || name === character.name;
}

function is_unique(e) {
	return !!(e && e.type === "monster" && !e.rip && UNIQUE[e.mtype]);
}

function unique_keep(e) {
	return unique_radius(e);
}

function hit_pad(e) {
	if (!e) return 75;
	if (is_unique(e)) return unique_keep(e);
	return (e.range || 35) + CONFIG.HIT_PAD;
}

function nearest_danger() {
	var best = null;
	var best_d = 1e15;
	for (var id in parent.entities) {
		var e = parent.entities[id];
		if (!e || e.type !== "monster" || e.rip) continue;
		if (e.mtype !== CONFIG.FARM && !is_unique(e)) continue;
		var d = dist2(character, e);
		if (d < hit_pad(e) && d < best_d) {
			best_d = d;
			best = e;
		}
	}
	return best;
}

function warrior_target(tank) {
	if (last_crypt && last_crypt.id) {
		var pinged = get_entity(last_crypt.id);
		if (pinged && pinged.type === "monster" && !pinged.rip) return pinged;
	}
	if (tank && tank.target) {
		var tagged = get_entity(tank.target);
		if (tagged && tagged.type === "monster" && !tagged.rip) return tagged;
	}
	return get_nearest_monster({ type: CONFIG.FARM, target: CONFIG.WARRIOR });
}

function dps_spot(tank, tgt) {
	var pad = hit_pad(tgt) + 12;
	var reach = (character.range || 120) - 12;
	var want = Math.max(pad, Math.min(reach, 90));
	var origin = tgt || tank;
	if (!origin) return null;
	return { x: origin.x - want, y: origin.y - 10 };
}

async function stay_safe(tank) {
	var danger = nearest_danger();
	if (!danger) return false;
	if (is_unique(danger)) {
		if (tank) await go_to({ x: tank.x - 50, y: tank.y - 20 }, "around unique", 40, true);
		else await go_to({ map: "crypt", x: 800, y: -520 }, "around unique", 40, true);
		return true;
	}
	var dx = character.x - danger.x;
	var dy = character.y - danger.y;
	var n = Math.sqrt(dx * dx + dy * dy) || 1;
	await go_to({
		x: character.x + (dx / n) * 80,
		y: character.y + (dy / n) * 80
	}, "back off", 16, true);
	return true;
}

function instance_name() {
	if (!last_crypt) return "";
	if (last_crypt.map !== "crypt") return "";
	if (Date.now() - last_crypt.at >= 25000) return "";
	var id = last_crypt.in;
	if (!id || id === "crypt" || id === "cave") return "";
	return id;
}

function instance_open() {
	return !!instance_name();
}

async function maybe_enter() {
	if (character.map === "crypt") return false;
	if (character.map === "bank" || character.map === "bank_b" || character.map === "bank_u") {
		await go_to({ map: "main", x: 0, y: 0 }, "leave bank", 50);
		return true;
	}
	var tank = get_player(CONFIG.WARRIOR);
	var inst = instance_name();
	if (!inst) {
		if (tank && tank.map !== "crypt") {
			if (character.map !== tank.map || dist2(character, tank) > 60) {
				await go_to({ map: tank.map, x: tank.x, y: tank.y }, "follow tank", 40);
			}
			return true;
		}
		if (character.map === "cave" && dist2(character, CONFIG.DOOR) < 80) {
			await go_to({ map: "main", x: -80, y: -50 }, "leave crypt door", 40);
			return true;
		}
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
	game_log("join crypt " + inst);
	try {
		await enter("crypt", inst);
		await wait_for(function () { return character.map === "crypt"; }, 8000, 100);
	} catch (e) {
		game_log("enter crypt: " + ((e && e.reason) || e));
	}
	return true;
}

function hp_ratio(who) {
	if (!who || !who.max_hp) return 1;
	return who.hp / who.max_hp;
}

function missing_hp(who) {
	if (!who || who.rip) return 0;
	return (who.max_hp || 0) - (who.hp || 0);
}

function needs_heal(who, ratio, missing) {
	if (!who || who.rip) return false;
	return hp_ratio(who) <= ratio || missing_hp(who) >= missing;
}

async function maybe_heal(tank) {
	var ranger = get_player(CONFIG.RANGER);
	var wounded = 0;
	if (needs_heal(character, CONFIG.SELF_RATIO, CONFIG.HEAL_MISSING)) wounded++;
	if (tank && needs_heal(tank, CONFIG.HEAL_RATIO, CONFIG.HEAL_MISSING)) wounded++;
	if (ranger && needs_heal(ranger, CONFIG.HEAL_RATIO, CONFIG.HEAL_MISSING)) wounded++;
	if ((tank && hp_ratio(tank) <= CONFIG.PARTYHEAL_HP) || wounded >= 2) {
		if (can_use("partyheal") && character.mp >= CONFIG.PARTYHEAL_MP) {
			try {
				await use_skill("partyheal");
				return true;
			} catch (e) {}
		}
	}
	if (hp_ratio(character) <= CONFIG.SELF_CRITICAL && can_heal(character)) {
		try { await heal(character); } catch (e) {}
		return true;
	}
	if (tank && hp_ratio(tank) <= CONFIG.SELF_CRITICAL && can_heal(tank)) {
		try { await heal(tank); } catch (e) {}
		return true;
	}
	if (ranger && hp_ratio(ranger) <= CONFIG.SELF_CRITICAL && can_heal(ranger)) {
		try { await heal(ranger); } catch (e) {}
		return true;
	}
	if (tank && needs_heal(tank, CONFIG.HEAL_RATIO, CONFIG.HEAL_MISSING) && can_heal(tank)) {
		try { await heal(tank); } catch (e) {}
		return true;
	}
	if (ranger && needs_heal(ranger, CONFIG.HEAL_RATIO, CONFIG.HEAL_MISSING) && can_heal(ranger)) {
		try { await heal(ranger); } catch (e) {}
		return true;
	}
	if (needs_heal(character, CONFIG.SELF_RATIO, CONFIG.HEAL_MISSING) && can_heal(character)) {
		try { await heal(character); } catch (e) {}
		return true;
	}
	if (tank && needs_heal(tank, CONFIG.HEAL_RATIO, CONFIG.HEAL_MISSING) && !is_in_range(tank, "heal")) {
		await go_to({ x: tank.x - 40, y: tank.y - 20 }, "heal range", 18, true);
		return true;
	}
	if (ranger && needs_heal(ranger, CONFIG.HEAL_RATIO, CONFIG.HEAL_MISSING) && !is_in_range(ranger, "heal")) {
		await go_to({ x: ranger.x - 40, y: ranger.y - 20 }, "heal ranger", 18, true);
		return true;
	}
	return false;
}

async function maybe_curse(tgt) {
	if (!tgt || tgt.rip) return false;
	if (tgt.s && tgt.s.cursed) return false;
	if (!can_use("curse") || character.mp < CONFIG.CURSE_MP) return false;
	if (!is_in_range(tgt, "curse")) return false;
	try {
		await use_skill("curse", tgt);
		return true;
	} catch (e) {
		return false;
	}
}

function someone_targets(name) {
	if (!name) return false;
	for (var id in parent.entities) {
		var e = parent.entities[id];
		if (e && e.type === "monster" && !e.rip && e.target === name) return true;
	}
	return false;
}

async function maybe_absorb() {
	if (!can_use("absorb") || character.mp < CONFIG.ABSORB_MP) return false;
	var ranger = get_player(CONFIG.RANGER);
	if (!ranger || ranger.rip || !someone_targets(ranger.name)) return false;
	if (!is_in_range(ranger, "absorb")) return false;
	try {
		await use_skill("absorb", ranger);
		return true;
	} catch (e) {
		return false;
	}
}

function on_cm(name, data) {
	if (name !== CONFIG.WARRIOR) return;
	if (!data || typeof data !== "object" || data.t !== "crypt") return;
	last_crypt = data;
	last_crypt.at = Date.now();
}

function on_party_invite(name) {
	if (is_ally(name)) accept_party_invite(name);
}

function on_party_request(name) {
	if (is_ally(name)) accept_party_request(name);
}

setInterval(async function () {
	if (working) return;
	working = true;
	try {
		await tick();
	} catch (error) {
		game_log("crypt priest: " + (error.reason || error.message || error));
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
	try { use_hp_or_mp(); } catch (e) {}
	try { loot(); } catch (e) {}

	var tank = get_player(CONFIG.WARRIOR);
	if (await maybe_enter()) return;
	var movedToSafety = await stay_safe(tank);
	if (await maybe_heal(tank)) return;
	if (movedToSafety) return;
	if (await maybe_absorb()) return;

	if (!tank) {
		if (instance_open() && last_crypt.x != null) {
			await go_to({ map: "crypt", x: last_crypt.x - 40, y: last_crypt.y - 20 }, "catch kite", 60);
		}
		return;
	}

	var tgt = warrior_target(tank);
	if (tgt) {
		if (await maybe_curse(tgt)) return;
		var pad = hit_pad(tgt);
		if (dist2(character, tgt) < pad) return;
		var park = dps_spot(tank, tgt);
		if (park && !is_in_range(tgt) && dist2(character, park) > 18) {
			await go_to(park, "cast pocket", 16, true);
			return;
		}
		if (is_in_range(tgt) && can_attack(tgt)) {
			change_target(tgt);
			try { await attack(tgt); } catch (e) {}
		}
		return;
	}

	if (dist2(character, tank) > 80) {
		await go_to({ x: tank.x - 50, y: tank.y - 20 }, "follow kite", 24);
	}
}

game_log("crypt priest: heal first, curse, partyheal");

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
