/**
 * Aedroma — priest partner
 * ========================
 *
 * Paste this entire file into Aedroma's in-game CODE editor, then press RUN.
 * Eadroma must run `eadroma-warrior.js` on the SAME server (see HOW-TO-RUN.txt).
 *
 * Role
 * ----
 * Stay with Eadroma. Heal the warrior whenever HP is missing enough to
 * matter. Heal Droma too when he is on screen and hurt. Only attack
 * when nobody in range needs a heal. Priest heal shares the attack
 * cooldown (G.skills.heal share:"attack"), so heal and damage are an
 * either/or each swing.
 *
 * Priest has no explosion weapon and no damage AoE. Default farm is
 * spiders with Eadroma: wait for the pull, then heal first and only hit
 * tagged spiders. If a Phoenix is on screen, hit that instead. Stay off melee. Talk to Daisy when we are next to her.
 * Eadroma tanks the first allowed hunt: his, then Droma, then ours.
 * Stoneworm hunts park at the west curb of the south-east spookytown
 * box — do not walk the pack centre. Stay off melee. Talk to Daisy when we are next to her.
 * (ecape) the mule hands over. Drink elixirint0 when no elixir is running.
 * Prefer Vampiric Staff (vstaff) as mainhand when the mule returns it.
 * Keep the Wanderer already worn; extra copies go to the mule for Droma.
 * Do not back off idle monsters — that cancelled every walk.
 *
 * Following: park 100-140px from Eadroma (his PRIEST_COVER is 175). When
 * he is off screen, walk to the position he broadcasts every 4s; never
 * pick a wait spot of our own while he is alive and talking.
 *
 * Movement: go_to() is the only entry point. move() when the line is
 * clear, one throttled smart_move otherwise. Long same-map catch-up uses
 * the game's xmove() follower route.
 *
 * Live contracts used
 *   heal, can_heal, attack, can_attack, is_in_range, get_player, get_entity
 *   move, can_move_to, smart_move, stop, loot, respawn, accept_party_invite, get_party
 *   send_cm / on_cm (silent — the default handler spam-logs every CM)
 */

var CONFIG = {
	/** Cooldown-aware movement; false restores legacy positioning. */
	KITE_ENABLED: true,
	KITE_LEASH: 240,
	KITE_PANIC_RATIO: 0.45,
	/** Exact warrior name. Must match in-game. */
	PARTNER: "Eadroma",
	DEFAULT_FARM: "spider",
	FARM_INDEPENDENT: false,

	/** Ranger farmer. Heal them after the warrior. */
	MAGE: "Droma",
	MERCHANT: "EadroSell",
	GIVE_WEAPONS: ["firestaff", "staff"],
	GIVE_ARMOR: ["helmet", "shoes", "coat", "gloves", "pants"],
	KEEP_ITEMS: ["ololipop", "glolipop", "vstaff", "oozingterror", "elixirint0", "ecape"],
	DAILY_DUNGEON: false,
	DAILY_DUNGEON_BUY: false,

	/**
	 * Heal the warrior at or below this HP ratio. Above it, attack and
	 * curse instead. Do not use a raw "missing HP" check on the tank —
	 * that keeps the priest healing at 90%+ forever.
	 */
	HEAL_HP_RATIO: 0.80,
	/** Party Heal if the tank is this low — single-target heal is not enough. */
	PARTYHEAL_WARRIOR_RATIO: 0.70,

	/** Mage / self: also heal if missing this much HP. Not used on the warrior. */
	HEAL_MISSING_HP: 180,

	/** Heal self at the same bar as allies. Don't wait until 55% to start. */
	SELF_HEAL_RATIO: 0.85,
	SELF_HEAL_MISSING: 180,
	/** Heal self first if this low, even when the warrior also wants a heal. */
	SELF_CRITICAL_RATIO: 0.4,

	/**
	 * Stay this close to the warrior so heal still reaches (priest range ~170).
	 * Must sit under the warrior's PRIEST_COVER (175) with margin: at 155 we
	 * parked at 140-155px while he waited for us "in cover" — a deadlock.
	 */
	FOLLOW_RANGE: 140,
	/** Never stand next to the warrior — that is the melee pile. */
	MIN_RANGE: 100,
	/** Pocket behind/beside the tank, outside the pack. */
	ANCHOR: 120,
	/**
	 * Spider range is 32. 110 treated the whole pull as melee and we
	 * walked left/right forever instead of healing. 55 is past spider
	 * reach. Phoenix and Water Spirits shoot from 100+; danger_range
	 * stays short so we stand still, heal, and hit instead of sliding.
	 */
	MELEE_SAFE: 55,
	ANCHOR_SLACK: 24,

	/** Backup HP pot if heal is on cooldown. Do not potion the warrior. */
	SELF_POT_HP_RATIO: 0.35,
	/** Curse only pays for itself on something that lives a while (croc 3200hp, spider 18000). */
	CURSE_MIN_HP: 3000,
	CURSE_KEEP_MP: 40,
	POT_MIN: 40,
	POT_ASK_HP: 80,
	POT_ASK_MP: 120,
	HPOT: "hpot1",
	MPOT: "mpot1",
	POT_BUY: 200,
	POT_CRITICAL: 8,
	POT_STARVE_MS: 45000,
	MLUCK_REFRESH_MS: 600000,
	GOLD_RESERVE: 400,
	GOLD_KEEP: 800,
	CITY: { map: "main", x: 0, y: 0 },
	CITY_WAIT_MS: 180000,
	GEAR_MS: 1500,
	UPGRADE_MAX_LEVEL: 7,
	UPGRADE_MAX_TRIES: 20,
	UPGRADE_TRIP_GOLD: 15000,
	SCROLL_KEEP: 6,
	CSCROLL_KEEP: 4,
	INTSCROLL: "intscroll"
};

var BOARD_CTL = {
	leader: "Eadroma",
	monster: "auto",
	roles: {
		Eadroma: "Leader",
		Aedroma: "Follow",
		Droma: "Follow",
		EadroSell: "Follow",
		Merchant: "Follow"
	},
	events: {
		Eadroma: true,
		Aedroma: true,
		Droma: true,
		EadroSell: false,
		Merchant: false
	}
};
var last_ctl_fetch = 0;

function live_control() {
	if (parent && parent.party_board_control && parent.party_board_control.leader) {
		BOARD_CTL = parent.party_board_control;
	}
	return BOARD_CTL;
}

function apply_ctl(ctl) {
	if (!ctl || !ctl.leader) return;
	BOARD_CTL = ctl;
	if (parent) parent.party_board_control = ctl;
}

function poll_board() {
	if (Date.now() - last_ctl_fetch < 4000) return;
	last_ctl_fetch = Date.now();
	if (typeof fetch !== "function") return;
	fetch("http://127.0.0.1:925/api/control")
		.then(function (r) { return r.json(); })
		.then(function (j) { apply_ctl(j); })
		.catch(function () {});
}

if (typeof SCRIPT_JOB === "undefined") SCRIPT_JOB = "hunt";
var last_job = "";
var last_job_ping = 0;

function my_role() {
	var ctl = live_control();
	var r = ctl.roles && ctl.roles[character.name];
	if (r === "Events") return "Follow";
	return r || "Follow";
}

function events_enabled() {
	var ctl = live_control();
	if (ctl.events && typeof ctl.events[character.name] !== "undefined") return !!ctl.events[character.name];
	if ((ctl.roles && ctl.roles[character.name]) === "Events") return true;
	return true;
}

function server_status() {
	if (typeof server !== "undefined" && server && server.status) return server.status;
	if (parent && parent.S) return parent.S;
	return {};
}

function event_def(name) {
	if (G.events && G.events[name]) return G.events[name];
	if (parent && parent.G && parent.G.events && parent.G.events[name]) return parent.G.events[name];
	return null;
}

function status_is_live(st) {
	if (!st) return false;
	if (st === true) return true;
	if (typeof st !== "object") return !!st;
	if (st.live === false) return false;
	if (st.live) return true;
	if ((st.hp || 0) > 0) return true;
	/** Goo Brawl / A/B Testing publish { end } (or signup_end) with no live/hp. */
	if (st.end) {
		var end_ms = Date.parse(st.end);
		if (!isNaN(end_ms)) return end_ms > Date.now();
		return true;
	}
	if (st.signup_end) {
		var sign_ms = Date.parse(st.signup_end);
		if (!isNaN(sign_ms)) return sign_ms > Date.now();
		return true;
	}
	return false;
}

function in_event_instance(name) {
	var gm = G.maps && G.maps[character.map];
	return !!(gm && gm.event === name);
}

function pick_live_event() {
	var S = server_status();
	if (!S || typeof S !== "object") return null;
	var name;
	var st;
	var def;
	var join_pick = null;
	var boss_pick = null;
	for (name in S) {
		if (name === "schedule") continue;
		st = S[name];
		if (!status_is_live(st)) continue;
		def = event_def(name);
		if (def && def.type === "seasonal" && !def.join) continue;
		if (def && def.join) {
			if (event_has_instance(name)) {
				if (!join_pick) join_pick = { name: name, join: true, map: st && st.map, x: st && st.x, y: st && st.y };
			} else {
				var alive = (st && st.live && (st.hp || 0) > 0) || !!get_nearest_monster({ type: name });
				if (alive && !join_pick) {
					join_pick = { name: name, join: false, map: st && st.map, x: st && st.x, y: st && st.y };
				}
			}
			continue;
		}
		if (get_nearest_monster({ type: name }) || (st && st.map && (st.live || (st.hp || 0) > 0))) {
			if (!boss_pick) boss_pick = { name: name, join: false, map: st && st.map, x: st && st.x, y: st && st.y };
		}
	}
	return join_pick || boss_pick;
}

function event_mtypes(name) {
	if (name === "goobrawl") return ["bgoo", "rgoo"];
	if (name === "abtesting") return [];
	return [name];
}

function event_target(ev) {
	if (!ev) return null;
	var types = event_mtypes(ev.name);
	for (var i = 0; i < types.length; i++) {
		var t = get_nearest_monster({ type: types[i] });
		if (t && !t.rip) return t;
	}
	return null;
}

var last_event_join = {};

/** Maps that are dedicated event instances (Goo Brawl), not open-world bosses. */
function event_has_instance(name) {
	if (!G.maps) return false;
	for (var m in G.maps) {
		if (G.maps[m] && G.maps[m].event === name) return true;
	}
	return false;
}

function near_event_spot(ev, range) {
	if (!ev || !ev.map || ev.x == null || ev.y == null) return false;
	if (character.map !== ev.map) return false;
	return simple_distance(character, { x: ev.x, y: ev.y }) <= (range || 120);
}

async function maybe_run_event() {
	if (!events_enabled()) return false;
	var ev = pick_live_event();
	if (!ev) return false;
	try { set_message("Event " + ev.name); } catch (e) {}
	var tgt = event_target(ev);
	if (tgt) return { ev: ev, tgt: tgt };
	/** Instance events only (goobrawl). Never await join() for Ice Golem — it hangs. */
	if (ev.join && event_has_instance(ev.name) && !in_event_instance(ev.name)) {
		if (Date.now() - (last_event_join[ev.name] || 0) < 4000) return true;
		last_event_join[ev.name] = Date.now();
		try {
			await join(ev.name);
			game_log("join event " + ev.name);
		} catch (e) {
			game_log("join " + ev.name + ": " + ((e && e.reason) || e));
		}
		return true;
	}
	if (ev.map && ev.x != null && ev.y != null) {
		if (!near_event_spot(ev, 120)) {
			if (!smart.moving) await go_to({ map: ev.map, x: ev.x, y: ev.y }, "event " + ev.name);
			return true;
		}
		return false;
	}
	return false;
}

function my_job() {
	var ctl = live_control();
	var j = ctl.scripts && ctl.scripts[character.name];
	if (j === "upgrade" || j === "combine" || j === "hunt") return j;
	if (SCRIPT_JOB === "upgrade" || SCRIPT_JOB === "combine") return SCRIPT_JOB;
	return "hunt";
}

function party_leader() {
	return live_control().leader || CONFIG.PARTNER;
}

function follow_ally() {
	return get_player(party_leader()) || get_player(CONFIG.PARTNER);
}

function regroup_dest() {
	return tank_last_pos() || SPIDER_FARM;
}

/**
 * Where the warrior last said he was (he broadcasts every 4s). Fresh for two
 * minutes; after that he is offline or dead and we wait at the pack instead.
 */
function tank_last_pos() {
	if (!last_pos || !last_pos.map) return null;
	if (Date.now() - (last_pos.at || 0) > 120000) return null;
	return { map: last_pos.map, x: last_pos.x, y: last_pos.y };
}

var working = false;
var last_pos = null;
var last_tgt_id = null;
var last_tank_intent = null;
var last_hunt = null;
var last_daisy_ms = 0;
var last_myhunt_ping = 0;
var hunt_kill_id = "";
var hunt_kill_total = 0;
var hunt_kill_left = 0;
var upgrade_tries = 0;
var last_path_key = "";
var last_go_dest = "";
var last_go_start = 0;
var last_follow_xmove = 0;
var last_gear = 0;
var town_trip = false;
var pots_low_since = 0;
var last_merchant_cm = 0;
var last_mux_sent = 0;
var last_give_at = 0;
var last_give_name = "";
var last_gold_send = 0;
var dump_trip = null;
var dump_backoff = 0;
var vstaff_trip = null;

function path_log(reason, dest) {
	var key = reason + " -> " + dest;
	if (key === last_path_key) return;
	last_path_key = key;
	game_log("path: " + key);
}

function in_caracal() {
	return !!(parent && parent.caracAL);
}

function dest_key(dest) {
	if (dest && typeof dest === "object") {
		return (dest.map || "") + ":" + Math.round(Number(dest.x)) + "," + Math.round(Number(dest.y));
	}
	return String(dest);
}

function door_to(to_map) {
	var doors = G.maps[character.map] && G.maps[character.map].doors;
	if (!doors) return null;
	for (var i = 0; i < doors.length; i++) {
		var d = doors[i];
		if (d && d[4] === to_map) return { x: d[0], y: d[1] };
	}
	return null;
}

var last_door_ms = 0;
var last_town_ms = 0;

/** Main's Halloween door dumps you on a cliff. Village is spawn 0; walk cannot reach it. */
function in_halloween_east_pocket() {
	return character.map === "halloween" && character.x > 900 && character.y > -80 && character.y < 280;
}

function dest_needs_halloween_village(dest) {
	if (dest_goes_spookytown(dest)) return true;
	if (dest_target_map(dest) === "halloween") {
		if (dest && typeof dest === "object" && dest.x > 900) return false;
		return true;
	}
	if (!dest || typeof dest !== "object") return false;
	if (dest.map === "halloween" && dest.x < 900 && dest.y < 200) return true;
	return false;
}

/** Halloween door lands at spawn 1 (32,1404). Town spawn is [0,0]; the walk north is too long for smart_move. */
function in_spookytown_south() {
	return character.map === "spookytown" && character.y > 600;
}

function dest_needs_spookytown_square(dest) {
	if (dest_goes_spookytown(dest)) return true;
	if (!dest || typeof dest !== "object") return false;
	if ((dest.map || character.map) === "spookytown" && dest.y < 400) return true;
	return false;
}

async function town_to_spawn(reason, log) {
	if (character.c && character.c.town) return true;
	if (Date.now() - last_town_ms < 10000) return true;
	last_town_ms = Date.now();
	if (smart.moving) stop_smart();
	path_log(reason, log);
	try { await town(); } catch (e) {}
	return true;
}

async function town_off_halloween_pocket(reason) {
	return town_to_spawn(reason, "town() off halloween east door");
}

/**
 * Spooky Town only opens from Halloween's north door. The east-park
 * landing is a cliff: town() to the village, walk to 784,-1085, use the door.
 */
function route_for_map(dest) {
	if (dest_goes_level1(dest) && character.map !== "level1") {
		if (character.map === "main") {
			var under = door_to("level1") || { x: 1936, y: -23 };
			if (simple_distance(character, under) > 50) return { map: "main", x: under.x, y: under.y + 14 };
			return dest;
		}
		return dest;
	}
	var to_spooky = dest_goes_spookytown(dest);
	if (!to_spooky) {
		if (!dest || typeof dest !== "object" || !dest.map) return dest;
		if (dest.map === character.map) return dest;
		return dest;
	}
	if (character.map === "spookytown") return dest;
	if (character.map === "halloween") {
		var door = door_to("spookytown") || { x: 784, y: -1085 };
		var village = { map: "halloween", x: 0, y: -80 };
		if (character.y > -200 && simple_distance(character, village) > 140) return village;
		return { map: "halloween", x: door.x, y: door.y + 25 };
	}
	/** Mainland door at 1600,-547. smart_move to halloween 1212,80 is the cliff node and fails. */
	if (character.map === "main") {
		var hall = door_to("halloween") || { x: 1600, y: -547 };
		return { map: "main", x: hall.x, y: hall.y + 23 };
	}
	return "halloween";
}

var stuck_xy = null;
var stuck_since = 0;
var smart_retry_at = 0;
var smart_fail_key = "";
var smart_fail_n = 0;
var dest_skip_until = {};
var last_route_switch = 0;

function same_map_xy(dest) {
	return !!(dest && typeof dest === "object" && dest.x != null && (!dest.map || dest.map === character.map));
}

/** Where the live smart_move route is heading, or null. */
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

/**
 * smart_move can stall on a door or a bad node with smart.moving still true.
 * No movement for 8s while "moving" -> kill it and re-plan next tick. Named
 * routes (monster, NPC, map) get a longer leash: the planner itself takes
 * time on big maps.
 */
function watch_stuck() {
	if (!smart.moving) {
		stuck_xy = null;
		return;
	}
	if (smart.searching) return;
	var named = !!(last_go_dest && last_go_dest.indexOf(":") < 0);
	var limit = named ? 30000 : 8000;
	var here = { x: Math.round(character.x), y: Math.round(character.y) };
	if (!stuck_xy || Math.abs(stuck_xy.x - here.x) > 4 || Math.abs(stuck_xy.y - here.y) > 4) {
		stuck_xy = here;
		stuck_since = Date.now();
		return;
	}
	if (Date.now() - stuck_since > limit) {
		game_log("path: stuck on " + last_go_dest + ", re-planning");
		stop_smart();
		smart_retry_at = Date.now() + 1500;
	}
}

/**
 * One move() per destination; re-issuing every 250ms makes the sprite
 * stutter. Never xmove(): when the straight line is blocked it starts an
 * unthrottled smart_move every tick ("Path not found!" spam). If the line is
 * blocked, try a short slide along the wall; return false so the caller can
 * fall back to a throttled smart_move.
 */
function step_toward(x, y) {
	if (character.moving && Math.abs((character.going_x || 0) - x) < 8 && Math.abs((character.going_y || 0) - y) < 8) return true;
	try {
		if (can_move_to(x, y)) {
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
				if (can_move_to(tx, ty)) {
					move(tx, ty);
					return true;
				}
			}
		}
	} catch (e) {}
	return false;
}

/**
 * The one movement entry point. Rules that keep smart_move alive:
 *  - never move() while a route runs unless we stop the route first
 *    (a stray move() is what prints "Lost the path..." and re-plans);
 *  - an active route to (about) the same place is left alone;
 *  - route switches are rate-limited so two callers cannot fight;
 *  - a destination that fails to plan three times is skipped for 30s
 *    instead of being retried forever.
 * `range` is an arrival radius: within it we stop and return.
 */
async function go_to(dest, reason, range, smartOnly) {
	ALCombat.release();
	if (character.c && character.c.town) return;
	if (in_halloween_east_pocket() && dest_needs_halloween_village(dest)) {
		await town_off_halloween_pocket(reason);
		return;
	}
	if (in_spookytown_south() && dest_needs_spookytown_square(dest)) {
		await town_to_spawn(reason, "town() off spookytown south door");
		return;
	}
	if (character.map === "main" && dest_goes_level1(dest)) {
		var under = door_to("level1") || { x: 1936, y: -23 };
		if (simple_distance(character, under) < 50) {
			path_log(reason, "main door to level1");
			if (smart.moving) stop_smart();
			if (Date.now() - last_door_ms < 2000) return;
			last_door_ms = Date.now();
			try { await use_nearest_door(); } catch (e) {}
			return;
		}
		dest = { map: "main", x: under.x, y: under.y + 14 };
		range = 20;
	}
	if (character.map === "main" && dest_goes_spookytown(dest)) {
		var hall_door = door_to("halloween") || { x: 1600, y: -547 };
		if (simple_distance(character, hall_door) < 50) {
			path_log(reason, "main door to halloween");
			if (smart.moving) stop_smart();
			if (Date.now() - last_door_ms < 2000) return;
			last_door_ms = Date.now();
			try { await use_nearest_door(); } catch (e) {}
			return;
		}
		dest = { map: "main", x: hall_door.x, y: hall_door.y + 23 };
		range = 20;
	}
	var want_spooky = !!(character.map === "halloween" && dest_goes_spookytown(dest));
	if (want_spooky) {
		var spooky_door = door_to("spookytown") || { x: 784, y: -1085 };
		if (simple_distance(character, spooky_door) < 45) {
			path_log(reason, "halloween door to spookytown");
			if (smart.moving) stop_smart();
			if (Date.now() - last_door_ms < 2000) return;
			last_door_ms = Date.now();
			try { await use_nearest_door(); } catch (e) {}
			return;
		}
		dest = { map: "halloween", x: spooky_door.x, y: spooky_door.y + 18 };
		range = 18;
	}
	dest = route_for_map(dest);
	var where = dest;
	var p = same_map_xy(dest) ? dest : null;
	if (dest && typeof dest === "object") {
		/** Coarse in the log so a moving target does not print every tick. */
		where = (dest.map || character.map) + " " + Math.round(dest.x / 50) * 50 + "," + Math.round(dest.y / 50) * 50;
	}
	path_log(reason, where);
	var key = dest_key(dest);
	if (p && range && simple_distance(character, p) <= range) {
		stop_smart();
		return;
	}
	if (smart.moving) {
		if (last_go_dest === key) return;
		var st = smart_target();
		var obj = dest && typeof dest === "object" && dest.x != null ? dest : null;
		if (obj && st && st.map === (obj.map || character.map)) {
			/** Chasing a moving target: keep the live route while it still points about the right way. */
			var slack = p ? Math.max(80, simple_distance(character, p) * 0.5) : 400;
			if (simple_distance(st, obj) < slack) {
				last_go_dest = key;
				return;
			}
		}
		if (Date.now() - last_route_switch < 1500) return;
		last_route_switch = Date.now();
		stop_smart();
	}
	if (p && !smartOnly) {
		if (can_move_to(p.x, p.y)) {
			step_toward(p.x, p.y);
			return;
		}
		if (simple_distance(character, p) <= 140 && step_toward(p.x, p.y)) return;
	}
	if (Date.now() < smart_retry_at) return;
	if (dest_skip_until[key] && Date.now() < dest_skip_until[key]) return;
	last_go_dest = key;
	last_go_start = Date.now();
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
				game_log("path: cannot reach " + where + " (" + (why || "failed") + "), skip 30s");
			}
		});
	} catch (e) {}
}

function sleep_ms(ms) {
	return new Promise(function (ok) { setTimeout(ok, ms); });
}

/** Same-map point: direct move when the line is clear, else the planner. */
async function walk_to(x, y, reason) {
	await go_to({ x: x, y: y }, reason);
}

var CRAB_FARM = { map: "main", x: -1202, y: -66 };
var CRAB_BOX = { x1: -1353, y1: -254, x2: -1052, y2: 122 };
/**
 * Beach north of the croc box [696,1498,906,1922]. Wait here, not in the
 * pack. The shore wall is x=696, so 640,1460 was in the sea (unreachable).
 */
var CROC_FARM = { map: "main", x: 740, y: 1460 };
var SPIDER_FARM = { map: "main", x: 948, y: -144 };

function in_crab_box(e) {
	if (!e) return false;
	var pad = 24;
	return e.x >= CRAB_BOX.x1 - pad && e.x <= CRAB_BOX.x2 + pad && e.y >= CRAB_BOX.y1 - pad && e.y <= CRAB_BOX.y2 + pad;
}

function pick_crab() {
	var current = get_targeted_monster();
	if (current && current.mtype === "crab" && current.hp > 0 && in_crab_box(current)) {
		if (!current.target || current.target === character.name) return current;
	}
	var mine = null;
	var mine_hp = 1e15;
	var near = null;
	var near_d = 1e15;
	var other = null;
	var other_hp = 1e15;
	for (var id in parent.entities) {
		var e = parent.entities[id];
		if (!e || e.type !== "monster" || e.rip || e.mtype !== "crab") continue;
		if (!in_crab_box(e)) continue;
		if (e.target === character.name) {
			if (e.hp < mine_hp) {
				mine_hp = e.hp;
				mine = e;
			}
			continue;
		}
		if (e.target && is_ally(e.target)) {
			if (e.hp < other_hp) {
				other_hp = e.hp;
				other = e;
			}
			continue;
		}
		if (e.target) continue;
		var d = distance(character, e);
		if (d < near_d) {
			near_d = d;
			near = e;
		}
	}
	return mine || near || other;
}

function hunt_join_type() {
	if (!last_hunt || !last_hunt.id) return "";
	if (Date.now() - last_hunt.at > 90000) return "";
	return last_hunt.id;
}

function tank_pull_type(tank) {
	var tt = tank_target(tank);
	if (tt && tt.mtype) return tt.mtype;
	if (!tank || tank.rip) return "";
	for (var id in parent.entities) {
		var e = parent.entities[id];
		if (!e || e.type !== "monster" || e.rip) continue;
		if (e.target === tank.name) return e.mtype;
	}
	return "";
}

/** What to fight: Daisy hunt the warrior is tanking, else whatever he is holding. */
function combat_mtype(tank) {
	var join = hunt_join_type();
	if (join && !CONFIG.FARM_INDEPENDENT) return join;
	if (CONFIG.FARM_INDEPENDENT) return CONFIG.DEFAULT_FARM || "spider";
	var pulled = tank_pull_type(tank);
	if (pulled) return pulled;
	return CONFIG.DEFAULT_FARM || "spider";
}

function hunt_info() {
	var h = character.s && character.s.monsterhunt;
	if (!h || !h.id) return null;
	return h;
}

function hunt_monster_name(id) {
	var def = G.monsters && G.monsters[id];
	return (def && def.name) || id || "?";
}

function maybe_log_hunt_kill() {
	var h = hunt_info();
	if (!h || !h.id) {
		hunt_kill_id = "";
		hunt_kill_total = 0;
		hunt_kill_left = 0;
		return;
	}
	var left = h.c || 0;
	if (h.id !== hunt_kill_id || left > hunt_kill_left) {
		hunt_kill_id = h.id;
		hunt_kill_total = left;
		hunt_kill_left = left;
		return;
	}
	if (left < hunt_kill_left) {
		game_log("Hunt: " + hunt_monster_name(h.id) + " " + (hunt_kill_total - left) + " killed / " + hunt_kill_total + " total");
		hunt_kill_left = left;
	}
}

function daisy_need() {
	var h = hunt_info();
	return !h || h.c === 0;
}

function near_daisy() {
	if (character.map !== "main") return false;
	var p = npc_xy("monsterhunter");
	if (!p) p = { x: 126, y: -413 };
	return simple_distance(character, p) < 350;
}

async function ping_myhunt() {
	if (Date.now() - last_myhunt_ping < 2000) return;
	last_myhunt_ping = Date.now();
	var h = hunt_info();
	var msg = {
		t: "myhunt",
		id: (h && h.id) || "",
		c: h ? (h.c || 0) : 0,
		need: daisy_need() ? 1 : 0
	};
	try { await send_cm(CONFIG.PARTNER, msg); } catch (e) {}
}

async function maybe_daisy() {
	if (CONFIG.FARM_INDEPENDENT) return false;
	if (!daisy_need() || !near_daisy()) return false;
	if (Date.now() - last_daisy_ms < 8000) return true;
	last_daisy_ms = Date.now();
	try {
		var result = await interact("monsterhunt", 8000);
		if (result && result.completed) {
			game_log("hunt turned in, Monster Token");
			await sleep_ms(400);
			result = await interact("monsterhunt", 8000);
		}
		if (result && result.started) {
			var nh = hunt_info();
			game_log("hunt started: " + ((nh && nh.id) || "?") + " x" + ((nh && nh.c) || 0));
		}
	} catch (e) {
		game_log("daisy: " + (e.reason || e.message || e));
	}
	return true;
}

function hunt_packs(mtype) {
	var out = [];
	for (var name in G.maps) {
		var gm = G.maps[name];
		if (!gm || gm.ignore || gm.instance || !gm.monsters) continue;
		for (var i = 0; i < gm.monsters.length; i++) {
			var pack = gm.monsters[i];
			if (pack.type !== mtype) continue;
			if (mtype === "booboo" && pack.boundary && (pack.boundary[0] + pack.boundary[2]) / 2 < 0) continue;
			if (mtype === "stoneworm" && pack.boundary && (pack.boundary[1] + pack.boundary[3]) / 2 < 0) continue;
			if (pack.boundary) out.push({ map: name, b: pack.boundary });
			else if (pack.boundaries) {
				for (var j = 0; j < pack.boundaries.length; j++) {
					var bb = pack.boundaries[j];
					out.push({ map: bb[0], b: [bb[1], bb[2], bb[3], bb[4]] });
				}
			}
		}
	}
	return out;
}

function named_hunt_map(mtype) {
	if (!mtype || typeof mtype !== "string") return "";
	var packs = hunt_packs(mtype);
	if (!packs.length) return "";
	var prefer = ["spookytown", "halloween", "main", "desertland", "winterland", "level1", "level2s"];
	for (var p = 0; p < prefer.length; p++) {
		for (var i = 0; i < packs.length; i++) {
			if (packs[i].map === prefer[p]) return prefer[p];
		}
	}
	return packs[0].map;
}

function dest_target_map(dest) {
	if (typeof dest === "string") return named_hunt_map(dest);
	if (dest && typeof dest === "object") return dest.map || "";
	return "";
}

function dest_goes_spookytown(dest) {
	return dest_target_map(dest) === "spookytown";
}

function dest_goes_level1(dest) {
	return dest_target_map(dest) === "level1";
}

function pack_box(b) {
	return {
		x1: Math.min(b[0], b[2]),
		y1: Math.min(b[1], b[3]),
		x2: Math.max(b[0], b[2]),
		y2: Math.max(b[1], b[3])
	};
}

function inside_box(who, box) {
	return who.x >= box.x1 && who.x <= box.x2 && who.y >= box.y1 && who.y <= box.y2;
}

function map_spawn(map) {
	var gm = G.maps[map];
	if (gm && gm.spawns && gm.spawns[0]) return { x: gm.spawns[0][0], y: gm.spawns[0][1] };
	return { x: 0, y: 0 };
}

function edge_outside(b, from, pad) {
	var box = pack_box(b);
	var cx = (box.x1 + box.x2) / 2;
	var cy = (box.y1 + box.y2) / 2;
	var fx = from.x;
	var fy = from.y;
	var px;
	var py;
	if (inside_box(from, box)) {
		var dL = fx - box.x1;
		var dR = box.x2 - fx;
		var dT = fy - box.y1;
		var dB = box.y2 - fy;
		var m = Math.min(dL, dR, dT, dB);
		if (m === dL) { px = box.x1; py = fy; }
		else if (m === dR) { px = box.x2; py = fy; }
		else if (m === dT) { px = fx; py = box.y1; }
		else { px = fx; py = box.y2; }
	} else {
		px = Math.max(box.x1, Math.min(box.x2, fx));
		py = Math.max(box.y1, Math.min(box.y2, fy));
	}
	var dx = px - cx;
	var dy = py - cy;
	var len = Math.sqrt(dx * dx + dy * dy) || 1;
	return { x: px + (dx / len) * pad, y: py + (dy / len) * pad };
}

function hunt_wait(mtype) {
	var packs = hunt_packs(mtype);
	if (!packs.length) return null;
	var best = null;
	var best_d = 1e15;
	for (var i = 0; i < packs.length; i++) {
		var pk = packs[i];
		var box = pack_box(pk.b);
		var from = map_spawn(pk.map);
		if (character.map === pk.map && !inside_box(character, box)) {
			from = { x: character.x, y: character.y };
		}
		var p = edge_outside(pk.b, from, 80);
		p.map = pk.map;
		var d = (character.map === pk.map ? 0 : 100000) + simple_distance(from, p);
		if (d < best_d) {
			best_d = d;
			best = p;
		}
	}
	return best;
}

function inside_hunt_pack(who, mtype) {
	if (!who) return false;
	var packs = hunt_packs(mtype);
	for (var i = 0; i < packs.length; i++) {
		if (packs[i].map !== (who.map || character.map)) continue;
		if (inside_box(who, pack_box(packs[i].b))) return true;
	}
	return false;
}

function farm_types(mtype) {
	if (mtype === "greenjr") return ["greenjr", "snake", "osnake"];
	if (mtype === "snake") return ["snake", "osnake"];
	return [mtype];
}

function is_hunt_mob(e, mtype) {
	return !!(e && e.type === "monster" && !e.rip && farm_types(mtype).indexOf(e.mtype) >= 0);
}

function pack_is_passive(mtype) {
	var def = G.monsters && G.monsters[mtype];
	/** Pom Poms are 0.05 aggro; treat low-aggro hunts like frogs. */
	return !!(def && !(def.aggro > 0.1));
}

function tank_target(tank) {
	if (!tank || tank.rip || !tank.target) return null;
	var e = get_entity(tank.target);
	if (e && e.type === "monster" && !e.rip) return e;
	return null;
}

function tank_is_pulling(tank, mtype) {
	if (!tank || tank.rip) return false;
	if (tank_target(tank)) return true;
	for (var id in parent.entities) {
		var e = parent.entities[id];
		if (!e || e.type !== "monster" || e.rip) continue;
		if (e.target === tank.name) return true;
	}
	/** Frogs and other aggro-0 packs never steal: standing in the box is the pull. */
	if (mtype && pack_is_passive(mtype) && inside_hunt_pack(tank, mtype)) return true;
	return false;
}

/** go_to gave up on this xy three times in a row (water, wall pocket, other side of a cliff). */
function dest_skipped(dest) {
	if (!dest || dest.x == null) return false;
	var until = dest_skip_until[dest_key(dest)];
	return !!(until && Date.now() < until);
}

function hunt_dest(mtype) {
	/** smart_move("cgoo") resolves to arena — use Underground South curb. */
	if (mtype === "cgoo") return { map: "level2s", x: -70, y: 500 };
	if (mtype === "prat") return { map: "level1", x: -110, y: 110 };
	if (mtype === "minimush") {
		var mush = { map: "halloween", x: 70, y: 640 };
		if (character.map === "halloween" && !dest_skipped(mush)) return mush;
		return "minimush";
	}
	if (mtype === "booboo") {
		var curb = { map: "spookytown", x: 200, y: -620 };
		var pack = get_nearest_monster({ type: "booboo" });
		var see = !!(pack && !pack.rip && distance(character, pack) < 280);
		if (character.map === "spookytown" && (see || simple_distance(character, curb) < 140) && !dest_skipped(curb)) return curb;
		return "booboo";
	}
	if (mtype === "stoneworm") {
		var worm = { map: "spookytown", x: 490, y: 130 };
		if (character.map === "spookytown" && !dest_skipped(worm)) return worm;
		return "stoneworm";
	}
	return mtype;
}

function report_hunt_fail() {
	var id = hunt_join_type();
	if (!id) return;
	try { send_cm(CONFIG.PARTNER, { t: "huntfail", id: id }); } catch (e) {}
}

function hunt_spot(mtype) {
	if (mtype === "croc") return CROC_FARM;
	if (mtype === "crab") return CRAB_FARM;
	if (mtype === "goo") return { map: "main", x: -32, y: 787 };
	if (mtype === "spider") return { map: "main", x: 948, y: -144 };
	if (mtype === "bat") return { map: "cave", x: -194, y: -461 };
	if (mtype === "snake") return { map: "halloween", x: -569, y: -512 };
	if (mtype === "jr") return { map: "spookytown", x: -784, y: -301 };
	if (mtype === "greenjr") return { map: "halloween", x: -569, y: -512 };
	if (mtype === "minimush") return { map: "halloween", x: 70, y: 640 };
	if (mtype === "arcticbee") return { map: "winterland", x: 1082, y: -873 };
	if (mtype === "iceroamer") return { map: "winterland", x: 824, y: -45 };
	if (mtype === "scorpion") return { map: "main", x: 1578, y: -80 };
	if (mtype === "bigbird") return { map: "main", x: 1088, y: 248 };
	if (mtype === "crabx") return { map: "main", x: -984, y: 1762 };
	if (mtype === "booboo") return { map: "spookytown", x: 200, y: -620 };
	if (mtype === "stoneworm") return { map: "spookytown", x: 490, y: 130 };
	var maps = [character.map, "main"];
	for (var mi = 0; mi < maps.length; mi++) {
		var m = G.maps[maps[mi]];
		if (!m || !m.monsters) continue;
		for (var i = 0; i < m.monsters.length; i++) {
			var pack = m.monsters[i];
			if (pack.type !== mtype) continue;
			var b = pack.boundary;
			if (!b && pack.boundaries && pack.boundaries.length) {
				var bb = pack.boundaries[0];
				return { map: bb[0], x: (bb[1] + bb[3]) / 2, y: (bb[2] + bb[4]) / 2 };
			}
			if (b) return { map: maps[mi], x: (b[0] + b[2]) / 2, y: (b[1] + b[3]) / 2 };
		}
	}
	if (last_hunt && last_hunt.map && last_hunt.x != null) {
		return { map: last_hunt.map, x: last_hunt.x, y: last_hunt.y };
	}
	return { map: "main", x: 0, y: 0 };
}

function pick_type(mtype) {
	var current = get_targeted_monster();
	if (current && current.mtype === mtype && current.hp > 0) {
		if (!current.target || is_ally(current.target) || current.target === character.name) return current;
	}
	var mine = null;
	var mine_hp = 1e15;
	var near = null;
	var near_d = 1e15;
	var other = null;
	var other_hp = 1e15;
	for (var id in parent.entities) {
		var e = parent.entities[id];
		if (!e || e.type !== "monster" || e.rip || e.mtype !== mtype) continue;
		if (e.target === character.name) {
			if (e.hp < mine_hp) {
				mine_hp = e.hp;
				mine = e;
			}
			continue;
		}
		if (e.target && is_ally(e.target)) {
			if (e.hp < other_hp) {
				other_hp = e.hp;
				other = e;
			}
			continue;
		}
		if (e.target) continue;
		var d = distance(character, e);
		if (d < near_d) {
			near_d = d;
			near = e;
		}
	}
	return mine || near || other;
}

function find_jr() {
	var best = null;
	for (var id in parent.entities) {
		var e = parent.entities[id];
		if (!e || e.type !== "monster" || e.rip) continue;
		if (e.mtype !== "jr" && e.mtype !== "greenjr") continue;
		if (!best || e.hp < best.hp) best = e;
	}
	return best;
}

function find_phoenix() {
	var p = get_nearest_monster({ type: "phoenix" });
	if (p && !p.rip && p.hp > 0) return p;
	return null;
}

function pick_pulled(mtype, tank) {
	var rare = find_jr() || find_phoenix();
	if (rare) return rare;
	var current = get_targeted_monster();
	if (current && is_hunt_mob(current, mtype) && current.hp > 0) {
		if (current.target === character.name || is_ally(current.target)) return current;
	}
	var tt = tank_target(tank);
	if (is_hunt_mob(tt, mtype)) return tt;
	var mine = null;
	var mine_hp = 1e15;
	var ally = null;
	var ally_hp = 1e15;
	var near = null;
	var near_d = 1e15;
	for (var id in parent.entities) {
		var e = parent.entities[id];
		if (!is_hunt_mob(e, mtype)) continue;
		if (e.target === character.name && e.hp < mine_hp) {
			mine_hp = e.hp;
			mine = e;
		} else if (e.target && is_ally(e.target) && e.hp < ally_hp) {
			ally_hp = e.hp;
			ally = e;
		} else if (!e.target && pack_is_passive(mtype)) {
			var d = distance(character, e);
			if (d < near_d) {
				near_d = d;
				near = e;
			}
		}
	}
	var scored = ALCombat.bestTarget(ALCombat.snapshot().monsters, { preferredType: mtype, current: current && current.id, allowed: function (candidate) { return is_hunt_mob(candidate, mtype) && (!candidate.target || is_ally(candidate.target)); } });
	return mine || ally || scored || near;
}

/**
 * Warrior off-screen: walk to where he last said he was. Do not throw that
 * away when our guessed pack (often default spiders on main) is a different
 * map. Only when we have not heard from him for two minutes do we fall
 * back to the pack wait spot, and never from Halloween/Spooky Town to
 * main spiders.
 */
async function catch_tank(mtype) {
	var seen = tank_last_pos();
	if (seen) {
		await go_to(seen, "catch " + CONFIG.PARTNER, 100, true);
		return;
	}
	if (last_hunt && last_hunt.map && last_hunt.x != null && Date.now() - (last_hunt.at || 0) < 120000) {
		await go_to({ map: last_hunt.map, x: last_hunt.x, y: last_hunt.y }, "catch hunt " + mtype, 100, true);
		return;
	}
	if (mtype === "spider" && character.map !== "main") {
		if (character.map === "halloween") {
			await go_to({ map: "spookytown", x: 490, y: 130 }, "rejoin via spookytown door", 40, true);
		}
		return;
	}
	var dest = hunt_dest(mtype);
	if (typeof dest === "string" || (dest && simple_distance(character, dest) > 55)) {
		await go_to(dest, "wait pull " + mtype, undefined, true);
	}
}

async function hunt_fight(mtype, tank) {
	if (CONFIG.FARM_INDEPENDENT) tank = null;
	if (!find_jr() && !find_phoenix() && !tank_is_pulling(tank, mtype)) {
		if (tank && !tank.rip && character.map === tank.map) {
			if (can_heal(tank) && tank.hp < tank.max_hp) {
				try { await heal(tank); } catch (e) {}
			}
			/** He is walking into the pack to pull: hold at the edge unless he gets far. */
			if (inside_hunt_pack(tank, mtype) && distance(character, tank) <= CONFIG.FOLLOW_RANGE + 60) return;
			await follow_at_range(tank);
			return;
		}
		if (CONFIG.FARM_INDEPENDENT) await go_to(hunt_dest(mtype), "farm " + mtype, undefined, true);
		else await catch_tank(mtype);
		return;
	}
	var monster = find_phoenix() || pick_pulled(mtype, tank);
	if (!monster) {
		if (tank && character.map === tank.map) {
			await follow_at_range(tank);
		}
		return;
	}
	if (tank && needs_heal(tank) && can_heal(tank)) {
		try { await heal(tank); } catch (e) {}
		return;
	}
	if (!ALCombat.engage(monster, tank) && await keep_ranged(monster, tank)) return;
	change_target(monster);
	await maybe_priest_skills(monster, tank);
	if (is_in_range(monster) && distance(character, monster) >= danger_range(monster) && can_attack(monster)) {
		await attack(monster);
	}
}

function point_away(from, toward, range) {
	var dx = from.x - toward.x;
	var dy = from.y - toward.y;
	var len = Math.sqrt(dx * dx + dy * dy) || 1;
	return {
		x: toward.x + (dx / len) * range,
		y: toward.y + (dy / len) * range
	};
}

function dist2(a, b) {
	var dx = a.x - b.x;
	var dy = a.y - b.y;
	return Math.sqrt(dx * dx + dy * dy);
}

/** True if the monster sits on the straight line we would walk. */
function mob_on_path(from, to, monster, pad) {
	if (!monster || !to) return false;
	var abx = to.x - from.x;
	var aby = to.y - from.y;
	var ab2 = abx * abx + aby * aby;
	if (ab2 < 1) return dist2(from, monster) < pad;
	var t = ((monster.x - from.x) * abx + (monster.y - from.y) * aby) / ab2;
	if (t <= 0 || t >= 1) return false;
	var px = from.x + t * abx;
	var py = from.y + t * aby;
	return dist2(monster, { x: px, y: py }) < pad;
}

function danger_range(monster) {
	var r = 32;
	if (monster) {
		if (monster.range) r = monster.range;
		else if (G.monsters && G.monsters[monster.mtype] && G.monsters[monster.mtype].range) {
			r = G.monsters[monster.mtype].range;
		}
	}
	/** Phoenix 120 and Water Spirit packs: cannot stand outside shot
	 *  range and still heal the tank. 108 on iceroamer was the spider
	 *  slide bug again — walk every tick, never heal or attack. */
	if (r >= 80) return 42;
	return CONFIG.MELEE_SAFE;
}

var last_pocket_tag = "";
var last_pocket_at = 0;

/**
 * Pocket beside/behind the tank. Never the far side of the monster
 * (that is what caused in-and-out with follow). Stick to one side so
 * left/right scores do not flip every tick.
 */
function heal_anchor(warrior, monster) {
	if (last_tank_intent && Date.now() - last_tank_intent.at < 2500 && last_tank_intent.map === character.map) warrior = Object.assign({}, warrior, {x:last_tank_intent.x,y:last_tank_intent.y});
	var want = Math.max(CONFIG.ANCHOR, CONFIG.MELEE_SAFE + 20);
	if (!monster) {
		return point_away(character, warrior, Math.min(CONFIG.FOLLOW_RANGE - 15, want));
	}
	var pad = danger_range(monster);
	var dx = warrior.x - monster.x;
	var dy = warrior.y - monster.y;
	var len = Math.sqrt(dx * dx + dy * dy) || 1;
	dx /= len;
	dy /= len;
	var fx = -dy;
	var fy = dx;
	var cands = [
		{ x: warrior.x + dx * want, y: warrior.y + dy * want, tag: "behind tank" },
		{ x: warrior.x + fx * want, y: warrior.y + fy * want, tag: "left of tank" },
		{ x: warrior.x - fx * want, y: warrior.y - fy * want, tag: "right of tank" }
	];
	if (last_pocket_tag && Date.now() - last_pocket_at < 4000) {
		for (var s = 0; s < cands.length; s++) {
			if (cands[s].tag === last_pocket_tag && dist2(cands[s], monster) >= pad - 8) {
				last_pocket_at = Date.now();
				return cands[s];
			}
		}
	}
	var best = null;
	var best_score = -1e9;
	for (var i = 0; i < cands.length; i++) {
		var c = cands[i];
		var to_mob = dist2(c, monster);
		if (to_mob < pad) continue;
		var to_me = dist2(character, c);
		var crosses = mob_on_path(character, c, monster, pad) ? 400 : 0;
		var score = to_mob - to_me - crosses;
		if (score > best_score) {
			best_score = score;
			best = c;
		}
	}
	if (!best) {
		var far = pad + 50;
		best = { x: warrior.x + dx * far, y: warrior.y + dy * far, tag: "far behind tank" };
	}
	last_pocket_tag = best.tag;
	last_pocket_at = Date.now();
	return best;
}

async function follow_at_range(ally) {
	var dist = distance(character, ally);
	if (dist > CONFIG.FOLLOW_RANGE) {
		if (dist > CONFIG.FOLLOW_RANGE + 120 && typeof xmove === "function" && character.map === ally.map && Date.now() - last_follow_xmove > 1200) {
			last_follow_xmove = Date.now();
			stop_smart();
			try { xmove(ally); return true; } catch (e) {}
		}
		/** Aim for the middle of the band so a few px of drift does not re-trigger either edge. */
		var p = point_away(character, ally, (CONFIG.FOLLOW_RANGE + CONFIG.MIN_RANGE) / 2);
		await walk_to(p.x, p.y, "follow " + ally.name + " (too far)");
		return true;
	}
	if (dist < CONFIG.MIN_RANGE) {
		var p = point_away(character, ally, (CONFIG.FOLLOW_RANGE + CONFIG.MIN_RANGE) / 2);
		await walk_to(p.x, p.y, "back off " + ally.name + " (too close)");
		return true;
	}
	return false;
}

async function hold_heal_pocket(warrior, monster) {
	if (!monster) return follow_at_range(warrior);
	var pad = danger_range(monster);
	var d_mob = distance(character, monster);
	var d_tank = warrior ? distance(character, warrior) : 9999;
	if (warrior && needs_heal(warrior) && can_heal(warrior)) return false;
	if (d_tank <= CONFIG.FOLLOW_RANGE && d_mob >= pad && can_heal(warrior)) return false;
	if (is_in_range(monster) && d_mob >= pad) return false;
	if (d_mob < pad) {
		var slide = heal_anchor(warrior, monster);
		if (dist2(character, slide) <= CONFIG.ANCHOR_SLACK) return false;
		await walk_to(slide.x, slide.y, "slide off " + (monster.mtype || "mob") + " to " + slide.tag);
		return true;
	}
	if (distance(character, warrior) < CONFIG.MIN_RANGE) {
		var p = point_away(character, warrior, CONFIG.MIN_RANGE + 20);
		await walk_to(p.x, p.y, "back off " + warrior.name);
		return true;
	}
	if (d_tank <= CONFIG.FOLLOW_RANGE && d_mob >= pad && can_heal(warrior)) {
		return false;
	}
	var dest = heal_anchor(warrior, monster);
	if (dist2(character, dest) <= CONFIG.ANCHOR_SLACK) return false;
	await walk_to(dest.x, dest.y, dest.tag);
	return true;
}

function monster_on_me() {
	var best = null;
	var best_d = 1e15;
	for (var id in parent.entities) {
		var e = parent.entities[id];
		if (!e || e.type !== "monster" || e.rip) continue;
		if (e.target !== character.name) continue;
		var d = distance(character, e);
		if (d < best_d) {
			best_d = d;
			best = e;
		}
	}
	return best;
}

async function keep_off_melee(tank) {
	var mob = monster_on_me();
	if (mob && distance(character, mob) < danger_range(mob)) {
		var dest = tank ? heal_anchor(tank, mob) : point_away(character, mob, CONFIG.MELEE_SAFE + 40);
		if (dist2(character, dest) <= CONFIG.ANCHOR_SLACK) return false;
		await walk_to(dest.x, dest.y, "kite " + (mob.mtype || "mob"));
		return true;
	}
	return false;
}

/** Never walk onto a monster or the tank. Stay at heal range. */
async function keep_ranged(monster, tank) {
	if (await keep_off_melee(tank)) return true;
	if (tank && await hold_heal_pocket(tank, monster)) return true;
	if (monster && !is_in_range(monster)) {
		var want = Math.max(CONFIG.MELEE_SAFE + 30, (character.range || 160) - 30);
		var dest = point_away(character, monster, want);
		await walk_to(dest.x, dest.y, "range on " + (monster.mtype || "mob"));
		return true;
	}
	return false;
}

/**
 * Override the shipped on_cm. The default implementation logs
 * "Received a code message from: NAME" on every ping.
 * Signature: on_cm(name, data) — data is the payload, not {name, message}.
 */
function on_cm(name, data) {
	if (name === CONFIG.MERCHANT) {
		last_merchant_cm = Date.now();
		if (!data || typeof data !== "object") return;
		if (data.t === "mux") {
			last_mux_sent = 0;
			ping_merchant();
		}
		if (data.t === "vstaff") {
			if (!vstaff_trip) {
				vstaff_trip = { started: Date.now() };
				game_log("city: mule has vstaff");
			}
		}
	}
	if (!is_ally(name) && name !== CONFIG.MERCHANT) return;
	if (!data || typeof data !== "object") return;
	if (data.t === "ctl") apply_ctl(data.ctl);
	if (data.t === "pos" && typeof data.map === "string") {
		last_pos = { map: data.map, x: data.x, y: data.y, at: Date.now() };
	}
	if (data.t === "tgt" && data.id) last_tgt_id = data.id;
	if (data.t === "intent" && data.id) { last_tgt_id = data.id; last_tank_intent = {id:data.id,phase:data.phase||"engage",map:data.map,x:data.x,y:data.y,at:Date.now()}; }
	if (data.t === "hunt") {
		last_hunt = {
			id: data.id || "",
			c: data.c || 0,
			try: data.try ? 1 : 0,
			at: Date.now(),
			map: data.map,
			x: data.x,
			y: data.y
		};
	}
	if (typeof CaveDreams !== "undefined") CaveDreams.onCm(name, data);
}

function on_party_invite(name) {
	if (is_ally(name) || name === party_leader()) accept_party_invite(name);
}

function on_party_request(name) {
	if (is_ally(name) || name === party_leader()) accept_party_request(name);
}

function is_ally(name) {
	if (!name) return false;
	if (name === character.name || name === CONFIG.PARTNER) return true;
	if (CONFIG.MAGE && name === CONFIG.MAGE) return true;
	if (name === CONFIG.MERCHANT) return true;
	var party = get_party();
	return !!(party && party[name]);
}

setInterval(async function () {
	if (working) return;
	working = true;
	try {
		await tick();
	} catch (error) {
		game_log("priest: " + (error.reason || error.message || error));
	} finally {
		working = false;
	}
}, 250);

async function tick() {
	poll_board();
	ALCombat.background([ping_merchant, ping_myhunt]);
	if (character.rip) {
		if (typeof CaveDreams !== "undefined" && CaveDreams.inCave()) {
			await CaveDreams.tick("follow");
			return;
		}
		report_hunt_fail();
		await respawn();
		return;
	}
	watch_stuck();
	maybe_self_potion();
	var urgentTank = get_player(CONFIG.PARTNER) || follow_ally();
	var urgentTarget = monster_on_me() || (urgentTank && urgentTank.target && get_entity(urgentTank.target));
	if (!urgentTarget && urgentTank) urgentTarget = get_nearest_monster({ target: urgentTank.name });
	if (urgentTarget) ALCombat.engage(urgentTarget, urgentTank);
	// Healing does not consume the movement update, even during attack cooldown.
	if (await maybe_partyheal(urgentTank) || await maybe_heal_party(urgentTank)) return;
	if (await close_to_heal(urgentTank, CONFIG.MAGE ? get_player(CONFIG.MAGE) : null)) return;

	maybe_log_hunt_kill();
	if (!ALCombat.inDanger() && await maybe_pickup_vstaff()) return;
	if (!ALCombat.inDanger()) await maybe_ensure_gear();
	await maybe_drink_elixir();
	maybe_self_potion();
	loot();
	await maybe_give_lolipops();
	if (await run_script_job()) return;
	if (typeof CaveDreams !== "undefined" && await CaveDreams.tick("follow")) return;
	if (!wants_dump() && !vstaff_trip && !ALCombat.inDanger() && await maybe_daisy()) return;
	var evrun = await maybe_run_event();
	if (evrun) {
		var tank = get_player(CONFIG.PARTNER) || follow_ally();
		if (await maybe_partyheal(tank)) return;
		if (await maybe_heal_party(tank)) return;
		if (evrun.tgt) {
			change_target(evrun.tgt);
			await maybe_priest_skills(evrun.tgt, tank);
			if (!ALCombat.engage(evrun.tgt, tank) && !is_in_range(evrun.tgt)) {
				await go_to({ map: character.map, x: evrun.tgt.x, y: evrun.tgt.y }, "event " + (evrun.tgt.mtype || "boss"), 40);
				return;
			}
			if (can_attack(evrun.tgt)) await attack(evrun.tgt);
		}
		return;
	}
	if (near_npc("fancypots") || near_npc("craftsman")) await shop_here();
	if (await maybe_refill_pots()) return;

	var tank = get_player(CONFIG.PARTNER) || follow_ally();
	var mage = CONFIG.MAGE ? get_player(CONFIG.MAGE) : null;
	if (await close_to_heal(tank, mage)) {
		if (merchant_here()) await maybe_trade_merchant();
		return;
	}
	if (await maybe_partyheal(tank)) {
		if (merchant_here()) await maybe_trade_merchant();
		return;
	}
	if (await maybe_heal_party(tank)) {
		if (merchant_here()) await maybe_trade_merchant();
		return;
	}
	if (await maybe_dump_to_mule()) return;
	if (!tank && !mage) {
		await maybe_trade_merchant();
		if (await maybe_emergency_town()) return;
	}

	await hunt_fight(combat_mtype(tank), tank);
	if (merchant_here()) await maybe_trade_merchant();
}

/** Spiders are the default hunt: follow the tank, heal, hit what he holds. */
function farm_spiders(tank) {
	return hunt_fight(combat_mtype(tank), tank);
}

function needs_heal(ally) {
	if (!ally || ally.rip) return false;
	var ratio = ally.hp / ally.max_hp;
	var missing = ally.max_hp - ally.hp;
	if (ally === character) {
		return ratio <= CONFIG.SELF_HEAL_RATIO || missing >= CONFIG.SELF_HEAL_MISSING;
	}
	if (ally.name === CONFIG.PARTNER) return ratio <= CONFIG.HEAL_HP_RATIO;
	return ratio <= CONFIG.HEAL_HP_RATIO || missing >= CONFIG.HEAL_MISSING_HP;
}

function hp_ratio(who) {
	if (!who || !who.max_hp) return 1;
	return who.hp / who.max_hp;
}

async function close_to_heal(tank, mage) {
	function stand_off(ally) {
		var want = Math.min((character.range || 160) - 25, CONFIG.FOLLOW_RANGE - 10);
		want = Math.max(CONFIG.MIN_RANGE + 15, want);
		return point_away(character, ally, want);
	}
	if (tank && needs_heal(tank) && !is_in_range(tank, "heal")) {
		var p = stand_off(tank);
		await walk_to(p.x, p.y, "heal range " + tank.name);
		return true;
	}
	if (mage && needs_heal(mage) && !is_in_range(mage, "heal") && !(tank && needs_heal(tank))) {
		var q = stand_off(mage);
		await walk_to(q.x, q.y, "heal range " + mage.name);
		return true;
	}
	return false;
}

/** Heal whoever is actually hurt. Warrior still wins a tie; mage is not skipped. */
async function maybe_heal_party(warrior) {
	if (typeof StyleLoadout !== "undefined" && !StyleLoadout.allows("heal")) return false;
	var mage = CONFIG.MAGE ? get_player(CONFIG.MAGE) : null;
	var me_low = needs_heal(character) && can_heal(character);
	var w_low = warrior && needs_heal(warrior) && can_heal(warrior);
	var m_low = mage && needs_heal(mage) && can_heal(mage);
	var me_crit = hp_ratio(character) <= CONFIG.SELF_CRITICAL_RATIO && can_heal(character);
	var w_crit = warrior && hp_ratio(warrior) <= 0.5 && can_heal(warrior);
	var m_crit = mage && hp_ratio(mage) <= 0.5 && can_heal(mage);

	if (me_crit && (!warrior || hp_ratio(character) <= hp_ratio(warrior)) && (!mage || hp_ratio(character) <= hp_ratio(mage))) {
		try { await heal(character); } catch (e) {}
		return true;
	}
	if (w_crit) {
		try { await heal(warrior); } catch (e) {}
		return true;
	}
	if (m_crit) {
		try { await heal(mage); } catch (e) {}
		return true;
	}
	if (me_low && (!warrior || hp_ratio(character) <= hp_ratio(warrior)) && (!mage || hp_ratio(character) <= hp_ratio(mage))) {
		try { await heal(character); } catch (e) {}
		return true;
	}
	if (w_low) {
		try { await heal(warrior); } catch (e) {}
		return true;
	}
	if (m_low) {
		try { await heal(mage); } catch (e) {}
		return true;
	}
	if (me_low) {
		try { await heal(character); } catch (e) {}
		return true;
	}
	return false;
}

async function maybe_partyheal(warrior) {
	if (typeof StyleLoadout !== "undefined" && !StyleLoadout.allows("partyheal")) return false;
	if (!can_use("partyheal") || character.mp < 400) return false;
	var tank_low = warrior && hp_ratio(warrior) < CONFIG.PARTYHEAL_WARRIOR_RATIO;
	var n = 0;
	if (hp_ratio(character) <= CONFIG.HEAL_HP_RATIO) n++;
	if (warrior && hp_ratio(warrior) <= CONFIG.HEAL_HP_RATIO) n++;
	var mage = CONFIG.MAGE ? get_player(CONFIG.MAGE) : null;
	if (mage && hp_ratio(mage) <= CONFIG.HEAL_HP_RATIO) n++;
	if (!tank_low && n < 2) return false;
	try {
		await use_skill("partyheal");
		return true;
	} catch (e) {
		return false;
	}
}

/**
 * Dark Blessing is 900 MP on a 60s cooldown; Curse is 400 MP for a 5s debuff.
 * Spent on a 720-hp snake that dies in two hits they only burn mana pots.
 * Both now need a real fight (monster with tank aggro) and a healthy pool.
 */
async function maybe_priest_skills(monster, warrior) {
	await maybe_curse(monster);
	var fight = monster && !monster.rip && warrior && monster.target === warrior.name;
	var ok = function (sk) { return typeof StyleLoadout === "undefined" || StyleLoadout.allows(sk); };
	if (ok("darkblessing") && fight && can_use("darkblessing") && character.mp >= 900 && character.mp / character.max_mp >= 0.8) {
		try { await use_skill("darkblessing"); } catch (e) {}
	}
	if (ok("absorb") && warrior && can_use("absorb") && character.mp >= 200 && hp_ratio(character) > 0.6) {
		var mage = CONFIG.MAGE ? get_player(CONFIG.MAGE) : null;
		if (mage) {
			for (var id in parent.entities) {
				var e = parent.entities[id];
				if (!e || e.type !== "monster" || e.rip) continue;
				if (e.target === mage.name) {
					try { await use_skill("absorb", mage); } catch (err) {}
					break;
				}
			}
		}
	}
}

async function maybe_curse(monster) {
	if (typeof StyleLoadout !== "undefined" && !StyleLoadout.allows("curse")) return false;
	if (!monster || monster.rip) return false;
	if ((monster.max_hp || 0) < CONFIG.CURSE_MIN_HP) return false;
	if (monster.s && monster.s.cursed) return false;
	if (!can_use("curse")) return false;
	if (character.mp < 400 + CONFIG.CURSE_KEEP_MP) return false;
	if (character.mp / character.max_mp < 0.6) return false;
	if (distance(character, monster) > 200) return false;
	try {
		await use_skill("curse", monster);
		return true;
	} catch (e) {
		return false;
	}
}

function is_warrior_fight(monster, warrior) {
	if (!warrior || !monster || monster.rip || monster.type !== "monster") return false;
	if (monster.target === warrior.name) return true;
	if (warrior.target && (monster.id === warrior.target || monster === get_entity(warrior.target))) {
		if (!monster.target || is_ally(monster.target)) return true;
	}
	return false;
}

/** Only Eadroma's pull. Never start a second armadillo on the side. */
function same_monster_as(warrior) {
	if (!warrior) return null;
	var picked = warrior.target ? get_entity(warrior.target) : null;
	if (picked && is_warrior_fight(picked, warrior) && distance(warrior, picked) < 280) return picked;

	var best = null;
	var best_d = 99999;
	for (var id in parent.entities) {
		var e = parent.entities[id];
		if (!e || e.type !== "monster" || e.rip) continue;
		if (e.target !== warrior.name) continue;
		var d = distance(warrior, e);
		if (d < best_d) {
			best_d = d;
			best = e;
		}
	}
	if (best) return best;

	if (last_tgt_id) {
		var stale = get_entity(last_tgt_id);
		if (stale && is_warrior_fight(stale, warrior) && distance(warrior, stale) < 220) return stale;
	}
	return null;
}

function maybe_self_potion() {
	if (character.mp / character.max_mp < 0.45 && has_mp_pot() && !is_on_cooldown("use_mp")) {
		try { use_skill("use_mp"); } catch (e) {}
	}
	if (character.hp / character.max_hp <= CONFIG.SELF_POT_HP_RATIO && has_hp_pot() && !is_on_cooldown("use_hp")) {
		try { use_skill("use_hp"); } catch (e) {}
	}
}

function item_count(name) {
	var n = 0;
	var items = character.items || [];
	for (var i = 0; i < items.length; i++) {
		var it = items[i];
		if (it && it.name === name) n += it.q || 1;
	}
	return n;
}

function has_hp_pot() {
	return locate_item("hpot1") !== -1 || locate_item("hpot0") !== -1;
}

function has_mp_pot() {
	return locate_item("mpot1") !== -1 || locate_item("mpot0") !== -1;
}

function drinkable_hp() {
	return item_count("hpot1") + item_count("hpot0");
}

function drinkable_mp() {
	return item_count("mpot1") + item_count("mpot0");
}

function merchant_on_duty() {
	return Date.now() - last_merchant_cm < 90000;
}

function merchant_here() {
	var m = get_player(CONFIG.MERCHANT);
	return !!(m && distance(character, m) <= 300);
}

function our_mluck() {
	return (character.s && character.s.mluck) || null;
}

function mluck_ok() {
	var s = our_mluck();
	if (!s) return false;
	if (s.strong && s.f && s.f !== CONFIG.MERCHANT) return true;
	return s.f === CONFIG.MERCHANT && s.ms > CONFIG.MLUCK_REFRESH_MS;
}

function wants_mluck() {
	var s = our_mluck();
	if (s && s.strong && s.f && s.f !== CONFIG.MERCHANT) return false;
	return !mluck_ok();
}

async function maybe_give_lolipops() {
	var tank = get_player(CONFIG.PARTNER);
	if (!tank || tank.rip || distance(character, tank) > 250) return;
	var names = ["glolipop", "ololipop"];
	var items = character.items || [];
	for (var n = 0; n < names.length; n++) {
		for (var i = 0; i < items.length; i++) {
			var it = items[i];
			if (!it || it.name !== names[n] || (it.level || 0) === 0) continue;
			try {
				await send_item(CONFIG.PARTNER, i, 1);
				game_log("give " + names[n] + "+" + (it.level || 0) + " to " + CONFIG.PARTNER);
			} catch (e) {}
			return;
		}
	}
}

function is_potion_name(n) {
	return n === "hpot0" || n === "mpot0" || n === "hpot1" || n === "mpot1";
}

function is_dumpable(it) {
	if (!it || it.l) return false;
	if (it.name === "tracker") return item_count("tracker") > 1;
	if (is_potion_name(it.name)) return false;
	if (it.name === "elixirint0" || it.name === "ecape") return false;
	if ((it.name === "ololipop" || it.name === "glolipop") && (it.level || 0) === 0) return true;
	if (keep_for_equip(it)) return false;
	var keep = CONFIG.KEEP_ITEMS || [];
	if (keep.indexOf(it.name) >= 0) return false;
	return true;
}

function dumpable_count() {
	var n = 0;
	var items = character.items || [];
	for (var i = 0; i < items.length; i++) {
		if (is_dumpable(items[i])) n++;
	}
	return n;
}

function bag_full() {
	return (character.esize || 0) <= 1;
}

function wants_dump() {
	return bag_full() && dumpable_count() > 0;
}

function ally_in_combat(name) {
	var p = get_player(name);
	if (!p || p.map !== character.map) return false;
	for (var id in parent.entities) {
		var e = parent.entities[id];
		if (e && e.type === "monster" && !e.rip && e.target === name && distance(character, e) < 400) return true;
	}
	return false;
}

async function maybe_pickup_vstaff() {
	var mh = character.slots && character.slots.mainhand;
	if ((mh && mh.name === "vstaff") || locate_item("vstaff") !== -1) {
		if (vstaff_trip) {
			vstaff_trip = null;
			await ensure_gear();
		}
		return false;
	}
	if (!vstaff_trip) return false;
	if (Date.now() - vstaff_trip.started > (CONFIG.CITY_WAIT_MS || 180000)) {
		game_log("city: vstaff wait expired");
		vstaff_trip = null;
		return false;
	}
	var dest = CONFIG.CITY || { map: "main", x: 0, y: 0 };
	var m = get_player(CONFIG.MERCHANT);
	if (m && m.map === "main" && simple_distance(m, dest) < 450) dest = { map: m.map, x: m.x, y: m.y };
	if (character.map === dest.map && simple_distance(character, dest) <= 70) {
		await maybe_trade_merchant();
		return true;
	}
	if (character.map === "main" && simple_distance(character, dest) > 280) {
		await town_to_spawn("city for vstaff", "town() for vstaff");
		return true;
	}
	await go_to(dest, "city for vstaff", 70);
	return true;
}

async function maybe_dump_to_mule() {
	if (ally_in_combat(CONFIG.PARTNER)) return false;
	if (!dump_trip && !wants_dump()) return false;
	if (!dump_trip && dump_backoff && Date.now() < dump_backoff && !wants_dump()) return false;
	if (!dump_trip && wants_dump()) {
		dump_trip = { started: Date.now() };
		game_log("city: dump bag to mule");
	}
	if (!dump_trip) return false;
	if (Date.now() - dump_trip.started > (CONFIG.CITY_WAIT_MS || 180000)) {
		game_log("city: mule too slow, back to farm");
		dump_trip = null;
		dump_backoff = Date.now() + 60000;
		return false;
	}
	var m = get_player(CONFIG.MERCHANT);
	var dest = CONFIG.CITY || { map: "main", x: 0, y: 0 };
	if (m && m.map === "main" && simple_distance(m, dest) < 450) dest = { map: m.map, x: m.x, y: m.y };
	if (character.map !== dest.map || simple_distance(character, dest) > 70) {
		await go_to(dest, m ? "mule in city" : "city mule stand");
		return true;
	}
	await maybe_trade_merchant();
	if (!wants_dump() && dumpable_count() < 1) {
		dump_trip = null;
		return false;
	}
	return true;
}

function wants_hpot() {
	return item_count(CONFIG.HPOT) < (CONFIG.POT_ASK_HP || CONFIG.POT_MIN);
}

function wants_mpot() {
	return item_count(CONFIG.MPOT) < (CONFIG.POT_ASK_MP || CONFIG.POT_MIN);
}

/**
 * Slot -> "name:level" for every slot we manage, "" when empty. The mule
 * cannot read character.slots unless we are on its screen, so it needs this
 * to decide what to buy and what to hand over while it stands in town.
 */
function kit_report() {
	var out = {};
	var slots = character.slots || {};
	for (var i = 0; i < WEAR_SLOTS.length; i++) {
		var slot = WEAR_SLOTS[i].slot;
		var eq = slots[slot];
		out[slot] = eq ? eq.name + ":" + (eq.level || 0) : "";
	}
	return out;
}

async function ping_merchant() {
	var need_h = wants_hpot();
	var need_m = wants_mpot();
	var wait = merchant_here() ? 2000 : 8000;
	if (need_h || need_m || wants_mluck()) wait = Math.min(wait, 3500);
	if (wants_dump()) wait = Math.min(wait, 2500);
	if (Date.now() - last_mux_sent < wait) return;
	last_mux_sent = Date.now();
	try {
		await send_cm(CONFIG.MERCHANT, {
			t: (need_h || need_m || wants_mluck()) ? "pots" : "mux",
			hpot: item_count(CONFIG.HPOT),
			mpot: item_count(CONFIG.MPOT),
			gold: character.gold,
			dump: dumpable_count(),
			map: character.map,
			x: Math.round(character.x),
			y: Math.round(character.y),
			need_h: need_h ? 1 : 0,
			need_m: need_m ? 1 : 0,
			need_luck: wants_mluck() ? 1 : 0,
			need_elixir: (!elixir_running() && item_count("elixirint0") < 1) ? 1 : 0,
			coming: (dump_trip || wants_dump() || vstaff_trip) ? 1 : 0,
			tracker: item_count("tracker"),
			kit: kit_report()
		});
	} catch (e) {}
}

async function maybe_trade_merchant() {
	await ping_merchant();
	if (!merchant_here()) return;
	/** Never bank our gold while we are dry — that money is our own refill. */
	if (pots_critical()) return;
	if (character.gold > CONFIG.GOLD_KEEP + 200 && Date.now() - last_gold_send > 8000) {
		var amt = character.gold - CONFIG.GOLD_KEEP;
		last_gold_send = Date.now();
		try { await send_gold(CONFIG.MERCHANT, amt); } catch (e) {}
		return;
	}
	await ensure_gear();
	await dump_bag_to_merchant();
}

async function dump_bag_to_merchant() {
	if (Date.now() - last_give_at < 400) return;
	var items = character.items || [];
	for (var i = 0; i < items.length; i++) {
		var it = items[i];
		if (!is_dumpable(it)) continue;
		var q = it.q || 1;
		var name = it.name;
		last_give_at = Date.now();
		last_give_name = name;
		try {
			await send_cm(CONFIG.MERCHANT, { t: "give", item: name, level: it.level || 0 });
			await send_item(CONFIG.MERCHANT, i, q);
		} catch (e) {}
		return;
	}
}

function need_pots() {
	return drinkable_hp() < CONFIG.POT_MIN || drinkable_mp() < CONFIG.POT_MIN;
}

var ARMOR_BUY = [
	{ slot: "gloves", item: "gloves" },
	{ slot: "chest", item: "coat" },
	{ slot: "pants", item: "pants" }
];

function shop_price(name) {
	return (G.items[name] && G.items[name].g) || 999999;
}

function missing_armor_list() {
	var slots = character.slots || {};
	var missing = [];
	for (var i = 0; i < ARMOR_BUY.length; i++) {
		var spec = ARMOR_BUY[i];
		if (!slots[spec.slot] && locate_item(spec.item) === -1) missing.push(spec);
	}
	return missing;
}

function need_armor() {
	var missing = missing_armor_list();
	if (!missing.length) return false;
	var cheapest = shop_price(missing[0].item);
	for (var i = 1; i < missing.length; i++) {
		var p = shop_price(missing[i].item);
		if (p < cheapest) cheapest = p;
	}
	return character.gold >= cheapest;
}

function npc_xy(id) {
	for (var key in parent.entities) {
		var e = parent.entities[key];
		if (!e || !e.npc) continue;
		if (e.npc === id || e.id === id) return { x: e.x, y: e.y };
	}
	var list = G.maps[character.map] && G.maps[character.map].npcs;
	if (!list) return null;
	for (var i = 0; i < list.length; i++) {
		var n = list[i];
		if (!n || n.id !== id) continue;
		var x = Array.isArray(n.position) ? n.position[0] : n.x;
		var y = Array.isArray(n.position) ? n.position[1] : n.y;
		if (x == null) continue;
		return { x: x, y: y };
	}
	return null;
}

function near_npc(id) {
	var p = npc_xy(id);
	return !!(p && simple_distance(character, p) < 200);
}

async function approach_npc(id, reason) {
	if (shop_ready(id)) return true;
	/** Walk to our known-good stand spot, not the NPC sprite (which may be on a wall). */
	var dest = SHOP_XY[id] || id;
	try { await go_to(dest, reason || ("walk to " + id), 40); } catch (e) {}
	return shop_ready(id);
}

/**
 * Cue (newupgrade) is drawn on his booth at -207,-220: not walkable, and
 * smart_move to it printed "Path not found!" 767 times in ten minutes. The
 * game's own smart_move("upgrade") stands at -204,-129; use the same spot.
 */
var SHOP_XY = {
	scrolls: { map: "main", x: -464, y: -96 },
	newupgrade: { map: "main", x: -204, y: -129 },
	fancypots: { map: "main", x: -35, y: -162 },
	basics: { map: "main", x: -89, y: -165 }
};

function npc_stand(id) {
	var live = npc_xy(id);
	if (live && (!SHOP_XY[id] || character.map === SHOP_XY[id].map)) return live;
	return SHOP_XY[id] || live;
}

function shop_ready(id) {
	var stand = SHOP_XY[id];
	if (stand && character.map !== stand.map) return false;
	if (stand && simple_distance(character, stand) <= 60) return true;
	var p = npc_stand(id);
	return !!(p && simple_distance(character, p) <= 100);
}

function shop_for(name) {
	if (name === "hpot0" || name === "mpot0" || name === "hpot1" || name === "mpot1") return "fancypots";
	if (name === "scroll0" || name === "scroll1" || name === "cscroll0" || name === "cscroll1" || name === "intscroll") return "scrolls";
	return "basics";
}

if (!buy._party_guard) {
	var raw_buy = buy;
	buy = function (name, quantity) {
		if (shop_for(name) === "scrolls" && !shop_ready("scrolls")) {
			return Promise.reject({ reason: "not_at_shop", name: name });
		}
		return raw_buy(name, quantity);
	};
	buy._party_guard = true;
}

async function buy_from_shop(name, quantity) {
	if (!quantity || quantity < 1) return false;
	var shop = shop_for(name);
	if (!(await approach_npc(shop, "buy " + name))) return false;
	try {
		await buy(name, quantity);
		game_log("bought " + quantity + " " + name);
		return true;
	} catch (e) {
		return false;
	}
}

function pots_critical() {
	return drinkable_mp() < CONFIG.POT_CRITICAL || drinkable_hp() < CONFIG.POT_CRITICAL;
}

/**
 * The mule claims duty just by pinging, so a mule that is busy, broke or
 * stuck in a trade loop still leaves us dry while we wait for it. Once we
 * have been this long under POT_CRITICAL with gold in pocket, stop waiting.
 */
function pots_starved() {
	if (!pots_critical()) {
		pots_low_since = 0;
		return false;
	}
	if (!pots_low_since) pots_low_since = Date.now();
	if (Date.now() - pots_low_since < CONFIG.POT_STARVE_MS) return false;
	return character.gold >= 400;
}

async function purchase_armor() {
	for (var i = 0; i < ARMOR_BUY.length; i++) {
		var spec = ARMOR_BUY[i];
		if (character.slots && character.slots[spec.slot]) continue;
		if (locate_item(spec.item) !== -1) {
			await wear_slot(spec.slot, [spec.item]);
			continue;
		}
		var price = shop_price(spec.item);
		if (character.gold < price) continue;
		try {
			await buy(spec.item);
			game_log("bought " + spec.item + " for " + price);
		} catch (e) {
			game_log("buy " + spec.item + " failed: " + (e.reason || e));
		}
		await wear_slot(spec.slot, [spec.item]);
	}
	await ensure_gear();
}

async function shop_here() {
	if ((!merchant_on_duty() || pots_critical()) && near_npc("fancypots") && need_pots() && character.gold >= 400) {
		await buy_up_to(CONFIG.HPOT, CONFIG.POT_BUY);
		await buy_up_to(CONFIG.MPOT, CONFIG.POT_BUY);
	}
	if (near_npc("craftsman")) await craft_firestaff_here();
}

async function buy_scrolls_if_needed() {
	var have_scroll = item_count("scroll0");
	if (have_scroll >= CONFIG.SCROLL_KEEP) return;
	if (character.gold <= CONFIG.GOLD_RESERVE + 1000) return;
	var buy_n = Math.min(CONFIG.SCROLL_KEEP - have_scroll, Math.floor((character.gold - CONFIG.GOLD_RESERVE) / 1000));
	if (buy_n > 0) await buy_from_shop("scroll0", buy_n);
}

async function maybe_refill_pots() {
	var starved = pots_starved();
	if (!pots_critical() || (merchant_on_duty() && !starved)) {
		town_trip = false;
		return false;
	}
	town_trip = true;
	if (!near_npc("fancypots")) {
		await go_to("fancypots", starved ? "mule left us dry; buying our own" : "emergency potions (merchant off)");
		return true;
	}
	await buy_up_to(CONFIG.HPOT, CONFIG.POT_BUY);
	await buy_up_to(CONFIG.MPOT, CONFIG.POT_BUY);
	town_trip = false;
	return false;
}

async function maybe_emergency_town() {
	if (merchant_on_duty() && !pots_starved()) return false;
	if (get_player(CONFIG.PARTNER)) return false;
	if (!pots_critical()) return false;
	await go_to("fancypots", "emergency potions (alone)");
	await buy_up_to(CONFIG.HPOT, CONFIG.POT_BUY);
	await buy_up_to(CONFIG.MPOT, CONFIG.POT_BUY);
	return true;
}

var UPGRADE_MAP = [
	{ slot: "helmet", item: "helmet" },
	{ slot: "shoes", item: "shoes" },
	{ slot: "chest", item: "coat" },
	{ slot: "gloves", item: "gloves" },
	{ slot: "pants", item: "pants" }
];

function priest_weapon_name() {
	var eq = character.slots && character.slots.mainhand;
	if (eq && (eq.name === "vstaff" || eq.name === "oozingterror")) return null;
	if (eq && (eq.name === "firestaff" || eq.name === "staff")) return eq.name;
	if (locate_item("vstaff") !== -1) return null;
	if (locate_item("firestaff") !== -1) return "firestaff";
	if (locate_item("staff") !== -1) return "staff";
	return null;
}

function weapon_needs_upgrade() {
	var n = priest_weapon_name();
	if (!n) return false;
	var eq = character.slots && character.slots.mainhand;
	if (eq && eq.name === n && (eq.level || 0) < CONFIG.UPGRADE_MAX_LEVEL) return true;
	var idx = locate_item(n);
	return idx !== -1 && character.items[idx] && (character.items[idx].level || 0) < CONFIG.UPGRADE_MAX_LEVEL;
}

function has_upgrade_candidate() {
	if (weapon_needs_upgrade()) return true;
	var slots = character.slots || {};
	for (var i = 0; i < UPGRADE_MAP.length; i++) {
		var spec = UPGRADE_MAP[i];
		var eq = slots[spec.slot];
		if (eq && eq.name === spec.item && (eq.level || 0) < CONFIG.UPGRADE_MAX_LEVEL) return true;
		var idx = locate_item(spec.item);
		if (idx !== -1 && character.items[idx] && (character.items[idx].level || 0) < CONFIG.UPGRADE_MAX_LEVEL) return true;
	}
	return false;
}

function can_afford_upgrade_trip() {
	if (!has_upgrade_candidate()) return false;
	if (upgrade_budget_spent()) return false;
	if (item_count("scroll0") >= 4) return true;
	return character.gold >= CONFIG.UPGRADE_TRIP_GOLD;
}

function upgrade_budget_spent() {
	if (my_job() === "upgrade") return false;
	return upgrade_tries >= CONFIG.UPGRADE_MAX_TRIES;
}

function can_upgrade_armor() {
	if (upgrade_budget_spent()) return false;
	if (!has_upgrade_candidate()) return false;
	if (locate_item("scroll0") === -1) return my_job() === "upgrade" && character.gold > CONFIG.GOLD_RESERVE + 1000;
	return true;
}

async function craft_firestaff_here() {
	if (locate_item("essenceoffire") === -1) return;
	var mh = character.slots && character.slots.mainhand;
	if (mh && (mh.name === "vstaff" || mh.name === "oozingterror" || mh.name === "firestaff")) return;
	if (locate_item("vstaff") !== -1) return;
	if (locate_item("staff") === -1) return;
	if (character.gold < 20000) return;
	try {
		await auto_craft("firestaff");
		game_log("crafted firestaff");
	} catch (e) {}
	await ensure_gear();
}

var WANDERER_SLOT = {
	wcap: "helmet",
	wattire: "chest",
	wgloves: "gloves",
	wbreeches: "pants",
	wshoes: "shoes"
};

function is_wanderer_name(n) {
	return !!WANDERER_SLOT[n];
}

function item_int_score(it) {
	return (it && it.stat_type === "int") ? 1 : 0;
}

function wanderer_needs_int(it) {
	if (!it || it.l) return false;
	if (!is_wanderer_name(it.name)) return false;
	if ((it.level || 0) < 7) return false;
	return it.stat_type !== "int";
}

function find_intscroll_job() {
	var items = character.items || [];
	var i;
	for (i = 0; i < items.length; i++) {
		if (wanderer_needs_int(items[i])) {
			return { where: "bag", name: items[i].name, slot: WANDERER_SLOT[items[i].name] };
		}
	}
	var slots = character.slots || {};
	var name;
	for (name in WANDERER_SLOT) {
		var eq = slots[WANDERER_SLOT[name]];
		if (eq && wanderer_needs_int(eq)) {
			return { where: "wear", name: name, slot: WANDERER_SLOT[name] };
		}
	}
	return null;
}

function locate_wanderer_needs_int(name) {
	var items = character.items || [];
	for (var i = 0; i < items.length; i++) {
		if (!wanderer_needs_int(items[i])) continue;
		if (name && items[i].name !== name) continue;
		return i;
	}
	return -1;
}

function city_intscroll_ok() {
	if (character.map !== "main") return false;
	if (dump_trip) return true;
	if (typeof merchant_here === "function" && merchant_here()) return true;
	if (shop_ready("newupgrade")) return true;
	var city = CONFIG.CITY;
	if (city && character.map === city.map && simple_distance(character, city) < 500) return true;
	return false;
}

/** Cue only. Do not leave a hunt map. Skip if the tank is in a fight. */
async function maybe_intscroll_wanderer() {
	var job = find_intscroll_job();
	if (!job) return false;
	if (item_count("intscroll") < 1) return false;
	if (character.q && character.q.upgrade) return true;
	if (!city_intscroll_ok()) return false;
	if (ally_in_combat(CONFIG.PARTNER)) return false;
	var tank = get_player(CONFIG.PARTNER);
	if (tank && hp_ratio(tank) < CONFIG.HEAL_HP_RATIO) return false;
	if (!shop_ready("newupgrade")) {
		await approach_npc("newupgrade", "intscroll " + job.name);
		return true;
	}
	if (job.where === "wear") {
		if ((character.esize || 0) < 1) return false;
		try { await unequip(job.slot); } catch (e) { return false; }
	}
	var item = locate_wanderer_needs_int(job.name);
	var scroll = locate_item(CONFIG.INTSCROLL || "intscroll");
	if (item === -1 || scroll === -1 || item === scroll) {
		await ensure_gear();
		return false;
	}
	var inst = character.items[item];
	if (!wanderer_needs_int(inst)) {
		await ensure_gear();
		return false;
	}
	try {
		var result = await upgrade(item, scroll);
		game_log("intscroll " + job.name + " stat=" + ((result && result.stat_type) || (result && result.success)));
	} catch (e) {
		game_log("intscroll: " + ((e && e.reason) || e));
	}
	await ensure_gear();
	return true;
}

function elixir_running() {
	var eq = character.slots && character.slots.elixir;
	if (eq) return true;
	var s = character.s || {};
	if (s.elixirint0 && s.elixirint0.ms > 2000) return true;
	if (s.elixirint1 && s.elixirint1.ms > 2000) return true;
	if (s.elixirint2 && s.elixirint2.ms > 2000) return true;
	var k;
	for (k in s) {
		if (k && k.indexOf("elixir") === 0 && s[k] && s[k].ms > 2000) return true;
	}
	return false;
}

var last_elixir_ms = 0;

async function maybe_drink_elixir() {
	if (elixir_running()) return false;
	if (Date.now() - last_elixir_ms < 4000) return false;
	var slot = locate_item("elixirint0");
	if (slot === -1) return false;
	var it = character.items[slot];
	if (!it || it.name !== "elixirint0" || it.l) return false;
	last_elixir_ms = Date.now();
	try {
		await consume(slot);
		game_log("elixirint0");
		return true;
	} catch (e) {
		game_log("elixir: " + ((e && e.reason) || e));
		return false;
	}
}

async function maybe_ensure_gear() {
	if (Date.now() - last_gear < CONFIG.GEAR_MS) return;
	last_gear = Date.now();
	await ensure_gear();
	if (typeof StyleLoadout !== "undefined") await StyleLoadout.equip(typeof combat_mtype === "function" ? combat_mtype() : null);
}

async function ensure_gear() {
	await wear_slot("mainhand", ["vstaff", "oozingterror", "firestaff", "staff"]);
	await wear_slot("offhand", ["wshield"]);
	await wear_slot("cape", ["ecape"]);
	await wear_slot("chest", ["wattire", "coat1", "coat"]);
	await wear_slot("gloves", ["wgloves", "gloves1", "gloves"]);
	await wear_slot("pants", ["wbreeches", "pants1", "pants"]);
	await wear_slot("helmet", ["wcap", "helmet1", "helmet"]);
	await wear_slot("shoes", ["wshoes", "shoes1", "shoes"]);
	await wear_slot("belt", ["intbelt", "hpbelt"]);
	await wear_slot("amulet", ["intamulet", "hpamulet"]);
	await wear_slot("ring1", ["intring", "vitring", "ringsj", "strring", "dexring"]);
	await wear_slot("ring2", ["intring", "vitring", "ringsj", "strring", "dexring"]);
	await wear_slot("earring1", ["intearring", "vitearring", "strearring", "dexearring"]);
	await wear_slot("earring2", ["intearring", "vitearring", "strearring", "dexearring"]);
}

var WEAR_SLOTS = [
	{ slot: "mainhand", items: ["vstaff", "oozingterror", "firestaff", "staff"] },
	/** A priest may hold a shield; a mage may not. wshield is 40 armor at +0. */
	{ slot: "offhand", items: ["wshield"] },
	{ slot: "cape", items: ["ecape"] },
	{ slot: "chest", items: ["wattire", "coat1", "coat"] },
	{ slot: "gloves", items: ["wgloves", "gloves1", "gloves"] },
	{ slot: "pants", items: ["wbreeches", "pants1", "pants"] },
	{ slot: "helmet", items: ["wcap", "helmet1", "helmet"] },
	{ slot: "shoes", items: ["wshoes", "shoes1", "shoes"] },
	{ slot: "belt", items: ["intbelt", "hpbelt"] },
	{ slot: "amulet", items: ["intamulet", "hpamulet"] },
	{ slot: "ring1", items: ["intring", "vitring", "ringsj", "strring", "dexring"] },
	{ slot: "ring2", items: ["intring", "vitring", "ringsj", "strring", "dexring"] },
	{ slot: "earring1", items: ["intearring", "vitearring", "strearring", "dexearring"] },
	{ slot: "earring2", items: ["intearring", "vitearring", "strearring", "dexearring"] }
];

function best_in_bag(names) {
	var items = character.items || [];
	var best = null;
	for (var i = 0; i < items.length; i++) {
		var it = items[i];
		if (!it) continue;
		var rank = names.indexOf(it.name);
		if (rank < 0) continue;
		var lv = it.level || 0;
		var int_score = item_int_score(it);
		if (!best || lv > best.level || (lv === best.level && rank < best.rank) || (lv === best.level && rank === best.rank && int_score > best.int_score)) {
			best = { i: i, name: it.name, level: lv, rank: rank, int_score: int_score };
		}
	}
	return best;
}

async function wear_slot(slot, names) {
	var bag = best_in_bag(names);
	if (!bag) return;
	var eq = character.slots && character.slots[slot];
	if (eq) {
		var eq_rank = names.indexOf(eq.name);
		var eq_lv = eq.level || 0;
		if (eq_rank >= 0) {
			if (eq_rank < bag.rank) return;
			if (eq_rank === bag.rank && eq_lv > bag.level) return;
			if (eq_rank === bag.rank && eq_lv === bag.level && item_int_score(eq) >= (bag.int_score || 0)) return;
		}
	}
	try {
		await equip(bag.i, slot);
		game_log("wear " + bag.name + "+" + bag.level + " " + slot);
	} catch (e) {
		try { await equip(bag.i); } catch (e2) {}
	}
}

function keep_for_equip(it) {
	if (!it) return false;
	for (var s = 0; s < WEAR_SLOTS.length; s++) {
		var spec = WEAR_SLOTS[s];
		if (spec.items.indexOf(it.name) < 0) continue;
		var eq = character.slots && character.slots[spec.slot];
		if (!eq) return true;
		var eq_rank = spec.items.indexOf(eq.name);
		var it_rank = spec.items.indexOf(it.name);
		var eq_lv = eq.level || 0;
		var it_lv = it.level || 0;
		if (eq_rank < 0) return true;
		if (it_rank < eq_rank) return true;
		if (it_rank === eq_rank && it_lv > eq_lv) return true;
		if (it_rank === eq_rank && it_lv === eq_lv && item_int_score(it) > item_int_score(eq)) return true;
	}
	return false;
}

async function cheap_upgrade() {
	if (character.q && character.q.upgrade) return;
	if (upgrade_budget_spent()) return;
	if (locate_item("scroll0") === -1) return;
	var specs = [];
	if (weapon_needs_upgrade()) {
		specs.push({ slot: "mainhand", item: priest_weapon_name() });
	}
	for (var a = 0; a < UPGRADE_MAP.length; a++) specs.push(UPGRADE_MAP[a]);
	for (var i = 0; i < specs.length; i++) {
		var spec = specs[i];
		if (!spec || !spec.item) continue;
		var scroll = locate_item("scroll0");
		if (scroll === -1) return;
		var eq = character.slots && character.slots[spec.slot];
		if (eq && eq.name === spec.item && (eq.level || 0) < CONFIG.UPGRADE_MAX_LEVEL) {
			try { await unequip(spec.slot); } catch (e) { continue; }
		}
		var item = locate_item(spec.item);
		var scroll = locate_item("scroll0");
		if (item === -1 || scroll === -1) continue;
		var inst = character.items[item];
		if (!inst || (inst.level || 0) >= CONFIG.UPGRADE_MAX_LEVEL) {
			try { await equip(item, spec.slot); } catch (e) {}
			continue;
		}
		upgrade_tries++;
		try {
			var result = await upgrade(item, scroll);
			game_log("upgrade " + spec.item + " ok=" + result.success + " lv=" + result.level);
		} catch (e) {
			game_log("upgrade failed: " + (e.reason || e));
		}
		var again = locate_item(spec.item);
		if (again !== -1) {
			try { await equip(again, spec.slot); } catch (e) {}
		}
		return;
	}
}

async function buy_up_to(name, want) {
	var have = item_count(name);
	if (have >= want) return;
	var need = want - have;
	var price = (G.items[name] && G.items[name].g) || 20;
	var reserve = pots_critical() ? 0 : CONFIG.GOLD_RESERVE;
	var can = Math.floor((character.gold - reserve) / price);
	if (can < need) need = can;
	if (need < 1) return;
	if (need < 10 && !pots_critical()) return;
	try { await buy(name, need); } catch (e) {}
}

async function run_script_job() {
	var job = my_job();
	if (job !== last_job) {
		last_job = job;
		upgrade_tries = 0;
		game_log("script: " + job);
		last_job_ping = Date.now();
	} else if (Date.now() - last_job_ping > 10000 && (job === "upgrade" || job === "combine")) {
		game_log("still " + job);
		last_job_ping = Date.now();
	}
	if (job === "upgrade") {
		await job_upgrade_loop();
		return true;
	}
	if (job === "combine") {
		await job_combine_loop();
		return true;
	}
	return false;
}

async function job_upgrade_loop() {
	try { set_message("Upgrade"); } catch (e) {}
	if (pots_critical()) {
		if (!(await approach_npc("fancypots", "pots then upgrade"))) return;
		await buy_up_to(CONFIG.HPOT, CONFIG.POT_BUY);
		await buy_up_to(CONFIG.MPOT, CONFIG.POT_BUY);
		return;
	}
	if (!has_upgrade_candidate()) {
		path_log("upgrade idle (nothing under +" + CONFIG.UPGRADE_MAX_LEVEL + ")", "newupgrade");
		return;
	}
	var have_scroll = item_count("scroll0");
	if (have_scroll < 1 && character.gold < 1000) {
		path_log("upgrade idle (need 1000 gold for scroll0)", "newupgrade");
		return;
	}
	if (have_scroll < 8 && character.gold >= 1000) {
		var buy_n = Math.min(8 - have_scroll, Math.floor(character.gold / 1000));
		if (buy_n > 0) {
			await buy_from_shop("scroll0", buy_n);
			return;
		}
	}
	if (!(await approach_npc("newupgrade", "upgrade toward +" + CONFIG.UPGRADE_MAX_LEVEL))) return;
	await cheap_upgrade();
}

async function job_combine_loop() {
	try { set_message("Combine"); } catch (e) {}
	if (need_pots() || pots_critical()) {
		if (!(await approach_npc("fancypots", "pots then combine"))) return;
		await buy_up_to(CONFIG.HPOT, CONFIG.POT_BUY);
		await buy_up_to(CONFIG.MPOT, CONFIG.POT_BUY);
		return;
	}
	var have_cscroll = item_count("cscroll0");
	if (has_compound_candidate() && have_cscroll < CONFIG.CSCROLL_KEEP && character.gold > CONFIG.GOLD_RESERVE + 6400) {
		var buy_c = Math.min(CONFIG.CSCROLL_KEEP - have_cscroll, Math.floor((character.gold - CONFIG.GOLD_RESERVE) / 6400));
		if (buy_c > 0) {
			await buy_from_shop("cscroll0", buy_c);
			return;
		}
	}
	if (!(await approach_npc("newupgrade", "combine accessories"))) return;
	if (has_compound_candidate()) await cheap_compound();
	else path_log("combine idle", "newupgrade");
}

function compound_uses_cscroll0(name, level) {
	var def = G.items[name];
	if (!def || !def.compound || !def.grades) return false;
	return (level || 0) < def.grades[0];
}

function find_compound_set() {
	var groups = {};
	function add(rec) {
		if (rec.it.l || rec.it.s) return;
		if (!compound_uses_cscroll0(rec.name, rec.level)) return;
		var key = rec.name + "@" + rec.level;
		if (!groups[key]) groups[key] = [];
		groups[key].push(rec);
	}
	var items = character.items || [];
	for (var i = 0; i < items.length; i++) {
		var it = items[i];
		if (!it) continue;
		add({ i: i, eq: null, name: it.name, level: it.level || 0, it: it });
	}
	var slots = ["ring1", "ring2", "earring1", "earring2", "amulet", "belt"];
	for (var s = 0; s < slots.length; s++) {
		var eq = character.slots && character.slots[slots[s]];
		if (!eq) continue;
		add({ i: -1, eq: slots[s], name: eq.name, level: eq.level || 0, it: eq });
	}
	for (var k in groups) {
		if (groups[k].length >= 3) return groups[k].slice(0, 3);
	}
	return null;
}

function has_compound_candidate() {
	return !!find_compound_set();
}

async function cheap_compound() {
	if (character.q && character.q.compound) return;
	var set = find_compound_set();
	if (!set) return;
	for (var u = 0; u < set.length; u++) {
		if (!set[u].eq) continue;
		try { await unequip(set[u].eq); } catch (e) { return; }
	}
	set = find_compound_set();
	if (!set || set.length < 3) return;
	var a = set[0].i;
	var b = set[1].i;
	var c = set[2].i;
	if (a < 0 || b < 0 || c < 0) return;
	var scroll = locate_item("cscroll0");
	if (scroll === -1) return;
	try {
		var result = await compound(a, b, c, scroll);
		game_log("combine " + set[0].name + "+" + set[0].level + " ok=" + (result && result.success) + " lv=" + (result && result.level));
	} catch (e) {
		game_log("combine failed: " + (e.reason || e));
	}
	await ensure_gear();
}

// BEGIN GENERATED COMBAT
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
				if (p.y < 37 || p.y > 221) return false;
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

// END GENERATED COMBAT
