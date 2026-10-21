/**
 * ============================================================================
 * DROMA — CRAB AOE RANGER V2
 * ============================================================================
 *
 * Rôle principal :
 *   - Farmer les crabs de la plage de manière autonome.
 *   - Utiliser 3-Shot, puis 5-Shot dès que le niveau le permet, sur 2 à 5 crabs.
 *   - Ignorer les crabs déjà engagés par un autre joueur.
 *   - Conserver une distance de tir sûre et revenir au centre du spawn si nécessaire.
 *   - Ne touche JAMAIS aux armes en mainhand (l'arc actuellement équipé reste l'arc en main).
 *   - Gère intelligemment son carquois en main gauche (Alloy Quiver sur les packs AoE, carquois amélioré en mono).
 *   - Protège uniquement les équipements portés et les carquois améliorés (> +0), le reste en +0 va à la mule.
 *   - Marque du chasseur (Huntersmark) sur les monstres résistants (PV >= 3000).
 *   - Tir de précision (Supershot) sur une cible isolée si le multishot n'est pas rentable.
 *   - Boit automatiquement l'élixir de dextérité (elixirdex0 / elixirdex1).
 *   - Vidage d'inventaire vers EadroSell, puis retour automatique à la plage.
 *   - Télémétrie, loadouts, kit, consommables et ravitaillement du dashboard v2.
 *
 * Sommaire des sections :
 *   1. CONFIGURATION            — Paramètres du Rôdeur
 *   2. INTERFACE COMMAND CENTER — Intégration Dashboard & Synchronisation
 *   3. GESTION DU GROUPE & CM   — Communication radio, invitations, suivi
 *   4. CACHE TACTIQUE           — Sélection sûre des crabs du spawn
 *   5. COMBAT & ROTATION DPS    — Huntersmark, 5-Shot, 3-Shot, Supershot, Attack
 *   6. SOUTIEN                  — Energize sur les alliés magiques / tank
 *   7. SUIVI DU GUERRIER        — Positionnement en retrait ("Shoot Pocket") & Anti-mêlée
 *   8. CHASSES DAISY            — Monster Hunter et validation de contrat
 *   9. ÉQUIPEMENT & CARQUOIS    — Gestion de l'offhand (Alloy vs Carquois) & élixir DEX
 *  10. SURVIE & POTIONS         — Potions d'urgence HP/MP
 *  11. DUMP VERS LA MULE        — Vidage d'inventaire vers EadroSell
 *  12. DÉMARRAGE DES BOUCLES    — Lancement des routines indépendantes
 * ============================================================================
 */

// GUI externe dans le navigateur (DPS / XP / stats)
if (typeof parent !== "undefined" && parent.$) {
	load_code("gui", function () { game_log("gui slot missing"); });
}

// ============================================================================
// 1. CONFIGURATION
// ============================================================================
var CONFIG = {
	// --- Personnages & Rôles ---
	NAME: "Droma",
	WARRIOR: "Eadroma",
	PRIEST: "Aedroma",
	MERCHANT: "EadroSell",
	PARTY: ["Eadroma", "Aedroma"],
	PARTY_GUESTS: ["EadroSell"],
	DEFAULT_FARM: "crab",
	FARM_INDEPENDENT: true,
	FIXED_FARM: true,
	DAILY_DUNGEON: false,
	RARE_VISITS: false,
	crabFarm: {
		map: "main",
		// Preferred crab farming anchor, captured from Droma's live position.
		x: -1195.61,
		y: -64.12,
		radius: 235,
		returnDistance: 190,
		maxTargets: 5,
		lowHpMaxTargets: 2,
		lowHpRatio: 0.55
	},

	// --- Positionnement & Suivi (Shoot Pocket) ---
	FOLLOW_RANGE: 170,             // Distance max de suivi du guerrier (portée archer)
	MIN_RANGE: 90,                 // Ne pas se coller au guerrier (zone de mêlée)
	ANCHOR: 120,                   // Distance idéale de tir en retrait
	MELEE_SAFE: 55,                // Distance de recul face aux monstres au contact
	kiting: {
		enabled: true,             // Kiting angulaire (FreezePhoenix avoidMobs / Crowns3bc rangedKiting)
		optimalDistance: 170,      // Distance ideale de tir (portee archer)
		sampleAngles: 8,           // 8 echantillons (45 degres) — leger, suffisant en farm
		bossAngles: 12,            // 12 echantillons sur les boss
		stepDistance: 40,          // Longueur du pas de kite (px)
		repositionThreshold: 20,   // Ne bouge que si le gain est significatif
	},
	bossLuckHp: {               // Seuils HP par boss pour le switch Luck (Crowns3bc)
		dragold: 200000,
		franky: 80000,
		tiger: 60000,
		greenjr: 150000,
		jr: 120000,
		default: 100000
	},

	// --- Compétences & Tirs Spéciaux ---
	skills: {
		huntersmarkEnabled: true,  // Marque du chasseur pour booster les dégâts de l'équipe
		huntersmarkMinHp: 3000,    // PV minimum pour rentabiliser la marque
		multishotEnabled: true,    // 5-Shot et 3-Shot sur les packs
		multishotMinMp: 260,       // Réserve de MP minimale pour multishot
		mpReserve: 240,            // Garde assez de mana pour la rotation suivante
		mpHysteresisUpper: 420,    // Reprend les tirs spéciaux après un vrai refill
		supershotEnabled: true,    // Tir puissant longue portée
		supershotMinHp: 4000,      // PV minimum pour Supershot
		supershotMinMp: 150,
		energizeEnabled: true      // Donner du mana aux alliés
	},

	// --- Gestion du Carquois & Élixirs ---
	offhand: {
		manageQuiver: true,        // Gérer le carquois selon la situation (pack vs mono)
		alloyQuiverName: "alloyquiver",
		defaultQuiverName: "quiver"
	},
	AUTO_ELIXIR: "elixirdex0",     // Élixir de dextérité à maintenir actif

	// --- Survie & Potions ---
	potions: {
		hpThreshold: 0.35,         // Boire potion HP sous 35% PV
		mpThreshold: 0.55,         // Le multishot dépend directement de la mana
		hpot: "hpot1",
		mpot: "mpot1",
		needH: 200,                // Seuil need_h du rapport potions (aligne avec marchand)
		needM: 300                 // Seuil need_m du rapport potions (aligne avec marchand)
	},

	// --- Chasses Daisy ---
	hunts: {
		enabled: false
	},

	// --- Ramassage des coffres (independant des chasses) ---
	// Avant, loot() n'etait appele que dans huntLoop(), donc jamais quand
	// CONFIG.hunts.enabled = false : les coffres du ranger expiraient.
	loot: {
		enabled: true,             // Activer le ramassage automatique des coffres
		intervalMs: 500,           // Intervalle entre deux scans de coffres (ms)
		chestRange: 350            // Portee de ramassage des coffres d'autres joueurs (px)
	},

	// --- Inventaire & Mule ---
	inventory: {
		dumpEsize: 4,              // Vider vers EadroSell si <= 4 slots libres
		dumpCooldownMs: 30000
	}
};

// ============================================================================
// 2. INTERFACE COMMAND CENTER (Dashboard & Synchronisation)
// ============================================================================
var BOARD_CTL = {
	leader: "Droma",
	monster: "crab",
	roles: { Eadroma: "Leader", Aedroma: "Follow", Droma: "Leader", EadroSell: "Follow" },
	events: { Eadroma: true, Aedroma: true, Droma: true, EadroSell: false }
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

var JOIN_EVENTS = [
	"crabxx", "goobrawl", "franky", "icegolem", "abtesting",
	"phoenix", "mrpumpkin", "mrgreen", "snowman",
	"grinch", "wabbit"
];

function server_status() {
	if (typeof server !== "undefined" && server && server.status) return server.status;
	if (typeof parent !== "undefined" && parent.S) return parent.S;
	return {};
}

function pick_live_event() {
	if (CONFIG.FIXED_FARM) return null;
	// Dashboard bundles use the profile switches; standalone CODE keeps its own events_enabled().
	if (typeof __ALCC !== "undefined" ? !__ALCC.eventsEnabled : !events_enabled()) return null;
	var S = server_status();
	if (!S || typeof S !== "object") return null;
	for (var i = 0; i < JOIN_EVENTS.length; i++) {
		var name = JOIN_EVENTS[i];
		if (typeof __ALCC !== "undefined" && __ALCC.events.indexOf(name) < 0) continue;
		var st = S[name];
		if (!st) continue;
		var isLive = st === true || st.live || (st.hp && st.hp > 0);
		if (isLive) {
			return { name: name, map: st.map, x: st.x, y: st.y };
		}
	}
	return null;
}

function my_role() {
	var ctl = live_control();
	return (ctl && ctl.roles && ctl.roles[character.name]) || "Follow";
}

function events_enabled() {
	var ctl = live_control();
	return !ctl || !ctl.events || ctl.events[character.name] !== false;
}

// ============================================================================
// 3. GESTION DU GROUPE, CM & REGROUPE
// ============================================================================
var ally_hunts = {};

function on_party_invite(name) {
	if (typeof CaveDreams !== "undefined" && CaveDreams.allowsPartyMember && !CaveDreams.allowsPartyMember(name)) return;
	var allowed = (CONFIG.PARTY || []).concat(CONFIG.PARTY_GUESTS || []);
	if (allowed.indexOf(name) >= 0) {
		accept_party_invite(name);
	}
}

function on_party_request(name) {
	if (typeof CaveDreams !== "undefined" && CaveDreams.allowsPartyMember && !CaveDreams.allowsPartyMember(name)) return;
	var allowed = (CONFIG.PARTY || []).concat(CONFIG.PARTY_GUESTS || []);
	if (allowed.indexOf(name) >= 0) {
		accept_party_request(name);
	}
}

function on_cm(name, data) {
	if (typeof CaveDreams !== "undefined") CaveDreams.onCm(name, data);
	if (typeof WorldEventIntel !== "undefined") WorldEventIntel.onCm(name, data);
	if (typeof TeamCoordinator !== "undefined") TeamCoordinator.onCm(name, data);
	if (!data || typeof data !== "object") return;
	if (name === CONFIG.MERCHANT && data.t === "mux") report_potion_stock(name);

	if (data.t === "ctl") {
		apply_ctl(data.ctl);
	}

	// Contrat de chasse partagé
	if (data.t === "myhunt" && data.id) {
		ally_hunts[name] = {
			id: data.id,
			c: data.c || 0,
			ms: data.ms || 9999999,
			at: Date.now()
		};
	}
}

function potion_item_count(name) {
	var total = 0;
	var items = character.items || [];
	for (var i = 0; i < items.length; i++) if (items[i] && items[i].name === name) total += items[i].q || 1;
	return total;
}

function report_potion_stock(to) {
	var cfg = CONFIG.potions || {};
	try {
		send_cm(to, {
			t: "pots", hpot: potion_item_count(cfg.hpot || "hpot1"), mpot: potion_item_count(cfg.mpot || "mpot1"),
			map: character.map, x: Math.round((typeof character.real_x === "number") ? character.real_x : character.x), y: Math.round((typeof character.real_y === "number") ? character.real_y : character.y), gold: character.gold || 0,
			dump: dumpable_count(), coming: !!state.dumpInProgress,
			need_h: potion_item_count(cfg.hpot || "hpot1") < (cfg.needH || 200), need_m: potion_item_count(cfg.mpot || "mpot1") < (cfg.needM || 300)
		});
	} catch (e) {}
}

var last_supply_req = 0;

/**
 * Demande ACTIVEMENT du ravitaillement au marchand (protocole "supply"
 * d'albot-js) au lieu d'attendre le prochain ping mux (jusqu'a 8s de latence).
 * Les seuils cfg.needH / cfg.needM sont partages avec le rapport mux.
 */
function request_supply(force) {
	var cfg = CONFIG.potions || {};
	var hp = potion_item_count(cfg.hpot || "hpot1");
	var mp = potion_item_count(cfg.mpot || "mpot1");
	var need_h = hp < (cfg.needH || 200);
	var need_m = mp < (cfg.needM || 300);
	if (!need_h && !need_m && !force) return;
	if (!force && Date.now() - last_supply_req < 30000) return;
	last_supply_req = Date.now();
	try {
		send_cm(CONFIG.MERCHANT, {
			t: "supply", need_h: need_h, need_m: need_m, hpot: hp, mpot: mp,
			map: character.map, x: Math.round((typeof character.real_x === "number") ? character.real_x : character.x), y: Math.round((typeof character.real_y === "number") ? character.real_y : character.y)
		});
	} catch (e) {}
}

function sleep_ms(ms) {
	return new Promise(function(resolve) { setTimeout(resolve, ms); });
}

// Hysteresis MP anti-yoyo (Crowns3bc) : les tirs speciaux sont suspendus quand la
// mana chute sous mpReserve, repris au-dessus de mpHysteresisUpper — l'attaque
// de base (1 MP) et les potions restent toujours possibles.
var mp_spend_locked = false;

function mp_spend_ok(extraCost) {
	var skills = CONFIG.skills || {};
	var mp = character.mp || 0;
	var reserve = skills.mpReserve || 0;
	var upper = skills.mpHysteresisUpper || reserve;
	if (mp_spend_locked) {
		if (mp >= upper) mp_spend_locked = false;
		else return false;
	} else if (mp < reserve) {
		mp_spend_locked = true;
		return false;
	}
	if (extraCost && mp < reserve + extraCost) return false;
	return true;
}

// Kiting angulaire (FreezePhoenix avoidMobs / Crowns3bc rangedKiting) :
// echantillonne N directions autour du personnage (real_x/real_y interpoles),
// privilegie la distance optimale de tir et les cases marchables.
function kite_step(harasser) {
	var k = CONFIG.kiting || {};
	if (!k.enabled || !harasser) return false;
	var cx = (typeof character.real_x === "number") ? character.real_x : character.x;
	var cy = (typeof character.real_y === "number") ? character.real_y : character.y;
	var optimal = k.optimalDistance || 170;
	var step = k.stepDistance || 40;
	var samples = (harasser.max_hp >= 60000) ? (k.bossAngles || 12) : (k.sampleAngles || 8);
	var threshold = k.repositionThreshold || 20;

	var best = null, bestScore = -1e9;
	for (var i = 0; i < samples; i++) {
		var a = (i / samples) * Math.PI * 2;
		var nx = Math.round(cx + step * Math.cos(a));
		var ny = Math.round(cy + step * Math.sin(a));
		if (typeof can_move_to !== "function" || !can_move_to(nx, ny)) continue;
		var d = Math.hypot(nx - harasser.x, ny - harasser.y);
		var score = -Math.abs(d - optimal);
		if (d > distance(character, harasser)) score += 15;
		if (score > bestScore) { bestScore = score; best = { x: nx, y: ny }; }
	}
	if (!best) return false;
	var curD = distance(character, harasser);
	var newD = Math.hypot(best.x - harasser.x, best.y - harasser.y);
	if (Math.abs(newD - optimal) > Math.abs(curD - optimal) - threshold && newD <= curD) return false;
	move(best.x, best.y);
	return true;
}

function boss_luck_threshold(target) {
	var table = CONFIG.bossLuckHp || {};
	if (!target) return table.default || 100000;
	if (target.mtype && table[target.mtype] != null) return table[target.mtype];
	return table.default || 100000;
}

// ============================================================================
// 4. CACHE TACTIQUE & CIBLAGE SÉCURISÉ
// ============================================================================
var state = {
	dumpInProgress: false,
	dumpFailures: 0,
	lastDumpTrip: 0,
	huntInProgress: false,
	lastHuntTrip: 0,
	lastDaisyInteract: 0,
	lastLoot: 0
};

var cache = {
	lastUpdate: 0,
	warrior: null,
	priest: null,
	merchant: null,
	target: null,
	aoeTargets: [] // Crabs disponibles, jamais ceux déjà pris par un autre joueur
};

function in_crab_farm(entity) {
	var farm = CONFIG.crabFarm;
	return !!entity && character.map === farm.map && (!entity.map || entity.map === farm.map) && Math.hypot(entity.x - farm.x, entity.y - farm.y) <= farm.radius;
}

function crab_is_available(entity) {
	if (!entity || entity.type !== "monster" || entity.dead || entity.rip || !entity.visible) return false;
	if (typeof EventRouter !== "undefined" && EventRouter.activeMonster && EventRouter.activeMonster()) {
		return EventRouter.accepts(entity) && EventRouter.canEngage(entity);
	}
	if (entity.mtype !== CONFIG.DEFAULT_FARM || !in_crab_farm(entity)) return false;
	// Ne pas voler la cible d'un autre joueur. Une cible libre ou déjà sur Droma est sûre.
	return !entity.target || entity.target === character.name;
}

function updateCache() {
	var now = Date.now();
	if (now - cache.lastUpdate < 50) return;
	cache.lastUpdate = now;

	cache.warrior = get_player(CONFIG.WARRIOR);
	cache.priest = get_player(CONFIG.PRIEST);
	cache.merchant = get_player(CONFIG.MERCHANT);
	cache.target = null;
	cache.aoeTargets = [];

	for (var id in parent.entities) {
		var e = parent.entities[id];
		if (crab_is_available(e)) cache.aoeTargets.push(e);
	}

	cache.aoeTargets.sort(function(a, b) {
		var aSelf = a.target === character.name ? 0 : 1;
		var bSelf = b.target === character.name ? 0 : 1;
		if (aSelf !== bSelf) return aSelf - bSelf;
		if ((a.hp || 0) !== (b.hp || 0)) return (a.hp || 0) - (b.hp || 0);
		return distance(character, a) - distance(character, b);
	});

	var ratio = character.max_hp ? character.hp / character.max_hp : 1;
	var cap = ratio <= CONFIG.crabFarm.lowHpRatio ? CONFIG.crabFarm.lowHpMaxTargets : CONFIG.crabFarm.maxTargets;
	cache.aoeTargets = cache.aoeTargets.slice(0, cap);
	cache.target = cache.aoeTargets.length ? cache.aoeTargets[0] : null;
}

// ============================================================================
// 5. COMBAT & ROTATION DPS (Huntersmark, Multishot, Supershot, Attack)
// ============================================================================
async function combatLoop() {
	var combatDelay = 80;
	try {
		if (is_disabled(character) || character.rip || state.dumpInProgress) {
			setTimeout(combatLoop, 300);
			return;
		}
		if (typeof CaveDreams !== "undefined" && CaveDreams.inCave()) {
			setTimeout(combatLoop, 200);
			return;
		}

		updateCache();
		var target = cache.target;
		var skills = CONFIG.skills;

		if (!target || !is_in_range(target, "attack") || (typeof EventRouter !== "undefined" && EventRouter.canEngage && !EventRouter.canEngage(target))) {
			setTimeout(combatLoop, 150);
			return;
		}

		// 1. Marque du Chasseur (Huntersmark)
		if (skills.huntersmarkEnabled && (typeof StyleLoadout === "undefined" || StyleLoadout.allows("huntersmark")) && !is_on_cooldown("huntersmark") && character.mp >= 240) {
			var isMarkWorthy = target.max_hp >= skills.huntersmarkMinHp;
			var notMarked = !target.s || !target.s.marked;
			if (isMarkWorthy && notMarked) {
				try {
					await (typeof ActionTiming !== "undefined" && ActionTiming.wait ? ActionTiming.wait(use_skill("huntersmark", target), 400) : use_skill("huntersmark", target));
					setTimeout(combatLoop, 150);
					return;
				} catch(e) {}
			}
		}

		// 2. Tirs multiples. L'API du jeu attend les IDs des cibles, pas les objets.
		if (skills.multishotEnabled && character.mp >= skills.multishotMinMp && mp_spend_ok(0)) {
			var validTargets = [];
			for (var i = 0; i < cache.aoeTargets.length; i++) {
				var mob = cache.aoeTargets[i];
				if (is_in_range(mob, "attack") && !(typeof EventRouter !== "undefined" && EventRouter.canEngage && !EventRouter.canEngage(mob))) {
					validTargets.push(mob);
				}
			}

			// 5-Shot à partir de quatre cibles ; 3-Shot à partir de deux.
			if (character.level >= 75 && character.mp >= 320 && validTargets.length >= 4 && (typeof StyleLoadout === "undefined" || StyleLoadout.allows("5shot")) && !is_on_cooldown("5shot") && G.skills["5shot"]) {
				try {
					await use_skill("5shot", validTargets.slice(0, 5).map(function(mob) { return mob.id; }));
					setTimeout(combatLoop, 200);
					return;
				} catch(e) {}
			}

			if (character.level >= 60 && character.mp >= 200 && validTargets.length >= 2 && (typeof StyleLoadout === "undefined" || StyleLoadout.allows("3shot")) && !is_on_cooldown("3shot") && G.skills["3shot"]) {
				try {
					await use_skill("3shot", validTargets.slice(0, 3).map(function(mob) { return mob.id; }));
					setTimeout(combatLoop, 200);
					return;
				} catch(e) {}
			}
		}

		// 3. Tir de Précision (Supershot) sur grosse cible
		if (typeof StyleLoadout !== "undefined" && StyleLoadout.selected("poisonarrow") && !is_on_cooldown("poisonarrow") && character.mp >= 360 && target.max_hp >= skills.supershotMinHp && (!target.s || !target.s.poisoned) && find_item("poison") >= 0 && is_in_range(target, "poisonarrow")) {
			try {
				await (typeof ActionTiming !== "undefined" && ActionTiming.wait ? ActionTiming.wait(use_skill("poisonarrow", target), 400) : use_skill("poisonarrow", target));
				setTimeout(combatLoop, 200);
				return;
			} catch(e) {}
		}

		// 4. Tir de Précision (Supershot) sur grosse cible
		if (skills.supershotEnabled && (typeof StyleLoadout === "undefined" || StyleLoadout.allows("supershot")) && !is_on_cooldown("supershot") && character.mp >= skills.supershotMinMp) {
			if (target.max_hp >= skills.supershotMinHp && is_in_range(target, "supershot")) {
				try {
					await (typeof ActionTiming !== "undefined" && ActionTiming.wait ? ActionTiming.wait(use_skill("supershot", target), 400) : use_skill("supershot", target));
					setTimeout(combatLoop, 200);
					return;
				} catch(e) {}
			}
		}

		// 5. Attaque de base
		if (can_attack(target) && !is_on_cooldown("attack")) {
			try {
				await (typeof ActionTiming !== "undefined" && ActionTiming.wait ? ActionTiming.wait(attack(target), 1500) : attack(target));
				if (typeof ActionTiming !== "undefined") combatDelay = ActionTiming.next("attack", 80, 20);
			} catch(e) {}
		}

	} catch(e) {}

	setTimeout(combatLoop, combatDelay);
}

// ============================================================================
// 6. SOUTIEN — Energize
// ============================================================================
async function supportLoop() {
	try {
		if (is_disabled(character) || character.rip) {
			setTimeout(supportLoop, 1000);
			return;
		}

		if (CONFIG.skills.energizeEnabled && (typeof StyleLoadout === "undefined" || StyleLoadout.allows("energize")) && !is_on_cooldown("energize") && character.mp >= 100) {
			var priest = cache.priest || get_player(CONFIG.PRIEST);
			var warrior = cache.warrior || get_player(CONFIG.WARRIOR);

			// Priorité au prêtre s'il lui manque du mana
			var recipient = null;
			if (priest && priest.max_mp && (priest.mp / priest.max_mp) < 0.65 && is_in_range(priest, "energize")) {
				recipient = priest;
			} else if (warrior && warrior.max_mp && (warrior.mp / warrior.max_mp) < 0.40 && is_in_range(warrior, "energize")) {
				recipient = warrior;
			}

			if (recipient) {
				try {
					await use_skill("energize", recipient);
				} catch(e) {}
			}
		}

	} catch(e) {}

	setTimeout(supportLoop, 1000);
}

// ============================================================================
// 7. NAVIGATION AUTONOME VERS LA PLAGE DES CRABS
// ============================================================================
var travel_dest_map = "";

async function movementLoop() {
	try {
		if (is_disabled(character) || character.rip) {
			setTimeout(movementLoop, 300);
			return;
		}

		// Le voyage vers EadroSell possède la navigation tant qu'il est actif.
		if (state.dumpInProgress || state.huntInProgress) {
			setTimeout(movementLoop, 500);
			return;
		}

		// Le farm fixe ne désactive pas les événements explicitement autorisés.
		if (typeof EventRouter !== "undefined" && await EventRouter.tick()) {
			setTimeout(movementLoop, 300);
			return;
		}

		// Cave Dreams prend la main avant le retour automatique vers la plage.
		// Sans ce tick, le module était bien injecté mais ce script de farm fixe
		// continuait indéfiniment à rejoindre les crabs pendant que l'équipe
		// l'attendait devant Dorr.
		if (typeof CaveDreams !== "undefined" && await CaveDreams.tick("follow")) {
			setTimeout(movementLoop, 300);
			return;
		}

		updateCache();
		var farm = CONFIG.crabFarm;
		var fromCenter = character.map === farm.map ? Math.hypot(character.x - farm.x, character.y - farm.y) : Infinity;
		if (character.map !== farm.map || fromCenter > farm.returnDistance) {
			if (!smart.moving) {
				set_message("crab beach");
				travel_dest_map = farm.map;
				await smart_move({ map: farm.map, x: farm.x, y: farm.y });
				travel_dest_map = "";
			}
			setTimeout(movementLoop, 300);
			return;
		}

		travel_dest_map = "";
		if (smart.moving) {
			setTimeout(movementLoop, 200);
			return;
		}

		// Sortir immédiatement de la mêlée, tout en restant dans la zone de spawn.
		var tooCloseMob = null;
		for (var id in parent.entities) {
			var e = parent.entities[id];
			if (crab_is_available(e) && e.target === character.name && distance(character, e) < CONFIG.MELEE_SAFE) {
				tooCloseMob = e;
				break;
			}
		}
		if (tooCloseMob && kite_step(tooCloseMob)) {
			setTimeout(movementLoop, 220);
			return;
		}

		// Les crabs du rectangle sont normalement à portée depuis le centre. Si une
		// cible dérive, avancer seulement jusqu'à la portée de tir, jamais au contact.
		var target = cache.target;
		if (target && !is_in_range(target, "attack")) {
			var dx = character.x - target.x;
			var dy = character.y - target.y;
			var len = Math.hypot(dx, dy) || 1;
			var desired = Math.max(CONFIG.ANCHOR, (character.range || 160) * 0.72);
			var px = Math.round(target.x + dx / len * desired);
			var py = Math.round(target.y + dy / len * desired);
			if (Math.hypot(px - farm.x, py - farm.y) <= farm.radius && can_move_to(px, py)) move(px, py);
		}

	} catch(e) {}

	setTimeout(movementLoop, 250);
}

// ============================================================================
// 8. CHASSES DAISY (Monster Hunter System)
// ============================================================================
function hunt_info() {
	var h = character.s && character.s.monsterhunt;
	if (!h || !h.id) return null;
	return { id: h.id, c: h.c || 0, ms: h.ms || 0 };
}

function near_daisy() {
	if (character.map !== "main") return false;
	return distance(character, { x: 126, y: -413 }) < 350;
}

async function huntLoop() {
	try {
		if (is_disabled(character) || character.rip) {
			setTimeout(huntLoop, 3000);
			return;
		}
		if (!CONFIG.hunts || !CONFIG.hunts.enabled) {
			setTimeout(huntLoop, 3000);
			return;
		}

		// 1. Ramassage automatique des coffres (loots perso + coffres au sol d'autres joueurs)
		try {
			loot();
			if (typeof parent !== "undefined" && parent.chests) {
				for (var cid in parent.chests) {
					var ch = parent.chests[cid];
					if (!ch) continue;
					if (ch.map && ch.map !== character.map) continue;
					if (distance(character, ch) <= 350) {
						loot(cid);
					}
				}
			}
		} catch(e) {}

		// 2. Diffusion de notre contrat actuel aux membres du groupe
		var myh = hunt_info();
		try {
			send_cm(CONFIG.PARTY, {
				t: "myhunt",
				id: myh ? myh.id : "",
				c: myh ? myh.c : 0,
				ms: myh ? myh.ms : 0,
				need: !myh || myh.c === 0
			});
		} catch(e) {}

		// 3. Gestion autonome de prise / rendu de contrat chez Daisy
		var turnin = myh && myh.c === 0;
		var needsHunt = !myh || turnin;

		if (state.huntInProgress) {
			// Si on a récupéré un contrat valide en cours, voyage terminé !
			if (myh && myh.c > 0) {
				state.huntInProgress = false;
				state.lastHuntTrip = Date.now();
				game_log("Contrat Daisy actif : " + myh.id + " (" + myh.c + " restant) ! Retour au farm.", "#98c379");
			} else if (near_daisy()) {
				if (Date.now() - state.lastDaisyInteract > 4000) {
					state.lastDaisyInteract = Date.now();
					try {
						var res = null;
						if (typeof interact === "function") {
							res = await interact("monsterhunt", 3000);
							if (res && res.completed) {
								game_log("Hunt rendu ! Token reçu.", "#98c379");
								await sleep_ms(400);
								res = await interact("monsterhunt", 3000);
							}
						}
						if (typeof parent !== "undefined" && parent.socket) {
							parent.socket.emit("monsterhunt");
							await sleep_ms(600);
							var nh = hunt_info();
							if (!nh || nh.c === 0) {
								parent.socket.emit("monsterhunt");
								await sleep_ms(400);
							}
						}
						var finalH = hunt_info();
						if (finalH && finalH.c > 0) {
							game_log("Nouveau contrat Daisy : " + finalH.id + " x" + finalH.c, "#98c379");
							state.huntInProgress = false;
							state.lastHuntTrip = Date.now();
						}
					} catch(e) {}
				}
			} else if (!smart.moving) {
				set_message("Go Daisy");
				await smart_move({ map: "main", x: 126, y: -413 });
			}
		} else if (needsHunt && !state.dumpInProgress) {
			var cooldown = 30000;
			if (Date.now() - state.lastHuntTrip > cooldown) {
				state.huntInProgress = true;
				game_log("Départ vers Daisy pour contrat de chasse...", "#61afef");
				if (smart.moving) stop();
				await smart_move({ map: "main", x: 126, y: -413 });
			}
		}

	} catch(e) {}

	setTimeout(huntLoop, 3500);
}

// ============================================================================
// 9. GESTION DES CARQUOIS (Offhand Dynamique) & ÉLIXIRS
// ============================================================================
function find_item(name, minLevel) {
	var items = character.items || [];
	for (var i = 0; i < items.length; i++) {
		if (items[i] && items[i].name === name) {
			if (minLevel != null && (items[i].level || 0) < minLevel) continue;
			return i;
		}
	}
	return -1;
}

async function manage_offhand_quiver() {
	if (!CONFIG.offhand.manageQuiver) return;

	var currentOffhand = character.slots && character.slots.offhand && character.slots.offhand.name;
	var isAoE = cache.aoeTargets.length >= 2;
	var desiredQuiver = isAoE ? CONFIG.offhand.alloyQuiverName : CONFIG.offhand.defaultQuiverName;

	if (currentOffhand !== desiredQuiver) {
		var slot = find_item(desiredQuiver);
		if (slot >= 0) {
			// equip_batch (Crowns3bc) : un seul aller-retour serveur pour le swap
			// d'offhand, au lieu d'equip() qui laisse une fenetre de desync.
			try {
				if (typeof parent !== "undefined" && parent.socket && typeof character !== "undefined") {
					parent.socket.emit("equip_batch", [{ num: slot, slot: "offhand" }]);
					await parent.push_deferred("equip_batch");
				} else {
					await equip(slot, "offhand");
				}
			} catch(e) {
				// Repli sur equip() si push_deferred n'est pas disponible.
				try { await equip(slot, "offhand"); } catch(e2) {}
			}
		}
	}
}

async function auto_drink_elixir() {
	// A dashboard rule is authoritative. Drinking the class default here would
	// immediately replace Liquid Luck (or any other configured elixir).
	if (typeof dashboard_elixir_rule === "function" && dashboard_elixir_rule()) return;
	if (!CONFIG.AUTO_ELIXIR) return;
	var s = character.s || {};
	var hasElixir = s.elixir || s.elixirdex0 || s.elixirdex1 || s.elixirdex2;
	if (hasElixir) return;

	var slot = find_item(CONFIG.AUTO_ELIXIR);
	if (slot >= 0) {
		try {
			await use(slot);
			game_log("Elixir DEX bu : " + CONFIG.AUTO_ELIXIR, "#469ECF");
		} catch(e) {}
	}
}

async function equipmentLoop() {
	try {
		if (is_disabled(character) || character.rip) {
			setTimeout(equipmentLoop, 3000);
			return;
		}

		if (typeof StyleLoadout === "undefined" || !StyleLoadout.hasSlot("offhand")) await manage_offhand_quiver();
		if (typeof wear_dashboard_kit === "function") await wear_dashboard_kit();
		if (typeof StyleLoadout !== "undefined") await StyleLoadout.equip();
		if (typeof use_dashboard_consumables === "function") await use_dashboard_consumables();
		await auto_drink_elixir();

	} catch(e) {}

	setTimeout(equipmentLoop, 3000);
}

// ============================================================================
// 10. SURVIE & POTIONS
// ============================================================================
async function potionLoop() {
	var potionDelay = 200;
	try {
		if (character.rip) {
			try { respawn(); } catch(e) {}
			setTimeout(potionLoop, 2000);
			return;
		}

		var hpRatio = character.hp / character.max_hp;
		var mp = character.mp || 0;
		var maxMp = character.max_mp || 1;
		var cfg = CONFIG.potions;

		// La mana passe en premier : sans elle l'archer perd toute sa rotation AoE.
		if ((mp / maxMp) <= cfg.mpThreshold && !is_on_cooldown("use_mp")) {
			try { await use_skill("use_mp"); if (typeof ActionTiming !== "undefined") potionDelay = ActionTiming.after("use_mp", 200, 40); } catch(e) {}
		}

		if (hpRatio <= cfg.hpThreshold && !is_on_cooldown("use_hp")) {
			try { await use_skill("use_hp"); if (typeof ActionTiming !== "undefined") potionDelay = ActionTiming.after("use_hp", 200, 40); } catch(e) {}
		}

		// Signale activement un manque au marchand (protocole "supply" d'albot-js).
		if (Math.floor(Date.now() / 10000) !== state.lastSupplyTick) {
			state.lastSupplyTick = Math.floor(Date.now() / 10000);
			request_supply();
		}

	} catch(e) {}

	setTimeout(potionLoop, potionDelay);
}

// ============================================================================
// 11. VIDAGE D'INVENTAIRE VERS LA MULE (Dump to EadroSell)
// ============================================================================
function is_protected_item(item) {
	if (!item || item.l) return true; // Objet verrouille = protege
	var name = item.name;
	var loadoutItems = CONFIG.LOADOUT_ITEMS || [];
	for (var li = 0; li < loadoutItems.length; li++) {
		if (loadoutItems[li].item === name && (item.level || 0) >= (loadoutItems[li].minLevel || 0)) return true;
	}
	if (CONFIG.KEEP_ITEMS && CONFIG.KEEP_ITEMS.indexOf(name) >= 0) return true;

	// Potions et consommables essentiels
	if (name.startsWith("hpot") || name.startsWith("mpot")) return true;
	if (name.startsWith("elixir")) return true;

	// Carquois : Proteger uniquement les carquois equipables ameliores (> +0) ou alloyquiver
	if (name === "alloyquiver") return true;
	if (name === "quiver" && (item.level || 0) > 0) return true;

	// Objets specifiques ou jetons
	if (name === "ecape" || name === "tracker") return true;

	// Tout le reste en +0 (doublons de carquois +0, armures, arcs superflus) peut etre donne
	return false;
}

function dumpable_count() {
	var count = 0;
	var items = character.items || [];
	for (var i = 0; i < items.length; i++) {
		if (items[i] && !is_protected_item(items[i])) count++;
	}
	return count;
}

function get_mule_target() {
	var mule = get_player(CONFIG.MERCHANT);
	if (mule) return { map: character.map, x: mule.x, y: mule.y };

	var party = (typeof get_party === "function") ? get_party() : (typeof parent !== "undefined" ? parent.party : null);
	if (party && party[CONFIG.MERCHANT] && party[CONFIG.MERCHANT].map) {
		var mem = party[CONFIG.MERCHANT];
		return { map: mem.map, x: mem.x, y: mem.y };
	}

	return { map: "main", x: -32, y: 12 };
}

async function dump_items_to_mule() {
	var muleName = CONFIG.MERCHANT;
	var mule = get_player(muleName);
	if (!mule || distance(character, mule) > 280) return false;

	var items = character.items || [];
	for (var i = 0; i < items.length; i++) {
		var it = items[i];
		if (it && !is_protected_item(it)) {
			try {
				await send_item(muleName, i, it.q || 1);
				await sleep_ms(150);
			} catch (e) {}
		}
	}

	// Transfert d'or si superieur a 60k
	if (character.gold > 60000) {
		try {
			await send_gold(muleName, character.gold - 50000);
		} catch(e) {}
	}

	return true;
}

async function dumpLoop() {
	try {
		if (is_disabled(character) || character.rip) {
			setTimeout(dumpLoop, 3000);
			return;
		}

		var muleTarget = get_mule_target();
		var mule = get_player(CONFIG.MERCHANT);
		var freeSlots = character.esize || 0;
		var dumpLimit = (CONFIG.inventory && CONFIG.inventory.dumpEsize) || 4;
		var needDump = (freeSlots <= dumpLimit && dumpable_count() > 0);

		// 1. Si la mule est a proximite immediate, vider directement les sacs
		if (mule && distance(character, mule) <= 250 && dumpable_count() > 0) {
			await dump_items_to_mule();
		}

		// 2. Gestion du voyage aller-retour vers la mule
		if (state.dumpInProgress) {
			if (dumpable_count() === 0) {
				state.dumpInProgress = false;
				state.dumpFailures = 0;
				state.lastDumpTrip = Date.now();
				game_log("Inventaire vide ! Retour au combat.", "#98c379");
			} else if (mule && distance(character, mule) <= 250) {
				await dump_items_to_mule();
				if (dumpable_count() === 0) {
					state.dumpInProgress = false;
					state.dumpFailures = 0;
					state.lastDumpTrip = Date.now();
				} else {
					state.dumpFailures++;
					if (state.dumpFailures >= 3) {
						state.dumpInProgress = false;
						state.lastDumpTrip = Date.now();
						game_log("Dump incomplet : nouvel essai dans 30s.", "#e5c07b");
					}
				}
			} else if (!smart.moving) {
				set_message("Go mule");
				await smart_move(muleTarget);
			}
		} else if (needDump) {
			var cooldown = (CONFIG.inventory && CONFIG.inventory.dumpCooldownMs) || 30000;
			if (Date.now() - state.lastDumpTrip > cooldown) {
				state.dumpInProgress = true;
				state.dumpFailures = 0;
				game_log("Inventaire plein (" + freeSlots + " slots) ! Depart vers " + CONFIG.MERCHANT + "...", "#e5c07b");
				report_potion_stock(CONFIG.MERCHANT);
				if (smart.moving) stop();
				await smart_move(muleTarget);
			}
		}

	} catch(e) {}

	setTimeout(dumpLoop, 3000);
}

// ============================================================================
// Ramassage autonome des coffres (independant des chasses Daisy)
// ============================================================================
// loot() n'etait appele qu'a l'interieur de huntLoop(), lui-meme coupe quand
// CONFIG.hunts.enabled = false. Les coffres du ranger expiraient donc sans
// etre ouverts. Cette boucle dediee ouvre les coffres personnels et ceux au
// sol d'autres joueurs (pattern albot-js / Crowns3bc : tout le monde loot).
async function lootLoop() {
	try {
		var lcfg = CONFIG.loot || {};
		if (lcfg.enabled !== false && !is_disabled(character) && !character.rip) {
			var now = Date.now();
			if (now - state.lastLoot >= (lcfg.intervalMs || 500)) {
				// Pas de loot pendant un voyage vers la mule ou Daisy : on est en transit.
				if (!state.dumpInProgress && !state.huntInProgress) {
					try {
						loot();
						var range = lcfg.chestRange || 350;
						if (typeof parent !== "undefined" && parent.chests) {
							for (var cid in parent.chests) {
								var ch = parent.chests[cid];
								if (!ch) continue;
								if (ch.map && ch.map !== character.map) continue;
								if (distance(character, ch) <= range) loot(cid);
							}
						}
					} catch(e) {}
				}
				state.lastLoot = now;
			}
		}
	} catch (e) {}
	setTimeout(lootLoop, 250);
}

// ============================================================================
// 12. DÉMARRAGE DES BOUCLES D'EXÉCUTION
// ============================================================================
combatLoop();
supportLoop();
movementLoop();
huntLoop();
equipmentLoop();
potionLoop();
dumpLoop();
lootLoop();

game_log("Droma Crab AoE v2 demarre — plage, multishot et mule actifs !", "#78C13F");
