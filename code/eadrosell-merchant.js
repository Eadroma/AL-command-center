/**
 * EadroSell — merchant mule
 * =========================
 *
 * Idle: if the stand has listings, keep it open in town. Whenever fishing
 * (48 min CD) or mining (safe Wizard's Crib, woffice, ~2 h CD) is off
 * cooldown, close the stand, go cast, then walk back and reopen it — the
 * listings stay in the trade slots meanwhile. Then combine/craft. Upgrade
 * Wanderer's armor toward +7 for Droma, except wcap and wbreeches.
 * NPC-sell those two at any level. At +7, apply Dexterity Scrolls until
 * the remaining pieces have a dex line, then hand them to Droma. Do not
 * give Wanderer to Aedroma. Hand Droma the one +7 quiver; do not upgrade
 * any more quivers. Do not upgrade lolipops. Hand Droma one Alloy Quiver
 * for lolipop packs.
 * Mass Exchange before every Xyn trade; Mass Production before each
 * compound, craft, and Wanderer upgrade. Do not list monster tokens on the
 * stand. NPC-sell the
 * configured junk list to Gabriel, including Party Hats. Exchange Anniversary
 * Gifts only at 50+, plus Raw Emeralds, Rare Gifts, Candy, Rare Candy, and
 * Mistletoe, at Xyn. Keep Market Parcels to sell to other players. Keep spidersilk; do not craft rods
 * or pickaxes from it.
 * Hourly Ponty tour from EU III: hop every non-PVP server, buy
 * ololipop/glolipop if listed, then return home. Do not hop until the live
 * Ponty NPC is in range and get_secondhands actually returns a list.
 * Walk to farmers only for gold drain or loot dump. Farmers walk to town
 * for potions, mluck, and a full bag. Park at the stand and serve them.
 * NPC-sell stingers, Mushroom Staffs, Slime Staffs, and Party Hats with the other Gabriel junk. Refill
 * hpot1/mpot1 to 3000 even while the stand is open. After a pack trip,
 * leave. Close the stand before a pack trip or a gathering cast. Do not
 * fish or mine while a farmer is coming in for city service.
 *
 * A trip is a commitment (see `mission`). Fear is limited to monsters that
 * target us. Bats (50 atk) one-shot 109 HP — on cave we stand at the door
 * (0,-80), never in the box. Combine dumped jewelry toward +3: pull matching
 * copies from the bank, compound at Cue, and bank the result if it succeeds.
 * Include Trinket of Faith and Book of Knowledge (wbook0). Hand a farmer a
 * +3 STR/DEX/INT piece that beats what they wear. Do not NPC-sell those
 * stat pieces. Combine other jewelry except the Gabriel junk list. NPC-sell
 * that list at basics.
 * Exchange gifts at Xyn once 50 Anniversary Gifts are in the bag, plus raw
 * emeralds, Candy, Rare Candy, and Mistletoe. Keep Market Parcels. Keep monster tokens. Kit stays in the
 * bag for you. Craft fire weapons only when essence is in the bag. Close the
 * stand before a pack trip or a fishing cast.
 * Do not Travel to Aedroma in Spooky Town — main has no door there.
 *
 * Staff is Gabriel (basics). There is no smart_move("weapons") location.
 * town() recalls to THIS map's spawn — it does not path across the farm.
 * Pack trips are only to main (spiders) and cave. Never Travel to
 * Aedroma in Spooky Town — that map has no door from main. Bees are
 * ignored; town() if stuck.
 *
 * Farmers send_cm { t: "pots"|"mux", need_h, need_m, need_luck, coming }.
 * Counts are hpot1 / mpot1. Each farmer keeps 1000 of those. Each handoff
 * fills up to 1000. They come to the town stand for pots and mluck.
 *
 * Farmers still send kit: { slot: "name:level" } so the mule can see what
 * they wear. Each farmer keeps one Tracktrix (tracker); extras dump here.
 * Do not buy Gabriel kit. Hand Aedroma the highest-level Oozing
 * Terror in our bag if it beats hers, the Fluffy Blanket (ecape) if she has
 * no cape or a worse one, and elixirint0 when she is not already on an elixir.
 * Do not hand her Wanderer or Intelligence Scrolls. Upgrade extra Wanderer
 * copies here to +7 except wcap and wbreeches, which we NPC-sell. Dexterity-scroll
 * the rest until they have a dex line, then hand only those +7 dex pieces to Droma if they
 * beat what he is wearing. Upgrade Heavy Underarmor (hpants) and Heavy Helmet
 * (hhelmet) with scroll2 to +7 (rare from +0), Strength-scroll those and vampire armor
 * (mcape, vgloves, vboots, vattire, vcape) until they have a str line, then
 * hand them to Eadroma if they beat what he wears. Hand Eadroma Strength
 * Scrolls and scroll1 so he can STR-scroll his Fluffy Blanket and worn
 * vampire/heavy pieces at Cue. Weapons cannot take stat scrolls.
 *
 * Eadroma is the farm root on its own client: it starts Aedroma and Droma.
 * This merchant window is a second client. Do not start_character anyone
 * from here — that would fight the warrior client for the same logins.
 */

/** Browser DPS / gold / XP / upgrade buttons. No-op on Mainframe. */
if (typeof parent !== "undefined" && parent.$) {
	load_code("gui", function () { game_log("gui slot missing"); });
}
game_log("mule CODE: Mass Production before Cue");

var CONFIG = {
	NAME: "EadroSell",
	FARMERS: ["Eadroma", "Droma", "Aedroma"],
	WARRIOR: "Eadroma",
	PRIEST: "Aedroma",
	/** Ranged DPS slot (ranger). Same mule jobs Tonerre had. */
	MAGE: "Droma",
	/** start_character CODE slots. Three children is the game max. */
	TEAM_SLOTS: {
		Eadroma: "CH_ESdwg4snAtoFZXRzGzAX2q7zMMfVZ",
		Aedroma: "CH_EiXQ8dHoXlqTOtyTH5IzbbafFAif9",
		Droma: "CH_TWNS1mcRp22XMAehvezNnJTPc2VBB"
	},
	REACH: 300,
	/** Town warehouse of the better Fancy Pots (hpot1 400 HP / mpot1 500 MP). */
	HPOT: "hpot1",
	MPOT: "mpot1",
	POT_STOCK: 3000,
	MPOT_STOCK: 3000,
	POT_GIVE: 1000,
	MPOT_GIVE: 1000,
	/** Each farmer keeps this many better pots. Top up while nearby. */
	POT_NEED: 1000,
	MPOT_NEED: 1000,
	MPOT_NEED_CASTER: 1000,
	/**
	 * Leave the fishing shore only when a farmer is actually dry. Crab claws
	 * and slime cores stack; dump>0 is not an emergency. Gold drain is only
	 * when this mule cannot buy pots.
	 */
	POT_VISIT: 80,
	MPOT_VISIT: 80,
	MPOT_VISIT_CASTER: 120,
	DUMP_VISIT_MIN: 8,
	GOLD_MULE_SKIP: 8000,
	SCROLL_KEEP: 50,
	CSCROLL_KEEP: 8,
	CSCROLL1_KEEP: 2,
	/** Compound STR/DEX/INT rings, amulets, earrings, and belts to this level. */
	ACCESSORY_GOAL: 3,
	SCROLL1_KEEP: 8,
	SCROLL2_KEEP: 4,
	INTSCROLL_GIVE: 20,
	ELIXIRINT_GIVE: 5,
	STRSCROLL_KEEP: 40,
	STRSCROLL_GIVE: 20,
	SCROLL1_GIVE: 10,
	QUIVER_MAX: 7,
	UPGRADE_MAX: 7,
	/** Do not upgrade lolipops. Hand one that already beats what Eadroma wears. */
	GOLD_FARMER_KEEP: 2500,
	CRAFT_GOLD: 20000,
	MUX_MS: 8000,
	BAG_MIN: 3,
	/** Bank only after the stand is full and the bag is this tight. */
	BAG_DUMP: 10,
	POT_ASK_MS: 120000,
	KIT_REPORT_MS: 120000,
	/**
	 * A farmer handing an item back means they do not want it at that level.
	 * Hold it until an upgrade changes its level rather than re-offering it —
	 * this is what stopped the pants+2 hand-back loop.
	 */
	BOUNCE_MS: 3600000,
	SAFE_STAND: 220,
	/** Stand farther out when the pack itself is an aggressive type (croc). */
	SAFE_STAND_HOT: 300,
	DANGER: 140,
	/**
	 * Trip commitment. Once we set out we finish the walk; once there we
	 * serve, then leave as soon as nobody still needs us.
	 */
	FERRY_TIMEOUT_MS: 240000,
	DWELL_MIN_MS: 20000,
	TOWN_JOB_DWELL_MS: 180000,
	HOT_DWELL_MS: 30000,
	IDLE_REPORT_MS: 60000,
	/** Keep this much gold for shoes/kit. Extra town buys are merchant XP. */
	XP_GOLD_KEEP: 40000,
	XP_BUY_Q: 20,
	TOKEN: "monstertoken",
	TOKEN_PRICE: 500000,
	/** Exact keys sold to Gabriel (basics). Unlocked bag copies only. */
	GABRIEL_SELL: [
		"ringsj", "seashell", "beewings", "gslime", "hpbelt", "hpamulet",
		"rattail", "spores", "reefglass", "crabclaw", "dstones",
		"helmet", "coat", "gloves", "pants", "shoes",
		"helmet1", "coat1", "gloves1", "pants1", "shoes1",
		"poker", "confetti",
		"stinger", "mushroomstaff", "slimestaff", "partyhat",
		"wcap", "wbreeches",
		"pumpkinspice", "smoke", "phelmet", "xmasshoes", "merry"
	],
	/** Exact keys exchanged at Xyn. One at a time; needs a free bag slot. */
	EXCHANGE_ITEMS: [
		"anniversarygift", "gem0", "gift0",
		"candy1", "candy0", "mistletoe",
		"candy1v2", "candy0v2", "candy1v3", "candy0v3"
	],
	/** Do not walk to Xyn for these until the bag holds this many. Once a stack
	 *  crosses the floor, drain it to empty even as it drops below the floor. */
	EXCHANGE_MIN: { anniversarygift: 50 },
	PONTY_MS: 3600000,
	PONTY_GOLD_KEEP: 200000,
	PONTY_ITEMS: ["ololipop", "glolipop"],
	/** Farmers live here. Ponty hops must return to this realm. */
	PONTY_HOME: { region: "EU", name: "III" },
	/** Mule must hold at least this much gold before Cue upgrades (dashboard override). */
	UPGRADE_GOLD_MIN: 0
};

var WARRIOR_BODY = ["coat", "gloves", "pants"];
var WARRIOR_KIT = ["coat", "gloves", "pants", "helmet", "shoes", "wbasher"];
var MAGE_WEAPONS = ["firestaff", "staff"];
var ALL_GEAR = ["coat", "gloves", "pants", "helmet", "shoes", "wshield", "firestaff", "staff", "wbasher"];
var NEVER_UPGRADE = { blade: 1, fireblade: 1, wcap: 1, wbreeches: 1, ecape: 1, quiver: 1, alloyquiver: 1, ololipop: 1, glolipop: 1 };
var NEVER_SELL = {
	hpot0: 1, mpot0: 1, hpot1: 1, mpot1: 1,
	scroll0: 1, scroll1: 1, scroll2: 1, cscroll0: 1, cscroll1: 1, intscroll: 1, dexscroll: 1, strscroll: 1,
	essenceoffire: 1, blade: 1, staff: 1,
	fireblade: 1, firestaff: 1, vstaff: 1, firebow: 1, elixirdex1: 1, elixirint0: 1, oozingterror: 1, ololipop: 1, glolipop: 1,
	wattire: 1, wgloves: 1, wshoes: 1, ecape: 1, quiver: 1, alloyquiver: 1,
	hpants: 1, hhelmet: 1, mcape: 1, vgloves: 1, vboots: 1, vattire: 1, vcape: 1,
	spidersilk: 1, rod: 1, pickaxe: 1,
	monstertoken: 1, marketparcel: 1, feather0: 1, wingedboots: 1,
	candy0: 1, candy1: 1, candy0v2: 1, candy1v2: 1, candy0v3: 1, candy1v3: 1, mistletoe: 1,
	stand0: 1, computer: 1, supercomputer: 1, tracker: 1
};
/**
 * Per-farmer wish list. `buy` is what Gabriel sells for that slot when the
 * list has rarer options first. `unless_2h` skips the slot while the farmer
 * holds a two-handed weapon (a basher blocks the shield).
 */
var KIT = {
	/** Player equips every farmer. Empty lists: do not buy or hand kit. */
	Eadroma: [],
	Droma: [],
	Aedroma: []
};
var WARRIOR_JEWEL = {
	belt: ["strbelt", "hpbelt"],
	amulet: ["stramulet", "hpamulet"],
	ring1: ["strring", "vitring", "ringsj", "intring", "dexring"],
	ring2: ["strring", "vitring", "ringsj", "intring", "dexring"],
	earring1: ["strearring", "vitearring", "intearring", "dexearring"],
	earring2: ["strearring", "vitearring", "intearring", "dexearring"]
};
var STAT_ACCESSORIES = [
	"strring", "stramulet", "strearring", "strbelt",
	"dexring", "dexamulet", "dexearring", "dexbelt",
	"intring", "intamulet", "intearring", "intbelt"
];
var CASTER_JEWEL = {
	belt: ["intbelt", "hpbelt"],
	amulet: ["intamulet", "hpamulet"],
	ring1: ["intring", "vitring", "ringsj", "strring", "dexring"],
	ring2: ["intring", "vitring", "ringsj", "strring", "dexring"],
	earring1: ["intearring", "vitearring", "strearring", "dexearring"],
	earring2: ["intearring", "vitearring", "strearring", "dexearring"]
};
var RANGER_JEWEL = {
	belt: ["dexbelt", "hpbelt"],
	amulet: ["t2dexamulet", "dexamulet", "hpamulet"],
	ring1: ["dexring", "vitring", "ringsj", "intring", "strring"],
	ring2: ["dexring", "vitring", "ringsj", "intring", "strring"],
	earring1: ["dexearring", "vitearring", "intearring", "strearring"],
	earring2: ["dexearring", "vitearring", "intearring", "strearring"]
};

function jewel_table(who) {
	if (who === CONFIG.WARRIOR) return WARRIOR_JEWEL;
	if (who === CONFIG.MAGE) return RANGER_JEWEL;
	return CASTER_JEWEL;
}

function in_list(list, name) {
	return list.indexOf(name) >= 0;
}

function is_potion_name(n) {
	return n === "hpot0" || n === "mpot0" || n === "hpot1" || n === "mpot1";
}

/** Upgrade order: weapons first (biggest swing), then tank body, then the rest. */
function gear_rank(it) {
	if (!it) return 99;
	var n = it.name;
	if (n === "wbasher" || in_list(MAGE_WEAPONS, n)) return 0;
	if (is_lolipop(n)) return 0;
	if (is_heavy_armor(n)) return 0;
	if (n === "quiver") return 1;
	if (in_list(WARRIOR_BODY, n)) return 2;
	if (in_list(WARRIOR_KIT, n)) return 3;
	if (is_wanderer(n)) return 4;
	if (in_list(ALL_GEAR, n)) return 5;
	return 99;
}

var WANDERER_SET = ["wcap", "wattire", "wgloves", "wbreeches", "wshoes"];
var WANDERER_SLOT = {
	wcap: "helmet",
	wattire: "chest",
	wgloves: "gloves",
	wbreeches: "pants",
	wshoes: "shoes"
};

function is_wanderer(name) {
	return !!WANDERER_SLOT[name];
}

function is_junk_wanderer(name) {
	return name === "wcap" || name === "wbreeches";
}

function is_heavy_armor(name) {
	return name === "hpants" || name === "hhelmet";
}

function is_vampire_armor(name) {
	return name === "mcape" || name === "vgloves" || name === "vboots" || name === "vattire" || name === "vcape";
}

var WARRIOR_STR_SLOT = {
	hpants: "pants",
	hhelmet: "helmet",
	mcape: "chest",
	vattire: "chest",
	vgloves: "gloves",
	vboots: "shoes",
	vcape: "cape",
	ecape: "cape"
};

function item_can_pscroll(it) {
	if (!it) return false;
	var def = G.items && G.items[it.name];
	return !!(def && (def.scroll || def.stat));
}

function is_lolipop(name) {
	return name === "ololipop" || name === "glolipop";
}

function jewel_owner(name) {
	var def = WARRIOR_JEWEL;
	for (var slot in def) {
		if (in_list(def[slot], name)) return CONFIG.WARRIOR;
	}
	return CONFIG.MAGE;
}

var working = false;
var last_path_key = "";
var last_go_dest = "";
var last_go_start = 0;
var last_mux = 0;
var last_town_ms = 0;
var reports = {};
var owners = {};
var last_give_ms = {};
var last_pot_ms = {};
var last_dump_ms = {};
var last_msg = 0;
var last_act = "";
var last_act_ms = 0;
var last_gather_fail = 0;
var last_token_list_ms = 0;
var last_visit_why = "";
var pot_asks = {};
var bounce_until = {};
/** { type: "ferry", who, why, started, arrived } — see run_ferry(). */
var mission = null;
var last_town_job_ms = 0;
var last_mluck_ms = {};
/** Rid of a successful jewelry combine, banked on the next bank visit. */
var accessory_store_rid = null;
/** True after a bank visit whose live packs had no 3-match to pull. */
var accessory_scanned = false;
/** When we last finished a jewelry bank scan (ms). */
var accessory_scan_at = 0;
/** Re-open the vault periodically — farmers keep dumping pairs after a barren scan. */
var ACCESSORY_RESCAN_MS = 900000;
/** Last seen bank counts, key "name@level". Used when we are not inside the vault. */
var bank_jewel_counts = {};
var last_start_ms = 0;
var start_fail_until = {};

function bounce_key(who, it) {
	return who + "|" + it.name + "|" + ((it && it.level) || 0);
}

function mark_bounce(who, it) {
	if (!who || !it) return;
	bounce_until[bounce_key(who, it)] = Date.now() + CONFIG.BOUNCE_MS;
}

function is_bounce(who, it) {
	var t = bounce_until[who + "|" + it.name + "|" + (it.level || 0)];
	return !!(t && Date.now() < t);
}

function act(msg) {
	var text = String(msg || "");
	if (text === last_act && Date.now() - last_act_ms < 6000) return;
	last_act = text;
	last_act_ms = Date.now();
	try { set_message(text.slice(0, 28)); } catch (e) {}
	game_log("mule: " + text);
}

function path_log(reason, dest) {
	var key = reason + " -> " + dest;
	if (key === last_path_key) return;
	last_path_key = key;
	act(reason + " -> " + dest);
}

/** Snap coarse so a farmer fidgeting does not restart smart_move. */
function snap_dest(dest) {
	if (!dest || dest.x == null) return dest;
	return {
		map: dest.map || character.map,
		x: Math.round(Number(dest.x) / 200) * 200,
		y: Math.round(Number(dest.y) / 200) * 200
	};
}

function dest_key(dest) {
	if (dest && typeof dest === "object") {
		var s = snap_dest(dest);
		return (s.map || "") + ":" + s.x + "," + s.y;
	}
	return String(dest);
}

function arrived_at(dest, range) {
	if (!dest || dest.x == null) return false;
	if (dest.map && dest.map !== character.map) return false;
	return simple_distance(character, dest) < (range || 80);
}

function dest_close(a, b, range) {
	if (!a || !b || a.x == null || b.x == null) return false;
	if ((a.map || character.map) !== (b.map || character.map)) return false;
	return simple_distance(a, b) < (range || 120);
}

function stop_pathfinder() {
	if (smart.moving) {
		try { stop("smart"); } catch (e) {}
	}
}

var walk_stuck_xy = null;
var walk_stuck_since = 0;

/**
 * Walk with move() only. xmove/smart_move print "Searching for a path..."
 * and from cave they never finish. If the straight line is a wall, slide
 * left/right along it instead of standing still.
 */
function step_toward(x, y) {
	if (character.moving && Math.abs((character.going_x || 0) - x) < 12 && Math.abs((character.going_y || 0) - y) < 12) return;
	var cx = character.x;
	var cy = character.y;
	var here = { x: cx, y: cy };
	if (!walk_stuck_xy || simple_distance(here, walk_stuck_xy) > 10) {
		walk_stuck_xy = here;
		walk_stuck_since = Date.now();
	}
	try {
		if (can_move_to(x, y)) {
			move(x, y);
			return;
		}
		var dx = x - cx;
		var dy = y - cy;
		var n = Math.sqrt(dx * dx + dy * dy) || 1;
		var ux = dx / n;
		var uy = dy / n;
		var px = -uy;
		var py = ux;
		var dists = [48, 36, 24, 16, 8];
		var sides = [0, 28, -28, 56, -56, 84, -84];
		if (Date.now() - walk_stuck_since > 2500) sides = [56, -56, 84, -84, 120, -120, 0];
		var di;
		var si;
		for (di = 0; di < dists.length; di++) {
			for (si = 0; si < sides.length; si++) {
				var tx = cx + ux * dists[di] + px * sides[si];
				var ty = cy + uy * dists[di] + py * sides[si];
				if (can_move_to(tx, ty)) {
					move(tx, ty);
					return;
				}
			}
		}
	} catch (e) {}
}

function map_spawn() {
	var map = G.maps[character.map];
	var sp = map && map.spawns && map.spawns[0];
	if (!sp) return null;
	return { x: sp[0], y: sp[1] };
}

function near_spawn(range) {
	var s = map_spawn();
	return !!(s && simple_distance(character, s) < (range || 140));
}

function can_town_recall() {
	if (character.rip) return false;
	if (character.c && character.c.town) return true;
	if (Date.now() - last_town_ms < 400) return false;
	try {
		if (typeof can_use === "function" && can_use("use_town")) return true;
	} catch (e) {}
	try {
		if (!is_on_cooldown("use_town")) return true;
	} catch (e2) {}
	return false;
}

async function recall_spawn(reason) {
	if (near_spawn()) return false;
	if (character.c && character.c.town) return true;
	if (!can_town_recall()) return false;
	if (smart.moving) {
		try { stop("smart"); } catch (e) {}
	}
	path_log(reason, "town()");
	last_go_dest = "town:" + character.map;
	last_town_ms = Date.now();
	try {
		await town();
	} catch (e) {
		game_log("town: " + (e.reason || e));
	}
	return true;
}

function resolve_dest(dest) {
	if (typeof dest === "string" && SHOP_XY[dest]) {
		return { map: SHOP_XY[dest].map, x: SHOP_XY[dest].x, y: SHOP_XY[dest].y };
	}
	return dest;
}

async function go_to(dest, reason, range) {
	dest = resolve_dest(dest);
	if (typeof dest === "string") {
		path_log(reason, dest + " (skipped, not a shop)");
		return;
	}
	if (!dest || dest.x == null) return;
	if (character.c && character.c.town) return;
	if (Date.now() < town_lock_until) return;
	if (arrived_at(dest, range || 80)) {
		if (smart.moving) {
			try { stop("smart"); } catch (e) {}
		}
		return;
	}
	var dmap = dest.map || character.map;
	var dist0 = simple_distance(character, dest);
	if ((character.stand || character.standed) && (dmap !== character.map || dist0 > 140)) {
		await ensure_stand_closed();
	}
	var where = dmap + " " + Math.round(dest.x) + "," + Math.round(dest.y);
	last_go_xy = { map: dmap, x: dest.x, y: dest.y };

	if (dmap !== character.map) {
		await cross_map(dmap, reason);
		return;
	}

				path_log(reason, where);
	if (smart.moving) return;

	var dist = simple_distance(character, dest);
	if (dist <= 90 && can_move_to(dest.x, dest.y)) {
		try { move(dest.x, dest.y); } catch (e) {}
		return;
	}
	start_smart_once({ map: dmap, x: dest.x, y: dest.y }, dest_key(dest));
}

var smart_retry_at = 0;
var stuck_xy = null;
var stuck_since = 0;

var last_go_xy = null;
var bad_dest_until = {};

function mark_bad_dest(dest) {
	if (!dest || dest.x == null) return;
	bad_dest_until[dest_key(dest)] = Date.now() + 120000;
}

function is_bad_dest(dest) {
	if (!dest || dest.x == null) return false;
	var t = bad_dest_until[dest_key(dest)];
	return !!(t && Date.now() < t);
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
var last_smart_key = "";
var last_smart_at = 0;
var town_lock_until = 0;
var smart_lock_until = 0;

function start_smart_once(dest, key) {
	if (character.c && character.c.town) return;
	if (Date.now() < town_lock_until) return;
	if (smart.moving) return;
	if (last_smart_key === key && Date.now() - last_smart_at < 25000) return;
	last_smart_key = key;
	last_smart_at = Date.now();
					last_go_dest = key;
	last_go_xy = { map: dest.map || character.map, x: dest.x, y: dest.y };
	try {
		smart_move({ map: dest.map || character.map, x: dest.x, y: dest.y }).catch(function (err) {
			last_smart_at = Date.now();
			var why = err && err.reason;
			if (why && why !== "interrupted") need_town_escape = true;
		});
	} catch (e) {}
}

/**
 * Main -> cave: town() off the goo ledge / river / trees, then one
 * smart_move from spawn. Hand-walked waypoints parked us on cliffs.
 * Cave -> main still uses the local door.
 */
async function cross_map(dmap, reason) {
	if (character.map === "spookytown" && (dmap === "main" || dmap === "halloween")) {
		var hdoor = door_to("halloween") || { x: 34, y: 1449 };
		if (simple_distance(character, hdoor) > 40) {
			path_log(reason, "spookytown door to halloween");
			start_smart_once({ map: "spookytown", x: hdoor.x, y: hdoor.y }, "spooky-door");
				return;
			}
		if (Date.now() - last_door_ms < 2000) return;
		last_door_ms = Date.now();
		try { await use_nearest_door(); } catch (e) { step_toward(hdoor.x, hdoor.y); }
			return;
		}

	if (character.map === "main" && dmap === "woffice") {
		if (smart.moving && last_smart_key === "woffice") {
			path_log(reason, "smart woffice");
			return;
		}
		path_log(reason, "smart woffice mine");
		start_smart_once({ map: "woffice", x: SHOP_XY.mine.x, y: SHOP_XY.mine.y }, "woffice");
		return;
	}

	if (character.map === "main" && dmap === "cave") {
		if (smart.moving && last_smart_key === "cave") {
			path_log(reason, "smart cave");
			return;
		}
		if (!near_spawn(220)) {
			path_log(reason, "town() then cave");
			await recall_spawn("off ledge, town() then cave");
			return;
		}
		path_log(reason, "smart cave");
		start_smart_once({ map: "cave", x: 0, y: -80 }, "cave");
		return;
	}

	stop_pathfinder();
	var door = door_to(dmap);
	if (!door && character.map === "cave") door = { x: 0, y: 33 };
	if (!door && character.map === "main" && dmap === "cave") door = { x: 160, y: 1370 };
	if (!door) {
		path_log(reason, "no door to " + dmap);
		return;
	}
	if (simple_distance(character, door) > 40) {
		path_log(reason, "door " + character.map + "->" + dmap);
		step_toward(door.x, door.y);
		return;
	}
	if (Date.now() - last_door_ms < 2000) return;
	last_door_ms = Date.now();
	path_log(reason, "use door " + character.map + "->" + dmap);
	try {
		await use_nearest_door();
	} catch (e) {
		step_toward(door.x, door.y);
	}
}

var need_town_escape = false;

function in_east_park_trap() {
	return character.map === "main" && character.x > 850 && character.y > 80 && character.y < 520;
}

function in_bee_bowl() {
	if (character.map !== "main") return false;
	var x = character.x;
	var y = character.y;
	var boxes = [
		[424, 1014, 668, 1104],
		[418, 994, 570, 1208],
		[52, 1426, 252, 1548],
		[448, 694, 592, 812],
		[678, 676, 796, 764]
	];
	for (var i = 0; i < boxes.length; i++) {
		var b = boxes[i];
		if (x > b[0] - 40 && y > b[1] - 40 && x < b[2] + 40 && y < b[3] + 40) return true;
	}
	return false;
}

function going_south() {
	return !!(last_go_xy && ((last_go_xy.map === "cave") || last_go_xy.y > 1100));
}

function standing_still(ms) {
	if (character.moving) {
		stuck_xy = { x: character.x, y: character.y };
		stuck_since = Date.now();
		return false;
	}
	var here = { x: character.x, y: character.y };
	if (!stuck_xy || simple_distance(here, stuck_xy) > 14) {
		stuck_xy = here;
		stuck_since = Date.now();
		return false;
	}
	return Date.now() - stuck_since > ms;
}

function watch_stuck() {
	standing_still(999999);
}

async function do_town_escape(why) {
	if (character.c && character.c.town) return true;
	if (Date.now() < town_lock_until) return false;
	if (near_spawn(160)) return false;
	town_lock_until = Date.now() + 18000;
	need_town_escape = false;
	last_smart_key = "";
	if (smart.moving) {
		try { stop("smart"); } catch (e) {}
	}
	act("town() " + why);
	try { await town(); } catch (e) {}
	return true;
}

async function maybe_escape_hole() {
	if (character.c && character.c.town) return true;
	if (Date.now() < town_lock_until) return false;
	if (near_spawn(160) || near_pack()) return false;
	/**
	 * A live Travel route to Aedroma crosses x>850 south of the spider
	 * road. Instant town() there is what pulled us back at half path.
	 * Only recall if we are actually standing still in a hole.
	 */
	if (character.moving) return false;
	if (smart.moving && !standing_still(20000)) return false;
	if (in_east_park_trap() && standing_still(8000)) return do_town_escape("east park");
	if (in_bee_bowl() && !going_south() && standing_still(8000)) return do_town_escape("bee cliff");
	if (need_town_escape && standing_still(8000)) return do_town_escape("path failed");
	/** Waiting on a gather cooldown or MP at the shore / in the crib is not "stuck". */
	if (in_fishing_zone() || in_mining_zone()) return false;
	if (standing_still(10000)) return do_town_escape("stuck");
	return false;
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

var SHOP_XY = {
	scrolls: { map: "main", x: -464, y: -96 },
	/**
	 * Cue is drawn on his booth at -207,-220: not walkable, smart_move to it
	 * fails with "Path not found!" and that used to trip need_town_escape.
	 * The game's own smart_move("upgrade") stands at -204,-129.
	 */
	newupgrade: { map: "main", x: -204, y: -129 },
	fancypots: { map: "main", x: -35, y: -162 },
	basics: { map: "main", x: -89, y: -165 },
	/** Xyn. NPC sits at -25,-478; stand south of him toward the transporter. */
	exchange: { map: "main", x: -25, y: -450 },
	craftsman: { map: "main", x: 92, y: 670 },
	standmerchant: { map: "main", x: -193, y: 680 },
	bankdoor: { map: "main", x: 168, y: -149 },
	/**
	 * Left of Town Square. Bean's plaza is [-100,-100,100,100]; spawn is
	 * 0,0. Park the stand on the west edge, not the centre.
	 */
	market: { map: "main", x: -100, y: -20 },
	/** Ponty (secondhands) on the square, east of spawn. */
	secondhands: { map: "main", x: 106, y: -47 },
	/**
	 * North fishing shore. The water polygon starts at y=-352 and the shore
	 * wall is the y_line at -344; with a 7px-tall hitbox the closest a
	 * character can stand is y=-336. The server accepts the cast when a
	 * probe 24px from us is inside the polygon (y-24=-360, inside), so
	 * -336 works and anything past -344 is "Path not found!".
	 * East of the crab box so 109 HP is not standing in grow crabs.
	 */
	fish: { map: "main", x: -960, y: -336 },
	/**
	 * Wizard's Crib mining zone (safe map, drop m2). The zone polygon is
	 * x[-184,-128] y[-232,-184] and sits behind the wall at y=-184, so its
	 * centre is unwalkable. Stand right under the wall: the 24px probe
	 * (y-24=-200) is inside the rectangle.
	 */
	mine: { map: "woffice", x: -156, y: -176 }
};

function npc_stand(id) {
	var live = npc_xy(id);
	if (live && (!SHOP_XY[id] || character.map === SHOP_XY[id].map)) return live;
	return SHOP_XY[id] || live;
}

function shop_ready(id) {
	var live = npc_xy(id);
	if (live && simple_distance(character, live) <= 80) return true;
	var stand = SHOP_XY[id];
	if (!stand || character.map !== stand.map) return false;
	return simple_distance(character, stand) <= 80;
}

function shop_for(name) {
	if (name === "hpot0" || name === "mpot0" || name === "hpot1" || name === "mpot1") return "fancypots";
	if (name === "scroll0" || name === "scroll1" || name === "scroll2" || name === "cscroll0" || name === "cscroll1" || name === "intscroll" || name === "dexscroll" || name === "strscroll") return "scrolls";
	return "basics";
}

async function approach_npc(id, reason) {
	if (shop_ready(id)) return true;
	try { await go_to(id, reason || ("walk to " + id)); } catch (e) {}
	return shop_ready(id);
}

async function buy_from_shop(name, quantity) {
	if (!quantity || quantity < 1) return false;
	await ensure_stand_closed();
	var shop = shop_for(name);
	if (!(await approach_npc(shop, "buy " + name))) return false;
	var left = Math.min(quantity, 9999);
	var bought = 0;
	while (left > 0) {
		var n = Math.min(left, 100);
		try {
			await buy(name, n);
			bought += n;
			left -= n;
	} catch (e) {
			game_log("buy " + name + " x" + n + ": " + (e.reason || e));
			break;
	}
	}
	if (bought) game_log("bought " + bought + " " + name);
	return bought > 0;
}

function is_farmer(name) {
	for (var i = 0; i < CONFIG.FARMERS.length; i++) {
		if (CONFIG.FARMERS[i] === name) return true;
	}
	return false;
}

function note_farmer_mux(name, data) {
		reports[name] = {
			name: name,
			hpot: data.hpot || 0,
			mpot: data.mpot || 0,
			gold: data.gold || 0,
			dump: data.dump || 0,
			map: data.map,
			x: data.x,
			y: data.y,
		need_h: !!data.need_h,
		need_m: !!data.need_m,
		need_luck: !!data.need_luck,
		need_int: !!data.need_int,
		need_elixir: !!data.need_elixir,
		need_str: !!data.need_str,
		need_scroll1: !!data.need_scroll1,
		coming: !!data.coming,
		alloy: !!data.alloy,
		tracker: data.tracker != null ? Number(data.tracker) : (reports[name] && reports[name].tracker),
		kit: data.kit || (reports[name] && reports[name].kit) || null,
			at: Date.now()
		};
	if (data.need_h || data.need_m) {
		var prev = pot_asks[name];
		if (!prev || Date.now() - prev.at > 15000) {
			var bits = [];
			if (data.need_m) bits.push("mp");
			if (data.need_h) bits.push("hp");
			game_log(name + " needs " + bits.join("/") + " pots");
		}
		pot_asks[name] = { h: !!data.need_h, m: !!data.need_m, at: Date.now() };
	} else {
		delete pot_asks[name];
	}
}

function on_cm(name, data) {
	if (!is_farmer(name) || !data || typeof data !== "object") return;
	if (data.t === "mux" || data.t === "pots") note_farmer_mux(name, data);
	if (data.t === "give") {
		last_dump_ms[name] = Date.now();
		if (data.item && (in_list(ALL_GEAR, data.item) || NEVER_UPGRADE[data.item])) {
			owners[data.item] = name;
		}
	}
}

function on_party_invite(name) {
	if (is_farmer(name)) accept_party_invite(name);
}

function fresh_report(name) {
	var r = reports[name];
	if (!r || Date.now() - r.at > 20000) return null;
	return r;
}

function pot_report(name) {
	var r = reports[name];
	if (!r || Date.now() - r.at > 60000) return null;
	return r;
}

function mpot_need(name) {
	if (name === CONFIG.MAGE || name === CONFIG.PRIEST) return CONFIG.MPOT_NEED_CASTER;
	return CONFIG.MPOT_NEED || CONFIG.POT_NEED;
}

function mpot_visit(name) {
	if (name === CONFIG.MAGE || name === CONFIG.PRIEST) return CONFIG.MPOT_VISIT_CASTER;
	return CONFIG.MPOT_VISIT;
}

function pot_ask(name) {
	var ask = pot_asks[name];
	if (!ask || Date.now() - ask.at > CONFIG.POT_ASK_MS) return null;
	return ask;
}

function farmer_needs_mpot(name) {
	var r = pot_report(name);
	if (r) return r.mpot < mpot_visit(name);
	var ask = pot_ask(name);
	return !!(ask && ask.m);
}

function farmer_needs_hpot(name) {
	var r = pot_report(name);
	if (r) return r.hpot < CONFIG.POT_VISIT;
	var ask = pot_ask(name);
	return !!(ask && ask.h);
}

function farmer_needs_pots(name) {
	return farmer_needs_hpot(name) || farmer_needs_mpot(name);
}

/**
 * Off-screen gold is only in the mux ping. A 20s window dropped CMs and the
 * mule sat in town with 475g while farmers held 20k. Trust the last ping for
 * three minutes; live get_player still wins when they share a screen.
 */
function farmer_has_gold(name) {
	if (character.gold >= (CONFIG.GOLD_MULE_SKIP || 8000)) return false;
	var live = get_player(name);
	if (live && live.gold > CONFIG.GOLD_FARMER_KEEP + 200) return true;
	var r = reports[name];
	if (!r || Date.now() - r.at > 180000) return false;
	return r.gold > CONFIG.GOLD_FARMER_KEEP + 200;
}

function farmer_has_dump(name) {
	if (mission && Date.now() - (last_dump_ms[name] || 0) < 4000) return true;
	var r = fresh_report(name);
	return !!(r && r.dump >= (CONFIG.DUMP_VISIT_MIN || 8));
}

function pick_visit() {
	var i;
	var name;
	var safe = [CONFIG.MAGE, CONFIG.PRIEST, CONFIG.WARRIOR];
	for (i = 0; i < safe.length; i++) {
		name = safe[i];
		if (!farmer_reachable(name)) continue;
		if (farmer_has_gold(name)) {
			last_visit_why = name + " gold drain";
			return name;
		}
		if (farmer_has_dump(name)) {
			last_visit_why = name + " loot dump";
			return name;
		}
	}
	for (i = 0; i < safe.length; i++) {
		name = safe[i];
		if (!farmer_reachable(name)) continue;
		if (has_return_item(name)) {
			last_visit_why = name + " deliver +" + CONFIG.UPGRADE_MAX + " gear";
			return name;
		}
	}
	last_visit_why = "";
	return null;
}

function mux_hpot(name) {
	var r = pot_report(name);
	return r ? r.hpot : "?";
}

function mux_mpot(name) {
	var r = pot_report(name);
	return r ? r.mpot : "?";
}

function dest_for(name) {
	var p = get_player(name);
	if (p) return { map: p.map, x: p.x, y: p.y };
	var q = party_xy(name);
	if (q) return q;
	var r = fresh_report(name) || reports[name];
	if (r && r.map != null) return { map: r.map, x: r.x, y: r.y };
	return null;
}

/**
 * Same data as the party-list Travel button: get_party() x/y/map even
 * when that character is off-screen.
 */
function party_xy(name) {
	var party = (typeof get_party === "function") ? get_party() : null;
	var m = party && party[name];
	if (!m || m.x == null || m.rip) return null;
	if (m["in"] && m.map && m["in"] !== m.map && m["in"] !== character["in"]) return null;
	return { map: m.map || character.map, x: m.x, y: m.y };
}

/** Prefer a farmer we can actually walk to (main / cave), not Aedroma in Spooky Town. */
function travel_anchor() {
	var names = [CONFIG.PRIEST, CONFIG.MAGE, CONFIG.WARRIOR];
	for (var i = 0; i < names.length; i++) {
		if (!farmer_reachable(names[i])) continue;
		var xy = dest_for(names[i]);
		if (xy && xy.x != null) return { name: names[i], dest: xy };
	}
	return null;
}

/** Cave spawn / main-door alcove. First bat box is ~500px south at -194,-461. */
var CAVE_MEET = { map: "cave", x: 0, y: -80 };
/**
 * Croc box is [696,1498,906,1922] and crocs (48 atk, aggro) would eat a 109
 * HP mule that walks to the farmer's exact xy inside it. The warrior waits
 * for the priest on the beach north of the box (740,1460) and walks out to
 * us between pulls, so stand 60px further north on the same sand. The
 * shore wall is x=696 — anything west of it (the old 580,1400) is sea and
 * smart_move can never get there. Aggro only triggers inside a croc's
 * 15px attack range, so 100px north of the box is safe.
 */
var CROC_MEET = { map: "main", x: 740, y: 1400 };
/**
 * Spider box [700,-282,1196,-6], 80 atk, range 32. Do not walk to the
 * farmer xy inside it. Park west of the west wall, toward town.
 */
var SPIDER_MEET = { map: "main", x: 620, y: -144 };

function near_croc_pack(p) {
	if (!p || (p.map || "main") !== "main") return false;
	return p.x > 680 && p.x < 1000 && p.y > 1430 && p.y < 2000;
}

function near_spider_pack(p) {
	if (!p || (p.map || "main") !== "main") return false;
	return p.x > 660 && p.x < 1240 && p.y > -320 && p.y < 40;
}

function pack_map_ok(map) {
	return map === "main" || map === "cave";
}

/** Main/cave only. Spooky Town has no door from main; halloween is the east-park death road. */
function dest_ok(d) {
	if (!d || d.x == null) return false;
	var map = d.map || "main";
	if (!pack_map_ok(map)) return false;
	if (map === "main" && d.x > 1300) return false;
	if (map === "main" && d.x > 850 && d.y > 80 && d.y < 520) return false;
	return true;
}

function farmer_reachable(name) {
	return dest_ok(dest_for(name));
}

function farmer_on_cave(name, base) {
	if (base && base.map === "cave") return true;
	var p = player_xy(name);
	return !!(p && p.map === "cave");
}

function at_cave_meet() {
	return character.map === "cave" && simple_distance(character, CAVE_MEET) < 160;
}

function town_anchor() {
	var main = G.maps.main;
	var sp = main && main.spawns && main.spawns[0];
	if (sp) return { map: "main", x: sp[0], y: sp[1] };
	return { map: "main", x: 0, y: -50 };
}

function offset_toward(from, toward, dist) {
	var dx = toward.x - from.x;
	var dy = toward.y - from.y;
	var n = Math.sqrt(dx * dx + dy * dy) || 1;
	return {
		map: from.map || toward.map || character.map,
		x: from.x + (dx / n) * dist,
		y: from.y + (dy / n) * dist
	};
}

function aggro_on_me() {
	for (var id in parent.entities) {
		var e = parent.entities[id];
		if (!e || e.type !== "monster" || e.rip) continue;
		if (e.target === character.name) return e;
	}
	return null;
}

function is_aggressive_type(mtype) {
	var def = G.monsters[mtype];
	return !!(def && (def.aggro || 0) > 0);
}

/**
 * Only a monster that already locked onto us is a threat. Bee has aggro 1, so
 * the old "any aggressive type within 140px" test town()'d on every walk
 * through the bee field between town and the snake pack — that is the
 * flee/town/walk loop. Bees hit from range 20; 139px is just scenery.
 */
function is_threat(e) {
	if (!e || e.type !== "monster" || e.rip) return false;
	return e.target === character.name;
}

function nearest_threat_to(p) {
	var best = null;
	var best_d = 99999;
	for (var id in parent.entities) {
		var e = parent.entities[id];
		if (!is_threat(e)) continue;
		var d = simple_distance(p, e);
		if (d < best_d) {
			best_d = d;
			best = e;
		}
	}
	return best;
}

function hot_types_near(p, range) {
	for (var id in parent.entities) {
		var e = parent.entities[id];
		if (!e || e.type !== "monster" || e.rip) continue;
		if (!is_aggressive_type(e.mtype)) continue;
		if (simple_distance(p, e) <= range) return true;
	}
	return false;
}

function player_xy(name) {
	var p = get_player(name);
	if (p) return { map: p.map, x: p.x, y: p.y };
	return dest_for(name);
}

/**
 * Walk to THIS farmer. Mage goos and crab beach are different spots;
 * preferring the priest used to dump every Tonerre trip on the west beach.
 */
function safe_meet_point(name) {
	var base = player_xy(name) || dest_for(name);
	if (!base || base.x == null) return null;
	if (base.map === "main" && base.x < 200 && base.y > 1400) return null;
	if (farmer_on_cave(name, base) || base.map === "cave") {
		return { map: CAVE_MEET.map, x: CAVE_MEET.x, y: CAVE_MEET.y };
	}
	if (near_croc_pack(base)) {
		return { map: CROC_MEET.map, x: CROC_MEET.x, y: CROC_MEET.y };
	}
	if (near_spider_pack(base)) {
		return { map: SPIDER_MEET.map, x: SPIDER_MEET.x, y: SPIDER_MEET.y };
	}
	var dest = { map: base.map || "main", x: base.x, y: base.y };
	if (!dest_ok(dest) || is_bad_dest(dest)) return null;
	return dest;
}

function at_croc_meet() {
	return character.map === "main" && simple_distance(character, CROC_MEET) < 120;
}

function at_spider_meet() {
	return character.map === "main" && simple_distance(character, SPIDER_MEET) < 120;
}

function any_farmer_at_crocs() {
	for (var i = 0; i < CONFIG.FARMERS.length; i++) {
		if (near_croc_pack(dest_for(CONFIG.FARMERS[i]))) return true;
	}
	return false;
}

function any_farmer_at_spiders() {
	for (var i = 0; i < CONFIG.FARMERS.length; i++) {
		if (near_spider_pack(dest_for(CONFIG.FARMERS[i]))) return true;
	}
	return false;
}

function near_pack() {
	if (character.map === "spookytown" || character.map === "halloween") return false;
	if (at_cave_meet()) return true;
	/** Parked at the croc entrance while the warrior walks out to us: not "stuck", do not town(). */
	if (at_croc_meet() && any_farmer_at_crocs()) return true;
	if (at_spider_meet() && any_farmer_at_spiders()) return true;
	for (var i = 0; i < CONFIG.FARMERS.length; i++) {
		if (near_farmer(CONFIG.FARMERS[i])) return true;
	}
	return false;
}

function near_mission() {
	if (!mission || !mission.who) return near_pack();
	if (near_farmer(mission.who)) return true;
	var d = dest_for(mission.who);
	if (at_croc_meet() && near_croc_pack(d)) return true;
	if (at_spider_meet() && near_spider_pack(d)) return true;
	return !!(at_cave_meet() && d && d.map === "cave");
}

function this_farmer_needs_us(name) {
	if (!name || !farmer_reachable(name)) return false;
	return farmer_needs_pots(name) || farmer_has_gold(name) || farmer_has_dump(name) || has_return_item(name);
}

function mob_attack(e) {
	var def = e && G.monsters[e.mtype];
	return (def && def.attack) || 0;
}

async function flee_if_danger() {
	var aggro = aggro_on_me();
	if (!aggro) return false;
	var hp = character.hp / character.max_hp;
	var atk = mob_attack(aggro);
	/**
	 * Bees (16 atk) used to kite with move(), which cancels smart_move
	 * ("Lost the path") and wedges us on the meadow cliff. Ignore them
	 * and keep the Travel route. Town only if something actually hurts.
	 */
	if (atk < 40 && hp > 0.45) return false;
	var d = Math.round(simple_distance(character, aggro));
	mission = null;
	return do_town_escape("aggro " + (aggro.mtype || "mob") + " d=" + d);
}

async function maybe_self_pot() {
	if (character.hp / character.max_hp <= 0.75 && (locate_item(CONFIG.HPOT) !== -1 || locate_item("hpot0") !== -1) && !is_on_cooldown("use_hp")) {
		try { await use_skill("use_hp"); } catch (e) {}
	}
	var need_mp = character.mp < 120 || (character.max_mp - character.mp) >= 280;
	if (need_mp && (locate_item(CONFIG.MPOT) !== -1 || locate_item("mpot0") !== -1) && !is_on_cooldown("use_mp")) {
		try { await use_skill("use_mp"); } catch (e) {}
	}
}

function near_farmer(name) {
	var p = get_player(name);
	if (p && distance(character, p) <= CONFIG.REACH) return true;
	var r = dest_for(name);
	return !!(r && (!r.map || r.map === character.map) && simple_distance(character, r) <= CONFIG.REACH);
}

/**
 * Equipment for a farmer. get_player only works while they share our screen,
 * and we do most of our thinking alone in town, so fall back to the slot map
 * they send with every mux ping.
 */
function farmer_slots(who) {
	var p = get_player(who);
	if (p && p.slots) return p.slots;
	var r = reports[who];
	if (!r || !r.kit || Date.now() - r.at > CONFIG.KIT_REPORT_MS) return null;
	var out = {};
	for (var slot in r.kit) {
		var v = r.kit[slot];
		if (!v) {
			out[slot] = null;
			continue;
		}
		var parts = String(v).split(":");
		out[slot] = { name: parts[0], level: Number(parts[1]) || 0 };
	}
	return out;
}

function farmer_two_handed(who) {
	var slots = farmer_slots(who);
	var mh = slots && slots.mainhand;
	if (!mh) return false;
	var def = G.items[mh.name];
	if (!def || !def.wtype) return false;
	var cls = G.classes && G.classes.warrior;
	if (cls && cls.doublehand && cls.doublehand[def.wtype]) return true;
	return def.wtype === "basher" || def.wtype === "axe" || def.wtype === "scythe";
}

/** Is this farmer's slot still open for the spec: empty, off-list, or under +7? */
function bag_count_any(names) {
	var n = 0;
	var items = character.items || [];
	for (var i = 0; i < items.length; i++) {
		if (items[i] && in_list(names, items[i].name)) n++;
	}
	return n;
}

/** Shield slot is closed once the farmer holds, or we are about to deliver, a two-hander. */
function shield_closed(who, spec) {
	if (!spec.unless_2h) return false;
	if (farmer_two_handed(who)) return true;
	return who === CONFIG.WARRIOR && bag_count_any(["wbasher"]) > 0;
}

/** Equipped piece already fills this slot (shop kit or a same-type find). */
function slot_covers_spec(eq, spec) {
	if (!eq) return false;
	if (in_list(spec.items, eq.name)) return true;
	var eqd = G.items[eq.name];
	var buyd = G.items[spec_buy_name(spec)];
	return !!(eqd && buyd && eqd.type === buyd.type);
}

function spec_open(who, spec) {
	var slots = farmer_slots(who);
	if (!slots) return false;
	if (shield_closed(who, spec)) return false;
	var eq = slots[spec.slot];
	if (!eq) return true;
	return !slot_covers_spec(eq, spec);
}

/** Empty, or wearing the wrong type. Wanderer's pants are not "empty". */
function spec_empty(who, spec) {
	var slots = farmer_slots(who);
	if (!slots) return false;
	if (shield_closed(who, spec)) return false;
	var eq = slots[spec.slot];
	if (!eq) return true;
	return !slot_covers_spec(eq, spec);
}

function lists_overlap(a, b) {
	for (var i = 0; i < a.length; i++) {
		if (in_list(b, a[i])) return true;
	}
	return false;
}

/** Number of farmers whose slot for this item is still open. */
function gear_demand(item_name) {
	var n = 0;
	for (var who in KIT) {
		var list = KIT[who];
	for (var i = 0; i < list.length; i++) {
			if (in_list(list[i].items, item_name) && spec_open(who, list[i])) {
				n++;
				break;
			}
		}
	}
	return n;
}

/** Farmers sharing this spec (same slot, overlapping items) whose slot is open. */
function spec_demand(spec) {
	var n = 0;
	for (var who in KIT) {
		var list = KIT[who];
		for (var i = 0; i < list.length; i++) {
			var s = list[i];
			if (s.slot === spec.slot && lists_overlap(s.items, spec.items) && spec_open(who, s)) {
				n++;
				break;
			}
		}
	}
	return n;
}

/** Bag copies (any level) that could be upgraded and handed out for this spec. */
function spec_supply(spec) {
	var n = 0;
	var items = character.items || [];
	for (var i = 0; i < items.length; i++) {
		var it = items[i];
		if (!it || !in_list(spec.items, it.name)) continue;
		if (NEVER_UPGRADE[it.name] && (it.level || 0) < CONFIG.UPGRADE_MAX) continue;
		n++;
	}
	return n;
}

function anyone_would_wear(it) {
	for (var i = 0; i < CONFIG.FARMERS.length; i++) {
		if (farmer_would_wear(CONFIG.FARMERS[i], it)) return true;
	}
	return false;
}

/**
 * Keep the best `demand` copies of a kit item (highest level, earliest slot).
 * Extra staffs and helmets are surplus — do not upgrade or hoard them.
 */
function is_kept_for_kit(it) {
	if (!it) return false;
	var demand = gear_demand(it.name);
	if (demand <= 0) return false;
	var items = character.items || [];
	var idx = items.indexOf(it);
	if (idx < 0) return false;
	var better = 0;
	var il = it.level || 0;
	for (var i = 0; i < items.length; i++) {
		var other = items[i];
		if (!other || other === it || other.name !== it.name || other.l) continue;
		var ol = other.level || 0;
		if (ol > il || (ol === il && i < idx)) better++;
	}
	return better < demand;
}

/**
 * Wanderer pieces except wcap and wbreeches, scroll0 to +7.
 * Do not upgrade lolipops or quivers.
 * One Quiver: already at +7. Heavy Helmet / Underarmor stay on their own jobs.
 */
function upgrade_scroll_name(it) {
	if (!it) return null;
	var grade = typeof item_grade === "function" ? item_grade(it) : 0;
	if (grade === 0) return "scroll0";
	if (grade === 1) return "scroll1";
	if (grade === 2) return "scroll2";
	return null;
}

/** 0 = scroll0, 1 = scroll1, 2 = scroll2. Lower runs first. */
function upgrade_scroll_rank(it) {
	var name = upgrade_scroll_name(it);
	if (name === "scroll0") return 0;
	if (name === "scroll1") return 1;
	if (name === "scroll2") return 2;
	return 9;
}

function scroll_stock_keep(name) {
	if (name === "cscroll1") return CONFIG.CSCROLL1_KEEP || 2;
	if (name === "cscroll0") return CONFIG.CSCROLL_KEEP || 8;
	if (name === "scroll2") return CONFIG.SCROLL2_KEEP || 4;
	if (name === "scroll1") return CONFIG.SCROLL1_KEEP || 8;
	return CONFIG.SCROLL_KEEP;
}

function bag_has_quiver_plus(min_level) {
	var items = character.items || [];
	for (var i = 0; i < items.length; i++) {
		var it = items[i];
		if (it && !it.l && it.name === "quiver" && (it.level || 0) >= min_level) return true;
	}
	return false;
}

function is_best_quiver_for_upgrade(it) {
	var items = character.items || [];
	var idx = items.indexOf(it);
	var il = it.level || 0;
	for (var i = 0; i < items.length; i++) {
		var other = items[i];
		if (!other || other === it || other.l || other.name !== "quiver") continue;
		if ((other.level || 0) >= (CONFIG.QUIVER_MAX || 7)) continue;
		var ol = other.level || 0;
		if (ol > il || (ol === il && i < idx)) return false;
	}
	return true;
}

function should_upgrade(it) {
	if (!it || it.l) return false;
	if (character.gold < (CONFIG.UPGRADE_GOLD_MIN || 0)) return false;
	if (NEVER_UPGRADE[it.name]) return false;
	if (it.name === "quiver") return false;
	if (is_heavy_armor(it.name)) return (it.level || 0) < CONFIG.UPGRADE_MAX;
	if (typeof item_grade === "function" && item_grade(it) !== 0) return false;
	if (is_lolipop(it.name)) return false;
	if (!is_wanderer(it.name)) return false;
	if ((it.level || 0) >= CONFIG.UPGRADE_MAX) return false;
	return true;
}

function wanderer_needs_dex(it) {
	if (!it || it.l) return false;
	if (is_junk_wanderer(it.name)) return false;
	if (!is_wanderer(it.name)) return false;
	if ((it.level || 0) < 7) return false;
	return it.stat_type !== "dex";
}

function locate_dexscroll_item() {
	var items = character.items || [];
	for (var i = 0; i < items.length; i++) {
		if (wanderer_needs_dex(items[i])) return i;
	}
	return -1;
}

function warrior_needs_str(it) {
	if (!it || it.l) return false;
	if (!item_can_pscroll(it)) return false;
	if (it.stat_type === "str") return false;
	if (is_heavy_armor(it.name)) return (it.level || 0) >= 7;
	if (is_vampire_armor(it.name) || it.name === "ecape") return true;
	return false;
}

function locate_strscroll_item() {
	var items = character.items || [];
	for (var i = 0; i < items.length; i++) {
		if (warrior_needs_str(items[i])) return i;
	}
	return -1;
}

function has_return_item(name) {
	if (name === CONFIG.PRIEST && mule_should_hand_oozing()) return true;
	if (name === CONFIG.PRIEST && mule_should_hand_vstaff()) return true;
	var items = character.items || [];
	for (var i = 0; i < items.length; i++) {
		var it = items[i];
		if (!it) continue;
		if (farmer_would_wear_stat(name, it)) return true;
		if (name === CONFIG.MAGE && ranger_would_wear_quiver(it)) return true;
		if (name === CONFIG.MAGE && ranger_would_wear_alloy(it)) return true;
		if (name === CONFIG.MAGE && ranger_would_wear_wingedboots(it)) return true;
		if (return_rank(it, name) < 90) return true;
	}
	return false;
}

function locate_best_named(name) {
	var items = character.items || [];
	var best = -1;
	var lv = -1;
	for (var i = 0; i < items.length; i++) {
		var it = items[i];
		if (!it || it.l || it.name !== name) continue;
		var nlv = it.level || 0;
		if (best < 0 || nlv > lv) {
			best = i;
			lv = nlv;
		}
	}
	return best;
}

function farmer_oozing_level(name) {
	var p = get_player(name);
	var eq = p && p.slots && p.slots.mainhand;
	if (eq && eq.name === "oozingterror") return eq.level || 0;
	var r = reports[name];
	var mh = r && r.kit && r.kit.mainhand;
	if (typeof mh === "string" && mh.indexOf("oozingterror:") === 0) {
		return parseInt(mh.split(":")[1], 10) || 0;
	}
	return -1;
}

function mule_should_hand_oozing() {
	var slot = locate_best_named("oozingterror");
	if (slot < 0) return false;
	var it = character.items[slot];
	if (!it) return false;
	var mine = it.level || 0;
	var theirs = farmer_oozing_level(CONFIG.PRIEST);
	if (theirs >= 0 && mine <= theirs) return false;
	return true;
}

function farmer_lolipop_level(name) {
	var slots = farmer_slots(CONFIG.WARRIOR);
	var best = -1;
	var hands = ["mainhand", "offhand"];
	var i;
	if (slots) {
		for (i = 0; i < hands.length; i++) {
			var eq = slots[hands[i]];
			if (eq && eq.name === name) best = Math.max(best, eq.level || 0);
		}
	}
	if (best >= 0) return best;
	var r = reports[CONFIG.WARRIOR];
	var kit = r && r.kit;
	if (!kit) return -1;
	for (i = 0; i < hands.length; i++) {
		var mh = kit[hands[i]];
		if (typeof mh === "string" && mh.indexOf(name + ":") === 0) {
			best = Math.max(best, parseInt(mh.split(":")[1], 10) || 0);
		}
	}
	return best;
}

function mule_should_hand_lolipop(it) {
	if (!it || it.l || !is_lolipop(it.name)) return false;
	if ((it.level || 0) < 1) return false;
	var theirs = farmer_lolipop_level(it.name);
	if (theirs >= 0 && (it.level || 0) <= theirs) return false;
	return true;
}

function jeweler_wants(who, it) {
	if (!it) return false;
	var table = jewel_table(who);
	for (var slot in table) {
		if (in_list(table[slot], it.name)) return true;
	}
	var def = G.items[it.name];
	if (!def) return false;
	return def.type === "ring" || def.type === "earring" || def.type === "amulet" || def.type === "belt";
}

function wear_names_for(who, it) {
	if (!it) return null;
	var n = it.name;
	if (n === "glolipop" || n === "fireblade" || n === "wbasher" || n === "blade") {
		return who === CONFIG.WARRIOR ? ["glolipop", "ololipop", "fireblade", "wbasher", "blade"] : null;
	}
	if (n === "ololipop") {
		return who === CONFIG.WARRIOR ? ["ololipop"] : null;
	}
	if (n === "vstaff" || n === "firestaff" || n === "staff" || n === "oozingterror") {
		return who === CONFIG.PRIEST ? ["vstaff", "oozingterror", "firestaff", "staff"] : null;
	}
	if (n === "firebow" || n === "frostbow" || n === "hbow" || n === "bow") {
		return who === CONFIG.MAGE ? ["firebow", "frostbow", "hbow", "bow"] : null;
	}
	var list = KIT[who] || [];
	for (var i = 0; i < list.length; i++) {
		if (in_list(list[i].items, n)) return list[i].items;
	}
	var table = jewel_table(who);
	for (var slot in table) {
		if (in_list(table[slot], n)) return table[slot];
	}
	return null;
}

function wear_slots_for(who, it) {
	if (!it) return [];
	var n = it.name;
	if (n === "glolipop" || n === "fireblade" || n === "wbasher" || n === "blade") {
		return who === CONFIG.WARRIOR ? ["mainhand"] : [];
	}
	if (n === "ololipop") {
		return who === CONFIG.WARRIOR ? ["offhand"] : [];
	}
	if (n === "vstaff" || n === "firestaff" || n === "staff" || n === "oozingterror") {
		return who === CONFIG.PRIEST ? ["mainhand"] : [];
	}
	if (n === "firebow" || n === "frostbow" || n === "hbow" || n === "bow") {
		return who === CONFIG.MAGE ? ["mainhand"] : [];
	}
	var list = KIT[who] || [];
	var slots = [];
	for (var i = 0; i < list.length; i++) {
		if (in_list(list[i].items, n)) slots.push(list[i].slot);
	}
	if (slots.length) return slots;
	var table = jewel_table(who);
	for (var slot in table) {
		if (in_list(table[slot], n)) slots.push(slot);
	}
	return slots;
}

function item_beats_eq(eq, it, names) {
	if (!it || !names || !in_list(names, it.name)) return false;
	if (!eq) return true;
	var eq_rank = names.indexOf(eq.name);
	var it_rank = names.indexOf(it.name);
	if (eq_rank < 0) return true;
	if (it_rank < eq_rank) return true;
	if (it_rank === eq_rank && (it.level || 0) > (eq.level || 0)) return true;
	return false;
}

function farmer_would_wear(who, it) {
	if (who !== CONFIG.MAGE || !it || it.l) return false;
	if (is_junk_wanderer(it.name)) return false;
	if (!is_wanderer(it.name)) return false;
	if ((it.level || 0) < 7) return false;
	if (it.stat_type !== "dex") return false;
	if (is_bounce(who, it)) return false;
	var slot = WANDERER_SLOT[it.name];
	var slots = farmer_slots(who);
	if (!slots) return true;
	var eq = slots[slot];
	if (!eq) return true;
	if (eq.name === it.name) return (it.level || 0) > (eq.level || 0);
	if (is_wanderer(eq.name)) return (it.level || 0) > (eq.level || 0);
	return (it.level || 0) >= (eq.level || 0);
}

function return_rank(it, name) {
	if (!it || it.l) return 99;
	if (is_bounce(name, it)) return 99;
	if (!farmer_would_wear(name, it)) return 99;
	var n = it.name;
	if (n === "ololipop" || n === "glolipop" || n === "fireblade" || n === "blade") return 0;
	if (n === "vstaff" || n === "oozingterror" || n === "firestaff" || n === "staff") {
		if (name === CONFIG.PRIEST) return n === "vstaff" ? 0 : 1;
		return name === CONFIG.MAGE ? 1 : 2;
	}
	if (is_wanderer(n) && name === CONFIG.MAGE) return 2;
	if (in_list(ALL_GEAR, n)) return 3;
	if (jeweler_wants(name, it)) {
		if (name === CONFIG.WARRIOR && jewel_owner(n) === CONFIG.WARRIOR) return 4;
		if (name !== CONFIG.WARRIOR && jewel_owner(n) !== CONFIG.WARRIOR) return 5;
		return 6;
	}
	return 99;
}

function spec_buy_name(spec) {
	return spec.buy || spec.items[spec.items.length - 1];
}

function spec_price(spec) {
	var n = spec_buy_name(spec);
	return (G.items[n] && G.items[n].g) || 999999;
}

/** The next spec we should buy a copy for: open slot, bag supply below demand, affordable. */
function next_kit_buy(name, only_empty) {
	var list = KIT[name] || [];
	for (var i = 0; i < list.length; i++) {
		var spec = list[i];
		if (only_empty ? !spec_empty(name, spec) : !spec_open(name, spec)) continue;
		if (spec_supply(spec) >= spec_demand(spec)) continue;
		if (character.gold < spec_price(spec)) continue;
		return spec;
	}
	return null;
}

function kit_needs_buy(name) {
	return !!next_kit_buy(name, false);
}

/** Someone is fighting with an empty slot and we could fix it at Gabriel. */
function kit_urgent() {
	for (var i = 0; i < CONFIG.FARMERS.length; i++) {
		if (next_kit_buy(CONFIG.FARMERS[i], true)) return true;
	}
	return false;
}

async function ping_farmers() {
	if (Date.now() - last_mux < CONFIG.MUX_MS) return;
	last_mux = Date.now();
	for (var i = 0; i < CONFIG.FARMERS.length; i++) {
		try { await send_cm(CONFIG.FARMERS[i], { t: "mux", src: "merch" }); } catch (e) {}
	}
}

function caster_mpot_urgent() {
	return farmer_needs_mpot(CONFIG.MAGE) || farmer_needs_mpot(CONFIG.PRIEST);
}

async function stock_pots() {
	var hname = CONFIG.HPOT;
	var mname = CONFIG.MPOT;
	var ph = (G.items[hname] && G.items[hname].g) || 100;
	var pm = (G.items[mname] && G.items[mname].g) || 100;
	var need_h = CONFIG.POT_STOCK - item_count(hname);
	var need_m = CONFIG.MPOT_STOCK - item_count(mname);
	if (caster_mpot_urgent() && item_count(mname) < CONFIG.MPOT_GIVE) {
		need_m = Math.max(need_m, CONFIG.MPOT_GIVE - item_count(mname));
	}
	if (need_h < 10 && need_m < 10) return false;
	var budget = Math.max(0, character.gold - (CONFIG.XP_GOLD_KEEP || 0));
	if (budget < Math.min(ph, pm)) return false;
	if (!shop_ready("fancypots")) {
		await go_to("fancypots", "stock " + hname + "/" + mname);
		return true;
	}
	if (need_m >= 10) {
		var buy_m = Math.min(need_m, Math.floor(budget / pm));
		if (buy_m >= 10) {
			await buy_from_shop(mname, buy_m);
			budget = Math.max(0, character.gold - (CONFIG.XP_GOLD_KEEP || 0));
		}
	}
	if (need_h >= 10) {
		var buy_h = Math.min(need_h, Math.floor(budget / ph));
		if (buy_h >= 10) await buy_from_shop(hname, buy_h);
	}
	return true;
}

async function stock_scrolls(kind, keep) {
	if (item_count(kind) >= keep) return false;
	var price = (G.items[kind] && G.items[kind].g) || 800;
	if (character.gold < price) return false;
	var n = Math.min(keep - item_count(kind), Math.floor(character.gold / price));
	if (n < 1) return false;
	return buy_from_shop(kind, n);
}

function locate_upgrade_item() {
	var items = character.items || [];
	var best = -1;
	var best_scroll = 99;
	var best_rank = 99;
	var best_lv = -1;
	for (var i = 0; i < items.length; i++) {
		var it = items[i];
		if (!should_upgrade(it)) continue;
		var srank = upgrade_scroll_rank(it);
		var rank = gear_rank(it);
		var lv = it.level || 0;
		if (srank < best_scroll || (srank === best_scroll && rank < best_rank) || (srank === best_scroll && rank === best_rank && lv > best_lv)) {
			best_scroll = srank;
			best_rank = rank;
			best_lv = lv;
			best = i;
		}
	}
	return best;
}

function is_stat_accessory(name) {
	return in_list(STAT_ACCESSORIES, name);
}

function accessory_goal() {
	return CONFIG.ACCESSORY_GOAL || 3;
}

function compound_scroll_for(name, level) {
	var def = G.items[name];
	if (!def || !def.compound || !def.grades) return null;
	var lv = level || 0;
	if (lv >= accessory_goal()) return null;
	if (lv < def.grades[0]) return "cscroll0";
	if (lv < def.grades[1]) return "cscroll1";
	if (lv < def.grades[2]) return "cscroll2";
	return null;
}

function is_bank_compound_item(it) {
	if (!it || it.l) return false;
	if (in_list(CONFIG.GABRIEL_SELL, it.name)) return false;
	var def = G.items[it.name];
	if (!def || !def.compound) return false;
	if (it.name === "ftrinket" || it.name === "wbook0") return true;
	var t = def.type;
	return t === "ring" || t === "earring" || t === "amulet" || t === "belt";
}

function is_compound_jewel(it) {
	return is_bank_compound_item(it) && !!compound_scroll_for(it.name, it.level || 0);
}

function compound_uses_cscroll0(name, level) {
	return compound_scroll_for(name, level) === "cscroll0";
}

function locate_rid(rid) {
	if (!rid) return -1;
	var items = character.items || [];
	for (var i = 0; i < items.length; i++) {
		if (items[i] && items[i].rid === rid) return i;
	}
	return -1;
}

function bag_slots_named_level(name, level) {
	var out = [];
	var items = character.items || [];
	var want = level || 0;
	for (var i = 0; i < items.length; i++) {
		var it = items[i];
		if (it && !it.l && it.name === name && (it.level || 0) === want) out.push(i);
	}
	return out;
}

function each_bank_item(fn) {
	var bank = character.bank;
	if (!bank) return;
	for (var pack in bank) {
		if (pack === "gold") continue;
		var list = bank[pack];
		if (!list) continue;
		if (typeof list.length === "number") {
			for (var i = 0; i < list.length; i++) fn(list[i], pack, i);
		} else {
			for (var k in list) {
				if (!Object.prototype.hasOwnProperty.call(list, k)) continue;
				var n = +k;
				if (k !== String(n)) continue;
				fn(list[k], pack, n);
			}
		}
	}
}

function remember_bank_jewels() {
	if (!character.bank) return;
	var groups = {};
	each_bank_item(function (it) {
		if (!is_compound_jewel(it)) return;
		var key = it.name + "@" + (it.level || 0);
		groups[key] = (groups[key] || 0) + 1;
	});
	bank_jewel_counts = groups;
}

function bank_cache_has_set() {
	for (var k in bank_jewel_counts) {
		if (bank_jewel_counts[k] >= 3) return true;
	}
	return false;
}

function bank_copy_count(name, level) {
	if (character.bank) remember_bank_jewels();
	var key = name + "@" + (level || 0);
	return bank_jewel_counts[key] || 0;
}

function find_bank_item_level(name, level) {
	if (!character.bank) return null;
	var want = level || 0;
	var found = null;
	each_bank_item(function (it, pack, slot) {
		if (found) return;
		if (it && !it.l && it.name === name && (it.level || 0) === want) {
			found = { pack: pack, slot: slot };
		}
	});
	return found;
}

function farmer_would_wear_stat(who, it) {
	if (!it || it.l || !is_stat_accessory(it.name)) return false;
	if ((it.level || 0) < accessory_goal()) return false;
	var table = jewel_table(who);
	var slots = farmer_slots(who);
	if (!table || !slots) return false;
	for (var slot in table) {
		if (!in_list(table[slot], it.name)) continue;
		if (item_beats_eq(slots[slot], it, table[slot])) return true;
	}
	return false;
}

function someone_would_wear_stat(it) {
	for (var i = 0; i < CONFIG.FARMERS.length; i++) {
		if (farmer_would_wear_stat(CONFIG.FARMERS[i], it)) return CONFIG.FARMERS[i];
	}
	return null;
}

function accessory_rank(name, level) {
	var lv = level || 0;
	if (name.indexOf("str") === 0) return lv;
	if (name.indexOf("dex") === 0) return lv + 0.1;
	if (name.indexOf("int") === 0) return lv + 0.2;
	return 20 + lv;
}

function find_compound_set() {
	var groups = {};
	var items = character.items || [];
	for (var i = 0; i < items.length; i++) {
		var it = items[i];
		if (!is_compound_jewel(it)) continue;
		var lv = it.level || 0;
		var scroll = compound_scroll_for(it.name, lv);
		if (!scroll) continue;
		var key = it.name + "@" + lv;
		if (!groups[key]) groups[key] = { slots: [], name: it.name, level: lv, scroll: scroll };
		groups[key].slots.push(i);
	}
	var best = null;
	var best_rank = 99;
	for (var k in groups) {
		if (groups[k].slots.length < 3) continue;
		var g = groups[k];
		var rank = is_stat_accessory(g.name) ? accessory_rank(g.name, g.level) : 40 + accessory_rank(g.name, g.level);
		if (rank < best_rank) {
			best_rank = rank;
			best = g.slots.slice(0, 3);
		}
	}
	return best;
}

function bag_has_compound_jewel() {
	var items = character.items || [];
	for (var i = 0; i < items.length; i++) {
		if (is_compound_jewel(items[i])) return true;
	}
	return false;
}

function in_bank() {
	return character.map === "bank";
}

function bag_tight() {
	return character.esize <= CONFIG.BAG_MIN + 2;
}

function accessory_needs_bank() {
	if (character.bank) remember_bank_jewels();
	if (accessory_store_rid && locate_rid(accessory_store_rid) !== -1) return true;
	if (find_compound_set()) return false;
	/** Full bag + Gabriel junk: sell frees slots; bank scans can wait. */
	if (bag_tight() && locate_sell_item() !== -1) return false;
	/** Only vault for a pull that finishes a triple, a known bank 3-match, or a scan.
	 *  Do NOT walk bank just because the bag holds 1–2 jewels — that used to store
	 *  incomplete sets and starve Cue of compounds until a third drip arrived later. */
	if (bank_cache_has_set()) return true;
	if (next_accessory_pull()) return true;
	if (bag_tight() && locate_stat_accessory_slot() !== -1) return true;
	if (!accessory_scanned) return true;
	if (Date.now() - (accessory_scan_at || 0) > (CONFIG.ACCESSORY_RESCAN_MS || ACCESSORY_RESCAN_MS)) {
		accessory_scanned = false;
		return true;
	}
	return false;
}

function accessory_work_pending() {
	return !!find_compound_set() || accessory_needs_bank();
}

function next_accessory_pull() {
	if (character.bank) remember_bank_jewels();
	var seen = {};
	var items = character.items || [];
	var i;
	for (i = 0; i < items.length; i++) {
		var it = items[i];
		if (!is_compound_jewel(it)) continue;
		var lv = it.level || 0;
		var key = it.name + "@" + lv;
		if (seen[key]) continue;
		seen[key] = true;
		var bag = bag_slots_named_level(it.name, lv).length;
		if (bag >= 3) continue;
		if (bag + bank_copy_count(it.name, lv) >= 3) {
			return { name: it.name, level: lv, need: 3 - bag };
		}
	}
	var best = null;
	var best_rank = 99;
	for (var k in bank_jewel_counts) {
		if (bank_jewel_counts[k] < 3) continue;
		var parts = k.split("@");
		var name = parts[0];
		var level = parseInt(parts[1], 10) || 0;
		if (!compound_scroll_for(name, level)) continue;
		var rank = is_stat_accessory(name) ? accessory_rank(name, level) : 40 + accessory_rank(name, level);
		if (rank < best_rank) {
			best_rank = rank;
			best = { name: name, level: level, need: 3 };
		}
	}
	return best;
}

function find_bank_plus3_for(who) {
	var bank = character.bank;
	if (!bank) return null;
	for (var pack in bank) {
		if (pack === "gold") continue;
		var list = bank[pack];
		if (!list) continue;
		for (var i = 0; i < list.length; i++) {
			var it = list[i];
			if (!it || it.l || !is_stat_accessory(it.name)) continue;
			if ((it.level || 0) < accessory_goal()) continue;
			if (farmer_would_wear_stat(who, it)) return { pack: pack, slot: i, name: it.name, level: it.level || 0 };
		}
	}
	return null;
}

function locate_stat_accessory_slot() {
	if (accessory_store_rid) {
		var s = locate_rid(accessory_store_rid);
		if (s !== -1) return s;
		accessory_store_rid = null;
	}
	if (find_compound_set()) return -1;
	var tight = character.esize <= CONFIG.BAG_MIN + 2;
	var items = character.items || [];
	for (var i = 0; i < items.length; i++) {
		var it = items[i];
		if (!is_bank_compound_item(it)) continue;
		if (someone_would_wear_stat(it)) continue;
		/** Hold incomplete compound stacks in bag for farmer finishes / Cue.
		 *  Only vault them under bag pressure, or when already at goal level. */
		if (is_compound_jewel(it) && !tight) {
			var lv = it.level || 0;
			if (lv < accessory_goal()) {
				var bag = bag_slots_named_level(it.name, lv).length;
				if (bag < 3) continue;
			}
		}
		return i;
	}
	return -1;
}

function craft_recipe(name) {
	if (G.craft && G.craft[name]) return G.craft[name];
	if (parent.G && parent.G.craft && parent.G.craft[name]) return parent.G.craft[name];
	return null;
}

function low_level_count(name, max_level) {
	var n = 0;
	var items = character.items || [];
	for (var i = 0; i < items.length; i++) {
		var it = items[i];
		if (it && it.name === name && !it.l && (it.level || 0) <= max_level) n += it.q || 1;
	}
	return n;
}

function item_count_level(name, level) {
	var n = 0;
	var items = character.items || [];
	var want = level || 0;
	for (var i = 0; i < items.length; i++) {
		var it = items[i];
		if (it && it.name === name && (it.level || 0) === want) n += it.q || 1;
	}
	return n;
}

function can_craft_named(name) {
	var recipe = craft_recipe(name);
	if (!recipe || !recipe.items) return false;
	if (character.gold < (recipe.cost || 0)) return false;
	for (var i = 0; i < recipe.items.length; i++) {
		var need = recipe.items[i];
		if (!need) continue;
		var q = need[0];
		var iname = need[1];
		var lv = need[2] || 0;
		if (item_count_level(iname, lv) < q) return false;
	}
	return true;
}

function wields(who, names) {
	var slots = farmer_slots(who);
	var mh = slots && slots.mainhand;
	return !!(mh && in_list(names, mh.name));
}

function next_craft() {
	var priest_needs = !wields(CONFIG.PRIEST, ["firestaff"]) && locate_item("firestaff") === -1;
	var warrior_needs = !wields(CONFIG.WARRIOR, ["fireblade", "glolipop", "ololipop"]) && locate_item("fireblade") === -1 && locate_item("glolipop") === -1 && locate_item("ololipop") === -1;
	if (item_count("essenceoffire") < 1) return null;
	if (warrior_needs && (can_craft_named("fireblade") || low_level_count("blade", 3) >= 1 || character.gold > 8400 + CONFIG.CRAFT_GOLD)) return "fireblade";
	if (priest_needs && (can_craft_named("firestaff") || low_level_count("staff", 3) >= 1 || character.gold > 12400 + CONFIG.CRAFT_GOLD)) return "firestaff";
	if (can_craft_named("firestaff")) return "firestaff";
	if (can_craft_named("fireblade")) return "fireblade";
	return null;
}

function is_jewelry(it) {
	if (!it) return false;
	var def = G.items[it.name];
	if (!def) return false;
	return def.type === "ring" || def.type === "earring" || def.type === "amulet" || def.type === "belt";
}

function is_heavy_piece(name) {
	return name === "hpants" || name === "hhelmet" || name === "hgloves" || name === "hboots" || name === "harmor";
}

function sell_item_owned(it) {
	if (!it || it.l) return false;
	/** Farmer drops keep oo until unlocked — Gabriel rejects them. */
	if (it.oo && it.oo !== character.name) return false;
	return true;
}

function should_sell(it) {
	if (!sell_item_owned(it)) return false;
	if (is_junk_wanderer(it.name)) return true;
	if (NEVER_SELL[it.name] || is_heavy_piece(it.name) || is_vampire_armor(it.name)) return false;
	return in_list(CONFIG.GABRIEL_SELL, it.name);
}

var sell_skip = {};

function sell_skip_key(it) {
	if (!it) return "";
	if (it.rid) return it.rid;
	return (it.name || "") + "@" + (it.level || 0) + "@" + (it.oo || "");
}

function locate_sell_item() {
	var items = character.items || [];
	for (var i = 0; i < items.length; i++) {
		var it = items[i];
		if (!should_sell(it)) continue;
		var key = sell_skip_key(it);
		if (key && sell_skip[key] && Date.now() < sell_skip[key]) continue;
		return i;
	}
	return -1;
}

function town_npc_chore_pending() {
	var can_exchange = character.esize >= 1 && locate_exchange_item() !== -1;
	return locate_sell_item() !== -1 || can_exchange || bag_needs_dump()
		|| locate_upgrade_item() !== -1 || locate_dexscroll_item() !== -1
		|| !!find_compound_set() || accessory_work_pending();
}

function bag_busy() {
	return locate_listed_keep() || locate_upgrade_item() !== -1 || locate_dexscroll_item() !== -1 || locate_strscroll_item() !== -1 || !!find_compound_set() || !!next_craft() || locate_sell_item() !== -1 || locate_exchange_item() !== -1 || character.esize <= CONFIG.BAG_MIN;
}

function mass_skill(kind) {
	var lv = character.level || 0;
	if (kind === "exchange") {
		if (lv >= 70) return "massexchangepp";
		if (lv >= 40) return "massexchange";
		return null;
	}
	if (lv >= 60) return "massproductionpp";
	if (lv >= 30) return "massproduction";
	return null;
}

function has_mass_buff(kind) {
	var s = character.s || {};
	if (kind === "exchange") return !!(s.massexchange || s.massexchangepp);
	return !!(s.massproduction || s.massproductionpp);
}

function wait_ms(ms) {
	return new Promise(function (ok) { setTimeout(ok, ms); });
}

/** Cast, wait until the buff is on character.s, never hang the mule loop. */
async function ensure_mass_buff(kind) {
	if (has_mass_buff(kind)) return true;
	var skill = mass_skill(kind);
	if (!skill) {
		game_log("mass skill: level " + (character.level || 0));
		return false;
	}
	game_log("cast " + skill);
	try { set_message(skill); } catch (e) {}
	try {
		var p = use_skill(skill);
		if (p && typeof p.then === "function") {
			var done = false;
			p.then(function () { done = true; }, function (err) {
				done = true;
				game_log(skill + " fail " + ((err && err.reason) || err));
			});
			var n;
			for (n = 0; n < 12 && !done && !has_mass_buff(kind); n++) {
				await wait_ms(50);
			}
		}
	} catch (e) {
		game_log(skill + ": " + ((e && e.reason) || e));
	}
	if (!has_mass_buff(kind) && typeof wait_for === "function") {
		try {
			await wait_for(function () { return has_mass_buff(kind); }, 400, 40);
		} catch (e) {}
	}
	if (has_mass_buff(kind)) return true;
	game_log(skill + " not applied");
	return false;
}

async function do_upgrade() {
	if (character.q && character.q.upgrade) return true;
	var slot = locate_upgrade_item();
	if (slot === -1) return false;
	var planned = character.items[slot];
	var scroll_name = upgrade_scroll_name(planned);
	if (!scroll_name) {
		act("upgrade blocked, no scroll for " + (planned && planned.name) + "+" + ((planned && planned.level) || 0));
		return false;
	}
	var keep = scroll_stock_keep(scroll_name);
	if (item_count(scroll_name) < 1) {
		if (await stock_scrolls(scroll_name, keep)) return true;
		act("upgrade blocked, no " + scroll_name);
		return false;
	}
	await ensure_stand_closed();
	if (!shop_ready("newupgrade")) {
		var walking = character.items[slot];
		act("walk Cue upgrade " + (walking && walking.name) + "+" + ((walking && walking.level) || 0));
		await go_to("newupgrade", "upgrade");
		return true;
	}
	slot = locate_upgrade_item();
	if (slot === -1) return false;
	if (!(await ensure_mass_buff("produce"))) {
		act("cast mass production");
		return true;
	}
	slot = locate_upgrade_item();
	planned = character.items[slot];
	scroll_name = upgrade_scroll_name(planned);
	var scroll = scroll_name ? locate_item(scroll_name) : -1;
	if (slot === -1 || scroll === -1 || scroll === slot) return false;
	var it = character.items[slot];
	if (!it || !should_upgrade(it)) return false;
	var name = it.name;
	var lv = it.level || 0;
	try {
		var result = await upgrade(slot, scroll);
		game_log("upgrade " + name + "+" + lv + " " + scroll_name + " ok=" + (result && result.success) + " lv=" + (result && result.level));
	} catch (e) {
		game_log("upgrade " + name + ": " + ((e && e.reason) || e));
	}
	return true;
}

async function do_dexscroll() {
	if (character.q && character.q.upgrade) return true;
	var slot = locate_dexscroll_item();
	if (slot === -1) return false;
	if (item_count("dexscroll") < 1) {
		if (await stock_scrolls("dexscroll", CONFIG.DEXSCROLL_KEEP || 20)) return true;
		act("dexscroll blocked, no dexscroll");
		return false;
	}
	await ensure_stand_closed();
	if (!shop_ready("newupgrade")) {
		var walking = character.items[slot];
		act("walk Cue dexscroll " + (walking && walking.name) + "+" + ((walking && walking.level) || 0));
		await go_to("newupgrade", "dexscroll");
		return true;
	}
	slot = locate_dexscroll_item();
	if (slot === -1) return false;
	if (!(await ensure_mass_buff("produce"))) {
		act("cast mass production");
		return true;
	}
	slot = locate_dexscroll_item();
	var scroll = locate_item("dexscroll");
	if (slot === -1 || scroll === -1 || scroll === slot) return false;
	var it = character.items[slot];
	if (!wanderer_needs_dex(it)) return false;
	var name = it.name;
	try {
		var result = await upgrade(slot, scroll);
		game_log("dexscroll " + name + "+7 stat=" + ((result && result.stat_type) || (result && result.success)));
	} catch (e) {
		game_log("dexscroll " + name + ": " + ((e && e.reason) || e));
	}
	return true;
}

async function do_compound() {
	if (character.q && character.q.compound) return true;
	if (in_bank()) {
		await ensure_stand_closed();
		act("leave bank, combine");
		await go_to("newupgrade", "combine accessories");
		return true;
	}
	var set = find_compound_set();
	if (!set) return false;
	var sample = character.items[set[0]];
	if (!sample) return false;
	var scroll_name = compound_scroll_for(sample.name, sample.level || 0);
	if (!scroll_name) return false;
	var keep = scroll_stock_keep(scroll_name);
	if (item_count(scroll_name) < 1) {
		if (await stock_scrolls(scroll_name, keep)) return true;
		act("combine blocked, " + character.gold + "g < " + scroll_name);
		return false;
	}
	if (!shop_ready("newupgrade")) {
		await ensure_stand_closed();
		act("walk Cue combine " + sample.name + "+" + (sample.level || 0));
		await go_to("newupgrade", "combine " + sample.name);
		return true;
	}
	set = find_compound_set();
	if (!set) return false;
	if (!(await ensure_mass_buff("produce"))) {
		act("cast mass production");
		return true;
	}
	set = find_compound_set();
	if (!set) return false;
	sample = character.items[set[0]];
	if (!sample) return false;
	scroll_name = compound_scroll_for(sample.name, sample.level || 0);
	var scroll = scroll_name ? locate_item(scroll_name) : -1;
	if (scroll === -1) return false;
	var a = character.items[set[0]];
	var b = character.items[set[1]];
	var c = character.items[set[2]];
	if (!a || !b || !c || a.name !== b.name || a.name !== c.name) return false;
	if ((a.level || 0) !== (b.level || 0) || (a.level || 0) !== (c.level || 0)) return false;
	if (scroll === set[0] || scroll === set[1] || scroll === set[2]) return false;
	try {
		var name = a.name;
		var lv = a.level || 0;
		var result = await compound(set[0], set[1], set[2], scroll);
		game_log("combine " + name + "+" + lv + " " + scroll_name + " ok=" + (result && result.success) + " lv=" + (result && result.level));
		if (result && result.success) {
			var out = (result.num != null) ? character.items[result.num] : null;
			if (out && out.name === name && is_bank_compound_item(out)) accessory_store_rid = out.rid || null;
			else if (is_bank_compound_item({ name: name, level: result.level || (lv + 1) })) accessory_store_rid = (out && out.rid) || null;
			accessory_scanned = false;
		}
	} catch (e) {
		game_log("combine failed: " + (e.reason || e));
	}
	return true;
}

async function retrieve_accessory_copies(name, level, need) {
	var pulled = 0;
	while (pulled < need && character.esize > CONFIG.BAG_MIN) {
		var found = find_bank_item_level(name, level);
		if (!found) break;
		try {
			await bank_retrieve(found.pack, found.slot);
			pulled++;
			game_log("bank pull " + name + "+" + level);
		} catch (e) {
			game_log("bank pull: " + ((e && e.reason) || e));
			break;
		}
	}
	return pulled;
}

async function do_accessory_bank() {
	if (character.map !== "bank") return false;
	if (!character.bank) {
		act("wait bank packs");
		return true;
	}
	remember_bank_jewels();
	var i;
	for (i = 0; i < CONFIG.FARMERS.length; i++) {
		var who = CONFIG.FARMERS[i];
		if (!farmer_in_city(who) && !near_farmer(who)) continue;
		var plus = find_bank_plus3_for(who);
		if (!plus || character.esize <= CONFIG.BAG_MIN) continue;
		try {
			await bank_retrieve(plus.pack, plus.slot);
			remember_bank_jewels();
			act("bank pull " + plus.name + "+" + plus.level + " for " + who);
			return true;
		} catch (e) {
			game_log("bank +3: " + ((e && e.reason) || e));
		}
	}
	if (accessory_store_rid) {
		var store = locate_rid(accessory_store_rid);
		if (store === -1) accessory_store_rid = null;
		else {
			try {
				var stored = character.items[store];
				var sname = stored && stored.name;
				var slv = stored && (stored.level || 0);
				await bank_store(store);
				accessory_store_rid = null;
				remember_bank_jewels();
				act("banked combine " + sname + "+" + slv);
				return true;
			} catch (e) {
				game_log("bank store combine: " + ((e && e.reason) || e));
				return false;
			}
		}
	}
	var pull = next_accessory_pull();
	if (pull) {
		var have = bag_slots_named_level(pull.name, pull.level).length;
		var need = Math.max(0, 3 - have);
		if (need > 0) {
			if (character.esize <= CONFIG.BAG_MIN) {
				act("bag tight, cannot pull " + pull.name);
				return false;
			}
			var n = await retrieve_accessory_copies(pull.name, pull.level, need);
			remember_bank_jewels();
			if (n > 0) {
				act("pulled " + n + " " + pull.name + "+" + pull.level);
				return true;
			}
			act("bank retrieve failed " + pull.name + "+" + pull.level);
			return false;
		}
		if (bag_slots_named_level(pull.name, pull.level).length >= 3) return true;
	}
	var slot = locate_stat_accessory_slot();
	if (slot !== -1) {
		try {
			var it = character.items[slot];
			var name = it && it.name;
			var lv = it && (it.level || 0);
			await bank_store(slot);
			if (accessory_store_rid && it && it.rid === accessory_store_rid) accessory_store_rid = null;
			remember_bank_jewels();
			act("banked " + name + "+" + lv);
			return true;
		} catch (e) {
			game_log("bank store accessory: " + ((e && e.reason) || e));
			return false;
		}
	}
	remember_bank_jewels();
	accessory_scanned = !bank_cache_has_set();
	accessory_scan_at = Date.now();
	if (bank_cache_has_set()) act("bank 3-match waiting");
	else {
		var pairs = 0;
		for (var pk in bank_jewel_counts) {
			if (bank_jewel_counts[pk] === 2) pairs++;
		}
		act(pairs ? ("bank jewelry scanned, " + pairs + " pairs need 3rd") : "bank jewelry scanned, no 3-match");
	}
	return false;
}

function farmer_waiting_in_plaza() {
	for (var i = 0; i < CONFIG.FARMERS.length; i++) {
		if (farmer_in_city(CONFIG.FARMERS[i])) return true;
	}
	return false;
}

async function maybe_accessory_work() {
	if (character.q && character.q.compound) return true;
	if (find_compound_set()) {
		if (in_bank()) {
			await ensure_stand_closed();
			act("leave bank, combine");
			await go_to("newupgrade", "combine accessories");
			return true;
		}
		return false;
	}
	if (!accessory_needs_bank()) return false;
	/** Plaza farmers still get pots via serve_pack — do not block jewelry vault forever. */
	if (!in_bank()) {
		await ensure_stand_closed();
		act("walk bank accessories");
		await go_to("bankdoor", "bank accessories");
		if (character.map === "main" && simple_distance(character, SHOP_XY.bankdoor) < 80) {
			try { await use_nearest_door(); } catch (e) {}
		}
		return true;
	}
	return await do_accessory_bank();
}

async function do_craft() {
	var name = next_craft();
	if (!name) return false;
	if (character.q && (character.q.compound || character.q.upgrade)) return true;
	var recipe = craft_recipe(name);
	var need_weapon = name === "firestaff" ? "staff" : "blade";
	if (recipe && recipe.items) {
		for (var i = 0; i < recipe.items.length; i++) {
			var need = recipe.items[i];
			if (!need) continue;
			if (need[1] === "staff" || need[1] === "blade") {
				if (item_count_level(need[1], need[2] || 0) >= need[0]) continue;
				if (await buy_from_shop(need[1], 1)) return true;
				return true;
			}
			if (item_count(need[1]) >= need[0]) continue;
			return false;
		}
	} else {
		if (item_count("essenceoffire") < 1) return false;
		if (item_count_level(need_weapon, 0) < 1) {
			if (await buy_from_shop(need_weapon, 1)) return true;
			return true;
		}
		if (character.gold < CONFIG.CRAFT_GOLD) return false;
	}
	if (recipe && !can_craft_named(name)) return false;
	if (!shop_ready("craftsman")) {
		act("walk Leo craft " + name);
		await go_to("craftsman", "craft " + name);
		return true;
	}
	if (!(await ensure_mass_buff("produce"))) {
		act("cast mass production");
		return true;
	}
	name = next_craft();
	if (!name) return false;
	try {
		await auto_craft(name);
		game_log("crafted " + name);
		if (name === "fireblade") owners.fireblade = CONFIG.WARRIOR;
		if (name === "firestaff") owners.firestaff = CONFIG.PRIEST;
	} catch (e) {
		game_log("craft " + name + ": " + (e.reason || e));
	}
	return true;
}

async function do_sell() {
	var slot = locate_sell_item();
	if (slot === -1) return false;
	await ensure_stand_closed();
	if (!shop_ready("basics")) {
		var walking = character.items[slot];
		act("walk Gabriel sell " + (walking && walking.name));
		await go_to("basics", "sell to Gabriel");
		return true;
	}
	slot = locate_sell_item();
	if (slot === -1) return false;
	var it = character.items[slot];
	if (!it || !should_sell(it)) return false;
	var q = it.q || 1;
	var name = it.name;
	try {
		await sell(slot, q);
		var key = sell_skip_key(it);
		if (key) delete sell_skip[key];
		game_log("sold " + name + " x" + q + " to Gabriel");
	} catch (e) {
		game_log("sell " + name + ": " + ((e && e.reason) || e));
		var skip = sell_skip_key(it);
		if (skip) sell_skip[skip] = Date.now() + 120000;
		return false;
	}
	return true;
}

var exchange_drain = {};

function locate_exchange_item() {
	for (var i = 0; i < CONFIG.EXCHANGE_ITEMS.length; i++) {
		var name = CONFIG.EXCHANGE_ITEMS[i];
		var min = (CONFIG.EXCHANGE_MIN && CONFIG.EXCHANGE_MIN[name]) || 1;
		var q = quantity(name);
		if (q < 1) {
			exchange_drain[name] = false;
			continue;
		}
		if (q >= min) exchange_drain[name] = true;
		if (q < min && !exchange_drain[name]) continue;
		var slot = locate_item(name);
		if (slot !== -1) {
			var it = character.items[slot];
			if (it && !it.l) return slot;
		}
	}
	return -1;
}

async function do_exchange() {
	if (character.q && character.q.exchange) return true;
	if (character.esize < 1) return false;
	var slot = locate_exchange_item();
	if (slot === -1) return false;
	await ensure_stand_closed();
	if (!shop_ready("exchange")) {
		var walking = character.items[slot];
		act("walk Xyn exchange " + (walking && walking.name));
		await go_to("exchange", "exchange at Xyn");
		return true;
	}
	slot = locate_exchange_item();
	if (slot === -1) return false;
	var it = character.items[slot];
	if (!it || it.l || !in_list(CONFIG.EXCHANGE_ITEMS, it.name)) return false;
	var name = it.name;
	if (!(await ensure_mass_buff("exchange"))) {
		act("cast mass exchange");
		return true;
	}
	slot = locate_exchange_item();
	if (slot === -1) return false;
	it = character.items[slot];
	if (!it || it.l || it.name !== name) return false;
	try {
		var result = await exchange(slot);
		game_log("exchanged " + name + " -> " + ((result && result.reward) || "ok"));
	} catch (e) {
		game_log("exchange " + name + ": " + ((e && e.reason) || e));
		return false;
	}
	return true;
}

function bag_needs_dump() {
	return character.esize <= CONFIG.BAG_DUMP;
}

function jewel_copies(name, level) {
	var n = 0;
	var items = character.items || [];
	for (var i = 0; i < items.length; i++) {
		var it = items[i];
		if (it && it.name === name && (it.level || 0) === (level || 0) && !it.l) n++;
	}
	return n;
}

function has_stand() {
	return locate_item("stand0") !== -1 || !!(character.stand || character.standed);
}

function listed_count() {
	var n = 0;
	var slots = character.slots || {};
	for (var i = 1; i <= 16; i++) {
		if (slots["trade" + i]) n++;
	}
	return n;
}

function stand_has_listings() {
	return listed_count() > 0;
}

function empty_trade_slot() {
	var slots = character.slots || {};
	for (var i = 1; i <= 16; i++) {
		var k = "trade" + i;
		if (!(k in slots) && i > 4) continue;
		if (!slots[k]) return i;
	}
	return 0;
}

function token_sell_listing() {
	var slots = character.slots || {};
	for (var i = 1; i <= 16; i++) {
		var it = slots["trade" + i];
		if (it && it.name === CONFIG.TOKEN && !it.b) return it;
	}
	return null;
}

async function maybe_list_tokens() {
	return false;
}

function list_price(it) {
	var def = G.items[it.name];
	var base = (def && def.g) || 0;
	var val = 0;
	try { val = item_value(it) || 0; } catch (e) {}
	return Math.max(100, Math.floor(Math.max(val, base) * 2));
}

function jeweler_wants_any(it) {
	for (var i = 0; i < CONFIG.FARMERS.length; i++) {
		if (jeweler_wants(CONFIG.FARMERS[i], it)) return true;
	}
	return false;
}

/**
 * Stand listings are owned by Command Center (__ALCC.listings via maybe_keep_shop).
 * Do not auto-dump bag loot onto the stand here — that spammed stormfeather listings
 * and fought the CC allowlist (unequip → re-list loop).
 */
function should_list(it) {
	return false;
}

function locate_listed_keep() {
	var slots = character.slots || {};
	for (var i = 1; i <= 16; i++) {
		var it = slots["trade" + i];
		if (!it || it.b) continue;
		/** Command Center stand allowlist owns these listings — do not yank them
		 *  back into the bag (that fought maybe_keep_shop: list → unlist loop). */
		if (typeof __ALCC !== "undefined" && __ALCC.standEnabled && __ALCC.listings) {
			var listed_ok = false;
			for (var r = 0; r < __ALCC.listings.length; r++) {
				var rule = __ALCC.listings[r];
				if (rule.item === it.name && rule.level === (it.level || 0)) {
					listed_ok = true;
					break;
				}
			}
			if (listed_ok) continue;
		}
		if (is_heavy_piece(it.name) || is_junk_wanderer(it.name) || it.name === "feather0" || it.name === "wingedboots" || it.name === CONFIG.TOKEN) return "trade" + i;
	}
	return null;
}

async function unlist_keep_gear() {
	var slot = locate_listed_keep();
	if (!slot) return false;
	if (character.esize < 1) {
		act("unlist blocked, bag full");
		return false;
	}
	var it = character.slots && character.slots[slot];
	var name = it && it.name;
	try {
		await unequip(slot);
		game_log("unlist " + name + " from " + slot);
		act("unlist " + name);
		return true;
	} catch (e) {
		game_log("unlist " + slot + ": " + ((e && e.reason) || e));
		return false;
	}
}

function should_dump(it) {
	return should_list(it);
}

function locate_dump_item() {
	var items = character.items || [];
	for (var i = 0; i < items.length; i++) {
		if (should_dump(items[i])) return i;
	}
	return -1;
}

async function ensure_stand_closed() {
	if (!(character.stand || character.standed)) return;
	try { await close_stand(); } catch (e) {}
}

async function ensure_stand_item() {
	if (has_stand()) return true;
	if (character.gold < 40000) return false;
	if (!shop_ready("standmerchant")) {
		act("buy merchant stand");
		await go_to("standmerchant", "buy stand");
		return false;
	}
	try {
		await buy("stand0", 1);
		game_log("bought stand0");
	} catch (e) {
		game_log("buy stand: " + (e.reason || e));
		return false;
	}
	return locate_item("stand0") !== -1;
}

async function do_shop_dump() {
	return false;
}

async function do_bank_dump() {
	var slot = locate_dump_item();
	if (slot === -1) return false;
	if (!character.bank) {
		await ensure_stand_closed();
		act("walk bank dump");
		await go_to("bankdoor", "bank dump");
		if (character.map === "main" && simple_distance(character, SHOP_XY.bankdoor) < 45) {
			try { await use_nearest_door(); } catch (e) {}
		}
		return true;
	}
	slot = locate_dump_item();
	if (slot === -1) return false;
	try {
		var name = character.items[slot].name;
		await bank_store(slot);
		act("banked " + name);
	} catch (e) {
		game_log("bank: " + (e.reason || e));
		return false;
	}
	return true;
}

async function dump_bag() {
	return false;
}

function shop_should_idle() {
	return false;
}

function point_in_poly(x, y, poly) {
	var inside = false;
	for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
		var xi = poly[i][0];
		var yi = poly[i][1];
		var xj = poly[j][0];
		var yj = poly[j][1];
		var hit = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-9) + xi);
		if (hit) inside = !inside;
	}
	return inside;
}

function fishing_polygon() {
	var zones = G.maps.main && G.maps.main.zones;
	if (!zones) return null;
	for (var i = 0; i < zones.length; i++) {
		if (zones[i] && zones[i].type === "fishing" && zones[i].polygon) return zones[i].polygon;
	}
	return null;
}

/**
 * Exact copy of the server's gathering check: the cast is accepted when one
 * of four probes 24px up/left/right/down from us lies inside the zone
 * polygon and we are standing still. The 120 MP is taken even on a miss,
 * so never cast unless this is true.
 */
function zone_probe_ok(poly) {
	if (!poly) return false;
	var probes = [[0, -24], [-24, 0], [24, 0], [0, 24]];
	for (var i = 0; i < probes.length; i++) {
		if (point_in_poly(character.x + probes[i][0], character.y + probes[i][1], poly)) return true;
	}
	return false;
}

function in_fishing_zone() {
	if (character.map !== "main") return false;
	return zone_probe_ok(fishing_polygon());
}

/**
 * Gathering spots are tiny. go_to treats 80px as arrived, which is still
 * on land for fishing. Walk the last stretch with move().
 */
async function step_to_gather(spot, reason) {
	if (!spot || spot.x == null) return;
	if ((spot.map || "main") !== character.map) {
		await go_to(spot, reason);
		return;
	}
	var dist = simple_distance(character, spot);
	if (smart.moving && dist > 50) return;
	if (smart.moving) {
		try { stop("smart"); } catch (e) {}
	}
	if (can_move_to(spot.x, spot.y)) {
		try { move(spot.x, spot.y); } catch (e) {}
		act(reason);
		return;
	}
	await go_to(spot, reason, 12);
}

function find_bank_item(name) {
	var bank = character.bank;
	if (!bank) return null;
	for (var pack in bank) {
		if (pack === "gold") continue;
		var items = bank[pack];
		if (!items || !items.length) continue;
		for (var i = 0; i < items.length; i++) {
			if (items[i] && items[i].name === name) return { pack: pack, slot: i };
		}
	}
	return null;
}

/** Persist rod/pickaxe bank locations — character.bank is only mounted in the vault,
 *  so has_rod() used to return false in town and fishing never started after a bank store. */
var tool_bank = {};
var fishing_mainhand = null;

function remember_fishing_mainhand() {
	var mh = character.slots && character.slots.mainhand;
	if (!fishing_mainhand && mh && mh.name !== "rod") fishing_mainhand = { name: mh.name, level: mh.level || 0, rid: mh.rid || null };
}

async function restore_fishing_mainhand() {
	if (!fishing_mainhand) return false;
	var items = character.items || [], slot = -1;
	for (var i = 0; i < items.length; i++) {
		var it = items[i]; if (!it) continue;
		if (fishing_mainhand.rid && it.rid === fishing_mainhand.rid) { slot = i; break; }
		if (slot < 0 && it.name === fishing_mainhand.name && (it.level || 0) === fishing_mainhand.level) slot = i;
	}
	if (slot < 0) return false;
	try { await equip(slot, "mainhand"); game_log("restored " + fishing_mainhand.name + " after fishing"); fishing_mainhand = null; return true; }
	catch (e) { game_log("restore fishing weapon: " + ((e && e.reason) || e)); return false; }
}

function remember_bank_tools() {
	if (!character.bank) return;
	["rod", "pickaxe"].forEach(function (name) {
		var found = find_bank_item(name);
		tool_bank[name] = found ? { pack: found.pack, slot: found.slot } : false;
	});
}

function tool_in_bag_or_hand(name) {
	var mh = character.slots && character.slots.mainhand;
	if (mh && mh.name === name) return true;
	return locate_item(name) !== -1;
}

function has_rod() {
	if (tool_in_bag_or_hand("rod")) return true;
	if (character.bank) {
		remember_bank_tools();
		return !!find_bank_item("rod");
	}
	return !!(tool_bank.rod && tool_bank.rod !== false);
}

function has_pickaxe() {
	if (tool_in_bag_or_hand("pickaxe")) return true;
	if (character.bank) {
		remember_bank_tools();
		return !!find_bank_item("pickaxe");
	}
	return !!(tool_bank.pickaxe && tool_bank.pickaxe !== false);
}

async function craft_gather_tool(name) {
	if (!can_craft_named(name)) return false;
	await ensure_stand_closed();
	if (!shop_ready("craftsman")) {
		act("walk Leo craft " + name);
		await go_to("craftsman", "craft " + name);
		return true;
	}
	try {
		await auto_craft(name);
		game_log("crafted " + name);
		tool_bank[name] = undefined;
	} catch (e) {
		game_log("craft " + name + ": " + ((e && e.reason) || e));
		return false;
	}
	return true;
}

async function ensure_rod() {
	var mh = character.slots && character.slots.mainhand;
	if (mh && mh.name === "rod") return true;
	remember_fishing_mainhand();
	var slot = locate_item("rod");
	if (slot === -1 && character.bank) {
		remember_bank_tools();
		var found = find_bank_item("rod");
		if (found && character.esize > 0) {
			try { await bank_retrieve(found.pack, found.slot); } catch (e) {}
			slot = locate_item("rod");
		} else {
			tool_bank.rod = false;
		}
	}
	if (slot === -1) return false;
	try {
		await equip(slot, "mainhand");
		return true;
	} catch (e) {
		game_log("equip rod: " + ((e && e.reason) || e));
		return false;
	}
}

async function ensure_pickaxe() {
	var mh = character.slots && character.slots.mainhand;
	if (mh && mh.name === "pickaxe") return true;
	var slot = locate_item("pickaxe");
	if (slot === -1 && character.bank) {
		remember_bank_tools();
		var found = find_bank_item("pickaxe");
		if (found && character.esize > 0) {
			try { await bank_retrieve(found.pack, found.slot); } catch (e) {}
			slot = locate_item("pickaxe");
		} else {
			tool_bank.pickaxe = false;
		}
	}
	if (slot === -1) return false;
	try {
		await equip(slot, "mainhand");
		return true;
	} catch (e) {
		game_log("equip pickaxe: " + ((e && e.reason) || e));
		return false;
	}
}

/** Command Center replaces this with kit-board handoff. */
async function maybe_dashboard_kit() {
	return false;
}

/** Command Center replaces this with permanent consumable top-ups. */
async function maybe_dashboard_consumables() {
	return false;
}

/** Command Center replaces this with give-and-keep bag handoffs. */
async function maybe_dashboard_gifts() {
	return false;
}

async function maybe_keep_shop() {
	if (await unlist_keep_gear()) return true;
	if (await maybe_list_tokens()) return true;
	if (character.c && (character.c.fishing || character.c.mining)) return false;
	/** No active town chore or listing work: keep the stand open in market so the
	 *  merchant is ready for visits instead of idling closed while the party waits. */
	if (locate_sell_item() !== -1 || locate_exchange_item() !== -1 || bag_needs_dump() || locate_upgrade_item() !== -1 || locate_dexscroll_item() !== -1 || find_compound_set() || accessory_work_pending()) {
		return false;
	}
	if (!has_stand() && !(await ensure_stand_item())) return false;
	if (!has_stand()) return false;
	var park = SHOP_XY.market;
	if (character.map !== "main" || simple_distance(character, park) > 24) {
		act("town stand");
		await go_to("market", "open stand", 20);
		return true;
	}
	if (character.moving || smart.moving) return true;
	if (!(character.stand || character.standed)) {
		var slot = locate_item("stand0");
		try {
			if (slot !== -1) await open_stand(slot);
			else await open_stand();
			act("stand open");
		} catch (e) {
			game_log("stand: " + ((e && e.reason) || e));
		}
		return true;
	}
	/** Idle with stand open: let ferry / XP / other chores run. */
	return false;
}

/**
 * A ready gathering cooldown beats the stand. Listings survive a closed
 * stand (they live in the trade slots), so we close, cast, walk back and
 * maybe_keep_shop reopens it.
 */
function fishing_ready() {
	if (character.ctype !== "merchant" || character.level < 16) return false;
	if (character.esize < 1) return false;
	if (is_on_cooldown("fishing")) return false;
	/** After a CODE restart the bank is unmounted, so an absent bag rod is
	 * unknown rather than missing. Let maybe_fish inspect the bank once. */
	if (!has_rod() && tool_bank.rod === false) return false;
	return true;
}

/**
 * Fish only when the 48-minute cooldown is up. Drink MP for the 120 cost.
 * Do not camp the shore during the wait — that is stand time.
 */
async function maybe_fish() {
	if (character.ctype !== "merchant" || character.level < 16) return false;
	if (anyone_coming_to_city() || city_service_needed()) return false;
	if (character.c && character.c.fishing) return true;
	if (!fishing_ready()) return false;
	if (Date.now() < last_gather_fail) return false;
	await ensure_stand_closed();
	if (!tool_in_bag_or_hand("rod") && tool_bank.rod === undefined && !character.bank) {
		act("check bank for rod");
		await go_to("bankdoor", "check fishing rod");
		if (character.map === "main" && simple_distance(character, SHOP_XY.bankdoor) < 45) {
			try { await use_nearest_door(); } catch (e) {}
		}
		return true;
	}
	if (character.map === "bank") {
		if (!(await ensure_rod())) {
			last_gather_fail = Date.now() + 60000;
			act("no fishing rod");
			return false;
		}
		act("leave bank to fish");
		await go_to("fish", "leave bank to fish");
		return true;
	}
	if (!(await ensure_rod())) return false;
	if (!in_fishing_zone()) {
		act("walk fishing shore");
		await step_to_gather(SHOP_XY.fish, "fishing shore");
		return true;
	}
	if (character.moving || smart.moving) return true;
	if (character.mp < 120) {
		if ((locate_item(CONFIG.MPOT) !== -1 || locate_item("mpot0") !== -1) && !is_on_cooldown("use_mp")) {
			try { await use_skill("use_mp"); } catch (e) {}
			act("mpot for fishing");
			return true;
		}
		if (locate_item(CONFIG.MPOT) === -1 && locate_item("mpot0") === -1) return false;
		act("wait MP to fish");
		return true;
	}
	act("fishing");
	try {
		var result = await use_skill("fishing", null, null, 20000);
		act(result && result.found ? "caught something" : "fishing: nothing");
	} catch (e) {
		var why = (e && (e.reason || e.message)) || e;
		game_log("fishing: " + why);
		if (String(why).indexOf("distance") >= 0 || String(why).indexOf("closer") >= 0) {
			last_gather_fail = Date.now() + 4000;
			await step_to_gather(SHOP_XY.fish, "closer to water");
		} else {
			/** Cooldown not yet known after a restart, or a server refusal: do not hammer it every tick. */
			last_gather_fail = Date.now() + 30000;
		}
	}
	await restore_fishing_mainhand();
	return true;
}

function has_pickaxe() {
	var mh = character.slots && character.slots.mainhand;
	if (mh && mh.name === "pickaxe") return true;
	if (locate_item("pickaxe") !== -1) return true;
	return !!find_bank_item("pickaxe");
}

async function ensure_pickaxe() {
	var mh = character.slots && character.slots.mainhand;
	if (mh && mh.name === "pickaxe") return true;
	var slot = locate_item("pickaxe");
	if (slot === -1 && character.bank) {
		var found = find_bank_item("pickaxe");
		if (found && character.esize > 0) {
			try { await bank_retrieve(found.pack, found.slot); } catch (e) {}
			slot = locate_item("pickaxe");
		}
	}
	if (slot === -1) return false;
	try {
		await equip(slot, "mainhand");
		return true;
	} catch (e) {
		game_log("equip pickaxe: " + ((e && e.reason) || e));
		return false;
	}
}

function mining_polygon() {
	var zones = G.maps.woffice && G.maps.woffice.zones;
	if (!zones) return null;
	for (var i = 0; i < zones.length; i++) {
		if (zones[i] && zones[i].type === "mining" && zones[i].polygon) return zones[i].polygon;
	}
	return null;
}

function in_mining_zone() {
	if (character.map !== "woffice") return false;
	var poly = mining_polygon();
	if (!poly) return simple_distance(character, SHOP_XY.mine) < 20;
	return zone_probe_ok(poly);
}

function mining_ready() {
	if (character.ctype !== "merchant" || character.level < 16) return false;
	if (!has_pickaxe()) return false;
	if (character.esize < 1) return false;
	if (is_on_cooldown("mining")) return false;
	return true;
}

/**
 * Mine in Wizard's Crib (safe). The mole tunnel is a wipe. Drink MP for
 * the 120 cost. Pickaxe can break on a find; do not spend silk to rebuild it.
 */
async function maybe_mine() {
	if (character.ctype !== "merchant" || character.level < 16) return false;
	if (anyone_coming_to_city() || city_service_needed()) return false;
	if (character.c && character.c.mining) return true;
	if (!mining_ready()) return false;
	if (Date.now() < last_gather_fail) return false;
	await ensure_stand_closed();
	if (character.map === "bank") {
		await ensure_pickaxe();
		act("leave bank to mine");
		await go_to("mine", "leave bank to mine");
		return true;
	}
	if (!(await ensure_pickaxe())) return false;
	if (!in_mining_zone()) {
		act("walk Wizard Crib mine");
		await step_to_gather(SHOP_XY.mine, "woffice mine");
		return true;
	}
	if (character.moving || smart.moving) return true;
	if (character.mp < 120) {
		if ((locate_item(CONFIG.MPOT) !== -1 || locate_item("mpot0") !== -1) && !is_on_cooldown("use_mp")) {
			try { await use_skill("use_mp"); } catch (e) {}
			act("mpot for mining");
			return true;
		}
		if (locate_item(CONFIG.MPOT) === -1 && locate_item("mpot0") === -1) return false;
		act("wait MP to mine");
		return true;
	}
	act("mining");
	try {
		var result = await use_skill("mining", null, null, 20000);
		act(result && result.found ? "mined something" : "mining: nothing");
	} catch (e) {
		var why = (e && (e.reason || e.message)) || e;
		game_log("mining: " + why);
		/** Cooldown not yet known after a restart, or a server refusal: do not hammer it every tick. */
		last_gather_fail = Date.now() + 30000;
	}
	return true;
}

async function town_work() {
	if (locate_listed_keep()) return unlist_keep_gear();
	/** Combine before NPC sales — a Gabriel loop was starving Cue compounds. */
	if (find_compound_set()) {
		if (await do_compound()) return true;
	}
	/** Tight bag: sell first (needs no free slot). Exchange needs esize>=1 for
	 *  the reward — when full, do_exchange() returned false and blocked sell. */
	if (bag_tight() && locate_sell_item() !== -1) {
		if (await do_sell()) return true;
	}
	if (await maybe_accessory_work()) return true;
	/** Drain Xyn before Gabriel when there is bag room — one trip to Xyn. */
	if (character.esize >= 1 && locate_exchange_item() !== -1) {
		if (await do_exchange()) return true;
	}
	if (locate_sell_item() !== -1) return do_sell();
	if (locate_dexscroll_item() !== -1) {
		if (await do_dexscroll()) return true;
	}
	if (locate_upgrade_item() !== -1) {
		if (await do_upgrade()) return true;
	}
	if (locate_dump_item() !== -1) {
		if (await dump_bag()) return true;
	}
	if (await maybe_list_tokens()) return true;
	if (next_craft()) return do_craft();
	return false;
}

/**
 * Merchants get XP from buy() and sell(), not from party kills. Extra pot
 * buys while we are already at Fancy Pots are useful stock and XP. Never
 * walk away from the cave only to grind this, and never dip below kit gold.
 */
async function maybe_merchant_xp() {
	if (character.gold < CONFIG.XP_GOLD_KEEP + CONFIG.XP_BUY_Q * 100) return false;
	if (!shop_ready("fancypots") && !shop_ready("basics")) return false;
	if (locate_sell_item() !== -1) return do_sell();
	var q = CONFIG.XP_BUY_Q;
	if (item_count(CONFIG.MPOT) < CONFIG.MPOT_STOCK + 200) {
		var before = character.xp || 0;
		if (await buy_from_shop(CONFIG.MPOT, q)) {
			act("xp buy " + CONFIG.MPOT + " x" + q + " xp " + before + "->" + (character.xp || 0));
			return true;
		}
	}
	if (item_count(CONFIG.HPOT) < CONFIG.POT_STOCK + 200) {
		var before_h = character.xp || 0;
		if (await buy_from_shop(CONFIG.HPOT, q)) {
			act("xp buy " + CONFIG.HPOT + " x" + q + " xp " + before_h + "->" + (character.xp || 0));
			return true;
		}
	}
	return false;
}

async function give_pots(name) {
	if (!near_farmer(name)) return false;
	if (Date.now() - (last_pot_ms[name] || 0) < 3000) return false;
	var r = reports[name] || { hpot: 0, mpot: 0, at: 0 };
	var ask = pot_ask(name);
	var want_h = r.hpot < CONFIG.POT_NEED || !!(ask && ask.h);
	var want_m = r.mpot < mpot_need(name) || !!(ask && ask.m);
	if (!want_h && !want_m) return false;
	var sent = false;
	var hname = CONFIG.HPOT;
	var mname = CONFIG.MPOT;
	if (want_h && item_count(hname) > 0) {
		var slot = locate_item(hname);
		if (slot !== -1) {
			var missing_h = Math.max(1, CONFIG.POT_NEED - (r.hpot || 0));
			var q = Math.min(CONFIG.POT_GIVE, missing_h, character.items[slot].q || 1);
			try {
				await send_item(name, slot, q);
				sent = true;
				r.hpot = (r.hpot || 0) + q;
			} catch (e) {}
		}
	}
	if (want_m && item_count(mname) > 0) {
		var slot2 = locate_item(mname);
		if (slot2 !== -1) {
			var keep_m = mpot_need(name);
			var missing_m = Math.max(1, keep_m - (r.mpot || 0));
			var give_n = (name === CONFIG.MAGE || name === CONFIG.PRIEST) ? CONFIG.MPOT_GIVE : CONFIG.POT_GIVE;
			var q2 = Math.min(give_n, missing_m, character.items[slot2].q || 1);
			try {
				await send_item(name, slot2, q2);
				sent = true;
				r.mpot = (r.mpot || 0) + q2;
			} catch (e) {}
		}
	}
		if (sent) {
		act("pots to " + name + " h=" + r.hpot + " m=" + r.mpot);
		last_pot_ms[name] = Date.now();
		r.at = Date.now();
		reports[name] = r;
		if (r.hpot >= CONFIG.POT_NEED && r.mpot >= mpot_need(name)) delete pot_asks[name];
		else if (ask) {
			ask.h = r.hpot < CONFIG.POT_NEED;
			ask.m = r.mpot < mpot_need(name);
			if (!ask.h && !ask.m) delete pot_asks[name];
		}
	}
	return sent;
}

async function give_pots_nearby() {
	for (var i = 0; i < CONFIG.FARMERS.length; i++) {
		await give_pots(CONFIG.FARMERS[i]);
	}
}

async function return_gear(name) {
	if (await maybe_give_stat_accessory(name)) return true;
	if (name === CONFIG.WARRIOR) return await maybe_give_lolipop();
	if (name === CONFIG.MAGE) {
		if (await maybe_give_quiver()) return true;
		if (await maybe_give_alloyquiver()) return true;
		if (await maybe_give_wingedboots()) return true;
		return await maybe_give_wanderer();
	}
	if (name !== CONFIG.PRIEST) return false;
	if (await maybe_give_vstaff()) return true;
	if (await maybe_give_best_oozing()) return true;
	if (await maybe_give_ecape()) return true;
	if (await maybe_give_int_elixir()) return true;
	return false;
}

async function maybe_give_stat_accessory(who) {
	if (!near_farmer(who)) return false;
	if (Date.now() - (last_give_ms["jewel:" + who] || 0) < 400) return false;
	var items = character.items || [];
	var pick = -1;
	var i;
	for (i = 0; i < items.length; i++) {
		if (farmer_would_wear_stat(who, items[i])) {
			pick = i;
			break;
		}
	}
	if (pick < 0) return false;
	var want = character.items[pick];
	if (!want) return false;
	var name = want.name;
	var lv = want.level || 0;
	var rid = want.rid;
	pick = rid ? locate_rid(rid) : pick;
	want = character.items[pick];
	if (!want || want.name !== name || (want.level || 0) !== lv) return false;
	if (!farmer_would_wear_stat(who, want)) return false;
	try {
		await send_item(who, pick, 1);
		last_give_ms["jewel:" + who] = Date.now();
		act("give " + name + "+" + lv + " to " + who);
		return true;
	} catch (e) {
		game_log("give " + name + ": " + ((e && e.reason) || e));
		return false;
	}
}

async function maybe_give_lolipop() {
	var warrior = get_player(CONFIG.WARRIOR);
	if (!warrior || distance(character, warrior) > 400) return false;
	if (Date.now() - (last_give_ms.lolipop || 0) < 400) return false;
	if (character.esize < 1) return false;
	var items = character.items || [];
	var pick = -1;
	var pick_lv = -1;
	var pick_name = null;
	for (var i = 0; i < items.length; i++) {
		var it = items[i];
		if (!mule_should_hand_lolipop(it)) continue;
		var lv = it.level || 0;
		if (pick < 0 || lv > pick_lv) {
			pick = i;
			pick_lv = lv;
			pick_name = it.name;
		}
	}
	if (pick < 0 || !pick_name) return false;
	var found = -1;
	items = character.items || [];
	for (var j = 0; j < items.length; j++) {
		var cur = items[j];
		if (!cur || cur.l || cur.name !== pick_name) continue;
		if ((cur.level || 0) !== pick_lv) continue;
		if (!mule_should_hand_lolipop(cur)) continue;
		found = j;
		break;
	}
	if (found === -1) return false;
	try {
		await send_item(CONFIG.WARRIOR, found, 1);
		last_give_ms.lolipop = Date.now();
		act("give " + pick_name + "+" + pick_lv + " to " + CONFIG.WARRIOR);
		return true;
	} catch (e) {
		game_log("give " + pick_name + ": " + ((e && e.reason) || e));
		return false;
	}
}

async function maybe_give_wanderer() {
	var ranger = get_player(CONFIG.MAGE);
	if (!ranger || distance(character, ranger) > 400) return false;
	if (Date.now() - (last_give_ms.wanderer || 0) < 400) return false;
	if (character.esize < 1) return false;
	var items = character.items || [];
	var pick = -1;
	var pick_lv = -1;
	var pick_name = null;
	for (var i = 0; i < items.length; i++) {
		var it = items[i];
		if (!it || it.l || !is_wanderer(it.name)) continue;
		if (!farmer_would_wear(CONFIG.MAGE, it)) continue;
		var lv = it.level || 0;
		if (pick < 0 || lv > pick_lv) {
			pick = i;
			pick_lv = lv;
			pick_name = it.name;
		}
	}
	if (pick < 0 || !pick_name) return false;
	var found = -1;
	items = character.items || [];
	for (var j = 0; j < items.length; j++) {
		var cur = items[j];
		if (!cur || cur.l || cur.name !== pick_name) continue;
		if ((cur.level || 0) !== pick_lv) continue;
		if (!farmer_would_wear(CONFIG.MAGE, cur)) continue;
		found = j;
		break;
	}
	if (found === -1) return false;
	try {
		await send_item(CONFIG.MAGE, found, 1);
		last_give_ms.wanderer = Date.now();
		act("give " + pick_name + "+" + pick_lv + " dex to " + CONFIG.MAGE);
		return true;
	} catch (e) {
		game_log("give " + pick_name + ": " + ((e && e.reason) || e));
		return false;
	}
}

var QUIVER_WEAR = ["stormquiver", "paradequiver", "t2quiver", "alloyquiver", "thistlequiver", "quiver"];

function ranger_would_wear_quiver(it) {
	if (!it || it.l || it.name !== "quiver") return false;
	if ((it.level || 0) < (CONFIG.QUIVER_MAX || 7)) return false;
	if (is_bounce(CONFIG.MAGE, it)) return false;
	var slots = farmer_slots(CONFIG.MAGE);
	if (!slots) return true;
	return item_beats_eq(slots.offhand, it, QUIVER_WEAR);
}

function ranger_has_alloy() {
	var slots = farmer_slots(CONFIG.MAGE);
	if (slots && slots.offhand && slots.offhand.name === "alloyquiver") return true;
	var r = reports[CONFIG.MAGE];
	return !!(r && Date.now() - r.at < 45000 && r.alloy);
}

function ranger_would_wear_alloy(it) {
	if (!it || it.l || it.name !== "alloyquiver") return false;
	if (is_bounce(CONFIG.MAGE, it)) return false;
	return !ranger_has_alloy();
}

function priest_would_wear_cape(it) {
	if (!it || it.l || it.name !== "ecape") return false;
	if (is_bounce(CONFIG.PRIEST, it)) return false;
	var slots = farmer_slots(CONFIG.PRIEST);
	if (!slots) return true;
	var eq = slots.cape;
	if (!eq) return true;
	if (eq.name === "ecape") return (it.level || 0) > (eq.level || 0);
	return true;
}

async function maybe_give_quiver() {
	var ranger = get_player(CONFIG.MAGE);
	if (!ranger || distance(character, ranger) > 400) return false;
	if (Date.now() - (last_give_ms.quiver || 0) < 400) return false;
	if (character.esize < 1) return false;
	var items = character.items || [];
	var pick = -1;
	var pick_lv = -1;
	for (var i = 0; i < items.length; i++) {
		var it = items[i];
		if (!ranger_would_wear_quiver(it)) continue;
		var lv = it.level || 0;
		if (pick < 0 || lv > pick_lv) {
			pick = i;
			pick_lv = lv;
		}
	}
	if (pick < 0) return false;
	items = character.items || [];
	var found = -1;
	for (var j = 0; j < items.length; j++) {
		var cur = items[j];
		if (!ranger_would_wear_quiver(cur)) continue;
		if ((cur.level || 0) !== pick_lv) continue;
		found = j;
		break;
	}
	if (found === -1) return false;
	try {
		await send_item(CONFIG.MAGE, found, 1);
		last_give_ms.quiver = Date.now();
		act("give quiver+" + pick_lv + " to " + CONFIG.MAGE);
		return true;
	} catch (e) {
		game_log("give quiver: " + ((e && e.reason) || e));
		return false;
	}
}

async function maybe_give_alloyquiver() {
	var ranger = get_player(CONFIG.MAGE);
	if (!ranger || distance(character, ranger) > 400) return false;
	if (Date.now() - (last_give_ms.alloyquiver || 0) < 400) return false;
	if (character.esize < 1) return false;
	var pick = locate_best_named("alloyquiver");
	if (pick < 0) return false;
	var it = character.items[pick];
	if (!ranger_would_wear_alloy(it)) return false;
	var lv = it.level || 0;
	var found = locate_best_named("alloyquiver");
	if (found === -1) return false;
	var cur = character.items[found];
	if (!ranger_would_wear_alloy(cur)) return false;
	try {
		await send_item(CONFIG.MAGE, found, 1);
		last_give_ms.alloyquiver = Date.now();
		act("give alloyquiver+" + lv + " to " + CONFIG.MAGE);
		return true;
	} catch (e) {
		game_log("give alloyquiver: " + ((e && e.reason) || e));
		return false;
	}
}

var RANGER_SHOES = ["wingedboots", "wshoes", "shoes1", "shoes"];

function ranger_would_wear_wingedboots(it) {
	if (!it || it.l || it.name !== "wingedboots") return false;
	if ((it.level || 0) < 7) return false;
	if (it.stat_type !== "dex") return false;
	if (is_bounce(CONFIG.MAGE, it)) return false;
	var slots = farmer_slots(CONFIG.MAGE);
	if (!slots) return true;
	return item_beats_eq(slots.shoes, it, RANGER_SHOES);
}

async function maybe_give_wingedboots() {
	var ranger = get_player(CONFIG.MAGE);
	if (!ranger || distance(character, ranger) > 400) return false;
	if (Date.now() - (last_give_ms.wingedboots || 0) < 400) return false;
	if (character.esize < 1) return false;
	var items = character.items || [];
	var pick = -1;
	var pick_lv = -1;
	for (var i = 0; i < items.length; i++) {
		var it = items[i];
		if (!ranger_would_wear_wingedboots(it)) continue;
		var lv = it.level || 0;
		if (pick < 0 || lv > pick_lv) {
			pick = i;
			pick_lv = lv;
		}
	}
	if (pick < 0) return false;
	var want = character.items[pick];
	if (!want || !ranger_would_wear_wingedboots(want)) return false;
	try {
		await send_item(CONFIG.MAGE, pick, 1);
		last_give_ms.wingedboots = Date.now();
		act("give wingedboots+" + pick_lv + " dex to " + CONFIG.MAGE);
		return true;
	} catch (e) {
		game_log("give wingedboots: " + ((e && e.reason) || e));
		return false;
	}
}

async function maybe_give_ecape() {
	var priest = get_player(CONFIG.PRIEST);
	if (!priest || distance(character, priest) > 400) return false;
	if (Date.now() - (last_give_ms.ecape || 0) < 400) return false;
	if (character.esize < 1) return false;
	var items = character.items || [];
	var pick = -1;
	var pick_lv = -1;
	for (var i = 0; i < items.length; i++) {
		var it = items[i];
		if (!priest_would_wear_cape(it)) continue;
		var lv = it.level || 0;
		if (pick < 0 || lv > pick_lv) {
			pick = i;
			pick_lv = lv;
		}
	}
	if (pick < 0) return false;
	items = character.items || [];
	var found = -1;
	for (var j = 0; j < items.length; j++) {
		var cur = items[j];
		if (!priest_would_wear_cape(cur)) continue;
		if ((cur.level || 0) !== pick_lv) continue;
		found = j;
		break;
	}
	if (found === -1) return false;
	try {
		await send_item(CONFIG.PRIEST, found, 1);
		last_give_ms.ecape = Date.now();
		act("give ecape+" + pick_lv + " to " + CONFIG.PRIEST);
		return true;
	} catch (e) {
		game_log("give ecape: " + ((e && e.reason) || e));
		return false;
	}
}

async function maybe_give_intscroll() {
	var priest = get_player(CONFIG.PRIEST);
	if (!priest || distance(character, priest) > 400) return false;
	if (Date.now() - (last_give_ms.intscroll || 0) < 4000) return false;
	var r = reports[CONFIG.PRIEST] || {};
	if (!r.need_int) return false;
	var slot = locate_item("intscroll");
	if (slot === -1) return false;
	var it = character.items[slot];
	if (!it || it.name !== "intscroll" || it.l) return false;
	var q = Math.min(CONFIG.INTSCROLL_GIVE || 20, it.q || 1);
	if (q < 1) return false;
	try {
		await send_item(CONFIG.PRIEST, slot, q);
		last_give_ms.intscroll = Date.now();
		act("give intscroll x" + q + " to " + CONFIG.PRIEST);
		return true;
	} catch (e) {
		game_log("give intscroll: " + ((e && e.reason) || e));
		return false;
	}
}

async function maybe_give_int_elixir() {
	var priest = get_player(CONFIG.PRIEST);
	if (!priest || distance(character, priest) > 400) return false;
	if (Date.now() - (last_give_ms.elixirint0 || 0) < 4000) return false;
	if (priest.slots && priest.slots.elixir) return false;
	var r = reports[CONFIG.PRIEST] || {};
	if (r.at && Date.now() - r.at < 45000 && r.need_elixir === false) return false;
	var slot = locate_item("elixirint0");
	if (slot === -1) return false;
	var it = character.items[slot];
	if (!it || it.name !== "elixirint0" || it.l) return false;
	var q = Math.min(CONFIG.ELIXIRINT_GIVE || 5, it.q || 1);
	if (q < 1) return false;
	try {
		await send_item(CONFIG.PRIEST, slot, q);
		last_give_ms.elixirint0 = Date.now();
		act("give elixirint0 x" + q + " to " + CONFIG.PRIEST);
		return true;
	} catch (e) {
		game_log("give elixirint0: " + ((e && e.reason) || e));
		return false;
	}
}

async function maybe_give_dex_elixir() {
	if (!near_farmer(CONFIG.MAGE)) return false;
	if (Date.now() - (last_give_ms.elixirdex1 || 0) < 4000) return false;
	var slot = locate_item("elixirdex1");
	if (slot === -1) return false;
	var it = character.items[slot];
	if (!it || it.name !== "elixirdex1" || it.l) return false;
	var q = it.q || 1;
	try {
		await send_item(CONFIG.MAGE, slot, q);
		last_give_ms.elixirdex1 = Date.now();
		act("give elixirdex1 x" + q + " to " + CONFIG.MAGE);
		return true;
	} catch (e) {
		game_log("give elixirdex1: " + ((e && e.reason) || e));
		return false;
	}
}

async function maybe_give_best_oozing() {
	var priest = get_player(CONFIG.PRIEST);
	if (!priest || distance(character, priest) > 400) return false;
	if (Date.now() - (last_give_ms[CONFIG.PRIEST] || 0) < 4000) return false;
	if (!mule_should_hand_oozing()) return false;
	var slot = locate_best_named("oozingterror");
	if (slot < 0) return false;
	var it = character.items[slot];
	if (!it || it.name !== "oozingterror" || it.l) return false;
	var lv = it.level || 0;
	try {
		await send_item(CONFIG.PRIEST, slot, 1);
		last_give_ms[CONFIG.PRIEST] = Date.now();
		act("give oozingterror+" + lv + " to " + CONFIG.PRIEST);
		return true;
	} catch (e) {
		return false;
	}
}

async function buy_missing_kit(name) {
	return false;
}

async function buy_kit_any() {
	return false;
}

/**
 * Merchant's Luck on every farmer in range (320). +luck on their drops for an
 * hour; refresh in the last ten minutes. Never fight a stronger mluck.
 */
async function mluck_farmers() {
	if (!can_use("mluck") || character.mp < 10) return false;
	for (var i = 0; i < CONFIG.FARMERS.length; i++) {
		var name = CONFIG.FARMERS[i];
		var p = get_player(name);
		if (!p || distance(character, p) > 320) continue;
		var s = p.s && p.s.mluck;
		if (s && s.f === character.name && s.ms > 600000) continue;
		if (s && s.strong && s.f !== character.name) continue;
		if (Date.now() - (last_mluck_ms[name] || 0) < 15000) continue;
		last_mluck_ms[name] = Date.now();
		try {
			await use_skill("mluck", p);
			act("mluck " + name);
		return true;
		} catch (e) {}
	}
	return false;
}

var last_vstaff_cm = 0;

function at_vstaff_plaza() {
	return character.map === "main" && simple_distance(character, SHOP_XY.market) < 160;
}

function locate_vstaff_slot() {
	var items = character.items || [];
	for (var i = 0; i < items.length; i++) {
		if (items[i] && items[i].name === "vstaff" && !items[i].l) return i;
	}
	return -1;
}

function priest_vstaff_level() {
	var p = get_player(CONFIG.PRIEST);
	var eq = p && p.slots && p.slots.mainhand;
	if (eq && eq.name === "vstaff") return eq.level || 0;
	var r = reports[CONFIG.PRIEST];
	var mh = r && r.kit && r.kit.mainhand;
	if (typeof mh === "string" && mh.indexOf("vstaff:") === 0) {
		return parseInt(mh.split(":")[1], 10) || 0;
	}
	return -1;
}

function bank_vstaff_upgrade() {
	if (!character.bank) return null;
	var theirs = priest_vstaff_level();
	/** Need a kit/live read before pulling — otherwise every spare vault staff
	 *  triggers a forever plaza wait while Aedroma already wears a better one. */
	if (theirs < 0) return null;
	var best = null;
	var best_lv = theirs;
	for (var pack in character.bank) {
		if (pack === "gold") continue;
		var items = character.bank[pack];
		if (!items || !items.length) continue;
		for (var i = 0; i < items.length; i++) {
			var it = items[i];
			if (!it || it.name !== "vstaff" || it.l) continue;
			var lv = it.level || 0;
			if (lv > best_lv) {
				best_lv = lv;
				best = { pack: pack, slot: i, level: lv };
			}
		}
	}
	return best;
}

function mule_should_hand_vstaff() {
	var theirs = priest_vstaff_level();
	var slot = locate_vstaff_slot();
	if (slot < 0) return !!bank_vstaff_upgrade();
	var it = character.items[slot];
	if (!it) return false;
	if (theirs >= 0 && (it.level || 0) <= theirs) return false;
	/** Unknown priest weapon: only hand when she is in range (live slots). */
	if (theirs < 0) {
		var p = get_player(CONFIG.PRIEST);
		return !!(p && distance(character, p) <= 400);
	}
	return true;
}

async function ping_vstaff_pickup() {
	if (Date.now() - last_vstaff_cm < 8000) return;
	if (!mule_should_hand_vstaff()) return;
	last_vstaff_cm = Date.now();
	try { await send_cm(CONFIG.PRIEST, { t: "vstaff" }); } catch (e) {}
}

var last_vstaff_wait_act = 0;

/**
 * Vampiric Staff belongs on Aedroma (priest). Retrieve from bank, meet in
 * town or at the pack, and hand it over. Do not keep it on the mule.
 */
async function maybe_return_vstaff() {
	if (!mule_should_hand_vstaff()) return false;
	if (character.bank && locate_vstaff_slot() < 0) {
		var found = bank_vstaff_upgrade();
		if (found && character.esize > 0) {
			try {
				await bank_retrieve(found.pack, found.slot);
				game_log("retrieved vstaff+" + found.level + " from bank");
				act("retrieve vstaff+" + found.level);
			} catch (e) {
				game_log("vstaff bank: " + ((e && e.reason) || e));
			}
			return true;
		}
	}
	if (locate_vstaff_slot() < 0) return false;
	if (character.map === "bank") {
		await go_to("market", "leave bank with vstaff");
		return true;
	}
	await ping_vstaff_pickup();
	if (await maybe_give_vstaff()) return true;
	if (!at_vstaff_plaza()) {
		await go_to("market", "park for vstaff handoff");
		return true;
	}
	/** Parked at the plaza: do not block the tick. Stand listing and city
	 *  chores share this spot, and returning true starved player-stand sales. */
	if (Date.now() - last_vstaff_wait_act > 12000) {
		last_vstaff_wait_act = Date.now();
		act("waiting for Aedroma for vstaff");
	}
	return false;
}

async function maybe_give_vstaff() {
	if (!mule_should_hand_vstaff()) return false;
	var slot = locate_vstaff_slot();
	if (slot < 0) return false;
	var it = character.items[slot];
	if (!it || it.name !== "vstaff" || it.l) return false;
	var priest = get_player(CONFIG.PRIEST);
	if (!priest || distance(character, priest) > 400) {
		/** Stand park shares the plaza — never log "waiting" unless we still
		 *  hold an upgrade and Aedroma is actually inbound / in city. */
		if (!(farmer_in_city(CONFIG.PRIEST) || farmer_said_coming(CONFIG.PRIEST))) return false;
		if (!at_vstaff_plaza()) {
			await go_to("market", "park for vstaff handoff");
			return true;
		}
		if (Date.now() - last_vstaff_wait_act > 12000) {
			last_vstaff_wait_act = Date.now();
			act("waiting for Aedroma for vstaff");
		}
		return false;
	}
	if (Date.now() - (last_give_ms["vstaff"] || 0) < 4000) return false;
	var lv = it.level || 0;
	try {
		await send_item(CONFIG.PRIEST, slot, 1);
		last_give_ms["vstaff"] = Date.now();
		act("give vstaff+" + lv + " to " + CONFIG.PRIEST);
		game_log("give vstaff+" + lv + " to " + CONFIG.PRIEST);
		return true;
	} catch (e) {
		game_log("give vstaff: " + ((e && e.reason) || e));
		return false;
	}
}

function bag_named_count(name) {
	var n = 0;
	var items = character.items || [];
	for (var i = 0; i < items.length; i++) {
		var it = items[i];
		if (it && it.name === name) n += it.q || 1;
	}
	return n;
}

function farmer_needs_tracker(name) {
	var r = reports[name];
	if (!r || Date.now() - r.at > 120000) return false;
	return r.tracker === 0;
}

function farmers_missing_tracker() {
	var n = 0;
	for (var i = 0; i < CONFIG.FARMERS.length; i++) {
		if (farmer_needs_tracker(CONFIG.FARMERS[i])) n++;
	}
	return n;
}

/** Keep one Tracktrix on the mule plus one for each farmer who reported none. */
function tracker_keep_bag() {
	return 1 + farmers_missing_tracker();
}

function find_bank_tracker() {
	var found = null;
	if (!character.bank) return null;
	each_bank_item(function (bit, pack, slot) {
		if (found || !bit || bit.name !== "tracker" || bit.l) return;
		found = { pack: pack, slot: slot };
	});
	return found;
}

/**
 * Each farmer keeps one Tracktrix. Pull extras from bank and hand them
 * when a farmer pings tracker:0. Surplus copies still dump / list.
 */
async function maybe_give_trackers() {
	if (Date.now() - (last_give_ms.tracker || 0) < 800) return false;
	var waiting = false;
	var i;
	for (i = 0; i < CONFIG.FARMERS.length; i++) {
		var name = CONFIG.FARMERS[i];
		if (!farmer_needs_tracker(name)) continue;
		if (near_farmer(name) || farmer_in_city(name)) waiting = true;
	}
	if (!waiting) return false;
	if (locate_item("tracker") === -1) {
		var found = find_bank_tracker();
		if (found && character.esize > 0) {
			await ensure_stand_closed();
			if (character.map !== "bank") {
				act("tracker bank");
				await go_to("bank", "tracker from bank");
				return true;
			}
			try {
				await bank_retrieve(found.pack, found.slot);
				game_log("retrieved tracker from bank");
				act("retrieve tracker");
			} catch (e) {
				game_log("tracker bank: " + ((e && e.reason) || e));
			}
			return true;
		}
		return false;
	}
	for (i = 0; i < CONFIG.FARMERS.length; i++) {
		var who = CONFIG.FARMERS[i];
		if (!farmer_needs_tracker(who) || !near_farmer(who)) continue;
		var slot = locate_item("tracker");
		if (slot < 0) return false;
		try {
			await send_item(who, slot, 1);
			last_give_ms.tracker = Date.now();
			if (reports[who]) reports[who].tracker = (reports[who].tracker || 0) + 1;
			game_log("give tracker to " + who);
			act("give tracker to " + who);
			return true;
		} catch (e) {
			game_log("give tracker: " + ((e && e.reason) || e));
			return false;
		}
	}
	return false;
}

async function serve_pack() {
	await give_pots_nearby();
	if (await maybe_give_trackers()) return;
	if (await maybe_dashboard_kit()) return;
	if (await maybe_dashboard_consumables()) return;
	if (await maybe_dashboard_gifts()) return;
	for (var i = 0; i < CONFIG.FARMERS.length; i++) {
		if (near_farmer(CONFIG.FARMERS[i])) {
			await return_gear(CONFIG.FARMERS[i]);
		}
	}
	await maybe_give_dex_elixir();
	await maybe_give_int_elixir();
	await maybe_return_vstaff();
	if (character.esize > 2) {
		await maybe_give_best_oozing();
		for (var i = 0; i < CONFIG.FARMERS.length; i++) {
			await return_gear(CONFIG.FARMERS[i]);
		}
	}
	await mluck_farmers();
}

function player_needs_mluck(p) {
	if (!p) return false;
	var s = p.s && p.s.mluck;
	if (s && s.strong && s.f && s.f !== character.name) return false;
	if (s && s.f === character.name && s.ms > 600000) return false;
	return true;
}

function farmer_in_city(name) {
	var park = SHOP_XY.market;
	var p = get_player(name);
	if (p && p.map === "main" && simple_distance(p, park) < 500) return true;
	var r = reports[name];
	if (!r || Date.now() - r.at > 45000) return false;
	if (r.map !== "main") return false;
	return simple_distance(r, park) < 500;
}

function farmer_said_coming(name) {
	var r = reports[name];
	return !!(r && Date.now() - r.at < 45000 && r.coming);
}

function anyone_coming_to_city() {
	for (var i = 0; i < CONFIG.FARMERS.length; i++) {
		var name = CONFIG.FARMERS[i];
		/** need_luck from the beach is not a walk-in. Only the warrior
		 *  coming flag, or a farmer already in the plaza. */
		if (farmer_said_coming(name)) return true;
		if (!farmer_in_city(name)) continue;
		if (farmer_needs_pots(name)) return true;
		var p = get_player(name);
		if (p && player_needs_mluck(p)) return true;
	}
	return false;
}

function city_service_needed() {
	for (var i = 0; i < CONFIG.FARMERS.length; i++) {
		var name = CONFIG.FARMERS[i];
		var r = reports[name];
		var incoming = farmer_said_coming(name) || farmer_in_city(name);
		if (!incoming) continue;
		if (farmer_needs_pots(name) || farmer_said_coming(name) || farmer_has_dump(name)) return true;
		if (has_return_item(name)) return true;
		if (r && r.need_luck && farmer_in_city(name)) return true;
		var p = get_player(name);
		if (p && player_needs_mluck(p)) return true;
	}
	return false;
}

/**
 * Farmers walk here for pots and mluck. Cancel a ferry, park at market,
 * hand potions, buff, stay until they leave or are served.
 */
async function maybe_city_service() {
	if (!anyone_coming_to_city() && !city_service_needed()) return false;
	mission = null;
	/** Gabriel junk / combine / Xyn beat the stand. Opening the shop while
	 *  farmers dump was a got-dump / stand flicker and never sold. */
	var gear_now = false;
	for (var i = 0; i < CONFIG.FARMERS.length; i++) {
		var who = CONFIG.FARMERS[i];
		if ((farmer_said_coming(who) || farmer_in_city(who)) && has_return_item(who)) gear_now = true;
	}
	if (!gear_now && town_npc_chore_pending()) {
		if (await town_work()) return true;
	}
	/** Full bag + Gabriel/Xyn still pending: do not yank back to plaza — that
	 *  cancels the walk mid-route and nothing ever sells (stand ↔ Gabriel loop). */
	if (!gear_now && town_npc_chore_pending()) return false;
	var park = SHOP_XY.market;
	if (character.map === "bank" || character.map !== "main" || simple_distance(character, park) > 90) {
		act("city service, park stand");
		await go_to("market", "farmers coming for pots/mluck");
		return true;
	}
	await serve_pack();
	if (pots_need_restock()) {
		act("stock pots h=" + item_count(CONFIG.HPOT) + " m=" + item_count(CONFIG.MPOT));
		if (await stock_pots()) return true;
	}
	/** Waiting used to return here with the stand closed. Listings stay
	 *  in trade slots; open them while we sit in the plaza. */
	if (await maybe_keep_shop()) return true;
	if (city_service_needed()) {
		act("city service, waiting on farmers");
		return true;
	}
	return false;
}

function anyone_reported_recently() {
	for (var i = 0; i < CONFIG.FARMERS.length; i++) {
		var r = reports[CONFIG.FARMERS[i]];
		if (r && Date.now() - r.at < CONFIG.IDLE_REPORT_MS) return true;
	}
	return false;
}

function anchor_farmer() {
	var order = [CONFIG.MAGE, CONFIG.PRIEST, CONFIG.WARRIOR];
	for (var i = 0; i < order.length; i++) {
		if (farmer_reachable(order[i])) return order[i];
	}
	return null;
}

function town_job_pending() {
	if (next_craft() || accessory_work_pending()) return true;
	if (locate_upgrade_item() !== -1 || locate_dexscroll_item() !== -1) return true;
	if (locate_sell_item() !== -1) return true;
	if (locate_dump_item() !== -1) return true;
	for (var i = 0; i < CONFIG.FARMERS.length; i++) {
		if (kit_needs_buy(CONFIG.FARMERS[i])) return true;
	}
	return item_count(CONFIG.HPOT) < CONFIG.POT_STOCK / 2 || item_count(CONFIG.MPOT) < CONFIG.MPOT_STOCK / 2;
}

var leave_reason = "";
var no_stand_until = 0;

/**
 * Serve the pack, then leave. Do not live beside them. A 20s dwell is only
 * so potions and dump can actually land before we walk back to the shore.
 */
function should_leave_pack() {
	var m = mission;
	var dwell = Date.now() - (m && m.arrived ? m.arrived : Date.now());
	if (pots_low()) { leave_reason = "pots low"; return true; }
	if (find_compound_set() || accessory_work_pending()) { leave_reason = "combine jewelry"; return true; }
	if (locate_upgrade_item() !== -1 || locate_dexscroll_item() !== -1) { leave_reason = "upgrade"; return true; }
	if (bag_needs_dump()) { leave_reason = "bag dump"; return true; }
	if (character.esize <= CONFIG.BAG_MIN + 2) { leave_reason = "bag nearly full"; return true; }
	if (!anyone_reported_recently()) { leave_reason = "pack went quiet"; return true; }
	if (dwell < CONFIG.DWELL_MIN_MS) return false;
	if (!this_farmer_needs_us(m && m.who)) { leave_reason = "done with " + ((m && m.who) || "farmer"); return true; }
	if (kit_urgent()) { leave_reason = "someone fights with an empty slot"; return true; }
	if (dwell > CONFIG.HOT_DWELL_MS && hot_types_near(character, 400) && !at_cave_meet()) {
		leave_reason = "aggressive pack, not lingering";
		no_stand_until = Date.now() + 240000;
		return true;
	}
	if (dwell > CONFIG.TOWN_JOB_DWELL_MS && town_job_pending()) { leave_reason = "town jobs"; return true; }
	return false;
}

/** One committed trip: walk out, stand town-side of the pack, serve, come back for a reason. */
async function run_ferry() {
	var m = mission;
	if (!m) return false;
	if (!near_mission()) {
		if (Date.now() - m.started > CONFIG.FERRY_TIMEOUT_MS) {
			act("ferry timeout, back to town");
			mission = null;
			await recall_spawn("ferry timeout");
			return true;
		}
		var dest = safe_meet_point(m.who);
		if (!dest || !dest_ok(dest)) {
			act("pack not on main/cave, town idle");
			mission = null;
			return false;
		}
		await go_to(dest, "travel " + m.who);
		return true;
	}
	if (!m.arrived) {
		m.arrived = Date.now();
		act("at " + m.who + ": " + m.why);
	}
	if (should_leave_pack()) {
		var next = pick_visit();
		if (next && next !== m.who) {
			mission = { type: "ferry", who: next, why: last_visit_why || ("visit " + next), started: Date.now(), arrived: 0 };
			act("next " + next);
			return true;
		}
		act("leave pack: " + leave_reason);
		mission = null;
		await recall_spawn(leave_reason);
		return true;
	}
	var hold = safe_meet_point(m.who);
	if (hold && simple_distance(character, hold) > 90) {
		await go_to(hold, "hold meet point");
	} else {
		act("with pack " + Math.round((Date.now() - m.arrived) / 1000) + "s h=" + item_count(CONFIG.HPOT) + " m=" + item_count(CONFIG.MPOT));
	}
	return true;
}

function pots_low() {
	if (caster_mpot_urgent() && item_count(CONFIG.MPOT) < CONFIG.MPOT_GIVE) return true;
	return item_count(CONFIG.HPOT) < CONFIG.POT_GIVE || item_count(CONFIG.MPOT) < CONFIG.MPOT_GIVE;
}

/** Below the town warehouse target. Serve-threshold pots_low is 1000; this
 *  is what actually refills mpot1 back to 3000 after handoffs. */
function pots_need_restock() {
	return item_count(CONFIG.HPOT) + 9 < CONFIG.POT_STOCK || item_count(CONFIG.MPOT) + 9 < CONFIG.MPOT_STOCK;
}

function anyone_needs_pots() {
	for (var i = 0; i < CONFIG.FARMERS.length; i++) {
		if (farmer_needs_pots(CONFIG.FARMERS[i])) return true;
	}
	return false;
}

function anyone_needs_visit() {
	for (var i = 0; i < CONFIG.FARMERS.length; i++) {
		var name = CONFIG.FARMERS[i];
		if (!farmer_reachable(name)) continue;
		if (farmer_needs_pots(name) || farmer_has_gold(name) || farmer_has_dump(name) || has_return_item(name)) return true;
	}
	return false;
}

function ponty_realm() {
	return {
		region: (typeof server !== "undefined" && server.region) || "",
		name: (typeof server !== "undefined" && server.id) || ""
	};
}

function same_realm(a, b) {
	return !!(a && b && a.region === b.region && a.name === b.name);
}

function ponty_key(r) {
	return (r && r.region && r.name) ? (r.region + ":" + r.name) : "";
}

function ponty_realm_is_pvp(r) {
	if (!r || !r.name) return false;
	if (String(r.name).toUpperCase() === "PVP") return true;
	try {
		if (typeof server !== "undefined" && server.pvp && r.region === server.region && r.name === server.id) return true;
	} catch (e) {}
	return false;
}

function load_ponty_tour() {
	var t = null;
	try {
		var raw = pget("eadrosell_ponty_tour");
		if (raw && raw !== "undefined" && raw !== "null" && raw !== "") t = JSON.parse(raw);
	} catch (e) {}
	if (!t) {
		try { t = get("ponty_tour"); } catch (e2) {}
	}
	if (t && typeof t === "object") {
		t.home = CONFIG.PONTY_HOME;
		if (!t.queue) t.queue = [];
		if (typeof t.i === "number") {
			t.active = false;
			t.visited = [];
			t.queue = [];
			if (!t.at) t.at = Date.now();
			return t;
		}
		if (!t.visited) t.visited = [];
		if (t.active && t.v !== 2) {
			t.visited = [];
			t.v = 2;
		}
		return t;
	}
	return { active: false, at: 0, home: CONFIG.PONTY_HOME, visited: [], queue: [] };
}

async function save_ponty_tour(tour) {
	if (tour) tour.v = 2;
	try { set("ponty_tour", tour); } catch (e) {}
	try {
		var r = pset("eadrosell_ponty_tour", JSON.stringify(tour));
		if (r && typeof r.then === "function") await r;
	} catch (e2) {}
}

function ponty_just_hopped() {
	var n = 0;
	try { n = parseInt(pget("eadrosell_ponty_hop"), 10) || 0; } catch (e) {}
	if (!n) {
		try { n = get("eadrosell_ponty_hop") || 0; } catch (e2) {}
	}
	return !!(n && Date.now() - n < 180000);
}

async function mark_ponty_hop() {
	var n = Date.now();
	try { set("eadrosell_ponty_hop", n); } catch (e) {}
	try {
		var r = pset("eadrosell_ponty_hop", String(n));
		if (r && typeof r.then === "function") await r;
	} catch (e2) {}
}

function ponty_visited(tour, realm) {
	var k = ponty_key(realm);
	return !!(k && tour.visited && tour.visited.indexOf(k) >= 0);
}

function mark_ponty_visited(tour, realm) {
	var k = ponty_key(realm);
	if (!k) return;
	if (!tour.visited) tour.visited = [];
	if (tour.visited.indexOf(k) < 0) tour.visited.push(k);
}

function ponty_server_queue(home) {
	var out = [];
	var seen = {};
	function add(region, name) {
		if (!region || !name) return;
		if (String(name).toUpperCase() === "PVP") return;
		var k = region + ":" + name;
		if (seen[k]) return;
		seen[k] = 1;
		out.push({ region: region, name: name });
	}
	add(home.region, home.name);
	var list = [];
	try { list = get_servers() || []; } catch (e) { list = []; }
	for (var i = 0; i < list.length; i++) {
		var s = list[i];
		if (!s) continue;
		if (s.pvp) continue;
		if (s.online === false) continue;
		var nm = s.name || s.id;
		var label = String(s.server || s.key || nm || "");
		if (String(nm).toUpperCase() === "PVP") continue;
		if (label.toUpperCase().indexOf("PVP") >= 0) continue;
		add(s.region, nm);
	}
	return out;
}

function ponty_next_unvisited(tour) {
	for (var i = 0; i < tour.queue.length; i++) {
		if (!ponty_visited(tour, tour.queue[i])) return tour.queue[i];
	}
	return null;
}

function ponty_live_npc() {
	try {
		for (var key in parent.entities) {
			var e = parent.entities[key];
			if (!e) continue;
			if (e.npc === "secondhands" || e.id === "secondhands") return e;
		}
	} catch (err) {}
	return null;
}

function ponty_in_range() {
	var e = ponty_live_npc();
	return !!(e && character.map === "main" && simple_distance(character, e) <= 80);
}

function is_ponty_lolipop(it) {
	if (!it || !it.name) return false;
	return in_list(CONFIG.PONTY_ITEMS, it.name);
}

async function ponty_open_list() {
	try {
		var data = await get_secondhands();
		if (!data || !Array.isArray(data.items)) return { ok: false, items: [] };
		return { ok: true, items: data.items };
	} catch (e) {
		game_log("Ponty list: " + ((e && e.reason) || e));
		return { ok: false, items: [] };
	}
}

async function ponty_buy_from_list(items) {
	if (!items || !items.length) return 0;
	if (character.esize < 1) return 0;
	var bought = 0;
	for (var i = 0; i < items.length; i++) {
		var it = items[i];
		if (!is_ponty_lolipop(it)) continue;
		if (character.esize < 1) break;
		if (character.gold < CONFIG.PONTY_GOLD_KEEP) break;
		var cost = it.price || 0;
		if (cost && character.gold - cost < CONFIG.PONTY_GOLD_KEEP) {
			game_log("Ponty skip " + it.name + " " + cost + "g, keep gold");
			continue;
		}
		try {
			await buy_secondhand(it.rid || it);
			bought++;
			game_log("Ponty bought " + it.name + "+" + (it.level || 0) + " " + cost + "g");
		} catch (e) {
			game_log("Ponty buy: " + ((e && e.reason) || e));
		}
	}
	return bought;
}

var ponty_hopped = false;
var ponty_settle_until = Date.now() + 2500;
var ponty_leave_at = 0;

async function ponty_hop(region, name) {
	if (!region || !name) return true;
	if (String(name).toUpperCase() === "PVP") return true;
	if (ponty_hopped) return true;
	var here = ponty_realm();
	if (here.region === region && here.name === name) return true;
	ponty_hopped = true;
	await mark_ponty_hop();
	act("hop " + region + " " + name + " Ponty");
	change_server(region, name);
	return true;
}

async function ponty_tour_step(tour) {
	var here = ponty_realm();
	if (!here.region || !here.name) return true;
	if (!tour.home) tour.home = CONFIG.PONTY_HOME;
	if (!ponty_visited(tour, here)) {
		if (ponty_realm_is_pvp(here)) {
			mark_ponty_visited(tour, here);
			await save_ponty_tour(tour);
			game_log("Ponty skip PVP " + ponty_key(here));
		} else {
			await ensure_stand_closed();
			if (character.map !== "main" || !ponty_in_range()) {
				act("walk Ponty " + here.region + " " + here.name);
				await go_to("secondhands", "Ponty lolipops");
				return true;
			}
			if (Date.now() < ponty_settle_until) {
				act("wait Ponty " + ponty_key(here));
				return true;
			}
			var scan;
			try { scan = await ponty_open_list(); } catch (e) {
				game_log("Ponty: " + ((e && e.reason) || e));
				return true;
			}
			if (!scan || !scan.ok) {
				act("Ponty closed " + ponty_key(here));
				return true;
			}
			try { await ponty_buy_from_list(scan.items); } catch (e2) {
				game_log("Ponty buy: " + ((e2 && e2.reason) || e2));
			}
			mark_ponty_visited(tour, here);
			await save_ponty_tour(tour);
			ponty_leave_at = Date.now() + 3000;
			game_log("Ponty scanned " + ponty_key(here) + " " + scan.items.length + " listings (" + tour.visited.length + "/" + tour.queue.length + ")");
		}
	}
	if (ponty_leave_at && Date.now() < ponty_leave_at) {
		act("Ponty list " + ponty_key(here));
		return true;
	}
	var next = ponty_next_unvisited(tour);
	if (next) {
		if (same_realm(here, next)) return true;
		await save_ponty_tour(tour);
		return ponty_hop(next.region, next.name);
	}
	if (tour.home && !same_realm(here, tour.home)) {
		await save_ponty_tour(tour);
		return ponty_hop(tour.home.region, tour.home.name);
	}
	tour.active = false;
	tour.at = Date.now();
	await save_ponty_tour(tour);
	game_log("Ponty tour done, home " + ponty_key(here));
	return true;
}

async function maybe_ponty_tour() {
	var tour = load_ponty_tour();
	var here = ponty_realm();
	var home = CONFIG.PONTY_HOME;
	if (!here.region || !here.name) return false;
	var on_home = same_realm(here, home);
	// Finish returning home, but do not start optional shopping while pots are due.
	if (on_home && anyone_needs_pots()) {
		if (tour.active) { tour.active = false; await save_ponty_tour(tour); }
		return false;
	}

	if (tour.active) return await ponty_tour_step(tour);

	if (!on_home) {
		tour = {
			active: true,
			v: 2,
			at: Date.now(),
			home: home,
			visited: [],
			queue: ponty_realm_is_pvp(here) ? [home] : [here, home]
		};
		await save_ponty_tour(tour);
		game_log("Ponty return home from " + ponty_key(here));
		return await ponty_tour_step(tour);
	}

	if (ponty_just_hopped()) {
		tour.active = false;
		if (!tour.at) tour.at = Date.now();
		await save_ponty_tour(tour);
		return false;
	}

	if (anyone_coming_to_city() || city_service_needed()) return false;
	if (character.gold < CONFIG.PONTY_GOLD_KEEP) return false;
	if (!tour.at) {
		tour.at = Date.now();
		await save_ponty_tour(tour);
		return false;
	}
	if (Date.now() - tour.at < CONFIG.PONTY_MS) return false;
	tour = {
		active: true,
		v: 2,
		at: Date.now(),
		home: home,
		visited: [],
		queue: ponty_server_queue(home)
	};
	await save_ponty_tour(tour);
	game_log("Ponty tour " + tour.queue.length + " servers for lolipops");
	return await ponty_tour_step(tour);
}

setInterval(async function () {
	if (working) return;
	working = true;
	try {
		await tick();
	} catch (error) {
		game_log("merchant: " + (error.reason || error.message || error));
	} finally {
		working = false;
	}
}, 250);

function on_home_realm() {
	var home = CONFIG.PONTY_HOME;
	if (!home || typeof server === "undefined" || !server) return true;
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

/** Farmers run on Eadroma's client. This window never start_character. */
async function maybe_start_team() {
	return false;
}

/** Urgent delivery owns the route until served; optional town work waits. */
async function urgent_potion_service() {
	if (!anyone_needs_pots()) return false;
	if (!same_realm(ponty_realm(), CONFIG.PONTY_HOME)) return maybe_ponty_tour();
	if (near_pack()) await give_pots_nearby();
	if (!anyone_needs_pots()) return false;
	if (pots_low() && await stock_pots()) return true;
	for (var i = 0; i < CONFIG.FARMERS.length; i++) {
		var name = CONFIG.FARMERS[i];
		if (!farmer_needs_pots(name) || !farmer_reachable(name)) continue;
		// Use the safe rendezvous, never chase a tank into its monster pack.
		var dest = safe_meet_point(name);
		if (!dest || !dest_ok(dest)) continue;
		if (!mission || mission.who !== name) mission = { type: "ferry", who: name, why: "urgent potions", started: Date.now(), arrived: 0 };
		return run_ferry();
	}
	return false;
}

async function tick() {
	if (character.rip) {
		act("rip, respawn");
		await respawn();
		return;
	}
	await maybe_self_pot();
	if (await flee_if_danger()) return;
	if (await maybe_start_team()) return;
	if (character.c && (character.c.town || character.c.fishing || character.c.mining)) {
		act(character.c.fishing ? "fishing" : character.c.mining ? "mining" : "town channel");
		return;
	}
	if (character.q && character.q.exchange) {
		act("exchanging");
		return;
	}
	if (await urgent_potion_service()) return;
	if (await maybe_return_vstaff()) return;
	if (await maybe_dashboard_kit()) return;
	if (await maybe_dashboard_consumables()) return;
	if (await maybe_dashboard_gifts()) return;
	if (await maybe_ponty_tour()) return;
	watch_stuck();
	if (await maybe_give_dex_elixir()) return;
	if (await maybe_give_int_elixir()) return;
	if (character.map === "spookytown" || character.map === "halloween") {
		mission = null;
		act("leave " + character.map + " for town");
		await go_to("market", "home from " + character.map);
		return;
	}
	if (in_east_park_trap()) {
		mission = null;
		if (await do_town_escape("east park, no halloween road")) return;
	}
	if (mission) {
		var hold = safe_meet_point(mission.who);
		if (!hold || !dest_ok(hold)) {
			act("drop ferry, pack not on main/cave");
			mission = null;
		}
	}
	if (await maybe_escape_hole()) return;
	loot();
	await ping_farmers();

	if (await maybe_city_service()) return;

	/** Leave the cave door for Fancy Pots before serving. Otherwise we stand
	 *  at 0,-80, log stock pots, and never walk to main. Top up to 3000 even
	 *  when we still have a handoff's worth — the stand used to skip that. */
	var must_stock = (anyone_needs_pots() && pots_low()) || (caster_mpot_urgent() && item_count(CONFIG.MPOT) < CONFIG.MPOT_GIVE);
	if (must_stock) {
		act("stock pots h=" + item_count(CONFIG.HPOT) + " m=" + item_count(CONFIG.MPOT));
		mission = null;
		if (await stock_pots()) return;
	} else if (!mission && pots_need_restock()) {
		act("stock pots h=" + item_count(CONFIG.HPOT) + " m=" + item_count(CONFIG.MPOT));
		if (await stock_pots()) return;
	}

	if (near_pack()) await serve_pack();

	/** Jewelry, Cue, Gabriel, and Xyn beat stand reopen — listings survive a closed
	 *  stand, so walking back to market every tick was canceling NPC sales. */
	if (find_compound_set() || accessory_work_pending() || locate_upgrade_item() !== -1 || locate_dexscroll_item() !== -1 || bag_needs_dump() || locate_sell_item() !== -1 || locate_exchange_item() !== -1) {
		mission = null;
		if (await town_work()) {
			last_town_job_ms = Date.now();
			return;
		}
	}

	/** A delivery already in progress stays committed until served. */
	if (mission && (await run_ferry())) return;

	/** A ready gathering cast owns its whole outbound route. This must run before
	 * stand maintenance: otherwise the first fishing tick closes the stand and
	 * walks west, then the next tick sees its saved listings and walks back to
	 * market, producing an endless "town stand" loop. */
	if (await maybe_fish()) return;
	if (await maybe_mine()) return;

	/** List / reopen stand only when no town chore or gathering route claimed the tick. */
	if (await maybe_keep_shop()) return;

	/**
	 * Gold drain and pot delivery beat town chores. kit_urgent used to hold us
	 * at Gabriel with 475g while the farmers sat on 20k — we cannot buy shoes
	 * (12100g) until we collect. Only a nearly-full bag keeps us in town.
	 */
	var bag_full = character.esize <= CONFIG.BAG_MIN + 2;
	if (accessory_work_pending() || locate_upgrade_item() !== -1 || locate_dexscroll_item() !== -1 || bag_needs_dump() || bag_full || locate_sell_item() !== -1 || locate_exchange_item() !== -1 || !anyone_needs_visit()) {
		if (await town_work()) {
			last_town_job_ms = Date.now();
			return;
		}
		if (await buy_kit_any()) return;
	}

	var who = pick_visit();
	if (!who && character.gold < 2000) {
		who = anchor_farmer();
		if (who) last_visit_why = "broke, collect gold";
	}
	if (who && !anyone_coming_to_city() && !bag_full && !accessory_work_pending() && locate_upgrade_item() === -1 && locate_dexscroll_item() === -1 && !bag_needs_dump() && locate_sell_item() === -1 && locate_exchange_item() === -1) {
		mission = { type: "ferry", who: who, why: last_visit_why || ("visit " + who), started: Date.now(), arrived: 0 };
		if (await run_ferry()) return;
	}

	if (await town_work()) {
		last_town_job_ms = Date.now();
		return;
	}
	/** Refill Fancy Pots before camping the stand. Listings used to return
	 *  here every tick, so mpot1 never climbed back to MPOT_STOCK. */
	if (pots_need_restock()) {
		act("stock pots h=" + item_count(CONFIG.HPOT) + " m=" + item_count(CONFIG.MPOT));
	if (await stock_pots()) return;
	}
	if (await maybe_keep_shop()) return;
	if (typeof __ALCC === "undefined" || !__ALCC.standEnabled || !(__ALCC.listings && __ALCC.listings.length)) {
		await ensure_stand_closed();
	}
	if (await buy_kit_any()) return;
	if (await stock_pots()) return;
	if (await maybe_merchant_xp()) return;

	if (smart.moving) {
		act("en route " + (last_visit_why || last_go_dest || "walk"));
		return;
	}
	if (character.map === "bank") {
		if (locate_sell_item() !== -1 || (character.esize >= 1 && locate_exchange_item() !== -1)) {
			act("leave bank for town chores");
			await go_to("market", "leave bank for sell");
			return;
		}
		act("leave bank, idle town");
		await go_to("market", "leave bank idle");
		return;
	}
	if (bag_tight() && locate_sell_item() !== -1) {
		if (await town_work()) return;
	}
	/** No spam when the stand is intentionally empty — fish/mine already ran above. */
	act("idle town h=" + item_count(CONFIG.HPOT) + " m=" + item_count(CONFIG.MPOT));
}
