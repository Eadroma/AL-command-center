/**
 * ============================================================================
 * EADROMA — GUERRIER (WARRIOR) V2 (Party Leader)
 * ============================================================================
 * 
 * Script simplifie, modulaire et hautement lisible pour guerrier dans Adventure Land.
 * Concu pour etre facilement modifiable et configurable par un humain,
 * tout en restant 100% compatible avec le Command Center (dashboard).
 *
 * Roles :
 * - Chef de groupe (Party Lead) : tanke, aggro les monstres et protege le groupe.
 * - Demarre automatiquement Aedroma (Pretre) et Droma (Ranger) via start_character.
 * - Swaps d'armes intelligents (Mono-cible / AoE) selon le monstre affronte.
 * - Gestion autonome des competences, potions, deplacements et evenements de boss.
 * ============================================================================
 */

// GUI externe dans le navigateur (DPS / XP / stats)
if (typeof parent !== "undefined" && parent.$) {
	load_code("gui", function () { game_log("gui slot missing"); });
}

// ============================================================================
// 1. CONFIGURATION — Modifiez vos preferences ici
// ============================================================================
var CONFIG = {
	// --- General & Roles ---
	NAME: "Eadroma",
	PRIEST: "Aedroma",
	RANGER: "Droma",
	MERCHANT: "EadroSell",
	PARTY: ["Aedroma", "Droma"],
	PARTY_GUESTS: ["EadroSell"],
	HOME: { region: "EU", name: "III" },
	DEFAULT_FARM: "stoneworm",
	FARM_INDEPENDENT: false,
	DAILY_DUNGEON: false,
	RARE_VISITS: true,

	// --- Slots pour start_character (gere par Command Center ou manuel) ---
	TEAM_SLOTS: {
		Aedroma: "CH_EiXQ8dHoXlqTOtyTH5IzbbafFAif9",
		Droma: "CH_TWNS1mcRp22XMAehvezNnJTPc2VBB"
	},

	// --- Chasses Daisy (Monster Hunter) ---
	hunts: {
		enabled: true,
		wipeTimeoutMs: 36 * 60 * 1000,
		maxWipes: 3
	},

	// --- Competences de Guerrier ---
	skills: {
		warcryEnabled: true,       // Buff de groupe (+attaque)
		chargeEnabled: true,       // Acceleration de vitesse
		tauntEnabled: true,        // Taunt les monstres qui attaquent les allies
		tauntCooldown: 3000,       // Intervalle minimum entre taunts (ms)
		cleaveEnabled: true,       // Attaque circulaire de zone
		cleaveMinMobs: 2,          // Nombre min de monstres pour lancer Cleave
		cleaveMinMp: 120,          // Reserve de MP necessaire pour Cleave
		stompEnabled: true,        // Stun de zone si l'equipe ou le guerrier est en danger
		stompPanicRatio: 0.35,     // Stomp si PV joueur/allie sous 35%
		agitateEnabled: true,      // Agitate AoE (necro) sur packs — gate par StyleLoadout
		agitateMinMobs: 2,         // Nombre min de monstres pour Agitate
		mpReserve: 300,            // Reserve MP : bloque warcry/charge/agitate sous ce seuil
		mpHysteresisUpper: 450,    // Reprise des depenses au-dessus de ce seuil (anti-yoyo)
		circleWalk: true,          // Orbite lente autour du pack pour clumper (Crowns3bc)
		circleRadius: 35,          // Rayon d'orbite (px)
	},
	bossLuckHp: {               // Seuils HP par boss pour le switch Luck (Crowns3bc)
		dragold: 200000,
		franky: 80000,
		tiger: 60000,
		greenjr: 150000,
		jr: 120000,
		default: 100000
	},

	// --- Survie & Potions ---
	potions: {
		autoBuy: true,             // Achete automatiquement des potions si besoin
		hpThreshold: 0.80,         // Boire potion HP sous 80% PV
		mpThreshold: 0.65,         // Garder assez de mana pour attaquer et protéger le groupe
		minStock: 100,             // Stock minimum a conserver
		needH: 200,                // Seuil need_h du rapport potions (aligne avec le marchand)
		needM: 300,                // Seuil need_m du rapport potions (aligne avec le marchand)
		hpot: "hpot1",
		mpot: "mpot1",
		potBuyCount: 200
	},

	// --- Deplacement & Positionnement ---
	movement: {
		enabled: true,             // Autoriser les deplacements automatiques
		approachRatio: 0.85,       // Se rapproche a 85% de la portee maximale
		followPriest: true,        // Attend le pretre s'il est trop loin
		priestMaxDist: 350         // Distance max avant d'attendre le pretre
	},

	// --- Equipement & Armes ---
	WEAPONS: {
		default: "lolipop",
		lolipop: { main: "ololipop", off: "glolipop" },
		fireblade: { main: "fireblade", off: "fireblade", shiny_main: true },
		pack: {
			goo: "lolipop",
			bee: "lolipop",
			crab: "lolipop",
			croc: "lolipop",
			armadillo: "lolipop",
			minimush: "fireblade",
			spider: "fireblade",
			scorpion: "fireblade",
			stoneworm: "fireblade",
			bigbird: "fireblade",
			booboo: "fireblade",
			phoenix: "fireblade",
			jr: "fireblade",
			greenjr: "fireblade",
			dragold: "fireblade",
			franky: "fireblade",
			icegolem: "fireblade",
			crabxx: "fireblade"
		}
	},
	KEEP_ITEMS: ["ololipop", "glolipop", "fireblade", "tracker", "hpot0", "mpot0", "hpot1", "mpot1"],
	GIVE_WEAPONS: [],
	GIVE_ARMOR: ["coat", "gloves", "pants", "helmet", "shoes"],

	// --- Ramassage des coffres (lootLoop dedie, 400ms au lieu de 3s) ---
	loot: {
		enabled: true,             // Ouvrir les coffres personnels et ceux au sol
		intervalMs: 400,           // Cadence de loot() (ms)
		chestRange: 350            // Rayon pour ouvrir les coffres d'autres joueurs
	},

	// --- Chasses Daisy (Monster Hunter) ---
	hunts: {
		enabled: true,             // Activer la recherche et realisation des chasses
		maxWipes: 3,              // Abandonner une chasse apres 3 morts (reset apres 36 min)
		wipeTimeoutMs: 36 * 60 * 1000 // Delai d'oubli d'une chasse ayant echoue
	},

	// --- Inventaire & Vidage vers la mule ---
	inventory: {
		dumpEsize: 4,              // Vider quand il reste 4 slots libres ou moins
		dumpCooldownMs: 60000,     // Cooldown minimum entre deux deplacements vers la mule
		goldKeep: 50000            // Garder ce montant d'or pour les potions
	},
	DUMP_ESIZE: 4,
	HUNT_WIPE_MAX: 3
};

// ============================================================================
// 2. INTERFACE DU COMMAND CENTER (Dashboard & Synchronisation)
// ============================================================================
var BOARD_CTL = {
	leader: "Eadroma",
	monster: "auto",
	roles: { Eadroma: "Leader", Aedroma: "Follow", Droma: "Follow", EadroSell: "Follow" },
	events: { Eadroma: true, Aedroma: true, Droma: true, EadroSell: false }
};

var HUNT_ALLOW = {
	arcticbee: 1, iceroamer: 1, scorpion: 1, crabx: 1, phoenix: 1,
	poisio: 1, stoneworm: 1, mvampire: 1, porcupine: 1, cgoo: 1,
	mole: 1, wolfie: 1, ghost: 1, booboo: 1, fireroamer: 1,
	spider: 1, minimush: 1, croc: 1, armadillo: 1, bigbird: 1
};

var BOSS_CHECKS = [
	{ boss: "jr", everyMinutes: 240 },
	{ boss: "greenjr", everyMinutes: 240 },
	{ boss: "dragold", everyMinutes: 120 }
];

var JOIN_EVENTS = [
	"crabxx", "goobrawl", "franky", "icegolem", "abtesting",
	"phoenix", "mrpumpkin", "mrgreen", "snowman",
	"grinch", "wabbit"
];

function live_control() {
	if (typeof parent !== "undefined" && parent.party_board_control && parent.party_board_control.leader) {
		BOARD_CTL = parent.party_board_control;
	}
	return BOARD_CTL;
}

function apply_ctl(ctl) {
	if (!ctl || !ctl.leader) return;
	BOARD_CTL = ctl;
	if (typeof parent !== "undefined") parent.party_board_control = ctl;
}

function poll_board() {
	// Replaced by Command Center builder if deployed via dashboard
}

function events_enabled() {
	var ctl = live_control();
	if (ctl.events && typeof ctl.events[character.name] !== "undefined") return !!ctl.events[character.name];
	return true;
}

function server_status() {
	if (typeof server !== "undefined" && server && server.status) return server.status;
	if (typeof parent !== "undefined" && parent.S) return parent.S;
	return {};
}

function pick_live_event() {
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

async function maybe_ensure_gear() {
	if (typeof wear_dashboard_kit === "function") await wear_dashboard_kit();
	if (typeof StyleLoadout !== "undefined") await StyleLoadout.equip();
	if (typeof use_dashboard_consumables === "function") await use_dashboard_consumables();
}

// ============================================================================
// 3. ETAT DU COMBAT & CACHE (Optimisation haute performance)
// ============================================================================

/**
 * Vérifie que le personnage est sur le bon serveur pour démarrer des workers.
 * Requis par le corps injecté par builder.ts dans maybe_start_team().
 * CONFIG.PONTY_HOME est injecté par le builder (= CONFIG.HOME du profil).
 */
function on_home_realm() {
	var home = CONFIG.PONTY_HOME || CONFIG.HOME;
	if (!home || typeof server === "undefined" || !server) return true;
	var sid = String(server.id || server.name || "");
	return server.region === home.region && (sid === home.name || sid.indexOf(home.name) !== -1);
}

var state = {
	lastAttack: 0,
	lastTaunt: 0,
	lastSkill: 0,
	lastWeaponSwap: 0,
	currentWeaponSet: "",
	lastInvite: 0,
	lastTeamStart: 0,
	lastLoot: 0,
	lastDaisyInteract: 0,
	lastHuntTrip: 0,
	huntInProgress: false,
	lastDumpTrip: 0,
	dumpInProgress: false,
	teamBusy: false
};

var cache = {
	target: null,
	priestEntity: null,
	alliesUnderAttack: [],
	monstersInCleaveRange: [],
	mobCount: 0,
	partyMembers: [],
	lastUpdate: 0,
	ttl: 50 // Cache valide pendant 50ms (aligne actionLoop 50ms / skillLoop 100ms)
};

function updateCache() {
	var now = Date.now();
	if (now - cache.lastUpdate < cache.ttl) return;
	cache.lastUpdate = now;

	cache.target = null;
	cache.priestEntity = get_player(CONFIG.PRIEST);
	cache.alliesUnderAttack = [];
	cache.monstersInCleaveRange = [];
	cache.mobCount = 0;
	cache.partyMembers = Object.keys(get_party() || {});

	var cleaveRange = (G.skills.cleave && G.skills.cleave.range) ? G.skills.cleave.range : 160;
	var farmTargetType = farm_monster();
	var eventTargeting = typeof EventRouter !== "undefined" && EventRouter.activeMonster && EventRouter.activeMonster();
	var blockedHunt = abandoned_hunt_id();
	var bestCandidate = null;
	var bestDist = 999999;

	for (var id in parent.entities) {
		var e = parent.entities[id];
		if (!e || e.type !== "monster" || e.dead || !e.visible) continue;
		if (eventTargeting === "franky" && e.mtype !== "franky") continue;
		// Apres le nombre maximal de morts, ignorer completement ce type de hunt.
		// Cela bloque aussi les skills AOE qui pouvaient relancer le combat alors
		// que l'attaque normale avait deja bascule sur le fallback.
		if (blockedHunt && e.mtype === blockedHunt) continue;

		var dist = distance(character, e);
		cache.mobCount++;

		// Detection pour Cleave
		if (dist <= cleaveRange) {
			cache.monstersInCleaveRange.push(e);
		}

		// Detection si un allie est attaque par ce monstre (priorite au Taunt)
		if (e.target && e.target !== character.name && cache.partyMembers.indexOf(e.target) >= 0) {
			cache.alliesUnderAttack.push(e);
		}

		// 1. Cible prioritaire absolue : monstre attaquant le pretre ou un allie
		if (e.target && e.target === CONFIG.PRIEST) {
			cache.target = e;
			continue;
		}

		// 2. Monstre deja cible par le guerrier
		if (e.target === character.name && !cache.target) {
			cache.target = e;
			continue;
		}

		// 3. Monstre correspondant au type de farm actuel
		if (!cache.target) {
			if ((eventTargeting && EventRouter.accepts(e)) || (!eventTargeting && (!farmTargetType || farmTargetType === "auto" || e.mtype === farmTargetType))) {
				if (dist < bestDist) {
					bestDist = dist;
					bestCandidate = e;
				}
			}
		}
	}

	if (!cache.target) {
		cache.target = bestCandidate;
	}
}

function sleep_ms(ms) {
	return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

// ============================================================================
// 4. CHASSES DAISY (Monster Hunter System)
// ============================================================================
var hunt_wipes = (function () {
	try { return get("hunt_wipes") || {}; } catch (e) { return {}; }
})();
var ally_hunts = {};

/** Table des monstres de chasse autorises (remplacee par builder.ts si configure sur le dashboard) */
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

function hunt_info() {
	var h = character.s && character.s.monsterhunt;
	if (!h || !h.id) return null;
	return { id: h.id, c: h.c || 0, ms: h.ms || 0 };
}

function hunt_should_try(id) {
	if (!id) return false;
	// Si une table HUNT_ALLOW existe et contient des cles, verifier que l'id est autorise
	if (typeof HUNT_ALLOW !== "undefined" && HUNT_ALLOW && Object.keys(HUNT_ALLOW).length > 0) {
		if (!HUNT_ALLOW[id]) return false;
	}
	var rec = active_hunt_wipe(id);
	if (!rec || !rec.n) return true;
	var maxWipes = (CONFIG.hunts && CONFIG.hunts.maxWipes) || CONFIG.HUNT_WIPE_MAX || 3;
	return rec.n < maxWipes;
}

function active_hunt_wipe(id) {
	if (!id) return null;
	var rec = hunt_wipes[id];
	if (!rec) return null;
	if (rec.until && Date.now() >= rec.until) {
		delete hunt_wipes[id];
		try { set("hunt_wipes", hunt_wipes); } catch (e) {}
		return null;
	}
	return rec;
}

function note_hunt_wipe(id) {
	if (!id) return 0;
	var rec = active_hunt_wipe(id) || { n: 0, until: 0, last: 0 };
	if (rec.last && Date.now() - rec.last < 30000) return rec.n || 0;
	var maxWipes = (CONFIG.hunts && CONFIG.hunts.maxWipes) || CONFIG.HUNT_WIPE_MAX || 3;
	var previous = rec.n || 0;
	rec.n = Math.min(maxWipes, previous + 1);
	rec.last = Date.now();
	var wipeTimeout = (CONFIG.hunts && CONFIG.hunts.wipeTimeoutMs) || (36 * 60 * 1000);
	rec.until = Date.now() + wipeTimeout;
	hunt_wipes[id] = rec;
	try { set("hunt_wipes", hunt_wipes); } catch (e) {}
	if (rec.n === 1) {
		game_log("1ere mort sur le hunt " + id + " : attente du groupe avant d'engager.", "#FFA500");
	} else if (rec.n >= maxWipes) {
		if (previous < maxWipes) game_log(maxWipes + "e mort sur le hunt " + id + " : contrat ignore/skip, repli sur le farm.", "#e06c75");
	} else {
		game_log("Wipe sur hunt " + id + " (" + rec.n + "/" + maxWipes + ")", "#FFA500");
	}
	return rec.n;
}

function hunt_wipe_count(huntId) {
	if (!huntId) return 0;
	var rec = active_hunt_wipe(huntId);
	if (!rec || !rec.n) return 0;
	return rec.n || 0;
}

function abandoned_hunt_id() {
	var h = hunt_info();
	if (!h || !h.id) return "";
	return hunt_should_try(h.id) ? "" : h.id;
}

function hunt_fallback_monster(abandonedId) {
	var fallback = CONFIG.DEFAULT_FARM || "crab";
	if (fallback !== abandonedId) return fallback;
	return abandonedId === "crab" ? "goo" : "crab";
}

/**
 * Verifie si le pretre est a proximite et vivant.
 * Active apres 1 mort sur un contrat de chasse pour eviter de repartir sans soin.
 * Le ranger ne bloque pas la reprise : il peut farmer ou revenir independamment.
 */
function is_team_ready_for_hunt(maxDist) {
	var distMax = maxDist || (CONFIG.movement && CONFIG.movement.priestMaxDist) || 280;
	var priestName = CONFIG.PRIEST;
	if (!priestName || priestName === character.name) return true;
	var priest = get_player(priestName);
	if (!priest || priest.rip || (priest.hp != null && priest.hp <= 0)) return false;
	if (priest.map && priest.map !== character.map) return false;
	return distance(character, priest) <= distMax;
}

/** Recurring bosses are never pulled before the priest reaches the warrior. */
function recurring_boss_waiting_for_priest(target) {
	if (!target || !boss_peek || !boss_peek.phase || target.mtype !== boss_peek.phase) return false;
	if (is_team_ready_for_hunt((CONFIG.movement && CONFIG.movement.priestMaxDist) || 350)) return false;
	// Once combat has already reached the party, survival actions must continue.
	if (target.target === character.name || target.target === CONFIG.PRIEST) return false;
	if (cache.alliesUnderAttack && cache.alliesUnderAttack.length) return false;
	return true;
}


function pick_party_hunt() {
	if (CONFIG.hunts && CONFIG.hunts.enabled === false) return null;

	// Si notre propre contrat est termine (c === 0), la priorite absolue est de le rendre a Daisy
	var mine = hunt_info();
	if (mine && mine.c === 0) return null;

	// 1. Priorite : terminer notre propre contrat d'abord !
	if (mine && mine.c > 0 && hunt_should_try(mine.id)) {
		return { who: character.name, id: mine.id, c: mine.c, ms: mine.ms || 9999999 };
	}

	// 2. Si nous n'avons pas de hunt personnel en cours, aider les allies (Pretre Aedroma, Ranger Droma)
	var list = [];
	var party = CONFIG.PARTY || [];
	for (var i = 0; i < party.length; i++) {
		var name = party[i];
		var rec = ally_hunts[name];
		if (!rec || !rec.id || !(rec.c > 0)) continue;
		if (Date.now() - (rec.at || 0) > 45000) continue;
		if (!hunt_should_try(rec.id)) continue;
		list.push({ who: name, id: rec.id, c: rec.c, ms: rec.ms || 9999999 });
	}

	if (list.length === 0) return null;

	// Priorite a la chasse qui a le MOINS de temps restant (ms le plus petit)
	list.sort(function (a, b) { return a.ms - b.ms; });
	return list[0];
}

function near_daisy() {
	if (character.map !== "main") return false;
	return distance(character, { x: 126, y: -413 }) < 350;
}

async function talk_to_daisy() {
	if (typeof interact === "function") {
		try {
			var res = await interact("monsterhunt", 3000);
			if (res && res.completed) {
				game_log("Hunt termine ! Token recu.", "#98c379");
				var oldH = hunt_info();
				if (oldH && oldH.id && hunt_wipes[oldH.id]) {
					delete hunt_wipes[oldH.id];
					try { set("hunt_wipes", hunt_wipes); } catch (e) {}
				}
				await sleep_ms(400);
				res = await interact("monsterhunt", 3000);
			}
			if (res && res.started) return res;
		} catch (e) {}
	}
	// Fallback socket direct Adventure Land (emule le clic NPC)
	if (typeof parent !== "undefined" && parent.socket) {
		try {
			parent.socket.emit("monsterhunt");
			await sleep_ms(600);
			var nh = hunt_info();
			if (!nh || nh.c === 0) {
				parent.socket.emit("monsterhunt");
				await sleep_ms(400);
			}
			return { started: true };
		} catch (e) {}
	}
	return null;
}

async function huntLoop() {
	if (typeof EventExpedition !== "undefined" && EventExpedition.worker()) { setTimeout(huntLoop, 3000); return; }
	try {
		if (is_disabled(character) || character.rip || state.dumpInProgress) {
			setTimeout(huntLoop, 3000);
			return;
		}

		if (CONFIG.hunts && CONFIG.hunts.enabled) {
			var h = hunt_info();
			var turnin = h && h.c === 0;
			var needsNewHunt = !h || turnin;

			if (state.huntInProgress) {
				// Si un contrat valide est actif et en cours, le voyage chez Daisy est termine !
				if (h && h.c > 0) {
					state.huntInProgress = false;
					state.lastHuntTrip = Date.now();
					game_log("Contrat Daisy actif : " + h.id + " (" + h.c + ") ! En route au farm.", "#98c379");
				} else if (near_daisy()) {
					if (Date.now() - state.lastDaisyInteract > 3000) {
						state.lastDaisyInteract = Date.now();
						await talk_to_daisy();
						var afterH = hunt_info();
						if (afterH && afterH.c > 0) {
							game_log("Nouveau hunt : " + afterH.id + " x" + afterH.c, "#98c379");
							state.huntInProgress = false;
							state.lastHuntTrip = Date.now();
						} else if (Date.now() - state.lastHuntTrip > 12000) {
							// Timeout si Daisy n'a pas de contrat disponible (cooldown Daisy)
							state.huntInProgress = false;
							state.lastHuntTrip = Date.now();
							game_log("Pas de contrat Daisy disponible. Retour au farm.", "#e5c07b");
						}
					}
				} else if (!smart.moving) {
					set_message("Go Daisy");
					await smart_move({ map: "main", x: 126, y: -413 });
				}
			} else if (needsNewHunt) {
				var cooldown = turnin ? 5000 : 45000;
				if (Date.now() - state.lastHuntTrip > cooldown) {
					state.huntInProgress = true;
					state.lastHuntTrip = Date.now();
					var label = turnin ? "Rendre hunt a Daisy..." : "Chercher hunt a Daisy...";
					game_log(label, "#61afef");
					if (smart.moving) stop();
					await smart_move({ map: "main", x: 126, y: -413 });
				}
			}
		}
	} catch (e) {
		// Erreurs hunt
	}

	setTimeout(huntLoop, 3000);
}

// ============================================================================
// 5. VIDAGE D'INVENTAIRE VERS LA MULE (Dump to Mule)
// ============================================================================
function bag_slots_free() {
	return character.esize || 0;
}

function bag_is_full() {
	var limit = (CONFIG.inventory && CONFIG.inventory.dumpEsize) || CONFIG.DUMP_ESIZE || 4;
	return bag_slots_free() <= limit;
}

function is_potion(itemName) {
	if (!itemName) return false;
	return itemName.startsWith("hpot") || itemName.startsWith("mpot");
}

/**
 * Nombre maximum d'exemplaires d'un item que le guerrier doit conserver au total
 * (exemplaires équipés + exemplaires dans l'inventaire).
 */
function get_max_keep(name) {
	if (!name) return 0;
	if (is_potion(name)) return 9999;
	if (name === "tracker") return 1;
	if (name.startsWith("elixir")) return 2;

	// Armes configurées du guerrier (mono-cible, farm/aoe, etc.)
	if (name === "fireblade") return 2; // Arme mono (peut être dual-wield)
	if (name === "ololipop" || name === "glolipop") return 1;

	// Vérification dynamique des sets d'armes (CONFIG.WEAPONS)
	if (CONFIG.WEAPONS) {
		var neededInWeapons = 0;
		for (var k in CONFIG.WEAPONS) {
			var wset = CONFIG.WEAPONS[k];
			if (wset && typeof wset === "object") {
				var inSet = 0;
				if (wset.main === name) inSet++;
				if (wset.off === name) inSet++;
				if (inSet > neededInWeapons) neededInWeapons = inSet;
			}
		}
		if (neededInWeapons > 0) return neededInWeapons;
	}

	// Définition de l'item selon G.items
	var gItem = (typeof G !== "undefined" && G.items && G.items[name]) || null;
	if (gItem) {
		if (gItem.type === "weapon") return 2;
		if (gItem.type === "ring" || gItem.type === "earring") return 2;
		// Armures, ceintures (hpbelt), amulettes, capes : 1 seul exemplaire
		return 1;
	}

	if (name.indexOf("ring") >= 0 || name.indexOf("earring") >= 0) return 2;
	return 1;
}

/**
 * Nombre d'exemplaires actuellement équipés dans character.slots
 */
function get_equipped_count(name) {
	var count = 0;
	var slots = character.slots || {};
	for (var slot in slots) {
		if (slot.indexOf("trade") === 0) continue;
		var eq = slots[slot];
		if (eq && eq.name === name) count++;
	}
	return count;
}

/**
 * Vérifie si le slot i de l'inventaire doit être donné à la mule :
 * - Les items verrouillés (.l) et potions sont protégés
 * - Les armes configurées (fireblade, glolipop...) sont conservées
 * - Pour les items de KEEP_ITEMS : on conserve jusqu'à maxKeep exemplaires (équipés + sac).
 *   Tout exemplaire excédentaire (ex: doublon hpbelt) est considéré comme dumpable.
 */
function is_dumpable_slot(slotIndex) {
	var items = character.items || [];
	var item = items[slotIndex];
	if (!item || item.l) return false;
	if (is_potion(item.name)) return false;
	var loadoutItems = CONFIG.LOADOUT_ITEMS || [];
	for (var li = 0; li < loadoutItems.length; li++) {
		if (loadoutItems[li].item === item.name && (item.level || 0) >= (loadoutItems[li].minLevel || 0)) return false;
	}

	var keep = CONFIG.KEEP_ITEMS || [];
	if (keep.indexOf(item.name) < 0) return true; // Pas dans la liste de garde = toujours dumpable

	var maxKeep = get_max_keep(item.name);
	var equipped = get_equipped_count(item.name);
	var allowedInBag = Math.max(0, maxKeep - equipped);

	// Si le quota total est déjà satisfait par les équipements portés (ex: hpbelt déjà équipé)
	if (allowedInBag <= 0) return true; // Doublon dans le sac -> à donner à la mule

	// Reserve the strongest carried copies, regardless of their bag position.
	// Loadout copies participate in this quota so a weaker drop cannot reserve
	// an extra slot simply because it appears before the combat weapon.
	var copies = [];
	for (var i = 0; i < items.length; i++) {
		if (items[i] && items[i].name === item.name) copies.push({ index: i, level: items[i].level || 0 });
	}
	copies.sort(function(a, b) { return b.level - a.level || a.index - b.index; });
	for (var rank = 0; rank < copies.length; rank++) {
		if (copies[rank].index === slotIndex) return rank >= allowedInBag;
	}
	return true;
}

function is_dumpable(item, optIndex) {
	if (!item || item.l) return false;
	if (typeof optIndex === "number") {
		return is_dumpable_slot(optIndex);
	}
	var items = character.items || [];
	for (var i = 0; i < items.length; i++) {
		if (items[i] === item) return is_dumpable_slot(i);
	}
	var keep = CONFIG.KEEP_ITEMS || [];
	if (keep.indexOf(item.name) < 0) return true;
	var allowed = Math.max(0, get_max_keep(item.name) - get_equipped_count(item.name));
	return allowed <= 0;
}

function dumpable_count() {
	var count = 0;
	var items = character.items || [];
	for (var i = 0; i < items.length; i++) {
		if (items[i] && is_dumpable_slot(i)) count++;
	}
	return count;
}

// --- Fonctions de verification et demande de buff mluck ---
function our_mluck() {
	return (character.s && character.s.mluck) || null;
}

function mluck_ok(entity) {
	var ent = entity || character;
	var s = ent.s && ent.s.mluck;
	if (!s) return false;
	if (s.strong && s.f && s.f !== CONFIG.MERCHANT) return true;
	var minMs = 5 * 60 * 1000; // Valide s'il reste au moins 5 minutes
	return s.f === CONFIG.MERCHANT && s.ms > minMs;
}

function wants_mluck() {
	var s = our_mluck();
	if (s && s.strong && s.f && s.f !== CONFIG.MERCHANT) return false;
	return !mluck_ok(character);
}

function ally_mluck_ok(p) {
	if (!p) return true;
	var s = p.s && p.s.mluck;
	if (!s) return false;
	if (s.strong && s.f && s.f !== CONFIG.MERCHANT) return true;
	var minMs = 5 * 60 * 1000;
	return s.f === CONFIG.MERCHANT && s.ms > minMs;
}

function party_needs_mluck() {
	if (wants_mluck()) return true;
	var party = CONFIG.PARTY || [];
	for (var i = 0; i < party.length; i++) {
		var p = get_player(party[i]);
		if (p && !ally_mluck_ok(p)) return true;
	}
	return false;
}

async function dump_items_to_mule() {
	var muleName = CONFIG.MERCHANT;
	var mule = get_player(muleName);
	if (!mule || distance(character, mule) > 280) return false;

	var items = character.items || [];
	for (var i = 0; i < items.length; i++) {
		var it = items[i];
		if (it && is_dumpable_slot(i)) {
			try {
				await send_item(muleName, i, it.q || 1);
				await sleep_ms(100);
			} catch (e) {}
		}
	}

	// Transfert de l'or excedentaire si possible
	var goldKeep = (CONFIG.inventory && CONFIG.inventory.goldKeep) || 50000;
	if (character.gold > goldKeep + 10000) {
		try {
			await send_gold(muleName, character.gold - goldKeep);
		} catch (e) {}
	}

	// Demande de buff mluck a la mule si necessaire
	if (wants_mluck() || party_needs_mluck()) {
		try {
			await send_cm(muleName, { t: "mluck" });
		} catch (e) {}
	}

	return true;
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

async function dumpLoop() {
	if (typeof EventExpedition !== "undefined" && EventExpedition.worker()) { setTimeout(dumpLoop, 3000); return; }
	try {
		if (is_disabled(character) || character.rip) {
			setTimeout(dumpLoop, 3000);
			return;
		}

		var muleName = CONFIG.MERCHANT;
		var muleTarget = get_mule_target();
		var mule = get_player(muleName);

		// 1. Si la mule est deja tout pres de nous, on lui vide nos sacs directement
		if (mule && distance(character, mule) <= 250 && (dumpable_count() > 0 || wants_mluck())) {
			await dump_items_to_mule();
		}

		// 2. Gestion du voyage vers la mule si sac plein ou besoin critique de mluck
		var needDump = (bag_is_full() && dumpable_count() > 0);
		var needMluckVisit = (wants_mluck() && dumpable_count() > 0);

		if (state.dumpInProgress) {
			if (!bag_is_full() && dumpable_count() === 0 && !wants_mluck()) {
				state.dumpInProgress = false;
				state.lastDumpTrip = Date.now();
				game_log("Inventaire vide & buff mluck valide ! Retour au farm.", "#98c379");
			} else if (mule && distance(character, mule) <= 250) {
				await dump_items_to_mule();
				state.dumpInProgress = false;
				state.lastDumpTrip = Date.now();
			} else if (!smart.moving) {
				set_message("Go mule");
				await smart_move(muleTarget);
			}
		} else if (needDump || needMluckVisit) {
			var cooldown = (CONFIG.inventory && CONFIG.inventory.dumpCooldownMs) || 60000;
			if (Date.now() - state.lastDumpTrip > cooldown) {
				state.dumpInProgress = true;
				var reason = needDump ? "Inventaire plein (" + bag_slots_free() + " slots)" : "Besoin du buff mluck";
				game_log(reason + ". En route vers " + muleName + "...", "#e5c07b");
				if (smart.moving) stop();
				await smart_move(muleTarget);
			}
		}
	} catch (e) {
		// Erreurs dump
	}

	setTimeout(dumpLoop, 4000);
}

// ============================================================================
// 6. RONDES DE BOSS PROGRAMMEES (Boss Checks : Jr., Green Jr., Dragold)
// ============================================================================
var BOSS_CHECK_TIMEOUT_MS = 3 * 60 * 1000;
var boss_peek = { at: {}, phase: "", started: 0 };
try {
	var stored_bp = get("boss_peek");
	if (stored_bp && typeof stored_bp === "object") {
		if (stored_bp.at && typeof stored_bp.at === "object") boss_peek.at = stored_bp.at;
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

function rare_on_screen(id) {
	if (!id) return false;
	for (var key in parent.entities) {
		var e = parent.entities[key];
		if (e && e.type === "monster" && !e.dead && !e.rip && e.mtype === id && e.hp > 0) return true;
	}
	return false;
}

function live_boss_check() {
	var rules = boss_check_rules();
	for (var i = 0; i < rules.length; i++) {
		var id = rules[i] && rules[i].boss;
		if (id && rare_on_screen(id)) return id;
	}
	return null;
}

function nearby_phoenix() {
	if (!CONFIG.RARE_VISITS) return null;
	return rare_on_screen("phoenix") ? "phoenix" : null;
}

function boss_check_give_up(why) {
	game_log(why || "boss check termine, retour au farm", "#B0C4DE");
	if (boss_peek.phase) boss_peek.at[boss_peek.phase] = Date.now();
	boss_peek.phase = "";
	boss_peek.started = 0;
	save_boss_peek();
}

function due_boss_check() {
	var rules = boss_check_rules();
	var best = null, best_over = -1;
	for (var i = 0; i < rules.length; i++) {
		var rule = rules[i];
		if (!rule || !rule.boss) continue;
		var over = Date.now() - (boss_peek.at[rule.boss] || 0) - Math.max(5, Number(rule.everyMinutes) || 0) * 60000;
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
	game_log("Ronde de boss : " + boss_name(next) + " (toutes les " + boss_check_every(next) + ")", "#FFA500");
	return next;
}

var BOSS_SPOTS = {
	jr: { map: "spookytown", x: -968, y: -657 },
	greenjr: { map: "halloween", x: -480, y: -420 },
	dragold: { map: "cave", x: 1200, y: -800 },
	fvampire: { map: "halloween", x: 80, y: -850 },
	mvampire: { map: "cave", x: 158, y: -1130 },
	stompy: { map: "winterland", x: 420, y: -2400 },
	bscorpion: { map: "desertland", x: 390, y: -1420 },
	mrpumpkin: { map: "halloween", x: -260, y: -1600 },
	mrgreen: { map: "spookytown", x: 10, y: -1060 }
};

function scheduled_boss_farm() {
	if (boss_peek.phase && !boss_check_rule(boss_peek.phase)) {
		boss_check_give_up("boss check " + boss_peek.phase + " non configure");
	}
	if (boss_peek.phase) {
		if (!boss_peek.started) {
			boss_peek.started = Date.now();
			save_boss_peek();
		}
		if (Date.now() - boss_peek.started > BOSS_CHECK_TIMEOUT_MS) {
			boss_check_give_up("Timeout verification " + boss_peek.phase);
			return null;
		}
		if (rare_on_screen(boss_peek.phase)) {
			return boss_peek.phase;
		}
		var spot = BOSS_SPOTS[boss_peek.phase];
		if (spot && character.map === spot.map && distance(character, spot) < 250 && !smart.moving) {
			var done = boss_peek.phase;
			boss_check_give_up(boss_name(done) + " absent, prochain check dans " + boss_check_every(done));
			return start_boss_check();
		}
		return boss_peek.phase;
	}
	return start_boss_check();
}

function farm_monster() {
	// 0. Si notre propre hunt est termine (c === 0), pas de farm : priorite absolue a Daisy pour le rendre !
	var myh = hunt_info();
	if (CONFIG.hunts && CONFIG.hunts.enabled && myh && myh.c === 0) {
		return null;
	}

	// Les événements autorisés prennent la priorité dès leur annonce. Cela
	// sélectionne aussi le bon loadout avant que le boss soit visible.
	if (typeof EventRouter !== "undefined" && EventRouter.activeMonster) {
		var eventMonster = EventRouter.activeMonster();
		if (eventMonster) return eventMonster;
	}

	// 1. Ordre manuel via le Command Center
	var blockedHunt = abandoned_hunt_id();
	var ctl = live_control();
	if (ctl.monster && ctl.monster !== "auto" && ctl.monster !== blockedHunt) return ctl.monster;

	// 2. Boss configure detecte vivant a l'ecran
	var liveBoss = live_boss_check();
	if (liveBoss) return liveBoss;
	var nearbyRare = nearby_phoenix();
	if (nearbyRare) return nearbyRare;

	// 3. Ronde de boss programmee (Jr., Green Jr., Dragold...). Elle doit être
	// évaluée avant Daisy : avec une chasse active en continu, l'ancien ordre
	// rendait cette branche définitivement inaccessible.
	var scheduledBoss = scheduled_boss_farm();
	if (scheduledBoss) return scheduledBoss;

	// 4. Chasse Daisy active pour le groupe (priorite au timer le plus court)
	var ph = pick_party_hunt();
	if (ph && ph.id) return ph.id;

	// 5. Monstre de farm par defaut
	return hunt_fallback_monster(blockedHunt);
}

// ============================================================================
// 8. ACTION LOOP — Attaque & Declenchement rapide
// ============================================================================
async function actionLoop() {
	if (typeof EventExpedition !== "undefined" && !EventExpedition.canCombat()) { setTimeout(actionLoop, 250); return; }
	var actionDelay = 50;
	try {
		if (is_disabled(character) || character.rip) {
			setTimeout(actionLoop, 250);
			return;
		}
		if (typeof CaveDreams !== "undefined" && CaveDreams.inCave()) {
			setTimeout(actionLoop, 250);
			return;
		}

		updateCache();
		var target = cache.target;
		if (typeof EventExpedition !== "undefined" && !EventExpedition.canCombat(target)) { setTimeout(actionLoop, 250); return; }

		
		if (target && is_in_range(target, "attack")) {
			var ph = pick_party_hunt();
			var isHuntMob = ph && ph.id && target.mtype === ph.id;
			var isSelfDefense = target.target === character.name || (cache.alliesUnderAttack && cache.alliesUnderAttack.indexOf(target) >= 0);
			if (typeof TeamCoordinator !== "undefined" && !TeamCoordinator.canEngage() && !isSelfDefense) {
				set_message("Wait priest (mission)");
			} else if (recurring_boss_waiting_for_priest(target) && !isSelfDefense) {
				set_message("Wait priest (boss)");
			} else if (isHuntMob && hunt_wipe_count(ph.id) >= 1 && !is_team_ready_for_hunt() && !isSelfDefense) {
				set_message("Wait team (hunt)");
			} else if (can_attack(target)) {
				await attack(target);
				if (typeof ActionTiming !== "undefined") actionDelay = ActionTiming.after("attack", 50, 20);
			}
		}
	} catch (e) {
		// Ignorer les erreurs normales de cooldown/timing
	}

	setTimeout(actionLoop, actionDelay);
}

// ============================================================================
// 9. SKILL LOOP — Competences du Guerrier
// ============================================================================
function can_cleave_weapon() {
	var slot = character.slots && character.slots.mainhand;
	if (!slot || !slot.name || typeof G === "undefined" || !G.items || !G.items[slot.name]) return false;
	var wtype = G.items[slot.name].wtype;
	if (typeof G.skills !== "undefined" && G.skills.cleave && Array.isArray(G.skills.cleave.wtypes)) {
		return G.skills.cleave.wtypes.indexOf(wtype) !== -1;
	}
	return wtype === "axe" || wtype === "scythe";
}

// Hysteresis MP anti-yoyo (Crowns3bc) : bloque les competences non-essentielles
// quand la mana chute sous mpReserve, reprend au-dessus de mpHysteresisUpper.
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

async function skillLoop() {
	if (typeof EventExpedition !== "undefined" && !EventExpedition.canCombat()) { setTimeout(skillLoop, 250); return; }
	try {
		if (is_disabled(character) || character.rip) {
			setTimeout(skillLoop, 200);
			return;
		}
		if (typeof CaveDreams !== "undefined" && CaveDreams.inCave()) {
			setTimeout(skillLoop, 200);
			return;
		}

		updateCache();
		var skills = CONFIG.skills;
		if (cache.target && typeof TeamCoordinator !== "undefined" && !TeamCoordinator.canEngage()) {
			set_message("Wait priest (mission)");
			setTimeout(skillLoop, 200);
			return;
		}
		if (recurring_boss_waiting_for_priest(cache.target)) {
			set_message("Wait priest (boss)");
			setTimeout(skillLoop, 200);
			return;
		}

		// 1. Taunt — Sauvetage des allies (Pretre / Ranger)
		if (skills.tauntEnabled && (typeof StyleLoadout === "undefined" || StyleLoadout.allows("taunt")) && !is_on_cooldown("taunt") && Date.now() - state.lastTaunt > skills.tauntCooldown) {
			if (cache.alliesUnderAttack.length > 0) {
				var mobToTaunt = cache.alliesUnderAttack[0];
				if (is_in_range(mobToTaunt, "taunt")) {
					await use_skill("taunt", mobToTaunt);
					state.lastTaunt = Date.now();
					game_log("Taunt sur " + mobToTaunt.mtype + " pour proteger " + mobToTaunt.target, "#FFD700");
				}
			}
		}

		// 3. Stomp — Controle de foule si danger
		if (skills.stompEnabled && (typeof StyleLoadout === "undefined" || StyleLoadout.allows("stomp")) && !is_on_cooldown("stomp")) {
			var priest = cache.priestEntity;
			var priestInDanger = priest && (priest.hp / priest.max_hp < skills.stompPanicRatio);
			var selfInDanger = (character.hp / character.max_hp < skills.stompPanicRatio);

			if ((priestInDanger || selfInDanger) && cache.monstersInCleaveRange.length > 0) {
				await use_skill("stomp");
				game_log("STOMP !", "#FF4500");
			}
		}

		// 4. Agitate — Degats de zone (AoE) sur packs
		// StyleLoadout.allows() comme cleave/stomp : un loadout vide (defaut dashboard)
		// autorise le skill, et les modes mono/tank le bloquent. L'ancien selected()
		// ne matchait jamais car STYLE_LOADOUTS.aoe.skills est vide par defaut.
		// mp_spend_ok() passe le cout reel en reserve (ne plus vider la mana pour rien).
		var agitateCost = (G.skills.agitate && G.skills.agitate.mp) || 420;
		if (skills.agitateEnabled && (typeof StyleLoadout === "undefined" || StyleLoadout.allows("agitate")) && cache.target && cache.mobCount >= (skills.agitateMinMobs || 2) && !is_on_cooldown("agitate") && mp_spend_ok(agitateCost)) {
			var priestSafe = !cache.priestEntity || cache.priestEntity.hp / cache.priestEntity.max_hp > 0.60;
			if (priestSafe && character.hp / character.max_hp > 0.70 && character.mp >= agitateCost) {
				try { await use_skill("agitate"); } catch(e) {}
			}
		}

		// 5. Cleave — Degats de zone (AoE)
		if (skills.cleaveEnabled && (typeof StyleLoadout === "undefined" || StyleLoadout.allows("cleave")) && can_cleave_weapon() && !is_on_cooldown("cleave") && character.mp >= skills.cleaveMinMp) {
			if (cache.monstersInCleaveRange.length >= skills.cleaveMinMobs) {
				await use_skill("cleave");
			}
		}

		// 6. Warcry — Buff offensif (bloque sous reserve MP)
		if (skills.warcryEnabled && (typeof StyleLoadout === "undefined" || StyleLoadout.allows("warcry")) && !is_on_cooldown("warcry") && !character.s.warcry && cache.target && mp_spend_ok(0)) {
			await use_skill("warcry");
		}

		// 7. Charge — Deplacement rapide (bloque sous reserve MP)
		if (skills.chargeEnabled && (typeof StyleLoadout === "undefined" || StyleLoadout.allows("charge")) && !is_on_cooldown("charge") && !character.s.charge && character.moving && mp_spend_ok(0)) {
			await use_skill("charge");
		}

	} catch (e) {
		// Log des erreurs de competence imprevues
	}

	setTimeout(skillLoop, 100);
}

// ============================================================================
// 10. MOVEMENT LOOP — Deplacement & Navigation
// ============================================================================
async function movementLoop() {
	if (typeof EventExpedition !== "undefined" && await EventExpedition.actorTick()) { setTimeout(movementLoop, 500); return; }
	try {
		if (is_disabled(character) || character.rip) {
			setTimeout(movementLoop, 300);
			return;
		}
		// Pause les déplacements de combat si on est en voyage pour vider les sacs ou chez Daisy
		if (state.dumpInProgress || state.huntInProgress) {
			setTimeout(movementLoop, 500);
			return;
		}

		// 1. Evenements en direct : join() pour les instances, trajet pour les boss.
		if (typeof EventRouter !== "undefined" && await EventRouter.tick()) {
			setTimeout(movementLoop, 300);
			return;
		}

		if (typeof CaveDreams !== "undefined" && await CaveDreams.tick("lead")) {
			setTimeout(movementLoop, 300);
			return;
		}

		// Refresh before honoring an already-running smart_move. A recurring boss
		// can appear while travelling; in that case the warrior must cancel the
		// approach immediately instead of reaching it alone before this guard runs.
		updateCache();
		var target = cache.target;
		if (recurring_boss_waiting_for_priest(target)) {
			if (smart.moving || character.moving) stop();
			set_message("Wait priest (boss)");
			setTimeout(movementLoop, 400);
			return;
		}
		if (smart.moving) {
			setTimeout(movementLoop, 300);
			return;
		}
		// 2. Securite du groupe : attendre le pretre s'il est distance
		if (CONFIG.movement.followPriest && cache.priestEntity) {
			var distPriest = distance(character, cache.priestEntity);
			if (distPriest > CONFIG.movement.priestMaxDist && !cache.target) {
				// Attendre que le soigneur rattrape
				setTimeout(movementLoop, 500);
				return;
			}
		}
		if (target && typeof TeamCoordinator !== "undefined" && !TeamCoordinator.canEngage()) {
			if (smart.moving || character.moving) stop();
			set_message("Wait priest (mission)");
			setTimeout(movementLoop, 400);
			return;
		}

		// 2b. Securite Chasse Daisy : si 1+ mort sur ce hunt, attendre le pretre avant d'engager
		var curHunt = pick_party_hunt();
		if (curHunt && curHunt.id && hunt_wipe_count(curHunt.id) >= 1 && !is_team_ready_for_hunt()) {
			var selfDefense = cache.target && (cache.target.target === character.name || (cache.alliesUnderAttack && cache.alliesUnderAttack.length > 0));
			if (!selfDefense) {
				if (smart.moving) stop();
				set_message("Wait team (hunt)");
				setTimeout(movementLoop, 400);
				return;
			}
		}


		// 3. Poursuite de la cible
		if (target) {
			var attackRange = character.range * CONFIG.movement.approachRatio;
			// is_in_range(target, skillName) n'accepte qu'un nom de skill : comparer la distance brute.
			if (distance(character, target) > attackRange) {
				if (can_move_to(target.x, target.y)) {
					move(target.x, target.y);
				} else {
					await smart_move(target);
				}
			} else if (CONFIG.skills.circleWalk && cache.mobCount >= (CONFIG.skills.cleaveMinMobs || 2)) {
				// Circle-walk Crowns3bc : orbite lente autour du pack pour clumper les mobs
				// et maximiser cleave/stomp sans rester plante.
				state.circleAngle = (state.circleAngle || 0) + Math.PI / 8;
				var cr = CONFIG.skills.circleRadius || 35;
				var ox = Math.round(character.x + cr * Math.cos(state.circleAngle));
				var oy = Math.round(character.y + cr * Math.sin(state.circleAngle));
				if (can_move_to(ox, oy)) move(ox, oy);
			}
		} else {
			// 4. Aucun monstre en vue : aller sur le spot de farm, hunt ou boss
			var farmType = farm_monster();
			if (farmType && farmType !== "auto") {
				var nearest = get_nearest_monster({ type: farmType });
				if (!nearest && !smart.moving) {
					var bossSpot = BOSS_SPOTS[farmType];
					if (bossSpot) {
						await smart_move(bossSpot);
					} else {
						await smart_move(farmType);
					}
				}
			}
		}
	} catch (e) {
		// Erreurs de cheminement ignorees
	}

	setTimeout(movementLoop, 250);
}

// ============================================================================
// 11. EQUIPMENT LOOP — Swaps d'Armes & Booster
// ============================================================================
function boss_luck_threshold(target) {
	var table = CONFIG.bossLuckHp || {};
	if (!target) return table.default || 100000;
	if (target.mtype && table[target.mtype] != null) return table[target.mtype];
	return table.default || 100000;
}

async function equipmentLoop() {
	try {
		if (is_disabled(character) || character.rip) {
			setTimeout(equipmentLoop, 1000);
			return;
		}

		updateCache();
		var now = Date.now();
		if (now - state.lastWeaponSwap < 1500) {
			setTimeout(equipmentLoop, 500);
			return;
		}

		// Determine le set requis selon la cible
		var target = cache.target;
		var targetType = target ? target.mtype : farm_monster();
		var desiredSet = (CONFIG.WEAPONS.pack && CONFIG.WEAPONS.pack[targetType]) || CONFIG.WEAPONS.default || "fireblade";

		if (state.currentWeaponSet !== desiredSet) {
			await equipWeaponSet(desiredSet);
			state.currentWeaponSet = desiredSet;
			state.lastWeaponSwap = now;
		}

		// Gestion du Booster (XP en temps normal, Luck sur les boss — seuils par boss)
		var boosterSlot = locate_item("xpbooster");
		var luckBoosterSlot = locate_item("luckbooster");

		if (target && target.max_hp >= boss_luck_threshold(target) && target.hp < target.max_hp * 0.25) {
			if (boosterSlot >= 0 && typeof shift === "function") {
				shift(boosterSlot, "luckbooster");
			}
		} else {
			if (luckBoosterSlot >= 0 && typeof shift === "function") {
				shift(luckBoosterSlot, "xpbooster");
			}
		}

		// Hook kit command-center
		if (typeof maybe_ensure_gear === "function") {
			await maybe_ensure_gear();
		}

	} catch (e) {
		// Erreurs de swap ignorees
	}

	setTimeout(equipmentLoop, 1000);
}

async function equipWeaponSet(setName) {
	var cfg = CONFIG.WEAPONS[setName];
	if (!cfg) return;

	var items = character.items || [];
	var mainCandidates = [];
	var offCandidates = [];

	// Recherche des meilleures armes dans l'inventaire (tri par niveau decroissant)
	for (var i = 0; i < items.length; i++) {
		var it = items[i];
		if (!it || it.l) continue;
		if (it.name === cfg.main) {
			mainCandidates.push({ slot: i, level: it.level || 0, shiny: !!it.shiny });
		}
		if (it.name === cfg.off) {
			offCandidates.push({ slot: i, level: it.level || 0, shiny: !!it.shiny });
		}
	}

	mainCandidates.sort(function(a, b) {
		if (b.level !== a.level) return b.level - a.level;
		return (b.shiny ? 1 : 0) - (a.shiny ? 1 : 0);
	});
	offCandidates.sort(function(a, b) {
		if (b.level !== a.level) return b.level - a.level;
		return (b.shiny ? 1 : 0) - (a.shiny ? 1 : 0);
	});

	var mainItemSlot = mainCandidates.length > 0 ? mainCandidates[0].slot : -1;
	var offItemSlot = -1;
	for (var j = 0; j < offCandidates.length; j++) {
		if (offCandidates[j].slot !== mainItemSlot) {
			offItemSlot = offCandidates[j].slot;
			break;
		}
	}

	var curMain = character.slots.mainhand;
	var curOff = character.slots.offhand;

	// Verifier si on a besoin d'equiper mainhand (changement d'arme ou arme du sac de meilleur niveau)
	var needMain = false;
	if (mainItemSlot >= 0) {
		var bestMain = items[mainItemSlot];
		if (!curMain || curMain.name !== cfg.main || (bestMain && (bestMain.level || 0) > (curMain.level || 0))) {
			needMain = true;
		}
	}

	// Verifier si on a besoin d'equiper offhand
	var needOff = false;
	if (offItemSlot >= 0) {
		var bestOff = items[offItemSlot];
		if (!curOff || curOff.name !== cfg.off || (bestOff && (bestOff.level || 0) > (curOff.level || 0))) {
			needOff = true;
		}
	}

	// Swap atomique via equip_batch si disponible
	if ((needMain || needOff) && typeof parent !== "undefined" && parent.socket) {
		try {
			var batch = [];
			if (needMain) batch.push({ num: mainItemSlot, slot: "mainhand" });
			if (needOff) batch.push({ num: offItemSlot, slot: "offhand" });
			parent.socket.emit("equip_batch", batch);
			await parent.push_deferred("equip_batch");
			return;
		} catch (e) {
			// Fallback separe ci-dessous
		}
	}

	if (needMain) {
		await equip(mainItemSlot, "mainhand");
	}
	if (needOff) {
		await equip(offItemSlot, "offhand");
	}
}

// ============================================================================
// 12. POTIONS & SURVIE LOOP
// ============================================================================
async function potionLoop() {
	var potionDelay = 200;
	try {
		if (character.rip) {
			var h = hunt_info();
			var wipes = h && h.id ? note_hunt_wipe(h.id) : 0;
			var maxWipes = (CONFIG.hunts && CONFIG.hunts.maxWipes) || CONFIG.HUNT_WIPE_MAX || 3;
			if (wipes >= maxWipes) {
				if (smart.moving) stop();
				set_message("Hunt abandoned");
			}
			respawn();
			setTimeout(potionLoop, 2000);
			return;
		}

		var hpRatio = character.hp / character.max_hp;
		var mpRatio = character.mp / character.max_mp;
		var pCfg = CONFIG.potions;

		// Le guerrier doit garder assez de mana pour attaquer et protéger le groupe.
		// La mana passe donc avant les PV, avec repli sur le soin si aucune MP n'est disponible.
		var skill = next_potion_skill(hpRatio, mpRatio, pCfg);
		if (skill) {
			await use_skill(skill);
			if (typeof ActionTiming !== "undefined") potionDelay = ActionTiming.after(skill, 200, 40);
		}

		// Signale activement un manque au marchand (protocole "supply" d'albot-js) :
		// ~1 fois toutes les 10s, request_supply() a son propre cooldown interne.
		if (Math.floor(Date.now() / 10000) !== state.lastSupplyTick) {
			state.lastSupplyTick = Math.floor(Date.now() / 10000);
			request_supply();
		}
	} catch (e) {
		// Ignorer les cooldowns de potion
	}

	setTimeout(potionLoop, potionDelay);
}

function has_potion_kind(prefix) {
	var items = character.items || [];
	for (var i = 0; i < items.length; i++) {
		if (items[i] && items[i].name && items[i].name.indexOf(prefix) === 0 && (items[i].q || 1) > 0) return true;
	}
	return false;
}

function next_potion_skill(hpRatio, mpRatio, pCfg) {
	if (mpRatio < pCfg.mpThreshold && has_potion_kind("mpot") && !is_on_cooldown("use_mp")) return "use_mp";
	if (hpRatio < pCfg.hpThreshold && has_potion_kind("hpot") && !is_on_cooldown("use_hp")) return "use_hp";
	return "";
}

// ============================================================================
// 13. GESTION DU GROUPE, MULE & WORKERS (Aedroma & Droma)
// ============================================================================

// ============================================================================
// Ramassage autonome des coffres (cadence rapide, comme Aedroma/Droma)
// ============================================================================
// partyMaintenanceLoop() ne tourne que toutes les 3s : les coffres de boss et de
// packs apparaissaient puis expiraient avant le prochain passage. Cette boucle
// dediee ouvre les coffres personnels et ceux au sol d'autres joueurs.
async function lootLoop() {
	try {
		var lcfg = CONFIG.loot || {};
		if (lcfg.enabled !== false && !is_disabled(character) && !character.rip) {
			var now = Date.now();
			if (now - state.lastLoot >= (lcfg.intervalMs || 400)) {
				// Pas de loot pendant un voyage vers la mule, Daisy ou un boss-check.
				if (!state.dumpInProgress && !state.huntInProgress) {
					try {
						loot(); // Ouvre les coffres dont on est proprietaire ou partages
						var range = lcfg.chestRange || 350;
						if (typeof parent !== "undefined" && parent.chests) {
							for (var cid in parent.chests) {
								var c = parent.chests[cid];
								if (!c) continue;
								if (c.map && c.map !== character.map) continue;
								if (distance(character, c) <= range) loot(cid);
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

async function partyMaintenanceLoop() {
	try {
		var now = Date.now();

		// 1. Ramassage des coffres : traite par lootLoop() (cadence 400ms,
		//    independante de cette boucle de maintenance a 3s).

		// 2. Inviter les membres du groupe configures
		if (now - state.lastInvite > 8000) {
			state.lastInvite = now;
			var party = CONFIG.PARTY || [];
			var guests = (typeof CaveDreams !== "undefined" && CaveDreams.reservingParty && CaveDreams.reservingParty()) ? [] : (CONFIG.PARTY_GUESTS || []);
			var allMembers = party.concat(guests);

			for (var i = 0; i < allMembers.length; i++) {
				var name = allMembers[i];
				if (!name || name === character.name) continue;
				if (!parent.party || !parent.party[name]) {
					send_party_invite(name);
				}
			}
		}

		// 3. Diffuser le contrat de chasse et la position au groupe (toutes les 3s)
		var myh = hunt_info();
		try {
			var intentMap = character.map, intentX = character.x, intentY = character.y;
			if (smart.moving && smart.map) {
				intentMap = smart.map; intentX = smart.x; intentY = smart.y;
			} else if (cache.target) {
				intentX = cache.target.x; intentY = cache.target.y;
			} else {
				var intentMonster = farm_monster();
				var intentSpot = intentMonster && BOSS_SPOTS[intentMonster];
				if (intentSpot) { intentMap = intentSpot.map; intentX = intentSpot.x; intentY = intentSpot.y; }
			}
			send_cm(CONFIG.PARTY, {
				t: "myhunt",
				id: myh ? myh.id : "",
				c: myh ? myh.c : 0,
				ms: myh ? myh.ms : 0,
				need: !myh || myh.c === 0
			});
			if (typeof TeamCoordinator !== "undefined") TeamCoordinator.publish(farm_monster() || "", { map: intentMap, x: intentX, y: intentY }, cache.target ? cache.target.id : "");
			send_cm(CONFIG.PARTY, {
				t: "pos",
				map: character.map,
				x: Math.round(character.x),
				y: Math.round(character.y),
				destMap: intentMap,
				destX: Math.round(intentX),
				destY: Math.round(intentY),
				targetId: cache.target ? cache.target.id : "",
				monster: farm_monster() || ""
			});
		} catch (e) {}

		// 4. Demarrage automatique des personnages de l'equipe (Workers)
		maybe_start_team();

	} catch (e) {
		// Log des erreurs de groupe
	}

	setTimeout(partyMaintenanceLoop, 3000);
}

// ============================================================================
// 13bis. (voir lootLoop() ci-dessus, section 13)
// ============================================================================

function on_party_request(name) {
	if (typeof CaveDreams !== "undefined" && CaveDreams.allowsPartyMember && !CaveDreams.allowsPartyMember(name)) return;
	var allowed = (CONFIG.PARTY || []).concat(CONFIG.PARTY_GUESTS || []);
	if (allowed.indexOf(name) >= 0) {
		accept_party_request(name);
	}
}

function on_party_invite(name) {
	if (typeof CaveDreams !== "undefined" && CaveDreams.allowsPartyMember && !CaveDreams.allowsPartyMember(name)) return;
	var allowed = (CONFIG.PARTY || []).concat(CONFIG.PARTY_GUESTS || []);
	if (allowed.indexOf(name) >= 0) {
		accept_party_invite(name);
	}
}

function on_cm(name, data) {
	if (typeof EventExpedition !== "undefined") EventExpedition.onCm(name, data);
	if (typeof CaveDreams !== "undefined") CaveDreams.onCm(name, data);
	if (typeof WorldEventIntel !== "undefined") WorldEventIntel.onCm(name, data);
	if (typeof TeamCoordinator !== "undefined") TeamCoordinator.onCm(name, data);
	if (!data) return;
	if (name === CONFIG.MERCHANT && data.t === "mux") report_potion_stock(name);
	// Reception des messages de groupe (Command Center ou equipiers)
	if (data.t === "ctl") {
		apply_ctl(data.ctl);
	}
	// Info de chasse partagee par un allie (Ranger / Pretre) avec timer restant
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

/** Reply to the merchant's stock ping even while farming on another map. */
function report_potion_stock(to) {
	var cfg = CONFIG.potions || {};
	var hpot = cfg.hpot || "hpot1";
	var mpot = cfg.mpot || "mpot1";
	try {
		send_cm(to, {
			t: "pots", hpot: potion_item_count(hpot), mpot: potion_item_count(mpot),
			map: character.map,
			x: Math.round((typeof character.real_x === "number") ? character.real_x : character.x),
			y: Math.round((typeof character.real_y === "number") ? character.real_y : character.y),
			gold: character.gold || 0,
			need_h: potion_item_count(hpot) < (cfg.needH || 200), need_m: potion_item_count(mpot) < (cfg.needM || 300)
		});
	} catch (e) {}
}

var last_supply_req = 0;

/**
 * Demande ACTIVEMENT du ravitaillement au marchand (protocole "supply"
 * d'albot-js) au lieu d'attendre le prochain ping mux (jusqu'a 8s de latence).
 * Les seuils cfg.needH / cfg.needM sont partages avec le rapport mux pour que
 * la demande explicite et le scan generique du marchand ne divergent jamais.
 */
function request_supply(force) {
	var cfg = CONFIG.potions || {};
	var hpot = cfg.hpot || "hpot1";
	var mpot = cfg.mpot || "mpot1";
	var hp = potion_item_count(hpot);
	var mp = potion_item_count(mpot);
	var need_h = hp < (cfg.needH || 200);
	var need_m = mp < (cfg.needM || 300);
	if (!need_h && !need_m && !force) return;
	if (!force && Date.now() - last_supply_req < 30000) return;
	last_supply_req = Date.now();
	try {
		send_cm(CONFIG.MERCHANT, {
			t: "supply", need_h: need_h, need_m: need_m, hpot: hp, mpot: mp,
			map: character.map,
			x: Math.round((typeof character.real_x === "number") ? character.real_x : character.x),
			y: Math.round((typeof character.real_y === "number") ? character.real_y : character.y)
		});
	} catch (e) {}
}

var start_fail_until = {};
var team_start_busy = false;
var last_start_ms = 0;

function team_child_state(name) {
	try {
		var live = (typeof get_active_characters === "function") ? get_active_characters() : null;
		return (live && live[name]) || "";
	} catch (e) {
		return "";
	}
}

function team_child_running(name) {
	var st = team_child_state(name);
	if (st === "starting" || st === "loading" || st === "active" || st === "code") return true;
	if (typeof parent !== "undefined" && parent.active_characters && parent.active_characters[name]) return true;
	return !!get_player(name);
}

function get_start_character_fn() {
	if (typeof start_character === "function") return start_character;
	if (typeof parent !== "undefined" && typeof parent.start_character === "function") return parent.start_character;
	return null;
}

function maybe_start_team() {
	if (typeof EventExpedition !== "undefined" && EventExpedition.worker()) return;
	var fn = get_start_character_fn();
	if (!fn) return;
	if (team_start_busy) return;
	if (Date.now() - last_start_ms < 6000) return;

	var names = ["Aedroma", "Droma"];
	var slots = CONFIG.TEAM_SLOTS || {};

	for (var i = 0; i < names.length; i++) {
		var name = names[i];
		if (!name || name === character.name) continue;
		if (team_child_running(name)) continue;
		if (start_fail_until[name] && Date.now() < start_fail_until[name]) continue;

		var slot = slots[name] || "";
		last_start_ms = Date.now();
		team_start_busy = true;
		game_log("Demarrage automatique de " + name + (slot ? " (" + slot + ")" : ""), "#469ECF");

		try {
			var p = slot ? fn(name, slot) : fn(name);
			if (p && typeof p.then === "function") {
				p.then(function () {
					game_log("Worker demarre : " + name, "#78C13F");
					start_fail_until[name] = 0;
				}).catch(function (e) {
					var why = (e && (e.reason || e.message)) || e;
					game_log("start " + name + " : " + why, "#E56369");
					start_fail_until[name] = Date.now() + 60000;
				}).then(function () {
					team_start_busy = false;
				});
			} else {
				team_start_busy = false;
			}
		} catch(err) {
			game_log("start " + name + " err: " + err, "#E56369");
			team_start_busy = false;
		}
		return;
	}
}

// ============================================================================
// 14. DEMARRAGE DES BOUCLES D'EXECUTION
// ============================================================================
actionLoop();
skillLoop();
movementLoop();
equipmentLoop();
potionLoop();
partyMaintenanceLoop();
huntLoop();
dumpLoop();
lootLoop();

game_log("Eadroma Warrior v2 charge et pret !", "#78C13F");
