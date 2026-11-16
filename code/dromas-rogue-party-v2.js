/**
 * ============================================================================
 * DROMAS — ROGUE DU GROUPE V2 (remplace le ranger dans le trio)
 * ============================================================================
 *
 * Meme role que droma-ranger-v2 : DPS qui suit Eadroma (tank) et ne frappe que
 * les monstres deja engages par l'equipe. Differences rogue :
 *   - Portee 120 (etoiles) : se place a ~60 px derriere le guerrier, pas 120.
 *   - Fan of Knives (5 cibles, 160 px, knifebelt) sur les packs engages.
 *   - Mental Burst sur la cible la plus faible (rend du mana).
 *   - Rogue Swiftness maintenue sur soi, le guerrier et le pretre.
 * Crypte, evenements, Cave Dreams : memes modules partages que le ranger
 * (CryptRun, EventRouter, CaveDreams) injectes par le builder.
 * ============================================================================
 */

if (typeof parent !== "undefined" && parent.$) {
	load_code("gui", function () { game_log("gui slot missing"); });
}

// ============================================================================
// 1. CONFIGURATION
// ============================================================================
var CONFIG = {
	NAME: "Dromas",
	WARRIOR: "Eadroma",
	PRIEST: "Aedroma",
	MERCHANT: "EadroSell",
	PARTY: ["Eadroma", "Aedroma"],
	PARTY_GUESTS: ["EadroSell"],
	DEFAULT_FARM: "spider",
	FARM_INDEPENDENT: false,
	DAILY_DUNGEON: false,
	RARE_VISITS: true,

	// --- Positionnement (portee rogue 120) ---
	FOLLOW_RANGE: 110,
	MIN_RANGE: 35,
	ANCHOR: 60,
	MELEE_SAFE: 45,
	kiting: {
		enabled: true,
		optimalDistance: 100,
		sampleAngles: 8,
		bossAngles: 12,
		stepDistance: 40,
		repositionThreshold: 20,
	},

	// --- Competences ---
	skills: {
		fanEnabled: true,          // Fan of Knives sur les packs engages
		fanMinTargets: 2,
		burstEnabled: true,        // Mental Burst
		swiftnessEnabled: true,    // Rogue Swiftness sur l'equipe
		mpReserve: 200
	},

	potions: {
		hpThreshold: 0.45,         // 3.2k PV : boire plus tot que le ranger
		mpThreshold: 0.60,         // user: drink MP earlier (Invisibility, Swiftness, Fan of Knives)
		hpot: "hpot1",
		mpot: "mpot1",
		needH: 200,
		needM: 300
	},

	hunts: { enabled: true },
	loot: { enabled: true, intervalMs: 500, chestRange: 350 },
	inventory: { dumpEsize: 4, dumpCooldownMs: 30000 }
};

// ============================================================================
// 2. INTERFACE COMMAND CENTER (le builder remplace ces fonctions)
// ============================================================================
var BOARD_CTL = {
	leader: "Eadroma",
	monster: "auto",
	roles: { Eadroma: "Leader", Aedroma: "Follow", Dromas: "Follow", EadroSell: "Follow" },
	events: { Eadroma: true, Aedroma: true, Dromas: true, EadroSell: false }
};

function live_control() {
	if (typeof parent !== "undefined" && parent.party_board_control && parent.party_board_control.leader) {
		BOARD_CTL = parent.party_board_control;
	}
	return BOARD_CTL;
}

function apply_ctl(ctl) {
	if (!ctl) return;
	if (ctl.monster) BOARD_CTL.monster = ctl.monster;
	if (ctl.leader) BOARD_CTL.leader = ctl.leader;
}

function poll_board() {
	var ctl = live_control();
	if (ctl) apply_ctl(ctl);
}

function events_enabled() {
	var ctl = live_control();
	return !ctl || !ctl.events || ctl.events[character.name] !== false;
}

// ============================================================================
// 3. GROUPE & CM
// ============================================================================
var tank_pos = { map: "main", x: 0, y: 0, at: 0 };
var leader_intent = { map: "", x: 0, y: 0, targetId: "", monster: "", at: 0 };

function on_party_invite(name) {
	if (typeof CaveDreams !== "undefined" && CaveDreams.allowsPartyMember && !CaveDreams.allowsPartyMember(name)) return;
	if ((CONFIG.PARTY || []).concat(CONFIG.PARTY_GUESTS || []).indexOf(name) >= 0) accept_party_invite(name);
}

function on_party_request(name) {
	if (typeof CaveDreams !== "undefined" && CaveDreams.allowsPartyMember && !CaveDreams.allowsPartyMember(name)) return;
	if ((CONFIG.PARTY || []).concat(CONFIG.PARTY_GUESTS || []).indexOf(name) >= 0) accept_party_request(name);
}

function on_cm(name, data) {
	if (typeof CaveDreams !== "undefined") CaveDreams.onCm(name, data);
	if (typeof CryptRun !== "undefined") CryptRun.onCm(name, data);
	if (typeof WorldEventIntel !== "undefined") WorldEventIntel.onCm(name, data);
	if (!data || typeof data !== "object") return;
	if (name === CONFIG.MERCHANT && data.t === "mux") report_potion_stock(name);
	if (data.t === "ctl") apply_ctl(data.ctl);
	if (name === CONFIG.WARRIOR && data.map) {
		tank_pos = { map: data.map, x: data.x, y: data.y, at: Date.now() };
		if (data.destMap) leader_intent = { map: data.destMap, x: data.destX, y: data.destY, targetId: data.targetId || "", monster: data.monster || "", at: Date.now() };
	}
}

function potion_item_count(name) {
	var total = 0, items = character.items || [];
	for (var i = 0; i < items.length; i++) if (items[i] && items[i].name === name) total += items[i].q || 1;
	return total;
}

function my_xy() {
	return {
		x: Math.round(typeof character.real_x === "number" ? character.real_x : character.x),
		y: Math.round(typeof character.real_y === "number" ? character.real_y : character.y)
	};
}

function report_potion_stock(to) {
	var cfg = CONFIG.potions, hp = potion_item_count(cfg.hpot), mp = potion_item_count(cfg.mpot), at = my_xy();
	try {
		send_cm(to, { t: "pots", hpot: hp, mpot: mp, map: character.map, x: at.x, y: at.y, gold: character.gold || 0,
			need_h: hp < cfg.needH, need_m: mp < cfg.needM });
	} catch (e) {}
}

var last_supply_req = 0;
function request_supply() {
	var cfg = CONFIG.potions, hp = potion_item_count(cfg.hpot), mp = potion_item_count(cfg.mpot);
	var need_h = hp < cfg.needH, need_m = mp < cfg.needM;
	if (!need_h && !need_m) return;
	if (Date.now() - last_supply_req < 30000) return;
	last_supply_req = Date.now();
	var at = my_xy();
	try { send_cm(CONFIG.MERCHANT, { t: "supply", need_h: need_h, need_m: need_m, hpot: hp, mpot: mp, map: character.map, x: at.x, y: at.y }); } catch (e) {}
}

function sleep_ms(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }

function skill_ok(name) { return typeof StyleLoadout === "undefined" || StyleLoadout.allows(name); }

function kite_step(harasser) {
	var k = CONFIG.kiting || {};
	if (!k.enabled || !harasser) return false;
	var at = my_xy(), optimal = k.optimalDistance || 100, step = k.stepDistance || 40;
	var samples = harasser.max_hp >= 60000 ? (k.bossAngles || 12) : (k.sampleAngles || 8);
	var best = null, bestScore = -1e9;
	for (var i = 0; i < samples; i++) {
		var a = (i / samples) * Math.PI * 2;
		var nx = Math.round(at.x + step * Math.cos(a)), ny = Math.round(at.y + step * Math.sin(a));
		if (typeof can_move_to !== "function" || !can_move_to(nx, ny)) continue;
		var d = Math.hypot(nx - harasser.x, ny - harasser.y);
		var score = -Math.abs(d - optimal) + (d > distance(character, harasser) ? 15 : 0);
		if (score > bestScore) { bestScore = score; best = { x: nx, y: ny }; }
	}
	if (!best) return false;
	var curD = distance(character, harasser), newD = Math.hypot(best.x - harasser.x, best.y - harasser.y);
	if (Math.abs(newD - optimal) > Math.abs(curD - optimal) - (k.repositionThreshold || 20) && newD <= curD) return false;
	move(best.x, best.y);
	return true;
}

// ============================================================================
// 4. CACHE TACTIQUE (memes regles anti-aggro que le ranger)
// ============================================================================
var state = { dumpInProgress: false, lastDumpTrip: 0, huntInProgress: false, lastHuntTrip: 0, lastDaisyInteract: 0, lastLoot: 0 };
var cache = { lastUpdate: 0, warrior: null, priest: null, merchant: null, target: null, tankEngagedMobs: [] };

function event_blocks(e) {
	if (typeof EventRouter === "undefined") return false;
	if (EventRouter.canEngage && !EventRouter.canEngage(e)) return true;
	return EventRouter.activeMonster() === "franky" && !EventRouter.accepts(e);
}

function updateCache() {
	var now = Date.now();
	if (now - cache.lastUpdate < 50) return;
	cache.lastUpdate = now;
	cache.warrior = get_player(CONFIG.WARRIOR);
	cache.priest = get_player(CONFIG.PRIEST);
	cache.merchant = get_player(CONFIG.MERCHANT);
	cache.target = null;
	cache.tankEngagedMobs = [];
	for (var id in parent.entities) {
		var e = parent.entities[id];
		if (!e || e.type !== "monster" || e.dead || !e.visible || event_blocks(e)) continue;
		var engaged = (cache.warrior && cache.warrior.target === id) || e.target === CONFIG.WARRIOR || e.target === CONFIG.PRIEST ||
			e.target === character.name || (typeof EventRouter !== "undefined" && EventRouter.activeMonster() && EventRouter.accepts(e));
		if (engaged) cache.tankEngagedMobs.push(e);
	}
	for (var i = 0; i < cache.tankEngagedMobs.length; i++) {
		if (cache.tankEngagedMobs[i].target === character.name) { cache.target = cache.tankEngagedMobs[i]; break; }
	}
	if (!cache.target && cache.warrior && cache.warrior.target) {
		var wt = parent.entities[cache.warrior.target];
		if (wt && wt.type === "monster" && !wt.dead && wt.visible && !event_blocks(wt)) cache.target = wt;
	}
	if (!cache.target && cache.tankEngagedMobs.length) cache.target = cache.tankEngagedMobs[0];
}

// ============================================================================
// 5. COMBAT (Fan of Knives, Mental Burst, attaque)
// ============================================================================
function fan_ready() {
	var skill = G.skills.fanofknives, belt = character.slots && character.slots.belt;
	return CONFIG.skills.fanEnabled && skill && skill_ok("fanofknives") && belt && belt.name === "knifebelt" &&
		character.level >= skill.level && character.mp >= skill.mp + CONFIG.skills.mpReserve && !is_on_cooldown("fanofknives");
}

function burst_ready() {
	var skill = G.skills.mentalburst;
	if (!CONFIG.skills.burstEnabled || !skill || !skill_ok("mentalburst") || is_on_cooldown("mentalburst")) return false;
	if (character.mp < skill.mp + CONFIG.skills.mpReserve) return false;
	var req = skill.requirements || {};
	return Object.keys(req).every(function (stat) { return Number(character[stat] || 0) >= req[stat]; });
}

async function combatLoop() {
	var delay = 80;
	try {
		if (is_disabled(character) || character.rip || state.dumpInProgress) { setTimeout(combatLoop, 300); return; }
		if ((typeof CaveDreams !== "undefined" && CaveDreams.inCave()) || (typeof CryptRun !== "undefined" && CryptRun.inside())) {
			setTimeout(combatLoop, 200); return;
		}
		updateCache();
		var target = cache.target;
		if (!target || event_blocks(target)) { setTimeout(combatLoop, 150); return; }

		if (fan_ready() && !is_on_cooldown("attack")) {
			var fanRange = G.skills.fanofknives.range || 160;
			var pack = cache.tankEngagedMobs.filter(function (m) { return distance(character, m) <= fanRange; }).slice(0, G.skills.fanofknives.max_targets || 5);
			if (pack.length >= CONFIG.skills.fanMinTargets) {
				try { await use_skill("fanofknives", pack.map(function (m) { return m.id; })); setTimeout(combatLoop, 200); return; } catch (e) {}
			}
		}

		if (burst_ready()) {
			var skill = G.skills.mentalburst;
			var reach = skill.range || character.range * (skill.range_multiplier || 1) + (skill.range_bonus || 0);
			var weakest = cache.tankEngagedMobs.filter(function (m) { return distance(character, m) <= reach; }).sort(function (a, b) { return a.hp - b.hp; })[0];
			if (weakest) { try { await use_skill("mentalburst", weakest.id); } catch (e) {} }
		}

		if (can_attack(target) && !is_on_cooldown("attack")) {
			try {
				await (typeof ActionTiming !== "undefined" && ActionTiming.wait ? ActionTiming.wait(attack(target), 1500) : attack(target));
				if (typeof ActionTiming !== "undefined") delay = ActionTiming.next("attack", 80, 20);
			} catch (e) {}
		}
	} catch (e) {}
	setTimeout(combatLoop, delay);
}

// ============================================================================
// 6. SOUTIEN — Rogue Swiftness sur l'equipe
// ============================================================================
async function supportLoop() {
	try {
		var skill = G.skills.rspeed;
		if (!is_disabled(character) && !character.rip && CONFIG.skills.swiftnessEnabled && skill && skill_ok("rspeed") &&
			character.level >= skill.level && character.mp >= skill.mp + CONFIG.skills.mpReserve && !is_on_cooldown("rspeed")) {
			var names = [character.name, CONFIG.WARRIOR, CONFIG.PRIEST];
			for (var i = 0; i < names.length; i++) {
				var p = names[i] === character.name ? character : get_player(names[i]);
				if (!p || p.rip || (p.s && p.s.rspeed)) continue;
				if (p !== character && distance(character, p) > (skill.range || 320)) continue;
				try { await use_skill("rspeed", p.name || names[i]); } catch (e) {}
				break;
			}
		}
	} catch (e) {}
	setTimeout(supportLoop, 1000);
}

// ============================================================================
// 7. SUIVI DU GUERRIER (poche de frappe a ANCHOR px derriere lui)
// ============================================================================
function get_shoot_pocket(warrior, target) {
	if (!warrior) return null;
	if (!target) return { x: warrior.x - 40, y: warrior.y - 40 };
	var dx = warrior.x - target.x, dy = warrior.y - target.y, len = Math.hypot(dx, dy);
	if (len < 1) return { x: warrior.x, y: warrior.y + CONFIG.ANCHOR };
	return { x: Math.round(warrior.x + dx / len * CONFIG.ANCHOR), y: Math.round(warrior.y + dy / len * CONFIG.ANCHOR) };
}

// 2026-11-04 21:45: movementLoop waits in await smart_move() for the whole walk, so the intent hold never ran and the
// follower walked into the Spookytown mummies' rage area alone. Stop the walk at its edge until the warrior is near.
setInterval(function () {
	try {
		if (!(smart.moving || character.moving) || character.map !== "spookytown" || character.rip) return;
		// Leaving spookytown (e.g. to Dorr for the cave) passes this edge; only hold walks that stay on the map.
		if (smart.moving && smart.map && smart.map !== "spookytown") return;
		var R = [-124, -1631, 614, -1130], E = 140, x = character.x, y = character.y;
		var inRage = x > R[0] && x < R[2] && y > R[1] && y < R[3];
		var nearRage = x > R[0] - E && x < R[2] + E && y > R[1] - E && y < R[3] + E;
		var w = get_player(CONFIG.WARRIOR);
		if (nearRage && !inRage && (!w || distance(character, w) > 200)) { stop(); set_message("attente du tank"); }
	} catch (e) {}
}, 250);

function get_leader_target() {
	if (leader_intent.at && Date.now() - leader_intent.at < 12000 && leader_intent.map) {
		// User (2026-11-04): Dromas (speed 92) reached the mummies alone, then the priest, then the warrior. Travel
		// towards the warrior's destination, but stop 350 px short of it until the warrior is within 200 px of us.
		var w = get_player(CONFIG.WARRIOR);
		if (character.map === leader_intent.map && distance(character, leader_intent) < 350 && (!w || distance(character, w) > 200)) { set_message("attente du tank"); return null; }
		if (character.map !== leader_intent.map || distance(character, leader_intent) > 110) return { map: leader_intent.map, x: leader_intent.x, y: leader_intent.y, entity: null, intent: true };
	}
	var p = get_player(CONFIG.WARRIOR);
	if (p) return { map: character.map, x: p.x, y: p.y, entity: p };
	var party = typeof get_party === "function" ? get_party() : (typeof parent !== "undefined" ? parent.party : null);
	if (party && party[CONFIG.WARRIOR] && party[CONFIG.WARRIOR].map) {
		var mem = party[CONFIG.WARRIOR];
		return { map: mem.map, x: mem.x, y: mem.y, entity: null };
	}
	if (tank_pos.at && Date.now() - tank_pos.at < 60000) return { map: tank_pos.map, x: tank_pos.x, y: tank_pos.y, entity: null };
	return null;
}

var travel_dest_map = "";

async function movementLoop() {
	try {
		if (is_disabled(character) || character.rip) { setTimeout(movementLoop, 300); return; }
		if (typeof CryptRun !== "undefined" && await CryptRun.tick()) { setTimeout(movementLoop, 250); return; }
		if (state.dumpInProgress || state.huntInProgress) { setTimeout(movementLoop, 500); return; }
		updateCache();
		if (typeof EventRouter !== "undefined" && await EventRouter.tick()) { setTimeout(movementLoop, 250); return; }
		if (typeof CaveDreams !== "undefined" && await CaveDreams.tick("follow")) { setTimeout(movementLoop, 300); return; }

		var leader = get_leader_target();
		if (!leader) {
			if (smart.moving) stop();
			travel_dest_map = "";
			setTimeout(movementLoop, 1500);
			return;
		}
		if (leader.map && leader.map !== character.map) {
			if (smart.moving && travel_dest_map === leader.map) { setTimeout(movementLoop, 400); return; }
			if (smart.moving) stop();
			travel_dest_map = leader.map;
			set_message("-> " + leader.map);
			await smart_move({ map: leader.map, x: leader.x, y: leader.y });
			travel_dest_map = "";
			setTimeout(movementLoop, 250);
			return;
		}
		travel_dest_map = "";
		if (smart.moving) { setTimeout(movementLoop, 200); return; }

		var dist = distance(character, leader);
		if (leader.entity) {
			var tooClose = null;
			for (var id in parent.entities) {
				var e = parent.entities[id];
				// A monster already on the tank or priest is not chasing us: stay in reach.
				if (e && e.type === "monster" && !e.dead && e.visible && e.target === character.name && distance(character, e) < CONFIG.MELEE_SAFE) { tooClose = e; break; }
			}
			if (tooClose) {
				if (kite_step(tooClose)) { setTimeout(movementLoop, 250); return; }
				var awayX = character.x + (character.x - tooClose.x), awayY = character.y + (character.y - tooClose.y);
				if (can_move_to(awayX, awayY)) { move(awayX, awayY); setTimeout(movementLoop, 250); return; }
			}
			var target = cache.target;
			var outOfReach = target && !is_in_range(target, "attack");
			if (dist > CONFIG.FOLLOW_RANGE || dist < CONFIG.MIN_RANGE || outOfReach) {
				var hold = typeof RuntimePolicy !== "undefined" && RuntimePolicy.teamHold && RuntimePolicy.teamHold();
				var pocket = get_shoot_pocket(leader.entity, hold ? null : target);
				if (pocket) {
					if (can_move_to(pocket.x, pocket.y)) move(pocket.x, pocket.y);
					else await smart_move(pocket);
				}
			}
		} else if (dist > CONFIG.FOLLOW_RANGE) {
			set_message("rejoindre tank");
			await smart_move({ map: leader.map, x: leader.x, y: leader.y });
		}
	} catch (e) {}
	setTimeout(movementLoop, 250);
}

// ============================================================================
// 8. CHASSES DAISY
// ============================================================================
function hunt_info() {
	var h = character.s && character.s.monsterhunt;
	return h && h.id ? { id: h.id, c: h.c || 0, ms: h.ms || 0 } : null;
}

function near_daisy() { return character.map === "main" && distance(character, { x: 126, y: -413 }) < 350; }

async function huntLoop() {
	try {
		if (is_disabled(character) || character.rip || !CONFIG.hunts || !CONFIG.hunts.enabled) { setTimeout(huntLoop, 3000); return; }
		var myh = hunt_info();
		try { send_cm(CONFIG.PARTY, { t: "myhunt", id: myh ? myh.id : "", c: myh ? myh.c : 0, ms: myh ? myh.ms : 0, need: !myh || myh.c === 0 }); } catch (e) {}
		var needsHunt = !myh || myh.c === 0;
		if (state.huntInProgress) {
			if (myh && myh.c > 0) {
				state.huntInProgress = false;
				state.lastHuntTrip = Date.now();
				game_log("Contrat Daisy actif : " + myh.id + " (" + myh.c + ")", "#98c379");
			} else if (near_daisy()) {
				if (Date.now() - state.lastDaisyInteract > 4000) {
					state.lastDaisyInteract = Date.now();
					try {
						if (typeof parent !== "undefined" && parent.socket) {
							parent.socket.emit("monsterhunt");
							await sleep_ms(600);
							var nh = hunt_info();
							if (!nh || nh.c === 0) { parent.socket.emit("monsterhunt"); await sleep_ms(400); }
						}
						var finalH = hunt_info();
						if (finalH && finalH.c > 0) { state.huntInProgress = false; state.lastHuntTrip = Date.now(); }
					} catch (e) {}
				}
			} else if (!smart.moving) {
				set_message("Go Daisy");
				await smart_move({ map: "main", x: 126, y: -413 });
			}
		} else if (needsHunt && !state.dumpInProgress && Date.now() - state.lastHuntTrip > 30000) {
			state.huntInProgress = true;
			if (smart.moving) stop();
			await smart_move({ map: "main", x: 126, y: -413 });
		}
	} catch (e) {}
	setTimeout(huntLoop, 3500);
}

// ============================================================================
// 9. EQUIPEMENT (loadouts et consommables du dashboard)
// ============================================================================
async function equipmentLoop() {
	try {
		if (!is_disabled(character) && !character.rip) {
			if (typeof wear_dashboard_kit === "function") await wear_dashboard_kit();
			if (typeof StyleLoadout !== "undefined") await StyleLoadout.equip();
			if (typeof use_dashboard_consumables === "function") await use_dashboard_consumables();
		}
	} catch (e) {}
	setTimeout(equipmentLoop, 3000);
}

// ============================================================================
// 10. SURVIE & POTIONS
// ============================================================================
async function potionLoop() {
	var delay = 200;
	try {
		if (character.rip) {
			try { respawn(); } catch (e) {}
			setTimeout(potionLoop, 2000);
			return;
		}
		var cfg = CONFIG.potions;
		if (character.hp / character.max_hp <= cfg.hpThreshold && !is_on_cooldown("use_hp")) {
			try { await use_skill("use_hp"); if (typeof ActionTiming !== "undefined") delay = ActionTiming.after("use_hp", 200, 40); } catch (e) {}
		} else if ((character.mp || 0) / (character.max_mp || 1) <= cfg.mpThreshold && !is_on_cooldown("use_mp")) {
			try { await use_skill("use_mp"); if (typeof ActionTiming !== "undefined") delay = ActionTiming.after("use_mp", 200, 40); } catch (e) {}
		}
		request_supply();
	} catch (e) {}
	setTimeout(potionLoop, delay);
}

// ============================================================================
// 11. VIDAGE VERS LA MULE
// ============================================================================
function is_protected_item(item) {
	if (!item || item.l) return true;
	var name = item.name, rules = CONFIG.LOADOUT_ITEMS || [];
	for (var i = 0; i < rules.length; i++) if (rules[i].item === name && (item.level || 0) >= (rules[i].minLevel || 0)) return true;
	if (CONFIG.KEEP_ITEMS && CONFIG.KEEP_ITEMS.indexOf(name) >= 0) return true;
	if (/^(hpot|mpot|elixir)/.test(name)) return true;
	// Rogue kit: knifebelt (Fan of Knives) and Rogue gear above +0 stay with him.
	return name === "knifebelt" || name === "ecape" || name === "tracker" || Number(item.level || 0) > 0;
}

function dumpable_count() {
	return (character.items || []).filter(function (it) { return it && !is_protected_item(it); }).length;
}

function get_mule_target() {
	var mule = get_player(CONFIG.MERCHANT);
	if (mule) return { map: character.map, x: mule.x, y: mule.y };
	var party = typeof get_party === "function" ? get_party() : (typeof parent !== "undefined" ? parent.party : null);
	if (party && party[CONFIG.MERCHANT] && party[CONFIG.MERCHANT].map) return { map: party[CONFIG.MERCHANT].map, x: party[CONFIG.MERCHANT].x, y: party[CONFIG.MERCHANT].y };
	return { map: "main", x: -32, y: 12 };
}

async function dump_items_to_mule() {
	var mule = get_player(CONFIG.MERCHANT);
	if (!mule || distance(character, mule) > 280) return false;
	var items = character.items || [];
	for (var i = 0; i < items.length; i++) {
		if (items[i] && !is_protected_item(items[i])) {
			try { await send_item(CONFIG.MERCHANT, i, items[i].q || 1); await sleep_ms(150); } catch (e) {}
		}
	}
	if (character.gold > 60000) { try { await send_gold(CONFIG.MERCHANT, character.gold - 50000); } catch (e) {} }
	return true;
}

async function dumpLoop() {
	try {
		if (!is_disabled(character) && !character.rip) {
			var mule = get_player(CONFIG.MERCHANT), free = character.esize || 0, limit = CONFIG.inventory.dumpEsize || 4;
			var eventLive = typeof EventRouter !== "undefined" && EventRouter.activeMonster && !!EventRouter.activeMonster();
			var needDump = free <= (eventLive ? 0 : limit) && dumpable_count() > 0;
			if (mule && distance(character, mule) <= 250 && dumpable_count() > 0) await dump_items_to_mule();
			if (state.dumpInProgress) {
				if (free > limit && dumpable_count() === 0) { state.dumpInProgress = false; state.lastDumpTrip = Date.now(); }
				else if (mule && distance(character, mule) <= 250) { await dump_items_to_mule(); state.dumpInProgress = false; state.lastDumpTrip = Date.now(); }
				else if (!smart.moving) { set_message("Go mule"); await smart_move(get_mule_target()); }
			} else if (needDump && Date.now() - state.lastDumpTrip > (CONFIG.inventory.dumpCooldownMs || 30000)) {
				state.dumpInProgress = true;
				if (smart.moving) stop();
				await smart_move(get_mule_target());
			}
		}
	} catch (e) {}
	setTimeout(dumpLoop, 3000);
}

// ============================================================================
// 12. COFFRES & DEMARRAGE
// ============================================================================
async function lootLoop() {
	try {
		var lcfg = CONFIG.loot || {};
		if (lcfg.enabled !== false && !is_disabled(character) && !character.rip && !state.dumpInProgress && !state.huntInProgress &&
			Date.now() - state.lastLoot >= (lcfg.intervalMs || 500)) {
			state.lastLoot = Date.now();
			loot();
			if (typeof parent !== "undefined" && parent.chests) {
				for (var cid in parent.chests) {
					var ch = parent.chests[cid];
					if (ch && (!ch.map || ch.map === character.map) && distance(character, ch) <= (lcfg.chestRange || 350)) loot(cid);
				}
			}
		}
	} catch (e) {}
	setTimeout(lootLoop, 250);
}

combatLoop();
supportLoop();
movementLoop();
huntLoop();
equipmentLoop();
potionLoop();
dumpLoop();
lootLoop();

game_log("Dromas Rogue (groupe) v2 demarre", "#78C13F");
