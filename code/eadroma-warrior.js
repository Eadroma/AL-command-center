/**
 * Eadroma — warrior party lead
 * ============================
 *
 * Saved to the Eadroma CODE slot via MCP. Restart CODE in-game to load it.
 * Party: Aedroma (priest), Droma (ranger). Same server.
 *
 * Weapons swap by pack (CONFIG.WEAPONS): orange/green lolipops on
 * crocs, bees and other squishies; dual Fire Blades on spiders, Pom Poms,
 * Jr. and Green Jr., shiny blade on mainhand. Both sets stay on us — never dump
 * fireblade or upgraded ololipop/glolipop to the mule. +0 lolipops go to
 * EadroSell. Armour is still manual.
 * Upgrade and combine jobs only touch spare copies in the bag, never what
 * is worn. Town is a warrior bus — do not leave a live pull unless pots
 * are almost gone or the bag is holding dumpable loot. Priest and mage shop only when standing at the NPC
 * (they follow you). Fire Blade needs Essence of Fire from Dragold —
 * craft only if essence is already in the bag. Combine 3 matching bag
 * accessories with cscroll0 only (not cscroll1). MP pots when the pool is
 * nearly empty (mpot0 = 300 on a 325 pool). Drink HP pots whenever the
 * bar is under 80% — that means priest heal is not keeping up.
 *
 * Default farm is Stone Worms (spookytown south-east curb: 2.2k HP,
 * 1s respawn, dual Fire Blades). Hawks stay hunt-only for feathers.
 * Scorpions are the retreat tier.
 * Aedroma heals; Droma stays at range and only hits pulled monsters.
 * If a Phoenix is on screen (it can spawn in this box), take it — cooperative,
 * Fire Blades, 160k HP. Do not walk other maps looking for one unless Daisy
 * assigned phoenix and server.status says it is live.
 * Daisy hunts are
 * per character. We tank the first allowed contract: ours, then
 * Droma, then Aedroma. Followers talk to Daisy when we walk over.
 * Allowed hunts include arcticbee, iceroamer, mainland scorpion,
 * crabx, phoenix, poisio, stoneworm, mvampire (Dracul), and mid packs like
 * porcupine / cgoo / mole / wolfie / ghost / booboo / fireroamer. Stone Worms are spookytown
 * south-east only (not the north box): 360 atk, rage 1, 800 armor
 * piercing. Dual Fire Blades, west curb of the box, no Charge into
 * the pack. Droma only hits worms already on us. Boo Boo (range 420):
 * camp the west road, pick the westmost mob, then close to melee —
 * never freeze on the curb hold, never Charge into pack centre.
 * Unknown or failed hunts stay on Stone Worms until they
 * expire. On every CODE reload we walk Jr. then Green Jr. first, then
 * every 4 hours after that. If either is live we stay and kill it.
 * Followers come with us. Pom Poms (minimush) are allowed: east halloween box only, Fire Blades
 * so lolipop explosion does not tag extras. Spiders while
 * Mr. Pumpkin is live (range 520 covers the mushroom field). Huge crabs
 * wait if Giga Crab is in that beach box.
 *
 * Daisy hunts: smart_move(mtype) to the pack the game knows; do not walk a
 * guessed box-edge xy (mummy/desert idle). Pull only once Aedroma is on this
 * map in heal range — tanking without the priest is a wipe. Broadcast our
 * position every 4s so the followers walk to us.
 *
 * Movement: go_to() is the only entry point. move() when the line is
 * clear, one throttled smart_move otherwise, never xmove.
 *
 * We still report kit: { slot: "name:level" } to the mule on every ping so
 * it can see what we wear; it no longer buys or hands over gear for us.
 *
 * Between pulls, walk the party to town when pots are low, Merchant's
 * Luck is missing, or four or fewer bag slots are free. Restock from
 * EadroSell at the stand, dump junk, and take mluck; do not buy Fancy
 * Pots while the mule is on duty. A dump trip also leaves a live pull.
 *
 * Live G.events (Giga Crab, Goo Brawl, Franky, Ice Golem, A/B Testing) and
 * live world bosses in server.status pull us off the idle farm. Seasonal
 * calendars stay ignored. Followers join the same event.
 *
 * This window is the farm root: start_character launches Aedroma and
 * Droma here (CODE-only children). EadroSell runs on its own client —
 * do not start the mule from here. Closing this warrior stops the two
 * farmers. Stopping mule CODE does not stop the farmers.
 */

/** Browser DPS / gold / XP / upgrade buttons. No-op on Mainframe. */
if (typeof parent !== "undefined" && parent.$) {
	load_code("gui", function () { game_log("gui slot missing"); });
}

var CONFIG = {
	/** Cooldown-aware movement; false restores legacy positioning. */
	KITE_ENABLED: true,
	KITE_LEASH: 240,
	KITE_PANIC_RATIO: 0.45,
	PRIEST: "Aedroma",
	MERCHANT: "EadroSell",
	/** Ranger then priest: hunt fallback after our own contract. */
	PARTY: ["Droma", "Aedroma"],
	/** Invited but not counted as fighters: shares kill XP, gets taunt cover. */
	PARTY_GUESTS: ["EadroSell"],
	/** start_character CODE slots. Priest and ranger only; mule has its own client. */
	TEAM_SLOTS: {
		Aedroma: "CH_EiXQ8dHoXlqTOtyTH5IzbbafFAif9",
		Droma: "CH_TWNS1mcRp22XMAehvezNnJTPc2VBB"
	},
	HOME: { region: "EU", name: "III" },
	GIVE_WEAPONS: [],
	GIVE_ARMOR: ["coat", "gloves", "pants", "helmet", "shoes"],
	KEEP_ITEMS: ["ololipop", "glolipop", "fireblade"],
	DAILY_DUNGEON: false,
	DAILY_DUNGEON_BUY: false,
	EMERGENCY_HP_RATIO: 0.22,
	CRITICAL_HP_RATIO: 0.12,
	/** Priest not keeping up: drink every use_hp cooldown (2s) below this. */
	HP_POT_RATIO: 0.80,
	MP_POT_BELOW: 40,
	/** mpot0 restores 300 on a 325 pool; drinking at 70% threw most of it away. */
	MP_USE_RATIO: 0.3,
	PRIEST_HEAL_RANGE: 110,
	INVITE_MS: 8000,
	POS_CM_MS: 4000,
	SHARE_MS: 12000,
	KIT_WAIT_MS: 18000,
	KIT_RETRY_MS: 120000,
	POT_CRITICAL: 8,
	POT_STARVE_MS: 45000,
	USE_CHARGE: true,
	POT_MIN: 40,
	POT_ASK_HP: 80,
	POT_ASK_MP: 80,
	HPOT: "hpot1",
	MPOT: "mpot1",
	POT_BUY: 200,
	GOLD_KEEP: 2500,
	GOLD_RESERVE: 2000,
	GEAR_MS: 5000,
	UPGRADE_MAX_LEVEL: 7,
	UPGRADE_MAX_TRIES: 20,
	UPGRADE_TRIP_GOLD: 15000,
	SCROLL_KEEP: 8,
	/** Combine accessories with cscroll0 only (+0/+1/+2). Do not buy cscroll1. */
	COMPOUND_MAX_GRADE0: true,
	CSCROLL_KEEP: 4,
	ALLY_GOLD: 12000,
	/**
	 * Idle farm. Stone Worms on spookytown south-east (west curb).
	 * Fire Blades. Scorpions if we wipe. Hawks only when Daisy assigns.
	 */
	DEFAULT_FARM: "stoneworm",
	FARM: [
		[8, "bee"],
		[12, "crab"],
		[16, "armadillo"],
		[24, "croc"],
		[38, "bat"],
		[40, "spider"],
		[50, "scorpion"],
		[64, "stoneworm"]
	],
	/**
	 * Hands per pack. lolipop = orange main / green off (explosion).
	 * fireblade = shiny Fire Blade main / other Fire Blade off (no explosion).
	 * Unknown packs use default.
	 */
	WEAPONS: {
		default: "lolipop",
		lolipop: { main: "ololipop", off: "glolipop" },
		fireblade: { main: "fireblade", off: "fireblade", shiny_main: true },
		pack: {
			goo: "lolipop",
			bee: "lolipop",
			crab: "lolipop",
			frog: "lolipop",
			squig: "lolipop",
			squigtoad: "lolipop",
			armadillo: "lolipop",
			snake: "lolipop",
			osnake: "lolipop",
			tortoise: "lolipop",
			croc: "lolipop",
			rat: "lolipop",
			bat: "lolipop",
			minimush: "fireblade",
			arcticbee: "lolipop",
			spider: "fireblade",
			phoenix: "fireblade",
			jr: "fireblade",
			greenjr: "fireblade",
			iceroamer: "fireblade",
			scorpion: "fireblade",
			bigbird: "fireblade",
			crabx: "fireblade",
			booboo: "fireblade",
			stoneworm: "fireblade",
			mvampire: "fireblade",
			fireroamer: "fireblade",
			mole: "fireblade",
			wolfie: "fireblade",
			ghost: "fireblade",
			boar: "lolipop",
			porcupine: "lolipop",
			cgoo: "lolipop",
			prat: "lolipop",
			mummy: "lolipop",
			nerfedmummy: "lolipop",
			poisio: "lolipop",
			goobrawl: "lolipop",
			crabxx: "fireblade",
			franky: "fireblade",
			icegolem: "fireblade",
			snowman: "fireblade",
			dragold: "fireblade",
			grinch: "fireblade",
			wabbit: "fireblade",
			pinkgoo: "lolipop",
			mrpumpkin: "fireblade",
			mrgreen: "fireblade",
			slenderman: "fireblade",
			tiger: "fireblade"
		}
	},
	/** After a death, drop one pack tier for this long. */
	RETREAT_MS: 600000,
	/** Croc farm: do not open a new pull while the healer is farther than this. */
	PRIEST_LEASH: 260,
	/**
	 * On-screen is enough to pull. Aedroma parks at 100-140px but often
	 * sits farther while kiting; 175 treated that as "not here" and we
	 * idled next to him.
	 */
	PRIEST_COVER: 420,
	/** Skip a hunt type only after this many wipes on it. */
	HUNT_WIPE_MAX: 3,
	STUCK_MS: 8000,
	/** Daisy is on main at (126,-413). Hunt interact range is 400. */
	DAISY: { map: "main", x: 126, y: -413 },
	/** Town Square centre (spawn 0,0). Meet the mule here for pots and mluck. */
	CITY: { map: "main", x: 0, y: 0 },
	CITY_POT: 200,
	/** Walk to town once this many bag slots (or fewer) are empty. */
	DUMP_ESIZE: 4,
	/** Refresh Merchant's Luck in the last ten minutes of the hour. */
	MLUCK_REFRESH_MS: 600000,
	CITY_WAIT_MS: 180000
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
var last_ctl_cm = 0;

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
	if (now() - last_ctl_fetch < 4000) return;
	last_ctl_fetch = now();
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
	if (r === "Events") return character.name === ctl.leader ? "Leader" : "Follow";
	return r || (character.name === ctl.leader ? "Leader" : "Follow");
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

/**
 * Any appearing event: joinable G.events (Giga Crab, Goo Brawl, Franky,
 * Ice Golem, A/B Testing) plus live world bosses in server.status.
 * Long seasonal calendars (Halloween, holidays) are skipped — those stay on.
 * Open-world "join" bosses (Ice Golem) only count while the boss is alive —
 * a bare {end} must not soft-lock us on join() forever.
 */
function pick_live_event() {
	// Dashboard bundles join only events allowed in the profile; standalone CODE joins all.
	if (typeof __ALCC !== "undefined" && !__ALCC.eventsEnabled) return null;
	var S = server_status();
	if (!S || typeof S !== "object") return null;
	var name;
	var st;
	var def;
	var join_pick = null;
	var boss_pick = null;
	for (name in S) {
		if (name === "schedule") continue;
		if (typeof __ALCC !== "undefined" && __ALCC.events.indexOf(name) < 0) continue;
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
	if (tgt) {
		change_target(tgt);
		return { ev: ev, tgt: tgt };
	}
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
	return live_control().leader || "Eadroma";
}

function maybe_broadcast_control() {
	if (my_role() !== "Leader") return;
	if (now() - last_ctl_cm < 6000) return;
	last_ctl_cm = now();
	var ctl = live_control();
	var names = CONFIG.PARTY.concat([CONFIG.PRIEST]);
	for (var i = 0; i < names.length; i++) {
		if (names[i] && names[i] !== character.name) {
			try { send_cm(names[i], { t: "ctl", ctl: ctl }); } catch (e) {}
		}
	}
}

var working = false;
var last_start_ms = 0;
var start_fail_until = {};
var team_start_busy = false;
var last_invite = 0;
var last_pos_cm = 0;
var upgrade_tries = 0;
var gold_sent = {};
var last_gold_share = 0;
var kit_wait_start = 0;
var kit_wait_done_until = 0;
var last_path_key = "";
var last_go_dest = "";
var last_go_start = 0;
var pots_low_since = 0;
var last_tgt_sent = null;
var last_intent_sent = 0;
var last_intent_signature = "";
var last_merchant_cm = 0;
var last_mux_sent = 0;
var last_give_at = 0;
var last_give_name = "";
var last_gold_send = 0;
var city_trip = null;
var city_backoff = 0;

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
	/** Named Daisy packs north of town spawn — town() off the south door first. */
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
 * smart_move can stall on a door or a bad node and sit there with
 * smart.moving still true. If we have not moved 4px in STUCK_MS while it is
 * "moving", kill it and let the next tick re-plan. Named routes (monster,
 * NPC, map) get a longer leash: the planner itself takes time on big maps.
 */
function watch_stuck() {
	if (!smart.moving) {
		stuck_xy = null;
		return;
	}
	if (smart.searching) return;
	var named = !!(last_go_dest && last_go_dest.indexOf(":") < 0);
	var limit = named ? 30000 : CONFIG.STUCK_MS;
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
 * One move() per destination. Re-issuing move() every 250ms makes the
 * sprite stutter. Never xmove(): when the straight line is blocked it starts
 * an unthrottled smart_move every tick ("Path not found!" spam, 767 in ten
 * minutes in the logs). If the line is blocked, try a short slide along the
 * wall; return false so the caller can fall back to a throttled smart_move.
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

function farm_types(mtype) {
	if (mtype === "greenjr") return ["greenjr", "snake", "osnake"];
	if (mtype === "snake") return ["snake", "osnake"];
	return [mtype];
}

/** Main crab box [-1353,-254,-1052,122]. Crab Claw drops here. */
var CRAB_FARM = { map: "main", x: -1202, y: -66 };
var CRAB_BOX = { x1: -1353, y1: -254, x2: -1052, y2: 122 };
/** Main goo box [-282,702,218,872]. Slime Core (gslime) drops here. */
var GOO_FARM = { map: "main", x: -32, y: 787 };
var GOO_BOX = { x1: -282, y1: 702, x2: 218, y2: 872 };
/**
 * Croc box [696,1498,906,1922], 6 grow. Entrance on the beach just north
 * of the box, not the pack centre. Pull without waiting for the priest.
 * The shore wall runs along x=696 (G.geometry.main x_lines), so anything
 * west of it — the old 640,1460 — is water: "Path not found!" forever.
 * 740,1460 is open sand, 44px east of the wall, 38px north of the box.
 */
var CROC_FARM = { map: "main", x: 740, y: 1460 };
var CROC_PULL = { map: "main", x: 760, y: 1560 };
var CROC_BOX = { x1: 696, y1: 1498, x2: 906, y2: 1922 };
var SNAKE_FARM = { map: "halloween", x: -569, y: -512 };
var GREENJR_FARM = { map: "halloween", x: -569, y: -512 };
var GREENJR_BOX = { x1: -720, y1: -820, x2: -418, y2: -203 };
/**
 * Pom Pom box is halloween [-166,453,182,808], 8 grow. Immediately west
 * are six xscorpion (720 atk) and Mr. Pumpkin (range 520) in
 * [-671,571,-320,800]. Camp the east half only; never walk west of x=-40.
 */
var MINIMUSH_FARM = { map: "halloween", x: 70, y: 640 };
var MINIMUSH_BOX = { x1: -40, y1: 453, x2: 182, y2: 808 };

/**
 * Cave of Darkness has five bat boxes. Idle farm uses the first (door).
 * A Daisy bat hunt may land on any of them; in_bat_box accepts all five.
 */
var BAT_FARM = { map: "cave", x: -194, y: -461 };
var BAT_BOX = { x1: -396, y1: -594, x2: 8, y2: -328 };
/** Main spider box [700,-282,1196,-6]. One pull; phoenix can spawn here. */
var SPIDER_FARM = { map: "main", x: 948, y: -144 };
var SPIDER_BOX = { x1: 700, y1: -282, x2: 1196, y2: -6 };
/**
 * Winterland arctic bees [682,-967,1482,-779], 10 grow, always-aggro.
 * Isolated from wolves / Stompy further north.
 */
var ARCTICBEE_FARM = { map: "winterland", x: 1082, y: -873 };
var ARCTICBEE_BOX = { x1: 682, y1: -967, x2: 1482, y2: -779 };
/**
 * Winterland water spirits, west box [550,-240,1097,149] by the inn.
 * East box sits closer to icegolem; stay west.
 */
var ICEROAMER_FARM = { map: "winterland", x: 824, y: -45 };
var ICEROAMER_BOX = { x1: 550, y1: -240, x2: 1097, y2: 149 };
/** Main scorpions [1485,-390,1670,54], east of spiders. Not halloween xscorpion. */
var SCORPION_FARM = { map: "main", x: 1578, y: -80 };
var SCORPION_BOX = { x1: 1485, y1: -390, x2: 1670, y2: 54 };
/**
 * Mainland Hawks [1100,160,1586,336], south of spiders. 5 grow, rage 0.4.
 * Camp the west curb so we do not walk the pack centre. Scorpions sit
 * north of this box, not inside it.
 */
var BIGBIRD_FARM = { map: "main", x: 1088, y: 248 };
var BIGBIRD_BOX = { x1: 1100, y1: 160, x2: 1586, y2: 336 };
/**
 * Huge crabs [-1256,1520,-712,2004] south of tortoises. Same box as
 * crabxx (Giga Crab) when that event is live — skip the hunt then.
 */
var CRABX_FARM = { map: "main", x: -984, y: 1762 };
var CRABX_BOX = { x1: -1256, y1: 1520, x2: -712, y2: 2004 };
/**
 * Spooky Town Jr. box [-970,-413,-597,-189]. Camp here for ololipop.
 * Do not pull the west booboos north of this box.
 */
var JR_FARM = { map: "spookytown", x: -784, y: -301 };
var JR_BOX = { x1: -970, y1: -413, x2: -597, y2: -189 };
/**
 * East Spooky Town Boo Boos [286,-842,544,-562], 5 grow, range 420.
 * smart_move("booboo") is the pack center and wipes the tank. 415,-480
 * south of the box is a wall. Camp the west road, then close to melee on
 * the westmost Boo — they snipe from 420 and will not walk into a curb
 * hold the way Stone Worms do. Soft max keeps us off pack centre.
 */
var BOOBOO_FARM = { map: "spookytown", x: 200, y: -620 };
var BOOBOO_BOX = { x1: 286, y1: -842, x2: 544, y2: -562 };
/** Approach line just west of the rage box (melee step target). */
var BOOBOO_HOLD_X = 260;
/** Past this x we are too deep — fall back to the west road. */
var BOOBOO_SOFT_X = 340;
/**
 * Spooky Town Stone Worms, south-east box [501,61,852,197], 4 grow.
 * North box [773,-198,1216,-68] is skipped so we do not rage two packs.
 * Do not smart_move("stoneworm"): that can land in the north pack.
 * Tank inside the south pack; no west-curb x cap.
 */
var STONEWORM_FARM = { map: "spookytown", x: 490, y: 130 };
var STONEWORM_BOX = { x1: 501, y1: 61, x2: 852, y2: 197 };

/**
 * Underground South (level2s) Irradiated Goo box [-52,359,120,646].
 * smart_move("cgoo") errors on this unlisted map — walk to the west curb instead.
 */
var CGOO_FARM = { map: "level2s", x: -70, y: 500 };
var CGOO_BOX = { x1: -52.5, y1: 359.33, x2: 120.29, y2: 646.25 };

/**
 * First Vampire Rat pack on Underground Entrance (level1): [-86,17,64,212].
 * smart_move("prat") fails from town the same way cgoo does — walk the east
 * main door (1936,-23), then camp west of that box.
 */
var PRAT_FARM = { map: "level1", x: -110, y: 110 };
var PRAT_BOX = { x1: -160, y1: 0, x2: 80, y2: 230 };

function farm_spot(mtype) {
	if (mtype === "crab") return CRAB_FARM;
	if (mtype === "goo") return GOO_FARM;
	if (mtype === "cgoo") return CGOO_FARM;
	if (mtype === "prat") return PRAT_FARM;
	if (mtype === "croc") return CROC_FARM;
	if (mtype === "greenjr") return GREENJR_FARM;
	if (mtype === "jr") return JR_FARM;
	if (mtype === "spider") return SPIDER_FARM;
	if (mtype === "arcticbee") return ARCTICBEE_FARM;
	if (mtype === "iceroamer") return ICEROAMER_FARM;
	if (mtype === "scorpion") return SCORPION_FARM;
	if (mtype === "bigbird") return BIGBIRD_FARM;
	if (mtype === "crabx") return CRABX_FARM;
	if (mtype === "phoenix") {
		var px = get_nearest_monster({ type: "phoenix" });
		if (px && !px.rip) return { map: character.map, x: px.x, y: px.y };
		return SPIDER_FARM;
	}
	if (mtype === "bat") return BAT_FARM;
	if (mtype === "snake") return SNAKE_FARM;
	if (mtype === "minimush") return MINIMUSH_FARM;
	if (mtype === "booboo") return BOOBOO_FARM;
	if (mtype === "stoneworm") return STONEWORM_FARM;
	/** Daisy / unknown packs: scan every map (not only main). */
	var pk = pick_hunt_pack(mtype);
	if (pk) {
		var box = pack_box(pk.b);
		return { map: pk.map, x: box.x1 - 20, y: (box.y1 + box.y2) / 2 };
	}
	var maps = character.map === "main" ? ["main"] : [character.map, "main"];
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
	return mtype;
}

function at_best_farm(mtype) {
	if (mtype === "crab") {
		return character.map === "main" && in_crab_box(character);
	}
	if (mtype === "croc") {
		return character.map === "main" && in_croc_box(character);
	}
	if (mtype === "goo") {
		return character.map === "main" && in_goo_box(character);
	}
	if (mtype === "jr") {
		return character.map === "spookytown" && in_jr_box(character);
	}
	if (mtype === "greenjr") {
		return character.map === "halloween" && in_greenjr_box(character);
	}
	if (mtype === "minimush") {
		return character.map === "halloween" && in_minimush_box(character);
	}
	if (mtype === "spider") {
		return character.map === "main" && in_spider_box(character);
	}
	if (mtype === "arcticbee") {
		return character.map === "winterland" && in_arcticbee_box(character);
	}
	if (mtype === "iceroamer") {
		return character.map === "winterland" && in_iceroamer_box(character);
	}
	if (mtype === "scorpion") {
		return character.map === "main" && in_scorpion_box(character);
	}
	if (mtype === "bigbird") {
		return character.map === "main" && (in_bigbird_box(character) || simple_distance(character, BIGBIRD_FARM) < 90);
	}
	if (mtype === "crabx") {
		return character.map === "main" && in_crabx_box(character);
	}
	if (mtype === "booboo") {
		if (hunting_this("booboo") && live_of_type("booboo")) return true;
		return character.map === "spookytown" && simple_distance(character, BOOBOO_FARM) < 90;
	}
	if (mtype === "stoneworm") {
		return character.map === "spookytown" && simple_distance(character, STONEWORM_FARM) < 90;
	}
	if (mtype === "cgoo") {
		return character.map === "level2s" && (inside_box(character, CGOO_BOX) || simple_distance(character, CGOO_FARM) < 90);
	}
	if (mtype === "prat") {
		return character.map === "level1" && (inside_box(character, PRAT_BOX) || simple_distance(character, PRAT_FARM) < 90);
	}
	if (mtype === "phoenix") {
		return nearby_phoenix();
	}
	var spot = farm_spot(mtype);
	if (!spot || spot.x == null) return true;
	if (character.map !== spot.map) return false;
	return simple_distance(character, spot) < 280;
}

function on_cm(name, data) {
	if (name === CONFIG.MERCHANT) {
		last_merchant_cm = Date.now();
		if (data && data.t === "mux") {
			last_mux_sent = 0;
			ping_merchant();
		}
		return;
	}
	if (!is_party_member(name)) return;
	if (!data || typeof data !== "object") return;
	if (data.t === "ctl") apply_ctl(data.ctl);
	if (data.t === "huntfail" && data.id) note_hunt_wipe(data.id);
	if (data.t === "myhunt") {
		ally_hunts[name] = {
			id: data.id || "",
			c: data.c || 0,
			need: data.need ? 1 : 0,
			at: Date.now()
		};
	}
	if (typeof CaveDreams !== "undefined") CaveDreams.onCm(name, data);
}

setInterval(async function () {
	if (working) return;
	working = true;
	try {
		await tick();
	} catch (error) {
		game_log("warrior: " + (error.reason || error.message || error));
	} finally {
		working = false;
	}
}, 250);

var last_death = 0;
var last_daisy_ms = 0;
var last_hunt_ping = 0;
var last_skip_log = "";
var hunt_kill_id = "";
var hunt_kill_total = 0;
var hunt_kill_left = 0;
var ally_hunts = {};
var hunt_wipes = {};
try {
	var stored_hw = get("hunt_wipes");
	if (stored_hw && typeof stored_hw === "object") hunt_wipes = stored_hw;
} catch (e) {}

/**
 * Daisy assigns the highest-level live regular-map pack, not a shortlist
 * we can handle. Unknown hunts stay on spiders until they expire — cannot
 * abandon a live hunt. Jr. / Green Jr. are cooperative rares on purpose:
 * walk the camp when Daisy assigns them, spiders if they are not spawned.
 * Three wipes still fail an allowed hunt for the rest of that contract.
 */
var HUNT_ALLOW = {
	goo: 1, bee: 1, crab: 1, frog: 1,
	squig: 1, squigtoad: 1, armadillo: 1,
	snake: 1, osnake: 1, tortoise: 1, croc: 1,
	rat: 1, spider: 1, bat: 1,
	jr: 1, greenjr: 1, minimush: 1,
	arcticbee: 1, iceroamer: 1, scorpion: 1, crabx: 1, bigbird: 1,
	phoenix: 1, poisio: 1, stoneworm: 1, mvampire: 1,
	porcupine: 1, cgoo: 1, prat: 1, boar: 1, mole: 1, wolfie: 1,
	ghost: 1, booboo: 1, fireroamer: 1, mummy: 1, nerfedmummy: 1
};
/** After an empty Jr. / Green Jr. camp, farm spiders this long before peeking again. */
var RARE_HUNT_MISS_MS = 600000;
var rare_hunt_miss_until = 0;
/**
 * Recurring boss checks: walk each configured boss camp on its own interval,
 * even when Daisy did not assign it. The dashboard "Recurring boss farming"
 * board replaces BOSS_CHECKS; this default is the old 4h Jr. → Green Jr. peek.
 * Reacting to a boss the server announces as live is the separate event path.
 */
var BOSS_CHECKS = [
	{ boss: "jr", everyMinutes: 240 },
	{ boss: "greenjr", everyMinutes: 240 }
];
/** Give up on an empty camp after this long and resume the default farm. */
var BOSS_CHECK_TIMEOUT_MS = 3 * 60 * 1000;
/** at holds the last finished check per boss, so each interval runs on its own clock. */
var boss_peek = { at: {}, phase: "", started: 0 };
try {
	var stored_bp = get("boss_peek");
	if (stored_bp && typeof stored_bp === "object") {
		if (stored_bp.at && typeof stored_bp.at === "object") boss_peek.at = stored_bp.at;
		/** Resume an in-progress check only if it is still fresh; never force one on reload. */
		if (stored_bp.phase && stored_bp.started && Date.now() - stored_bp.started < BOSS_CHECK_TIMEOUT_MS) {
			boss_peek.phase = stored_bp.phase;
			boss_peek.started = stored_bp.started;
		}
	}
} catch (e) {}

function save_boss_peek() {
	try {
		set("boss_peek", {
			at: boss_peek.at,
			phase: boss_peek.phase,
			started: boss_peek.started || 0
		});
	} catch (e) {}
}

function boss_check_rules() {
	return (typeof BOSS_CHECKS !== "undefined" && BOSS_CHECKS) || [];
}

function boss_check_rule(mtype) {
	var rules = boss_check_rules();
	for (var i = 0; i < rules.length; i++) {
		if (rules[i] && rules[i].boss === mtype) return rules[i];
	}
	return null;
}

function boss_name(mtype) {
	return (G.monsters[mtype] && G.monsters[mtype].name) || mtype;
}

function fmt_minutes(m) {
	if (m < 60) return m + "m";
	var h = Math.floor(m / 60), rest = m % 60;
	return rest ? h + "h " + rest + "m" : h + "h";
}

function boss_check_every(mtype) {
	var rule = boss_check_rule(mtype);
	return rule ? fmt_minutes(Math.max(5, Number(rule.everyMinutes) || 0)) : "?";
}

/** A configured boss standing on screen: kill it whether or not we came for it. */
function live_boss_check() {
	var rules = boss_check_rules();
	for (var i = 0; i < rules.length; i++) {
		var id = rules[i] && rules[i].boss;
		if (id && rare_on_screen(id)) return id;
	}
	return null;
}

function boss_check_give_up(why) {
	game_log(why || "boss check done, back to farm");
	/** Stamp the boss we just visited so its own interval restarts from now. */
	if (boss_peek.phase) boss_peek.at[boss_peek.phase] = Date.now();
	boss_peek.phase = "";
	boss_peek.started = 0;
	save_boss_peek();
}

/** Configured boss that is furthest past its interval, or null when none is due. */
function due_boss_check() {
	var rules = boss_check_rules();
	var best = null, best_over = -1;
	for (var i = 0; i < rules.length; i++) {
		var rule = rules[i];
		if (!rule || !rule.boss) continue;
		var over = Date.now() - (boss_peek.at[rule.boss] || 0) - Math.max(5, Number(rule.everyMinutes) || 0) * 60000;
		/** Longest overdue wins so a short interval cannot starve a long one. */
		if (over >= 0 && over > best_over) {
			best_over = over;
			best = rule.boss;
		}
	}
	return best;
}

function start_boss_check() {
	var next = due_boss_check();
	if (!next) return null;
	boss_peek.phase = next;
	boss_peek.started = Date.now();
	save_boss_peek();
	game_log("boss check: " + boss_name(next) + " (every " + boss_check_every(next) + ")");
	return next;
}

function scheduled_boss_farm() {
	/** The board dropped this boss while we were on the way. */
	if (boss_peek.phase && !boss_check_rule(boss_peek.phase)) {
		boss_check_give_up("boss check " + boss_peek.phase + " no longer configured");
	}
	if (boss_peek.phase) {
		if (!boss_peek.started) {
			boss_peek.started = Date.now();
			save_boss_peek();
		}
		if (Date.now() - boss_peek.started > BOSS_CHECK_TIMEOUT_MS) {
			boss_check_give_up("boss check " + boss_peek.phase + " timeout, back to " + CONFIG.DEFAULT_FARM);
			return null;
		}
		/** Standing in the camp with nothing on screen is the "not spawned" answer. */
		if (at_best_farm(boss_peek.phase)) {
			var done = boss_peek.phase;
			boss_check_give_up(boss_name(done) + " camp empty, next check in " + boss_check_every(done));
			return start_boss_check();
		}
		return boss_peek.phase;
	}
	return start_boss_check();
}

function on_home_realm() {
	var home = CONFIG.HOME;
	if (!home || typeof server === "undefined" || !server) return true;
	if (server.pvp) return false;
	var sid = String(server.id || server.name || "");
	return server.region === home.region && (sid === home.name || sid.indexOf(home.name) !== -1);
}

function team_child_state(name) {
	try {
		var live = get_active_characters();
		return (live && live[name]) || "";
	} catch (e) {
		return "";
	}
}

function team_child_running(name) {
	var st = team_child_state(name);
	return st === "starting" || st === "loading" || st === "active" || st === "code";
}

/** Kick off one child without waiting so combat is not paused. Skip if we are ourselves a child. */
function maybe_start_team() {
	if (character.bot) return;
	if (typeof start_character !== "function") return;
	if (team_start_busy) return;
	if (Date.now() - last_start_ms < 8000) return;
	if (!on_home_realm()) return;
	var names = ["Aedroma", "Droma"];
	var slots = CONFIG.TEAM_SLOTS || {};
	for (var i = 0; i < names.length; i++) {
		var name = names[i];
		if (!name || name === character.name) continue;
		if (team_child_running(name)) continue;
		if (start_fail_until[name] && Date.now() < start_fail_until[name]) continue;
		var slot = slots[name];
		if (!slot) continue;
		last_start_ms = Date.now();
		team_start_busy = true;
		game_log("start " + name);
		start_character(name, slot).then(function () {
			game_log("started " + name);
			start_fail_until[name] = 0;
		}).catch(function (e) {
			var why = (e && (e.reason || e.message)) || e;
			game_log("start " + name + ": " + why);
			start_fail_until[name] = Date.now() + 60000;
		}).then(function () {
			team_start_busy = false;
		});
		return;
	}
}

async function tick() {
	maybe_start_team();
	poll_board();
	ALCombat.background([ping_merchant, maybe_ping_missing, maybe_ping_target, ping_hunt]);
	maybe_broadcast_control();
	if (character.rip) {
		if (typeof CaveDreams !== "undefined" && CaveDreams.inCave()) {
			await CaveDreams.tick("lead");
			return;
		}
		if (!last_death || Date.now() - last_death > 30000) {
			last_death = Date.now();
			var ph = pick_party_hunt();
			if (ph && hunt_should_try(ph.id)) {
				note_hunt_wipe(ph.id);
			} else {
				game_log("died; dropping one pack tier for " + Math.round(CONFIG.RETREAT_MS / 60000) + " min");
			}
		}
		await respawn();
		return;
	}
	watch_stuck();

	if (!ALCombat.inDanger()) await maybe_ensure_gear();
	await maybe_use_potion();
	loot();
	maybe_log_hunt_kill();
	if (await run_script_job()) return;
	if (typeof CaveDreams !== "undefined" && await CaveDreams.tick("lead")) return;
	var evrun = await maybe_run_event();
	if (evrun) {
		if (evrun.tgt) {
			await taunt_off_allies();
			if (can_use("taunt") && character.mp >= 40 && evrun.tgt.target && evrun.tgt.target !== character.name) {
				try { await use_skill("taunt", evrun.tgt); } catch (e) {}
			}
			var eventPhase = tank_phase(evrun.tgt);
			if (eventPhase === "kite" && ALCombat.engage(evrun.tgt, null)) {
				await maybe_warrior_skills(evrun.tgt);
				await swing(evrun.tgt);
				ALCombat.update();
				return;
			}
			ALCombat.release();
			if (!in_attack_range(evrun.tgt)) {
				await walk_to(evrun.tgt.x, evrun.tgt.y, "event " + (evrun.tgt.mtype || "boss"));
				return;
			}
			await swing(evrun.tgt);
		}
		return;
	}
	if (my_role() === "Leader") await keep_party();

	if (!wants_dump() && (boss_peek.phase || live_boss_check())) {
		await fight();
		return;
	}

	if (!wants_dump() && !ALCombat.inDanger() && await maybe_daisy()) return;

	if (actively_tanking() && !pots_critical() && !wants_dump()) {
		await fight();
		if (merchant_here()) await maybe_trade_merchant();
		return;
	}
	await maybe_trade_merchant();
	if (await maybe_visit_mule()) return;
	if (await maybe_city_merchant()) return;
	if (await maybe_town_bus()) return;
	await fight();
}

function can_taunt(e) {
	if (typeof StyleLoadout !== "undefined" && !StyleLoadout.allows("taunt")) return false;
	if (!e || e.rip || !can_use("taunt") || character.mp < 40) return false;
	return is_in_range(e, "taunt");
}

async function taunt_off_allies() {
	if (!can_use("taunt") || character.mp < 40) return;
	for (var id in parent.entities) {
		var e = parent.entities[id];
		if (!e || e.type !== "monster" || e.rip) continue;
		if (!e.target || e.target === character.name || !is_party_member(e.target)) continue;
		if (!can_taunt(e)) continue;
		try { await use_skill("taunt", e); } catch (err) {}
		return;
	}
}

/**
 * Daisy hunts: smart_move(mtype) to the pack. Do not wait for the priest.
 */
function hunting_this(mtype) {
	var ph = pick_party_hunt();
	return !!(ph && ph.id === mtype);
}

function hunt_packs(mtype) {
	var out = [];
	for (var name in G.maps) {
		var gm = G.maps[name];
		if (!gm || gm.ignore || gm.instance || !gm.monsters) continue;
		/** Arena / PVP packs are not Daisy farm destinations. */
		if (gm.pvp || name === "arena") continue;
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

/** Map the game will send smart_move(mtype) toward. Prefer open-world camps over underground clones (mummy has both). */
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

/** Wait on the entrance edge, 80px outside the box — not the pack centre. */
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

function pick_hunt_pack(mtype) {
	var packs = hunt_packs(mtype);
	if (!packs.length) return null;
	var on = [];
	for (var i = 0; i < packs.length; i++) {
		if (packs[i].map === character.map) on.push(packs[i]);
	}
	var list = on.length ? on : packs;
	for (var i = 0; i < list.length; i++) {
		if (inside_box(character, pack_box(list[i].b))) return list[i];
	}
	var live = get_nearest_monster({ type: mtype });
	if (live && !live.rip) {
		for (var i = 0; i < list.length; i++) {
			if (inside_box(live, pack_box(list[i].b))) return list[i];
		}
	}
	var from = character.map === list[0].map ? character : map_spawn(list[0].map);
	var best = list[0];
	var best_d = 1e15;
	for (var i = 0; i < list.length; i++) {
		var box = pack_box(list[i].b);
		var cx = Math.max(box.x1, Math.min(box.x2, from.x));
		var cy = Math.max(box.y1, Math.min(box.y2, from.y));
		var d = simple_distance(from, { x: cx, y: cy });
		if (d < best_d) {
			best_d = d;
			best = list[i];
		}
	}
	return best;
}

function hunt_wait(mtype) {
	var pk = pick_hunt_pack(mtype);
	if (!pk) return null;
	var box = pack_box(pk.b);
	var from = map_spawn(pk.map);
	if (character.map === pk.map && !inside_box(character, box)) {
		from = { x: character.x, y: character.y };
	}
	var p = edge_outside(pk.b, from, 80);
	p.map = pk.map;
	return p;
}

/** go_to gave up on this xy three times in a row (water, wall pocket, other side of a cliff). */
function dest_skipped(dest) {
	if (!dest || dest.x == null) return false;
	var until = dest_skip_until[dest_key(dest)];
	return !!(until && Date.now() < until);
}

/**
 * Daisy hunts: always smart_move(mtype). Guessed box-edge xy (mummy on
 * spookytown vs underground, desert dunes) is how the tank idled off-map.
 * cgoo / prat are exceptions: named smart_move fails from town.
 * Boo Boo / Stone Worm / Pom Pom still switch to a curb once we see the pack.
 */
function pull_dest(mtype) {
	if (mtype === "cgoo") return CGOO_FARM;
	if (mtype === "prat") return PRAT_FARM;
	if (mtype === "minimush") {
		if (!hunting_this("minimush") || (character.map === "halloween" && !dest_skipped(MINIMUSH_FARM))) return MINIMUSH_FARM;
	}
	if (mtype === "booboo") {
		if (hunting_this("booboo")) {
			var near_curb = character.map === "spookytown" && simple_distance(character, BOOBOO_FARM) < 140;
			var see_pack = character.map === "spookytown" && live_of_type("booboo");
			if ((near_curb || see_pack) && !dest_skipped(BOOBOO_FARM)) return BOOBOO_FARM;
			return "booboo";
		}
		return BOOBOO_FARM;
	}
	if (mtype === "stoneworm") return STONEWORM_FARM;
	if (hunting_this(mtype)) return mtype;
	if (mtype === "arcticbee") return ARCTICBEE_FARM;
	if (mtype === "iceroamer") return ICEROAMER_FARM;
	if (mtype === "scorpion") return SCORPION_FARM;
	if (mtype === "bigbird") return BIGBIRD_FARM;
	if (mtype === "crabx") return CRABX_FARM;
	return farm_spot(mtype);
}

function live_of_type(mtype) {
	var live = get_nearest_monster({ type: mtype });
	return !!(live && !live.rip && distance(character, live) < 280);
}

function at_pull_spot(mtype) {
	if (mtype === "minimush") {
		return character.map === "halloween" && in_minimush_box(character);
	}
	if (mtype === "booboo") {
		if (hunting_this("booboo") && live_of_type("booboo")) return true;
		return character.map === "spookytown" && simple_distance(character, BOOBOO_FARM) < 90;
	}
	if (mtype === "stoneworm") {
		return character.map === "spookytown" && simple_distance(character, STONEWORM_FARM) < 90;
	}
	if (mtype === "cgoo") {
		return character.map === "level2s" && (inside_box(character, CGOO_BOX) || simple_distance(character, CGOO_FARM) < 90 || live_of_type(mtype));
	}
	if (mtype === "prat") {
		return character.map === "level1" && (inside_box(character, PRAT_BOX) || simple_distance(character, PRAT_FARM) < 90 || live_of_type(mtype));
	}
	if (mtype === "bigbird") {
		return character.map === "main" && (in_bigbird_box(character) || simple_distance(character, BIGBIRD_FARM) < 90);
	}
	if (hunting_this(mtype)) {
		if (live_of_type(mtype)) return true;
		var packs = hunt_packs(mtype);
		for (var i = 0; i < packs.length; i++) {
			if (packs[i].map !== character.map) continue;
			if (inside_box(character, pack_box(packs[i].b))) return true;
		}
		return false;
	}
	if (mtype === "crab") return character.map === "main" && in_crab_box(character);
	if (mtype === "croc") {
		/** Anywhere in the box counts: walking back to the entrance after every kill was the croc yo-yo. */
		return character.map === "main" && (in_croc_box(character) || simple_distance(character, CROC_FARM) < 70);
	}
	if (mtype === "goo") return character.map === "main" && in_goo_box(character);
	if (mtype === "spider") return character.map === "main" && in_spider_box(character);
	if (mtype === "phoenix") return nearby_phoenix();
	if (mtype === "bat") return character.map === "cave" && in_bat_box(character);
	if (mtype === "jr") return character.map === "spookytown" && in_jr_box(character);
	if (mtype === "greenjr") return character.map === "halloween" && in_greenjr_box(character);
	if (live_of_type(mtype)) return true;
	var spot = farm_spot(mtype);
	if (!spot || spot.x == null) return false;
	if (character.map !== (spot.map || character.map)) return false;
	return simple_distance(character, spot) < 90;
}

/** Mule on screen with business for us: close to trade range between pulls. */
async function maybe_meet_mule() {
	if (actively_tanking() && !pots_critical() && !wants_dump()) return false;
	var m = get_player(CONFIG.MERCHANT);
	if (!m || m.rip || m.map !== character.map) return false;
	var d = distance(character, m);
	if (d <= 220 || d > 700) return false;
	var need = pots_critical() || wants_hpot() || wants_mpot();
	if (!need && character.gold <= CONFIG.GOLD_KEEP + 200 && dumpable_count() < 1) return false;
	var dx = character.x - m.x;
	var dy = character.y - m.y;
	var len = Math.sqrt(dx * dx + dy * dy) || 1;
	await walk_to(m.x + (dx / len) * 150, m.y + (dy / len) * 150, "meet mule");
	return true;
}

var KIT_WEAPONS = { ololipop: 1, glolipop: 1, fireblade: 1 };
var last_weapon_try = 0;
var last_weapon_log = "";

function is_kit_weapon(name) {
	return !!(name && KIT_WEAPONS[name]);
}

function is_lolipop_name(name) {
	return name === "ololipop" || name === "glolipop";
}

/** +0 lolipops go to EadroSell. Upgraded lolipops and every Fire Blade stay. */
function keep_kit_item(it) {
	if (!it) return false;
	if (it.name === "fireblade") return true;
	if (is_lolipop_name(it.name) && (it.level || 0) > 0) return true;
	return false;
}

function worn_slot(slot) {
	return character.slots && character.slots[slot];
}

function farm_weapon_key(mtype) {
	var w = CONFIG.WEAPONS;
	if (!w) return "lolipop";
	if (mtype && w.pack && w.pack[mtype]) return w.pack[mtype];
	return w.default || "lolipop";
}

function item_is_shiny(it) {
	return !!(it && it.p === "shiny");
}

function owned_has_shiny(name) {
	var main = worn_slot("mainhand");
	var off = worn_slot("offhand");
	if (main && main.name === name && item_is_shiny(main)) return true;
	if (off && off.name === name && item_is_shiny(off)) return true;
	var items = character.items || [];
	for (var i = 0; i < items.length; i++) {
		if (items[i] && items[i].name === name && item_is_shiny(items[i])) return true;
	}
	return false;
}

function count_owned_named(name) {
	var n = 0;
	var main = worn_slot("mainhand");
	var off = worn_slot("offhand");
	if (main && main.name === name) n++;
	if (off && off.name === name) n++;
	var items = character.items || [];
	for (var i = 0; i < items.length; i++) {
		if (items[i] && items[i].name === name) n++;
	}
	return n;
}

/** Bag index for name. want_shiny true prefers p:"shiny"; false prefers a non-shiny copy. */
function find_bag_weapon(name, want_shiny) {
	var items = character.items || [];
	var any = -1;
	var shiny = -1;
	var dull = -1;
	for (var i = 0; i < items.length; i++) {
		var it = items[i];
		if (!it || it.name !== name) continue;
		if (any < 0) any = i;
		if (item_is_shiny(it)) {
			if (shiny < 0) shiny = i;
		} else if (dull < 0) dull = i;
	}
	if (want_shiny) return shiny >= 0 ? shiny : any;
	return dull >= 0 ? dull : any;
}

function first_empty_bag() {
	var items = character.items || [];
	for (var i = 0; i < items.length; i++) {
		if (!items[i]) return i;
	}
	return -1;
}

function weapon_label(it) {
	if (!it) return "empty";
	return it.name + "+" + (it.level || 0) + (it.p ? "(" + it.p + ")" : "");
}

function weapon_set_ready(key) {
	var spec = CONFIG.WEAPONS && CONFIG.WEAPONS[key];
	if (!spec) return true;
	var main = worn_slot("mainhand");
	var off = worn_slot("offhand");
	if (!main || main.name !== spec.main) return false;
	if (!off || off.name !== spec.off) return false;
	if (spec.shiny_main && owned_has_shiny(spec.main) && !item_is_shiny(main)) return false;
	return true;
}

/**
 * Swap to the pack's hands before the pull. Relocate bag indexes after
 * every equip — loot and swaps move slots.
 */
async function maybe_equip_farm_weapons(mtype) {
	if (character.rip) return false;
	if (typeof StyleLoadout !== "undefined" && StyleLoadout.hasSlot("mainhand", mtype)) return false;
	if (character.q && (character.q.upgrade || character.q.compound)) return false;
	var key = farm_weapon_key(mtype);
	if (weapon_set_ready(key)) return false;
	if (now() - last_weapon_try < 400) return false;
	last_weapon_try = now();
	var spec = CONFIG.WEAPONS[key];
	if (!spec) return false;
	if (count_owned_named(spec.main) < 1) {
		if (last_weapon_log !== "miss:" + spec.main) {
			last_weapon_log = "miss:" + spec.main;
			game_log("no " + spec.main + " for " + (mtype || key) + ", keep current weapons");
		}
		return false;
	}
	var need_shiny = !!(spec.shiny_main && owned_has_shiny(spec.main));
	var off = worn_slot("offhand");
	if (need_shiny && off && off.name === spec.main && item_is_shiny(off)) {
		var main = worn_slot("mainhand");
		if ((!main || !item_is_shiny(main)) && first_empty_bag() !== -1) {
			try { await unequip("offhand"); } catch (e) { return true; }
		}
	}
	var main = worn_slot("mainhand");
	var main_ok = main && main.name === spec.main && (!need_shiny || item_is_shiny(main));
	if (!main_ok) {
		var idx = find_bag_weapon(spec.main, need_shiny);
		if (idx < 0) return false;
		try {
			await equip(idx, "mainhand");
		} catch (e) {
			game_log("equip main " + spec.main + ": " + (e.reason || e));
			return true;
		}
	}
	off = worn_slot("offhand");
	var off_ok = off && off.name === spec.off;
	if (off_ok && spec.shiny_main && item_is_shiny(off) && worn_slot("mainhand") && !item_is_shiny(worn_slot("mainhand"))) {
		off_ok = false;
	}
	if (!off_ok) {
		var oidx = find_bag_weapon(spec.off, false);
		if (oidx < 0) oidx = find_bag_weapon(spec.off, true);
		if (oidx >= 0) {
			try {
				await equip(oidx, "offhand");
			} catch (e) {
				game_log("equip off " + spec.off + ": " + (e.reason || e));
				return true;
			}
		}
	}
	if (weapon_set_ready(key) && last_weapon_log !== key) {
		last_weapon_log = key;
		game_log("weapons " + key + " for " + (mtype || "pack") + ": " + weapon_label(worn_slot("mainhand")) + " / " + weapon_label(worn_slot("offhand")));
	}
	return true;
}

var tank_combat = { id: null, phase: "idle", since: 0, lostAt: 0 };
function set_tank_phase(phase, target) {
	if (tank_combat.phase !== phase || tank_combat.id !== (target && target.id)) tank_combat.since = Date.now();
	tank_combat.phase = phase; tank_combat.id = target && target.id || null;
	if (typeof ALCombat !== "undefined" && ALCombat.setPhase) ALCombat.setPhase(phase);
	return phase;
}
function tank_phase(target) {
	if (!target || target.rip || target.hp <= 0) return set_tank_phase("recover", null);
	if (tank_combat.id !== target.id) return set_tank_phase("approach", target);
	var damaged = typeof target.max_hp === "number" && target.hp < target.max_hp;
	var ours = target.target === character.name;
	var partyAggro = target.target && is_party_member(target.target);
	if (ours) {
		tank_combat.lostAt = 0;
		if (tank_combat.phase !== "secure" && tank_combat.phase !== "kite") return set_tank_phase("secure", target);
		if (tank_combat.phase === "secure" && Date.now() - tank_combat.since >= 600) return set_tank_phase("kite", target);
		return tank_combat.phase;
	}
	if (tank_combat.phase === "kite") {
		if (!tank_combat.lostAt) tank_combat.lostAt = Date.now();
		return set_tank_phase("engage", target);
	}
	if (partyAggro || damaged) return set_tank_phase("engage", target);
	return set_tank_phase("approach", target);
}

async function fight() {
	if (my_role() === "Follow") {
		var lead = get_player(party_leader());
		if (lead && distance(character, lead) > 90 && !actively_tanking()) {
			await walk_to(lead.x, lead.y, "follow " + party_leader());
			return;
		}
	}
	var mtype = farm_monster();
	await maybe_equip_farm_weapons(mtype);
	if (mtype === "booboo" && character.map === "spookytown" && character.x > BOOBOO_SOFT_X) {
		await go_to(BOOBOO_FARM, "too deep in booboo", 40, true);
		return;
	}
	var tanking = actively_tanking();
	var target = pick_monster(mtype);
	if (target && in_attack_range(target) && smart.moving) stop_smart();
	if (!target && !tanking && !at_pull_spot(mtype) && !(hunting_this(mtype) && live_of_type(mtype))) {
		await go_to(pull_dest(mtype), farm_reason(mtype), undefined, true);
		return;
	}
	if (!target && !tanking && await maybe_meet_mule()) return;
	if (!target) {
		if (mtype === "croc") {
			await go_to(CROC_PULL, "pull crocs", 40, true);
			return;
		}
		if (mtype === "stoneworm") {
			await go_to(STONEWORM_FARM, "stoneworm west curb", 40, true);
			return;
		}
		if (at_pull_spot(mtype) || (hunting_this(mtype) && live_of_type(mtype))) return;
		await go_to(pull_dest(mtype), farm_reason(mtype), undefined, true);
		return;
	}
	change_target(target);
	await taunt_off_allies();
	if (is_party_member(target.target) && target.target !== character.name && can_taunt(target)) {
		try { await use_skill("taunt", target); } catch (e) {}
	}
	/** Let the normal attack approach make contact before movement takes ownership.
	 * Starting the kite planner on an untouched target can orbit outside melee range
	 * forever, so the target must first aggro the party or lose HP. */
	var phase = tank_phase(target);
	if (phase === "kite" && ALCombat.engage(target, null)) {
		await maybe_warrior_skills(target);
		if (!(await try_aoe(mtype))) await swing(target);
		ALCombat.update();
		return;
	}
	ALCombat.release();
	await maybe_warrior_skills(target);
	if (await try_aoe(mtype)) return;
	if (CONFIG.KITE_ENABLED === false && CONFIG.USE_CHARGE && mtype !== "minimush" && mtype !== "booboo" && mtype !== "stoneworm" && mtype !== "bigbird" && can_use("charge") && !in_attack_range(target) && (typeof StyleLoadout === "undefined" || StyleLoadout.allows("charge", mtype))) {
		try { await use_skill("charge"); } catch (e) {}
	}
	if (!target || target.type !== "monster") return;
	if (!in_attack_range(target)) {
		if (mtype === "booboo") {
			await close_on_booboo(target);
			return;
		}
		if (mtype === "stoneworm") {
			await walk_to(target.x, target.y, "close on stoneworm");
			return;
		}
		await walk_to(target.x, target.y, "close on " + (target.mtype || mtype));
		return;
	}
	await swing(target);
}

function fight_engaged(target) {
	if (!target || target.rip || target.type !== "monster") return false;
	if (target.target === character.name || (target.target && is_party_member(target.target))) return true;
	return typeof target.max_hp === "number" && target.hp < target.max_hp;
}

function in_attack_range(target) {
	if (!target || target.rip) return false;
	if (!is_in_range(target)) return false;
	var reach = (character.range || 25) - 4;
	return simple_distance(character, target) <= Math.max(10, reach);
}

async function swing(target) {
	if (!target || target.rip || !can_attack(target)) return false;
	try {
		await attack(target);
		return true;
	} catch (e) {
		if (ALCombat.active()) return false;
		if (e && e.reason === "too_far") {
			if ((target.mtype || "") === "booboo") {
				await close_on_booboo(target);
			} else if ((target.mtype || "") === "stoneworm") {
				await walk_to(target.x, target.y, "close on stoneworm");
			} else {
				await walk_to(target.x, target.y, "close on " + (target.mtype || "mob"));
			}
		}
		return false;
	}
}

function party_min_level() {
	var min = character.level;
	for (var i = 0; i < CONFIG.PARTY.length; i++) {
		var ally = get_player(CONFIG.PARTY[i]);
		if (ally && ally.level < min) min = ally.level;
	}
	if (character.level - min > 8) min = character.level - 8;
	return min;
}

function farm_by_level() {
	var min = party_min_level();
	var best = "bee";
	for (var i = 0; i < CONFIG.FARM.length; i++) {
		if (min >= CONFIG.FARM[i][0]) best = CONFIG.FARM[i][1];
	}
	return best;
}

/**
 * The old gate held the pack at armadillo while any body piece was missing
 * pants — 2,258 armadillo kills at level 41. Death is the honest signal: if
 * the tank died recently, step down one tier; otherwise trust the level table.
 */
function retreating() {
	return last_death && Date.now() - last_death < CONFIG.RETREAT_MS;
}

function farm_tier_down(name) {
	if (name === "croc") return "armadillo";
	if (name === "crab") return "crab";
	if (name === "goo") return "goo";
	/** After a Jr. wipe, spiders are the gold pack. */
	if (name === "jr") return "spider";
	if (name === "greenjr") return "spider";
	if (name === "minimush") return "spider";
	if (name === "phoenix") return "spider";
	if (name === "arcticbee") return "spider";
	if (name === "iceroamer") return "spider";
	if (name === "scorpion") return "spider";
	if (name === "bigbird") return "scorpion";
	if (name === "crabx") return "spider";
	if (name === "stoneworm") return "scorpion";
	if (name === "booboo") return "stoneworm";
	if (name === "spider") return "croc";
	/** After a bat wipe, armadillo is the safe pack next to the cave door. */
	if (name === "bat") return "armadillo";
	for (var i = 1; i < CONFIG.FARM.length; i++) {
		if (CONFIG.FARM[i][1] === name) return CONFIG.FARM[i - 1][1];
	}
	return name;
}

function nearby_phoenix() {
	var p = get_nearest_monster({ type: "phoenix" });
	return !!(p && !p.rip && p.hp > 0);
}

function farm_monster() {
	var pick = live_control().monster;
	if (pick && pick !== "auto") return pick;
	if (nearby_phoenix()) return "phoenix";
	var livecheck = live_boss_check();
	if (livecheck) {
		if (boss_peek.phase) boss_check_give_up("live " + boss_name(livecheck) + ", end check timer");
		return livecheck;
	}
	var ph = pick_party_hunt();
	if (ph) {
		if (ph.who !== character.name) maybe_log_ally_hunt(ph);
		if (!hunt_target_ready(ph.id)) return CONFIG.DEFAULT_FARM;
		return ph.id;
	}
	var peek = scheduled_boss_farm();
	if (peek) return peek;
	var h = hunt_info();
	if (h && h.c > 0) maybe_log_skip(h.id);
	if (retreating()) return farm_tier_down(CONFIG.DEFAULT_FARM);
	return CONFIG.DEFAULT_FARM;
}

function ally_hunt(name) {
	var rec = ally_hunts[name];
	if (!rec || Date.now() - rec.at > 20000) return null;
	return rec;
}

/** First allowed live hunt: us, then Droma, then Aedroma. */
function pick_party_hunt() {
	var mine = hunt_info();
	if (mine && mine.c > 0 && hunt_should_try(mine.id)) {
		return { who: character.name, id: mine.id, c: mine.c };
	}
	for (var i = 0; i < CONFIG.PARTY.length; i++) {
		var name = CONFIG.PARTY[i];
		var rec = ally_hunt(name);
		if (!rec || !rec.id || !(rec.c > 0)) continue;
		if (!hunt_should_try(rec.id)) continue;
		return { who: name, id: rec.id, c: rec.c };
	}
	return null;
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

function hunt_type() {
	var h = hunt_info();
	return (h && h.id) || "";
}

function hunt_is_failed(id) {
	if (!id) return false;
	var rec = hunt_wipes[id];
	if (!rec || !rec.n) return false;
	if (rec.until && Date.now() >= rec.until) return false;
	return rec.n >= CONFIG.HUNT_WIPE_MAX;
}

function note_hunt_wipe(id) {
	if (!id) return;
	var rec = hunt_wipes[id] || { n: 0, until: 0, last: 0 };
	if (rec.until && Date.now() >= rec.until) rec = { n: 0, until: 0, last: 0 };
	if (rec.last && Date.now() - rec.last < 30000) return;
	rec.n += 1;
	rec.last = Date.now();
	rec.until = Date.now() + 36 * 60 * 1000;
	hunt_wipes[id] = rec;
	try { set("hunt_wipes", hunt_wipes); } catch (e) {}
	if (rec.n >= CONFIG.HUNT_WIPE_MAX) {
		game_log("hunt " + id + " failed after " + rec.n + " deaths, back to spiders");
	} else {
		game_log("hunt " + id + " wipe " + rec.n + "/" + CONFIG.HUNT_WIPE_MAX);
	}
}

function mark_hunt_failed(id) {
	note_hunt_wipe(id);
}

function hunt_should_try(id) {
	if (!id || !HUNT_ALLOW[id]) return false;
	if (hunt_is_failed(id)) return false;
	return true;
}

function rare_on_screen(id) {
	if (!id) return false;
	for (var key in parent.entities) {
		var e = parent.entities[key];
		if (e && e.type === "monster" && !e.rip && e.mtype === id && e.hp > 0) return true;
	}
	return false;
}

function rare_server_live(id) {
	var S = server_status();
	var st = S && S[id];
	if (!st) return false;
	return !!(st.live || st.hp > 0 || (st.map && st.x != null));
}

function pumpkin_live() {
	return rare_on_screen("mrpumpkin") || rare_server_live("mrpumpkin");
}

function crabxx_live() {
	return rare_on_screen("crabxx") || rare_server_live("crabxx");
}

/** Jr. / Green Jr. hunts: fight them if spawned, otherwise spiders.
 *  Pom Poms: fight unless Mr. Pumpkin is live (range 520 covers the camp).
 *  Huge crabs: fight unless Giga Crab is in that beach box.
 *  Phoenix hunt: only if one is actually live; otherwise spiders (it can
 *  spawn in the spider box). */
function hunt_target_ready(id) {
	if (id === "minimush") {
		if (pumpkin_live()) {
			if (last_skip_log !== "miss:pumpkin") {
				last_skip_log = "miss:pumpkin";
				game_log("Mr. Pumpkin live, spiders until it is gone");
			}
			return false;
		}
		return true;
	}
	if (id === "crabx") {
		if (crabxx_live()) {
			if (last_skip_log !== "miss:crabxx") {
				last_skip_log = "miss:crabxx";
				game_log("Giga Crab live, spiders until it is gone");
			}
			return false;
		}
		return true;
	}
	if (id === "phoenix") {
		if (nearby_phoenix() || rare_on_screen("phoenix") || rare_server_live("phoenix")) {
			rare_hunt_miss_until = 0;
			return true;
		}
		if (last_skip_log !== "miss:phoenix") {
			last_skip_log = "miss:phoenix";
			game_log("phoenix not spawned, spiders until one is live");
		}
		return false;
	}
	if (id !== "jr" && id !== "greenjr") return true;
	if (rare_on_screen(id) || rare_server_live(id)) {
		rare_hunt_miss_until = 0;
		return true;
	}
	if (at_pull_spot(id) || at_best_farm(id)) {
		rare_hunt_miss_until = Date.now() + RARE_HUNT_MISS_MS;
		if (last_skip_log !== "miss:" + id) {
			last_skip_log = "miss:" + id;
			game_log(id + " not spawned, spiders — peek camp again in " + Math.round(RARE_HUNT_MISS_MS / 60000) + " min");
		}
		return false;
	}
	if (Date.now() < rare_hunt_miss_until) return false;
	return true;
}

function maybe_log_skip(id) {
	if (!id || last_skip_log === id) return;
	last_skip_log = id;
	game_log("skip hunt " + id + ", farm " + CONFIG.DEFAULT_FARM + " until it expires");
}

function maybe_log_ally_hunt(ph) {
	var key = ph.who + ":" + ph.id;
	if (last_skip_log === key) return;
	last_skip_log = key;
	game_log(ph.who + " hunt " + ph.id + " x" + ph.c + ", we tank");
}

function daisy_need_own() {
	var h = hunt_info();
	return !h || h.c === 0;
}

function own_hunt_usable() {
	var h = hunt_info();
	return !!(h && h.c > 0 && hunt_should_try(h.id));
}

function daisy_need_ally() {
	for (var i = 0; i < CONFIG.PARTY.length; i++) {
		var name = CONFIG.PARTY[i];
		var rec = ally_hunts[name];
		var seen = rec && Date.now() - rec.at < 30000;
		if (!seen && !get_player(name)) continue;
		if (rec && rec.need) return true;
	}
	return false;
}

function near_daisy() {
	if (character.map !== "main") return false;
	var p = npc_xy("monsterhunter") || CONFIG.DAISY;
	return !!(p && simple_distance(character, p) < 350);
}

async function ping_hunt() {
	if (now() - last_hunt_ping < 2000) return;
	last_hunt_ping = now();
	var farm = farm_monster();
	var ph = pick_party_hunt();
	var id = farm || (ph ? ph.id : ((hunt_info() && hunt_info().id) || ""));
	var c = ph ? ph.c : ((hunt_info() && hunt_info().c) || 0);
	var trying = (farm === "jr" || farm === "greenjr" || farm === "phoenix") ? 1 : ((ph && hunt_target_ready(ph.id)) ? 1 : 0);
	var msg = { t: "hunt", id: id, c: c, try: trying, who: ph ? ph.who : "", map: character.map, x: Math.round(character.x), y: Math.round(character.y) };
	try {
		await send_cm(CONFIG.PARTY, msg);
	} catch (e) {}
}

/**
 * Daisy: interact("monsterhunt") starts a hunt or turns one in.
 * Do not call her while c > 0 (server refuses). Cannot skip a live hunt.
 * Only walk over between pulls.
 */
async function maybe_daisy() {
	var own = daisy_need_own();
	var ally = daisy_need_ally();
	if (!own && (own_hunt_usable() || !ally)) return false;
	if (actively_tanking() && !own) return false;
	if (pots_critical()) return false;
	var turnin = !!(hunt_info() && hunt_info().c === 0);
	if (!near_daisy()) {
		await go_to("monsterhunter", turnin ? "Daisy turn-in" : "Daisy hunt");
		return true;
	}
	if (!own) return false;
	if (now() - last_daisy_ms < 8000) return true;
	last_daisy_ms = now();
	try {
		var result = await interact("monsterhunt", 8000);
		if (result && result.completed) {
			game_log("hunt turned in, Monster Token");
			await sleep_ms(400);
			result = await interact("monsterhunt", 8000);
		}
		if (result && result.started) {
			var nh = hunt_info();
			last_skip_log = "";
			game_log("hunt started: " + ((nh && nh.id) || "?") + " x" + ((nh && nh.c) || 0));
		}
	} catch (e) {
		game_log("daisy: " + (e.reason || e.message || e));
	}
	return true;
}

function farm_reason(mtype) {
	var ph = pick_party_hunt();
	if (ph && ph.id === mtype) {
		if (ph.who === character.name) return "Daisy hunt " + mtype + " (" + ph.c + " left)";
		return ph.who + " hunt " + mtype + " (" + ph.c + " left)";
	}
	if (mtype === "phoenix") return "phoenix on screen, take the cooperative";
	if (mtype === "goo") return "goos for Slime Core";
	if (mtype === "crab") return "crabs for Crab Claw";
	if (mtype === "croc") return "crocs for gold";
	if (mtype === "jr") return "Jr. camp, spookytown west box";
	if (mtype === "greenjr") return "Green Jr. camp, west halloween snakes";
	if (mtype === "minimush") return "Pom Poms, east halloween (stay off scorpions)";
	if (mtype === "spider") return "main spiders for gold";
	if (mtype === "arcticbee") return "arctic bees, winterland east of the cave";
	if (mtype === "iceroamer") return "water spirits, winterland west box";
	if (mtype === "scorpion") return "main scorpions, east of spiders";
	if (mtype === "bigbird") return "Hawks, main south of spiders (west curb)";
	if (mtype === "crabx") return "huge crabs, south beach";
	if (mtype === "booboo") return "east Boo Boos: west road, then melee close (no curb freeze)";
	if (mtype === "stoneworm") return "stoneworms, spookytown south-east west curb";
	if (mtype === "prat") return "Vampire Rats, level1 west of first pack";
	if (mtype === "bat") return "cave bats";
	if (mtype === "snake") return "snake pack (smart_move)";
	if (retreating()) return "no " + mtype + " here; retreat tier after death";
	return "no " + mtype + " here; party floor lv" + party_min_level();
}

/**
 * Phoenix: if one is on screen, farm it (cooperative). After a death, skip extras
 * (RETREAT_MS).
 */
function rare_aoe_hunt() {
	return null;
}

function weapon_type() {
	var slot = character.slots && character.slots.mainhand;
	if (!slot || !G.items[slot.name]) return null;
	return G.items[slot.name].wtype;
}

function valid_monsters_in(range, mtype) {
	var n = 0;
	for (var id in parent.entities) {
		var e = parent.entities[id];
		if (!e || e.type !== "monster" || e.rip) continue;
		if (mtype && e.mtype !== mtype) continue;
		if (e.target && !is_party_member(e.target)) continue;
		if (distance(character, e) <= range) n++;
	}
	return n;
}

async function maybe_warrior_skills(target) {
	var ok = function (sk) { return typeof StyleLoadout === "undefined" || StyleLoadout.allows(sk); };
	if (ok("hardshell") && can_use("hardshell") && character.mp >= 480 && character.hp / character.max_hp <= 0.55) {
		try { await use_skill("hardshell"); } catch (e) {}
	}
	/**
	 * Warcry is 320 MP on a 325 MP pool: one cast a minute emptied the tank,
	 * left no 40 MP for taunt for the next pot cooldown, and cost ~60 mana
	 * pots an hour. Keep a taunt in reserve; the skill turns itself back on as
	 * the pool grows.
	 */
	if (ok("warcry") && can_use("warcry") && character.mp >= 320 + 80) {
		try { await use_skill("warcry"); } catch (e) {}
	}
	if (ok("charge") && CONFIG.KITE_ENABLED === false && CONFIG.USE_CHARGE && target && target.mtype !== "minimush" && target.mtype !== "booboo" && target.mtype !== "stoneworm" && target.mtype !== "bigbird" && can_use("charge") && !is_in_range(target)) {
		try { await use_skill("charge"); } catch (e) {}
	}
}

/** Cleave (52, axe/scythe) and Stomp (52, basher) when 2+ pack members are in range. */
async function try_aoe(mtype) {
	/** Two extra 50-atk bats on a 3k HP tank is how this pack wipes. */
	if (mtype === "bat" || mtype === "spider" || mtype === "phoenix" || mtype === "jr" || mtype === "greenjr" || mtype === "minimush" || mtype === "iceroamer" || mtype === "scorpion" || mtype === "crabx" || mtype === "booboo" || mtype === "stoneworm" || mtype === "bigbird") return false;
	if (typeof StyleLoadout !== "undefined" && !StyleLoadout.allows("cleave", mtype) && !StyleLoadout.allows("stomp", mtype)) return false;
	var wtype = weapon_type();
	if ((typeof StyleLoadout === "undefined" || StyleLoadout.allows("cleave", mtype)) && can_use("cleave") && (wtype === "axe" || wtype === "scythe") && character.mp >= 720) {
		if (valid_monsters_in(160, mtype) >= 2) {
			try { await use_skill("cleave"); return true; } catch (e) {}
		}
	}
	if ((typeof StyleLoadout === "undefined" || StyleLoadout.allows("stomp", mtype)) && can_use("stomp") && wtype === "basher" && character.mp >= 120) {
		if (valid_monsters_in(80, mtype) >= 3) {
			try { await use_skill("stomp"); return true; } catch (e) {}
		}
	}
	return false;
}

/**
 * Gear the player may want for each slot, best first. Kit weapons are
 * swapped by pack (CONFIG.WEAPONS) and never dumped. The list also feeds
 * the kit report the mule sees.
 */
var last_gear = 0;
var WEAR_SLOTS = [
	{ slot: "mainhand", items: ["ololipop", "glolipop", "fireblade", "wbasher", "blade"] },
	{ slot: "offhand", items: ["glolipop", "ololipop", "fireblade"] },
	{ slot: "chest", items: ["wattire", "coat1", "coat"] },
	{ slot: "gloves", items: ["wgloves", "gloves1", "gloves"] },
	{ slot: "pants", items: ["wbreeches", "pants1", "pants"] },
	{ slot: "helmet", items: ["wcap", "helmet1", "helmet"] },
	{ slot: "shoes", items: ["wshoes", "shoes1", "shoes"] },
	{ slot: "belt", items: ["hpbelt", "strbelt"] },
	{ slot: "amulet", items: ["hpamulet", "stramulet"] },
	{ slot: "ring1", items: ["vitring", "strring", "ringsj", "intring", "dexring"] },
	{ slot: "ring2", items: ["vitring", "strring", "ringsj", "intring", "dexring"] },
	{ slot: "earring1", items: ["vitearring", "strearring", "intearring", "dexearring"] },
	{ slot: "earring2", items: ["vitearring", "strearring", "intearring", "dexearring"] }
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
		if (!best || lv > best.level || (lv === best.level && rank < best.rank)) {
			best = { i: i, name: it.name, level: lv, rank: rank };
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
			if (eq_rank === bag.rank && eq_lv === bag.level) return;
		}
	}
	try {
		await equip(bag.i, slot);
		game_log("wear " + bag.name + "+" + bag.level + " " + slot);
	} catch (e) {
		try { await equip(bag.i); } catch (e2) {}
	}
}

async function maybe_ensure_gear() {
	if (Date.now() - last_gear < (CONFIG.GEAR_MS || 5000)) return;
	last_gear = Date.now();
	await wear_slot("belt", ["hpbelt", "strbelt"]);
	await wear_slot("amulet", ["hpamulet", "stramulet"]);
	await wear_slot("ring1", ["vitring", "strring", "ringsj", "intring", "dexring"]);
	await wear_slot("ring2", ["vitring", "strring", "ringsj", "intring", "dexring"]);
	await wear_slot("earring1", ["vitearring", "strearring", "intearring", "dexearring"]);
	await wear_slot("earring2", ["vitearring", "strearring", "intearring", "dexearring"]);
	if (typeof StyleLoadout !== "undefined") await StyleLoadout.equip(typeof combat_mtype === "function" ? combat_mtype() : null);
}

/** Bag item that beats what is worn in one of its slots: keep it for equip. */
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
	}
	return false;
}

async function maybe_use_potion() {
	var hp_ratio = character.hp / character.max_hp;
	if (hp_ratio < CONFIG.HP_POT_RATIO && has_hp_pot() && !is_on_cooldown("use_hp")) {
		try { await use_skill("use_hp"); } catch (e) {}
		return;
	}
	if ((character.mp / character.max_mp < CONFIG.MP_USE_RATIO || character.mp < CONFIG.MP_POT_BELOW)
		&& has_mp_pot() && !is_on_cooldown("use_mp")) {
		try { await use_skill("use_mp"); } catch (e) {}
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

function wants_city_pots() {
	var floor = CONFIG.CITY_POT || CONFIG.POT_ASK_HP || CONFIG.POT_MIN;
	return item_count(CONFIG.HPOT) < floor || item_count(CONFIG.MPOT) < floor;
}

function bag_full() {
	return (character.esize || 0) <= (CONFIG.DUMP_ESIZE || 4);
}

function wants_dump() {
	if (dumpable_count() < 1) return false;
	if (bag_full()) return true;
	/** Once we walked to town, keep handing junk until the bag is actually empty of it. */
	return !!city_trip;
}

function wants_city_stop() {
	if (city_backoff && Date.now() < city_backoff && !pots_critical() && !wants_dump()) return false;
	if (wants_dump()) return true;
	if (!merchant_on_duty()) return false;
	return wants_city_pots() || wants_mluck();
}

function in_city_area(who) {
	if (!who) return false;
	var map = who.map || character.map;
	if (map !== "main") return false;
	return simple_distance(who, CONFIG.CITY) < 450;
}

function ally_mluck_ok(p) {
	if (!p) return true;
	var s = p.s && p.s.mluck;
	if (!s) return false;
	if (s.strong && s.f && s.f !== CONFIG.MERCHANT) return true;
	return s.f === CONFIG.MERCHANT && s.ms > CONFIG.MLUCK_REFRESH_MS;
}

function city_service_done() {
	if (wants_dump() || wants_mluck() || wants_city_pots()) return false;
	for (var i = 0; i < CONFIG.PARTY.length; i++) {
		var p = get_player(CONFIG.PARTY[i]);
		if (!p || distance(character, p) > 420) continue;
		if (!ally_mluck_ok(p)) return false;
	}
	if (!city_trip.served) city_trip.served = Date.now();
	return Date.now() - city_trip.served > 8000;
}

/**
 * Walk the party to the town stand for mule potions and mluck.
 * The mule parks at Town Square; we do not chase it to the fishing shore.
 */
async function maybe_city_merchant() {
	if (actively_tanking() && !pots_critical() && !wants_dump()) return false;
	if (merchant_here() && dumpable_count() > 0) {
		await maybe_trade_merchant();
		return true;
	}
	if (!city_trip && !wants_city_stop()) return false;
	if (!city_trip && wants_city_stop()) {
		city_trip = { started: Date.now() };
		game_log(wants_dump() ? "city: dump bag to mule" : "city: restock and mluck from mule");
	}
	if (!city_trip) return false;
	if (Date.now() - city_trip.started > CONFIG.CITY_WAIT_MS) {
		game_log("city: mule too slow, back to farm");
		city_trip = null;
		city_backoff = Date.now() + 60000;
		return false;
	}
	var m = get_player(CONFIG.MERCHANT);
	var dest = CONFIG.CITY;
	if (m && in_city_area(m)) dest = { map: m.map, x: m.x, y: m.y };
	if (character.map !== dest.map || simple_distance(character, dest) > 70) {
		await go_to(dest, m && in_city_area(m) ? "mule in city" : "city mule stand");
		return true;
	}
	await maybe_trade_merchant();
	if (city_service_done()) {
		city_trip = null;
		return false;
	}
	return true;
}

/**
 * Mule stands at the cave door (bats one-shot 109 HP) and at Spooky Town
 * plaza (0,0) while we camp Jr. Walk there between pulls. Never drop a
 * live target.
 */
async function maybe_visit_mule() {
	if (actively_tanking() && !pots_critical() && !wants_dump()) return false;
	if (character.map !== "cave" && character.map !== "spookytown") return false;
	var m = get_player(CONFIG.MERCHANT);
	if (!m) return false;
	if (distance(character, m) <= 280) return false;
	var need = pots_critical() || wants_hpot() || wants_mpot();
	if (!need && character.gold <= CONFIG.GOLD_KEEP + 200 && dumpable_count() < 1) return false;
	await walk_to(m.x, m.y, character.map === "cave" ? "mule at cave door" : "mule at spookytown plaza");
	return true;
}

function is_potion_name(n) {
	return n === "hpot0" || n === "mpot0" || n === "hpot1" || n === "mpot1";
}

function is_dumpable(it) {
	if (!it || it.l) return false;
	if (it.name === "tracker") return item_count("tracker") > 1;
	if (is_potion_name(it.name)) return false;
	if (is_lolipop_name(it.name) && (it.level || 0) === 0) return true;
	if (keep_kit_item(it) || is_kit_weapon(it.name)) return false;
	if (CONFIG.KEEP_ITEMS && CONFIG.KEEP_ITEMS.indexOf(it.name) >= 0) return false;
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
	if (need_h || need_m) wait = Math.min(wait, 3500);
	if (wants_dump()) wait = Math.min(wait, 2500);
	if (now() - last_mux_sent < wait) return;
	last_mux_sent = now();
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
			coming: (city_trip || wants_dump()) ? 1 : 0,
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
	if (dumpable_count() > 0) {
		await dump_bag_to_merchant();
		return;
	}
	if (character.gold > CONFIG.GOLD_KEEP + 200 && now() - last_gold_send > 8000) {
		var amt = character.gold - CONFIG.GOLD_KEEP;
		last_gold_send = now();
		try { await send_gold(CONFIG.MERCHANT, amt); } catch (e) {}
	}
}

async function dump_bag_to_merchant() {
	if (now() - last_give_at < 400) return;
	var items = character.items || [];
	var name = null;
	var level = 0;
	for (var i = 0; i < items.length; i++) {
		var it = items[i];
		if (!is_dumpable(it)) continue;
		name = it.name;
		level = it.level || 0;
		break;
	}
	if (!name) return;
	last_give_at = now();
	last_give_name = name;
	try {
		game_log("dump " + name + "+" + level + " to mule");
		await send_cm(CONFIG.MERCHANT, { t: "give", item: name, level: level });
	} catch (e) {}
	var found = -1;
	var q = 1;
	items = character.items || [];
	for (var j = 0; j < items.length; j++) {
		var cur = items[j];
		if (!cur || cur.name !== name) continue;
		if ((cur.level || 0) !== level) continue;
		if (!is_dumpable(cur)) continue;
		found = j;
		q = cur.q || 1;
		break;
	}
	if (found === -1) return;
	try { await send_item(CONFIG.MERCHANT, found, q); } catch (e) {}
}

function need_pots() {
	return drinkable_hp() < CONFIG.POT_MIN || drinkable_mp() < CONFIG.POT_MIN;
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
 * Where to stand for each NPC. Cue (newupgrade) is drawn on his booth at
 * -207,-220: that point is not walkable and smart_move to it printed
 * "Path not found!" 767 times in ten minutes. The game's own
 * smart_move("upgrade") stands at -204,-129; use the same spot.
 */
var SHOP_XY = {
	scrolls: { map: "main", x: -464, y: -96 },
	newupgrade: { map: "main", x: -204, y: -129 },
	fancypots: { map: "main", x: -35, y: -162 },
	basics: { map: "main", x: -89, y: -165 },
	monsterhunter: { map: "main", x: 126, y: -413 }
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
	if (name === "scroll0" || name === "scroll1" || name === "cscroll0" || name === "cscroll1") return "scrolls";
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

function actively_tanking() {
	if (monster_on_me()) return true;
	var t = get_targeted_monster();
	if (!t || t.rip) return false;
	return t.target === character.name || is_party_member(t.target);
}

function nearby_ally_needs_kit() {
	for (var i = 0; i < CONFIG.PARTY.length; i++) {
		var ally = get_player(CONFIG.PARTY[i]);
		if (ally && distance(character, ally) < 420 && ally_needs_kit(ally)) return true;
	}
	return false;
}

function at_farm_pack() {
	return at_best_farm(farm_monster());
}

function in_town_shop() {
	return near_npc("basics") || near_npc("fancypots") || near_npc("newupgrade");
}

function waiting_on_ally_kit() {
	if (now() < kit_wait_done_until) return false;
	return nearby_ally_needs_kit();
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

function party_needs_bus() {
	var starved = pots_starved();
	if (!pots_critical()) return false;
	return !merchant_on_duty() || starved;
}

function ally_needs_kit(ally) {
	if (!ally || !ally.slots) return false;
	var slots = ally.slots;
	var seen = false;
	for (var k in slots) {
		if (slots[k]) {
			seen = true;
			break;
		}
	}
	if (!seen) return false;
	return !slots.chest || !slots.gloves || !slots.pants;
}

function wants_upgrade() {
	if (!has_upgrade_candidate()) return false;
	if (item_count("scroll0") >= 4) return true;
	return character.gold >= CONFIG.UPGRADE_TRIP_GOLD;
}

function upgrade_budget_spent() {
	if (my_job() === "upgrade") return false;
	return upgrade_tries >= CONFIG.UPGRADE_MAX_TRIES;
}

function can_upgrade_armor() {
	if (upgrade_budget_spent()) return false;
	return wants_upgrade();
}

async function maybe_share_gold() {
	if (now() - last_gold_share < CONFIG.SHARE_MS) return;
	if (character.gold < CONFIG.GOLD_KEEP + 3400) return;
	for (var i = 0; i < CONFIG.PARTY.length; i++) {
		var name = CONFIG.PARTY[i];
		if (!name) continue;
		var ally = get_player(name);
		if (!ally || distance(character, ally) > 250) continue;
		if (!ally_needs_kit(ally)) continue;
		var amount = Math.min(CONFIG.ALLY_GOLD, character.gold - CONFIG.GOLD_KEEP);
		if (amount < 3400) continue;
		last_gold_share = now();
		try {
			await send_gold(name, amount);
			gold_sent[name] = true;
			game_log("sent " + amount + " gold to " + name + " for kit");
		} catch (e) {
			game_log("send gold to " + name + " failed: " + (e.reason || e));
		}
		return;
	}
}

async function maybe_town_bus() {
	if (locate_item("essenceoffire") !== -1 && !actively_tanking() && !at_farm_pack()) {
		if (await maybe_craft_fire_weapon()) return true;
	}
	if (!party_needs_bus()) return false;
	if (!near_npc("fancypots")) {
		await go_to("fancypots", "emergency potions (merchant off)");
		return true;
	}
	await buy_up_to(CONFIG.HPOT, CONFIG.POT_BUY);
	await buy_up_to(CONFIG.MPOT, CONFIG.POT_BUY);
	return false;
}

/** Craft only; the blade is left in the bag for the player to equip. */
async function maybe_craft_fire_weapon() {
	if (locate_item("essenceoffire") === -1) return false;
	if (character.slots && character.slots.mainhand && character.slots.mainhand.name === "fireblade") return false;
	if (locate_item("fireblade") !== -1) return false;
	if (locate_item("blade") === -1) {
		if (character.gold < CONFIG.GOLD_RESERVE + 8400 + 20000) return false;
		await go_to("basics", "buy blade for fireblade craft");
		try { await buy("blade"); } catch (e) { return false; }
	}
	if (character.gold < 20000) return false;
	await go_to("craftsman", "craft fireblade (have essenceoffire)");
	try {
		await auto_craft("fireblade");
		game_log("crafted fireblade (stays on us, swapped by pack)");
		return true;
	} catch (e) {
		game_log("craft fireblade: " + (e.reason || e));
		return false;
	}
}

var UPGRADE_MAP = [
	{ slot: "helmet", item: "helmet" },
	{ slot: "shoes", item: "shoes" },
	{ slot: "chest", item: "coat" },
	{ slot: "gloves", item: "gloves" },
	{ slot: "pants", item: "pants" }
];

/**
 * Spare bag copy of a basic armour piece still under the cap. Worn gear is
 * never unequipped for an upgrade — equipment is the player's call.
 */
function find_upgrade_item() {
	var items = character.items || [];
	for (var s = 0; s < UPGRADE_MAP.length; s++) {
		var name = UPGRADE_MAP[s].item;
		for (var i = 0; i < items.length; i++) {
			var it = items[i];
			if (!it || it.name !== name || it.l) continue;
			if ((it.level || 0) < CONFIG.UPGRADE_MAX_LEVEL) return { i: i, name: name };
		}
	}
	return null;
}

function has_upgrade_candidate() {
	return !!find_upgrade_item();
}

async function cheap_upgrade() {
	if (character.q && character.q.upgrade) return;
	if (upgrade_budget_spent()) return;
	var pick = find_upgrade_item();
		var scroll = locate_item("scroll0");
	if (!pick || scroll === -1) return;
		upgrade_tries++;
		try {
		var result = await upgrade(pick.i, scroll);
		game_log("upgrade " + pick.name + " ok=" + result.success + " lv=" + result.level);
		} catch (e) {
			game_log("upgrade failed: " + (e.reason || e));
	}
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
	/** Bag copies only: worn accessories are never pulled off for a combine. */
	var items = character.items || [];
	for (var i = 0; i < items.length; i++) {
		var it = items[i];
		if (!it) continue;
		add({ i: i, name: it.name, level: it.level || 0, it: it });
	}
	for (var k in groups) {
		if (groups[k].length >= 3) return groups[k].slice(0, 3);
	}
	return null;
}

function has_compound_candidate() {
	return !!find_compound_set();
}

function wants_compound() {
	if (!has_compound_candidate()) return false;
	if (locate_item("cscroll0") !== -1) return true;
	return character.gold >= CONFIG.GOLD_RESERVE + 6400;
}

async function cheap_compound() {
	if (character.q && character.q.compound) return;
	var set = find_compound_set();
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
}

async function buy_up_to(name, want) {
	var have = item_count(name);
	if (have >= want) return;
	var need = want - have;
	var price = (G.items[name] && G.items[name].g) || 20;
	var reserve = pots_critical() ? 0 : CONFIG.GOLD_RESERVE;
	if (character.gold - price * need < reserve) {
		need = Math.floor((character.gold - reserve) / price);
	}
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

/**
 * Fighters first, then guests (the merchant). Guests are kept out of
 * CONFIG.PARTY so the level floor, taunt and target broadcasts ignore them —
 * the mule is level 1 and must never pull the pack down to bees.
 */
async function keep_party() {
	if (now() - last_invite < CONFIG.INVITE_MS) return;
	var names = CONFIG.PARTY.concat(CONFIG.PARTY_GUESTS || []);
	for (var i = 0; i < names.length; i++) {
		var name = names[i];
		if (!name || in_party_with(name)) continue;
		last_invite = now();
		try { await send_party_invite(name); } catch (e) {}
		return;
	}
}

function in_party_with(name) {
	var party = get_party();
	return !!(party && party[name]);
}

function is_party_member(name) {
	if (!name) return false;
	if (name === character.name || name === CONFIG.PRIEST) return true;
	for (var i = 0; i < CONFIG.PARTY.length; i++) {
		if (CONFIG.PARTY[i] === name) return true;
	}
	var party = get_party();
	return !!(party && party[name]);
}

function in_croc_box(e) {
	if (!e) return false;
	var pad = 24;
	return e.x >= CROC_BOX.x1 - pad && e.x <= CROC_BOX.x2 + pad && e.y >= CROC_BOX.y1 - pad && e.y <= CROC_BOX.y2 + pad;
}

function in_crab_box(e) {
	if (!e) return false;
	var pad = 24;
	return e.x >= CRAB_BOX.x1 - pad && e.x <= CRAB_BOX.x2 + pad && e.y >= CRAB_BOX.y1 - pad && e.y <= CRAB_BOX.y2 + pad;
}

function in_goo_box(e) {
	if (!e) return false;
	var pad = 24;
	return e.x >= GOO_BOX.x1 - pad && e.x <= GOO_BOX.x2 + pad && e.y >= GOO_BOX.y1 - pad && e.y <= GOO_BOX.y2 + pad;
}

function in_spider_box(e) {
	if (!e) return false;
	var pad = 24;
	return e.x >= SPIDER_BOX.x1 - pad && e.x <= SPIDER_BOX.x2 + pad && e.y >= SPIDER_BOX.y1 - pad && e.y <= SPIDER_BOX.y2 + pad;
}

function in_arcticbee_box(e) {
	if (!e) return false;
	var pad = 24;
	return e.x >= ARCTICBEE_BOX.x1 - pad && e.x <= ARCTICBEE_BOX.x2 + pad && e.y >= ARCTICBEE_BOX.y1 - pad && e.y <= ARCTICBEE_BOX.y2 + pad;
}

function in_iceroamer_box(e) {
	if (!e) return false;
	var pad = 24;
	return e.x >= ICEROAMER_BOX.x1 - pad && e.x <= ICEROAMER_BOX.x2 + pad && e.y >= ICEROAMER_BOX.y1 - pad && e.y <= ICEROAMER_BOX.y2 + pad;
}

function in_scorpion_box(e) {
	if (!e) return false;
	var pad = 24;
	return e.x >= SCORPION_BOX.x1 - pad && e.x <= SCORPION_BOX.x2 + pad && e.y >= SCORPION_BOX.y1 - pad && e.y <= SCORPION_BOX.y2 + pad;
}

function in_bigbird_box(e) {
	if (!e) return false;
	var pad = 24;
	return e.x >= BIGBIRD_BOX.x1 - 80 && e.x <= BIGBIRD_BOX.x2 + pad && e.y >= BIGBIRD_BOX.y1 - pad && e.y <= BIGBIRD_BOX.y2 + pad;
}

function in_crabx_box(e) {
	if (!e) return false;
	var pad = 24;
	return e.x >= CRABX_BOX.x1 - pad && e.x <= CRABX_BOX.x2 + pad && e.y >= CRABX_BOX.y1 - pad && e.y <= CRABX_BOX.y2 + pad;
}

function in_booboo_box(e) {
	if (!e) return false;
	var pad = 24;
	/** No north pad: mummies. West pack is a different box. */
	return e.x >= BOOBOO_BOX.x1 - pad && e.x <= BOOBOO_BOX.x2 + pad && e.y >= BOOBOO_BOX.y1 && e.y <= BOOBOO_BOX.y2 + pad;
}

function in_stoneworm_box(e) {
	if (!e) return false;
	var pad = 24;
	/** Extra west pad: worms we kited out of the box still count. */
	return e.x >= STONEWORM_BOX.x1 - 80 && e.x <= STONEWORM_BOX.x2 + pad && e.y >= STONEWORM_BOX.y1 - pad && e.y <= STONEWORM_BOX.y2 + pad;
}

/** Never path into pack centre. Close to melee from the west on one Boo. */
function booboo_hold_xy(target) {
	var y = BOOBOO_FARM.y;
	if (target && target.y != null) {
		y = Math.max(BOOBOO_BOX.y1, Math.min(BOOBOO_BOX.y2, target.y));
	}
	return { map: "spookytown", x: BOOBOO_HOLD_X, y: y };
}

/**
 * Boo Boos shoot from 420 and stand still. A curb hold with arrival radius
 * 30 freezes the tank out of warrior melee (~35) forever. Walk to melee on
 * the westmost target, capped by BOOBOO_SOFT_X so we do not charge the pack.
 */
async function close_on_booboo(target) {
	if (!target || target.rip) return;
	if (character.map !== "spookytown") {
		await go_to(pull_dest("booboo"), "booboo map", 40, true);
		return;
	}
	if (character.x > BOOBOO_SOFT_X) {
		await go_to(BOOBOO_FARM, "too deep in booboo", 40, true);
		return;
	}
	if (in_attack_range(target)) return;
	if (!at_pull_spot("booboo") && simple_distance(character, BOOBOO_FARM) > 140) {
		await go_to(pull_dest("booboo"), "booboo west road", 40, true);
		return;
	}
	var reach = Math.max(10, (character.range || 25) - 4);
	var tx = Math.min(BOOBOO_SOFT_X, target.x - Math.min(reach - 2, 18));
	var ty = target.y;
	if (ty < BOOBOO_BOX.y1) ty = BOOBOO_BOX.y1;
	if (ty > BOOBOO_BOX.y2) ty = BOOBOO_BOX.y2;
	tx = Math.max(BOOBOO_FARM.x, tx);
	if (can_use("hardshell") && character.mp >= 480 && character.x >= BOOBOO_HOLD_X - 10) {
		try { await use_skill("hardshell"); } catch (e) {}
	}
	await walk_to(tx, ty, "close on booboo");
}

function in_jr_box(e) {
	if (!e) return false;
	var pad = 40;
	return e.x >= JR_BOX.x1 - pad && e.x <= JR_BOX.x2 + pad && e.y >= JR_BOX.y1 - pad && e.y <= JR_BOX.y2 + pad;
}

function in_greenjr_box(e) {
	if (!e) return false;
	var pad = 40;
	return e.x >= GREENJR_BOX.x1 - pad && e.x <= GREENJR_BOX.x2 + pad && e.y >= GREENJR_BOX.y1 - pad && e.y <= GREENJR_BOX.y2 + pad;
}

function in_minimush_box(e) {
	if (!e) return false;
	var pad = 16;
	/** No west pad: that direction is scorpions / Pumpkin. */
	return e.x >= MINIMUSH_BOX.x1 && e.x <= MINIMUSH_BOX.x2 + pad && e.y >= MINIMUSH_BOX.y1 - pad && e.y <= MINIMUSH_BOX.y2 + pad;
}

function in_bat_box(e) {
	if (!e) return false;
	if (character.map !== "cave") return false;
	var pad = 40;
	var packs = hunt_packs("bat");
	for (var i = 0; i < packs.length; i++) {
		if (packs[i].map !== "cave") continue;
		var box = pack_box(packs[i].b);
		if (e.x >= box.x1 - pad && e.x <= box.x2 + pad && e.y >= box.y1 - pad && e.y <= box.y2 + pad) return true;
	}
	return false;
}

function monster_on_me() {
	var best = null;
	var best_hp = 1e15;
	for (var id in parent.entities) {
		var e = parent.entities[id];
		if (!e || e.type !== "monster" || e.rip || e.hp <= 0) continue;
		if (e.npc || e.player || e.ctype) continue;
		if (e.target !== character.name) continue;
		if (e.hp < best_hp) {
			best_hp = e.hp;
			best = e;
		}
	}
	return best;
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

function pick_monster(mtype) {
	var on_me = monster_on_me();
	if (on_me) return on_me;
	if (mtype === "phoenix") {
		var phx = get_nearest_monster({ type: "phoenix" });
		if (phx && !phx.rip && phx.hp > 0) return phx;
	}
	var rare = find_jr();
	if (rare) return rare;

	if (mtype === "jr" || mtype === "greenjr") {
		var want = mtype;
		var live_jr = null;
		for (var jid in parent.entities) {
			var jr = parent.entities[jid];
			if (!jr || jr.mtype !== want || !is_allowed_monster(jr, mtype) || jr.hp <= 0) continue;
			if (jr.target && is_party_member(jr.target)) return jr;
			live_jr = jr;
		}
		if (live_jr) return live_jr;
	}

	var current = get_targeted_monster();
	if (current && is_allowed_monster(current, mtype) && current.hp > 0) {
		if (current.target === character.name || (current.target && is_party_member(current.target))) {
			return current;
		}
	}

	var best_tagged = null;
	var best_hp = 1e15;
	var best_near = null;
	var best_d = 1e15;
	var best_west = null;
	var best_west_x = 1e15;
	var scored_candidates = [];
	for (var id in parent.entities) {
		var e = parent.entities[id];
		if (!is_allowed_monster(e, mtype)) continue;
		scored_candidates.push(e);
		if (e.target && is_party_member(e.target)) {
			if (e.hp < best_hp) {
				best_hp = e.hp;
				best_tagged = e;
			}
			continue;
		}
		if (e.target && !is_cooperative(e)) continue;
		var d = distance(character, e);
		if (d < best_d) {
			best_d = d;
			best_near = e;
		}
		/** Boo Boo: prefer the westmost live pack member so we stay on the curb. */
		if (mtype === "booboo" && e.x < best_west_x) {
			best_west_x = e.x;
			best_west = e;
		}
	}
	if (current && is_allowed_monster(current, mtype) && current.hp > 0 && !best_tagged) {
		return current;
	}
	if (mtype === "booboo" && best_west && !best_tagged) return best_west;
	if (best_tagged && best_near && !in_attack_range(best_tagged)) {
		if (simple_distance(character, best_near) + 40 < simple_distance(character, best_tagged)) {
			return best_near;
		}
	}
	return ALCombat.bestTarget(scored_candidates, { preferredType: mtype, current: current && current.id, allowed: function (candidate) { return is_allowed_monster(candidate, mtype); } }) || best_tagged || best_near;
}

function is_allowed_monster(monster, mtype) {
	if (!monster || monster.rip) return false;
	if (monster.type !== "monster") return false;
	if (monster.npc || monster.player || monster.ctype) return false;
	if (!monster.mtype || farm_types(mtype).indexOf(monster.mtype) < 0) return false;
	if (mtype === "croc" && !in_croc_box(monster)) return false;
	if (mtype === "crab" && !in_crab_box(monster)) return false;
	if (mtype === "goo" && !in_goo_box(monster)) return false;
	if (mtype === "bat" && !in_bat_box(monster)) return false;
	if (mtype === "spider" && !in_spider_box(monster)) return false;
	if (mtype === "jr" && !in_jr_box(monster)) return false;
	if (mtype === "greenjr" && !in_greenjr_box(monster)) return false;
	if (mtype === "minimush" && !in_minimush_box(monster)) return false;
	if (mtype === "booboo" && !in_booboo_box(monster)) return false;
	if (mtype === "stoneworm" && !in_stoneworm_box(monster)) return false;
	if (mtype === "bigbird" && !in_bigbird_box(monster)) return false;
	if (is_party_member(monster.name) || monster.name === character.name) return false;
	var aggro = monster.target;
	if (!aggro) return true;
	if (is_party_member(aggro)) return true;
	if (is_cooperative(monster)) return true;
	return false;
}

function is_cooperative(monster) {
	if (!monster || !monster.mtype || !G.monsters[monster.mtype]) return false;
	return !!G.monsters[monster.mtype].cooperative;
}

async function maybe_ping_target() {
	var t = get_targeted_monster();
	if (!t || t.rip) return;
	var debug = ALCombat.debug && ALCombat.debug();
	var selected = debug && debug.selected;
	var intent = { t: "intent", id: t.id, phase: tank_combat.phase, map: character.map,
		x: Math.round(selected ? selected.x : character.x), y: Math.round(selected ? selected.y : character.y), at: Date.now() };
	var signature = [intent.id, intent.phase, intent.map, intent.x, intent.y].join(":");
	if (signature === last_intent_signature && Date.now() - last_intent_sent < 750) return;
	last_tgt_sent = t.id; last_intent_signature = signature; last_intent_sent = Date.now();
	try { await send_cm(CONFIG.PARTY, intent); } catch (e) {}
}

async function maybe_ping_missing() {
	if (now() - last_pos_cm < CONFIG.POS_CM_MS) return;
	last_pos_cm = now();
	try {
		await send_cm(CONFIG.PARTY, {
			t: "pos",
			map: character.map,
			x: Math.round(character.x),
			y: Math.round(character.y)
		});
	} catch (e) {}
}

function now() {
	return Date.now();
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

// END GENERATED COMBAT
