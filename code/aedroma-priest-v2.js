/**
 * ============================================================================
 * AEDROMA — PRÊTRE DU GROUPE (HEALER) V2
 * ============================================================================
 *
 * Rôle principal :
 *   - Rester aux côtés d'Eadroma (Guerrier) à distance de sécurité (Pocket 100-140px).
 *   - Soigner le tank dès qu'il est blessé (<= 80% PV).
 *   - Soigner Droma (Ranger) et se soigner soi-même en priorité d'urgence (< 40% PV).
 *   - Soin de groupe d'urgence (partyheal) si le tank ou plusieurs alliés sont bas.
 *   - Maudire (Curse) les monstres résistants (PV >= 3000) pour amplifier les dégâts.
 *   - Continuer à attaquer pendant le suivi et ne céder le cycle offensif qu'aux soins critiques.
 *   - Équiper automatiquement le meilleur bâton disponible (vstaff > firestaff > staff).
 *   - Boire automatiquement l'élixir d'intelligence (elixirint0).
 *   - Suivre les chasses de monstres et valider les contrats Daisy.
 *   - Transférer les loots encombrants à EadroSell (Mule).
 *
 * Sommaire des sections :
 *   1. CONFIGURATION            — Paramètres éditables du Prêtre
 *   2. INTERFACE COMMAND CENTER — Intégration Dashboard & Synchronisation
 *   3. GESTION DU GROUPE & CM   — Communication radio, invitations, suivi
 *   4. CACHE TACTIQUE           — Détection des alliés, blessures, cibles
 *   5. SYSTÈME DE SOINS         — Heal ciblé, Partyheal d'urgence
 *   6. COMBAT & MALÉDICTION     — Curse, Attack d'appoint (sans compromettre le heal)
 *   7. SUIVI & POCKET           — Maintien de distance de sécurité et anti-mêlée
 *   8. CHASSES DAISY            — Monster Hunter et validation de contrat
 *   9. ÉVÉNEMENTS MONDIAUX      — Live Events (Goo Brawl, Pink Goo, Wabbit...)
 *  10. ÉQUIPEMENT & ÉLIXIRS     — Auto-equip meilleurs bâtons (vstaff...) & élixir INT
 *  11. SURVIE & POTIONS         — Potions d'urgence HP/MP
 *  12. DUMP VERS LA MULE        — Vidage d'inventaire vers EadroSell
 *  13. DÉMARRAGE DES BOUCLES    — Lancement des routines indépendantes
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
	NAME: "Aedroma",
	WARRIOR: "Eadroma",
	RANGER: "Droma",
	MERCHANT: "EadroSell",
	PARTY: ["Eadroma", "Droma"],
	PARTY_GUESTS: ["EadroSell"],
	DEFAULT_FARM: "spider",
	FARM_INDEPENDENT: false,
	DAILY_DUNGEON: false,
	RARE_VISITS: true,

	// --- Seuils de Soin (Heal Rules) ---
	HEAL_HP_RATIO: 0.80,           // Soigner le guerrier dès qu'il passe sous 80% PV
	PARTYHEAL_WARRIOR_RATIO: 0.70, // Partyheal d'urgence si guerrier sous 70% PV
	PARTYHEAL_MIN_ALLIES: 2,       // Partyheal si au moins 2 alliés ont besoin de soin
	SELF_HEAL_RATIO: 0.85,         // Se soigner soi-même sous 85% PV
	SELF_CRITICAL_RATIO: 0.40,     // Priorité d'urgence absolue sur soi-même sous 40% PV
	HEAL_MISSING_HP: 200,          // Soigner un allié s'il lui manque au moins 200 PV
	partyHealMinMp: 2000,          // Garder ce MP pour partyheal : skip le heal mono en dessous

	// --- Positionnement, Kiting & Suivi (Pocket & Anti-Mêlée) ---
	FOLLOW_RANGE: 140,             // Distance maximale de suivi du guerrier
	MIN_RANGE: 95,                 // Ne pas se coller au guerrier (zone de mêlée)
	ANCHOR: 120,                   // Distance idéale en retrait ("pocket")
	MELEE_SAFE: 60,                // Distance de recul face aux monstres au contact
	kiting: {
		enabled: true,             // Kiting angulaire (FreezePhoenix avoidMobs / Crowns3bc rangedKiting)
		optimalDistance: 120,      // Distance ideale vs le harceleur
		sampleAngles: 8,           // 8 echantillons (45 degres) — leger, suffisant en farm
		bossAngles: 12,            // 12 echantillons sur les boss
		stepDistance: 40,          // Longueur du pas de kite (px)
		repositionThreshold: 20,   // Ne bouge que si le gain est significatif
	},
	mpReserve: 800,                // Reserve MP : skip le heal mono-cible si partyheal menace (hysteresis)
	mpHysteresisUpper: 1100,       // Reprise du heal mono au-dessus de ce seuil

	// --- Compétences Offensives & Malédiction ---
	curseEnabled: true,            // Lancer Malédiction pour affaiblir les cibles
	curseMinHp: 50000,             // Réserver curse aux boss/cibles assez longues à tuer
	curseMinMp: 60,                // Réserve minimale de MP pour curse

	// --- Équipement & Consommables Autonomes ---
	WEAPON_PREFERENCE: ["lmace", "vstaff", "firestaff", "staff"], // Ordre de priorité des bâtons
	KEEP_ITEMS: [
		"vstaff", "staff", "oozingterror",
		"elixirint0", "ecape", "tracker",
		"hpot0", "mpot0", "hpot1", "mpot1"
	],
	GIVE_ARMOR: ["coat", "gloves", "pants", "helmet", "shoes"],
	GIVE_WEAPONS: ["blade", "claw"],
	AUTO_ELIXIR: "elixirint0",     // Boire automatiquement cet élixir si inactif

	// --- Survie & Potions ---
	SELF_POT_HP_RATIO: 0.40,       // Boire potion HP de secours si soin en cooldown
	SELF_POT_MP_RATIO: 0.35,       // Boire potion MP sous 35% mana
	HPOT: "hpot1",
	MPOT: "mpot1",
	POT_BUY_COUNT: 200,
	POT_MIN_STOCK: 60,
	needH: 200,                    // Seuil need_h du rapport potions (aligne avec le marchand)
	needM: 300,                    // Seuil need_m du rapport potions (aligne avec le marchand)

	// --- Chasses Daisy ---
	hunts: {
		enabled: true
	},

	// --- Ramassage des coffres (independant des chasses) ---
	// Avant, loot() n'etait appele que dans huntLoop(), donc jamais quand
	// CONFIG.hunts.enabled = false : les coffres du pretre expiraient.
	loot: {
		enabled: true,             // Activer le ramassage automatique des coffres
		intervalMs: 500,           // Intervalle entre deux scans de coffres (ms)
		chestRange: 350            // Portee de ramassage des coffres d'autres joueurs (px)
	},

	// --- Inventaire & Mule ---
	inventory: {
		dumpEsize: 4,               // Vider vers EadroSell si <= 4 slots libres
		dumpCooldownMs: 30000
	}
};

// ============================================================================
// 2. INTERFACE COMMAND CENTER (Dashboard & Synchronisation)
// ============================================================================
var BOARD_CTL = {
	leader: "Eadroma",
	monster: "auto",
	roles: { Eadroma: "Leader", Aedroma: "Follow", Droma: "Follow", EadroSell: "Follow" },
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
	if (!events_enabled()) return null;
	var S = server_status();
	if (!S || typeof S !== "object") return null;
	for (var i = 0; i < JOIN_EVENTS.length; i++) {
		var name = JOIN_EVENTS[i];
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
var tank_pos = { map: "main", x: 0, y: 0, at: 0 };
var leader_intent = { map: "", x: 0, y: 0, targetId: "", monster: "", at: 0 };
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
	if (typeof EventExpedition !== "undefined") EventExpedition.onCm(name, data);
	if (typeof CaveDreams !== "undefined") CaveDreams.onCm(name, data);
	if (typeof WorldEventIntel !== "undefined") WorldEventIntel.onCm(name, data);
	if (typeof TeamCoordinator !== "undefined") TeamCoordinator.onCm(name, data);
	if (!data || typeof data !== "object") return;
	if (name === CONFIG.MERCHANT && data.t === "mux") report_potion_stock(name);

	if (data.t === "ctl") {
		apply_ctl(data.ctl);
	}

	// Suivi de position diffusée par le guerrier
	if (name === CONFIG.WARRIOR && data.map) {
		tank_pos.map = data.map;
		tank_pos.x = data.x;
		tank_pos.y = data.y;
		tank_pos.at = Date.now();
		if (data.destMap) {
			leader_intent = { map: data.destMap, x: data.destX, y: data.destY, targetId: data.targetId || "", monster: data.monster || "", at: Date.now() };
		}
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
	try {
		send_cm(to, {
			t: "pots", hpot: potion_item_count(CONFIG.HPOT), mpot: potion_item_count(CONFIG.MPOT),
			map: character.map, x: Math.round((typeof character.real_x === "number") ? character.real_x : character.x), y: Math.round((typeof character.real_y === "number") ? character.real_y : character.y), gold: character.gold || 0,
			need_h: potion_item_count(CONFIG.HPOT) < (CONFIG.needH || 200), need_m: potion_item_count(CONFIG.MPOT) < (CONFIG.needM || 300)
		});
	} catch (e) {}
}

var last_supply_req = 0;

/**
 * Demande ACTIVEMENT du ravitaillement au marchand (protocole "supply"
 * d'albot-js) au lieu d'attendre le prochain ping mux (jusqu'a 8s de latence).
 * Les seuils CONFIG.needH / CONFIG.needM sont partages avec le rapport mux car
 * une panne de mana du pretre coute la vie du guerrier.
 */
function request_supply(force) {
	var hp = potion_item_count(CONFIG.HPOT);
	var mp = potion_item_count(CONFIG.MPOT);
	var need_h = hp < (CONFIG.needH || 200);
	var need_m = mp < (CONFIG.needM || 300);
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

// Hysteresis MP anti-yoyo (Crowns3bc) : le heal mono-cible est suspendu quand la
// mana chute sous mpReserve, repris au-dessus de mpHysteresisUpper — le partyheal
// d'urgence (~400 MP) reste ainsi toujours finançable.
var mp_spend_locked = false;

function mp_spend_ok(extraCost) {
	var mp = character.mp || 0;
	var reserve = CONFIG.mpReserve || 0;
	var upper = CONFIG.mpHysteresisUpper || reserve;
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
// privilegie la distance optimale au harceleur et les cases marchables.
function kite_step(harasser) {
	var k = CONFIG.kiting || {};
	if (!k.enabled || !harasser) return false;
	var cx = (typeof character.real_x === "number") ? character.real_x : character.x;
	var cy = (typeof character.real_y === "number") ? character.real_y : character.y;
	var optimal = k.optimalDistance || 120;
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
		// Bonus : s'eloigner franchement si on est au contact
		if (d > distance(character, harasser)) score += 15;
		if (score > bestScore) { bestScore = score; best = { x: nx, y: ny }; }
	}
	if (!best) return false;
	// Ne bouger que si le gain est significatif (anti-jitter)
	var curD = distance(character, harasser);
	var newD = Math.hypot(best.x - harasser.x, best.y - harasser.y);
	if (Math.abs(newD - optimal) > Math.abs(curD - optimal) - threshold && newD <= curD) return false;
	move(best.x, best.y);
	return true;
}

// Revive (albot-js HawkPriest) : get_player() ne voit que les allies vivants a
// l'ecran — parent.entities expose aussi les cadavres (rip) pour le revive.
function find_fallen(name) {
	var p = (typeof get_player === "function") ? get_player(name) : null;
	if (p && p.rip) return p;
	if (typeof parent !== "undefined" && parent.entities) {
		for (var id in parent.entities) {
			var e = parent.entities[id];
			if (e && e.type === "character" && e.name === name && e.rip) return e;
		}
	}
	return null;
}

async function try_revive_allies() {
	if (typeof StyleLoadout !== "undefined" && !StyleLoadout.selected("revive")) return false;
	if (is_on_cooldown("revive")) return false;
	var names = [CONFIG.WARRIOR, CONFIG.RANGER];
	for (var i = 0; i < names.length; i++) {
		var fallen = find_fallen(names[i]);
		if (!fallen) continue;
		// Se rapprocher du cadavre si hors de portee du revive
		if (!is_in_range(fallen, "revive")) {
			if (typeof can_move_to === "function" && can_move_to(fallen.x, fallen.y)) move(fallen.x, fallen.y);
			else if (typeof smart_move === "function") { try { await smart_move({ map: character.map, x: fallen.x, y: fallen.y }); } catch(e) {} }
			return true; // déplacement en cours — on réessaie au prochain cycle
		}
		try { await use_skill("revive", fallen); return true; } catch(e) {}
	}
	return false;
}

// ============================================================================
// 4. CACHE TACTIQUE (Détection du Groupe & des Blessures)
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
	ranger: null,
	merchant: null,
	target: null,
	injuredAllies: [],
	alliesUnderAttack: [],
	criticalCount: 0
};
var sticky_target_id = "";
var sticky_target_at = 0;

function hp_ratio(entity) {
	if (!entity || !entity.max_hp) return 1;
	return entity.hp / entity.max_hp;
}

function needs_heal(entity) {
	if (!entity || entity.dead || entity.rip) return false;
	var ratio = hp_ratio(entity);
	if (entity.name === CONFIG.WARRIOR) {
		return ratio <= CONFIG.HEAL_HP_RATIO;
	}
	if (entity.name === character.name) {
		return ratio <= CONFIG.SELF_HEAL_RATIO;
	}
	return (entity.max_hp - entity.hp) >= CONFIG.HEAL_MISSING_HP || ratio <= 0.85;
}

function valid_attack_target(target) {
	if (typeof EventRouter !== "undefined" && EventRouter.activeMonster() === "franky" && target && target.mtype !== "franky") return false;
	return !!(target && target.type === "monster" && !target.dead && target.visible);
}

function remember_attack_target(target) {
	if (!valid_attack_target(target)) return false;
	cache.target = target;
	sticky_target_id = target.id;
	sticky_target_at = Date.now();
	return true;
}

function updateCache() {
	var now = Date.now();
	if (now - cache.lastUpdate < 50) return;
	cache.lastUpdate = now;

	cache.warrior = get_player(CONFIG.WARRIOR);
	cache.ranger = get_player(CONFIG.RANGER);
	cache.merchant = get_player(CONFIG.MERCHANT);
	cache.injuredAllies = [];
	cache.criticalCount = 0;
	cache.alliesUnderAttack = [];
	cache.target = null;

	var partyMembers = [character];
	if (cache.warrior) partyMembers.push(cache.warrior);
	if (cache.ranger) partyMembers.push(cache.ranger);

	for (var i = 0; i < partyMembers.length; i++) {
		var member = partyMembers[i];
		if (!member || member.dead || member.rip) continue;
		var r = hp_ratio(member);
		if (r <= 0.50) cache.criticalCount++;
		if (needs_heal(member)) {
			cache.injuredAllies.push(member);
		}
	}

	// Classement des blessés : le plus bas en ratio d'abord
	cache.injuredAllies.sort(function(a, b) {
		return hp_ratio(a) - hp_ratio(b);
	});

	// Ciblage du monstre engagé par le guerrier
	if (cache.warrior && cache.warrior.target) {
		var wt = parent.entities[cache.warrior.target];
		remember_attack_target(wt);
	}

	// Le CM du leader contient l'id de sa cible. Il reste exploitable pendant
	// le déplacement, avant que get_player() ne reflète son nouvel engagement.
	if (!cache.target && leader_intent.targetId) {
		remember_attack_target(parent.entities[leader_intent.targetId]);
	}

	// Sinon, monstre nous attaquant directement
	if (!cache.target) {
		for (var id in parent.entities) {
			var e = parent.entities[id];
			if (!e || e.type !== "monster" || e.dead || !e.visible) continue;
			if (typeof EventRouter !== "undefined" && EventRouter.activeMonster() === "franky" && e.mtype !== "franky") continue;
			// Keep contributing even if the warrior's transient target id was not
			// propagated yet. Any monster fighting our party is a safe shared target.
			if (e.target === character.name || e.target === CONFIG.WARRIOR || e.target === CONFIG.RANGER) {
				remember_attack_target(e);
				break;
			}
		}
	}

	// Conserver brièvement la cible partagée entre deux mises à jour du guerrier.
	// Sans cela le prêtre perdait sa cible à chaque transition et ne tirait que
	// quelques fois entre deux recalculs de trajectoire.
	if (!cache.target && sticky_target_id && now - sticky_target_at < 2000) {
		remember_attack_target(parent.entities[sticky_target_id]);
	}
}

// ============================================================================
// 5. SYSTÈME DE SOINS (Heal Ciblé & Partyheal)
// ============================================================================
async function healLoop() {
	try {
		if (is_disabled(character) || character.rip) {
			setTimeout(healLoop, 200);
			return;
		}
		if (typeof CaveDreams !== "undefined" && CaveDreams.inCave() && CaveDreams.paused && CaveDreams.paused()) {
			setTimeout(healLoop, 200);
			return;
		}

		updateCache();
		// Revive prioritaire (albot-js) : gere aussi les cadavres hors ecran via parent.entities.
		if (await try_revive_allies()) {
			setTimeout(healLoop, typeof ActionTiming !== "undefined" ? ActionTiming.after("revive", 500, 60) : 500);
			return;
		}

		// 1. Soin de groupe d'urgence (Partyheal) — MP protege par hysteresis
		var tankLow = cache.warrior && hp_ratio(cache.warrior) <= CONFIG.PARTYHEAL_WARRIOR_RATIO;
		var multipleLow = cache.criticalCount >= CONFIG.PARTYHEAL_MIN_ALLIES;
		if ((tankLow || multipleLow) && (typeof StyleLoadout === "undefined" || StyleLoadout.allows("partyheal")) && !is_on_cooldown("partyheal") && character.mp >= 400) {
			try {
				await use_skill("partyheal");
				setTimeout(healLoop, typeof ActionTiming !== "undefined" ? ActionTiming.after("partyheal", 250, 40) : 250);
				return;
			} catch(e) {}
		}

		// 2. Soin ciblé individuel (Heal) — suspendu sous reserve MP pour proteger le partyheal
		if ((typeof StyleLoadout === "undefined" || StyleLoadout.allows("heal")) && !is_on_cooldown("heal") && mp_spend_ok(G.skills.heal ? G.skills.heal.mp : 20) && character.mp >= (G.skills.heal ? G.skills.heal.mp : 20)) {
			var targetToHeal = null;

			// Urgence absolue : soi-même si PV critiques (< 40%)
			if (hp_ratio(character) <= CONFIG.SELF_CRITICAL_RATIO) {
				targetToHeal = character;
			} else if (cache.warrior && needs_heal(cache.warrior) && is_in_range(cache.warrior, "heal")) {
				targetToHeal = cache.warrior;
			} else if (needs_heal(character)) {
				targetToHeal = character;
			} else if (cache.ranger && needs_heal(cache.ranger) && is_in_range(cache.ranger, "heal")) {
				targetToHeal = cache.ranger;
			}

			if (targetToHeal) {
				try {
					await heal(targetToHeal);
					setTimeout(healLoop, typeof ActionTiming !== "undefined" ? ActionTiming.after("heal", 100, 30) : 100);
					return;
				} catch(e) {}
			}
		}
	} catch(e) {}

	setTimeout(healLoop, 80);
}

// ============================================================================
// 6. COMBAT & MALÉDICTION (Curse, Attack d'appoint)
// ============================================================================
async function combatLoop() {
	if (typeof EventExpedition !== "undefined" && !EventExpedition.canCombat()) { setTimeout(combatLoop, 250); return; }
	var combatDelay = 100;
	try {
		if (is_disabled(character) || character.rip) {
			setTimeout(combatLoop, 250);
			return;
		}
		if (typeof CaveDreams !== "undefined" && CaveDreams.inCave()) {
			setTimeout(combatLoop, 200);
			return;
		}
		updateCache();

		var target = cache.target;
		if (typeof EventExpedition !== "undefined" && !EventExpedition.canCombat(target)) { setTimeout(combatLoop, 250); return; }
		if (!target || !is_in_range(target, "attack")) {
			setTimeout(combatLoop, 200);
			return;
		}

		if (typeof StyleLoadout !== "undefined" && StyleLoadout.selected("darkblessing") && !is_on_cooldown("darkblessing") && character.mp >= 900 && character.mp / character.max_mp >= 0.80 && target.target) {
			try { await use_skill("darkblessing"); } catch(e) {}
		}

		if (typeof StyleLoadout !== "undefined" && StyleLoadout.selected("absorb") && !is_on_cooldown("absorb") && character.mp >= 200 && hp_ratio(character) > 0.60) {
			var ranger = cache.ranger || get_player(CONFIG.RANGER);
			if (ranger) {
				for (var eid in parent.entities) {
					var enemy = parent.entities[eid];
					if (enemy && enemy.type === "monster" && !enemy.dead && enemy.target === ranger.name) {
						try { await use_skill("absorb", ranger); } catch(e) {}
						break;
					}
				}
			}
		}

		// 1. Malédiction (Curse) sur les gros monstres — n'utilise pas le cooldown
		// d'attaque, donc ne jamais quitter le cycle avant l'attaque de base.
		if (CONFIG.curseEnabled && (typeof StyleLoadout === "undefined" || StyleLoadout.allows("curse")) && !is_on_cooldown("curse") && character.mp >= CONFIG.curseMinMp) {
			var isBigMonster = (target.max_hp >= CONFIG.curseMinHp);
			var notCurseImmune = (!target.s || !target.s.cursed);
			if (isBigMonster && notCurseImmune) {
				try {
					await use_skill("curse", target);
				} catch(e) {}
			}
		}

		// 2. Attaque d'appoint (si heal en cooldown ou tout le monde est en bonne santé)
		if (can_attack(target) && !is_on_cooldown("attack")) {
			try {
				await attack(target);
				if (typeof ActionTiming !== "undefined") combatDelay = ActionTiming.after("attack", 100, 20);
			} catch(e) {}
		}

	} catch(e) {}

	setTimeout(combatLoop, combatDelay);
}


// ============================================================================
// 7. SUIVI DU GUERRIER & POSITIONNEMENT TACTIQUE (Pocket)
// ============================================================================
function get_heal_pocket(warrior, monster) {
	if (!warrior) return null;
	if (!monster) {
		// Pas de monstre : rester juste en retrait du guerrier
		return { x: warrior.x - 40, y: warrior.y + 40 };
	}
	// Calculer la position opposée au monstre pour ne pas être dans la ligne d'attaque
	var dx = warrior.x - monster.x;
	var dy = warrior.y - monster.y;
	var len = Math.hypot(dx, dy);
	if (len < 1) return { x: warrior.x, y: warrior.y + Math.min(CONFIG.ANCHOR, character.range * 0.8) };
	var nx = dx / len;
	var ny = dy / len;
	// Anchor from the monster, not from the warrior. The previous formula put
	// the priest at monster→warrior distance + 120px, commonly outside the
	// priest's own attack range. Keep a safe ranged pocket that can still fire.
	var attackPocket = Math.max(CONFIG.MELEE_SAFE, Math.min(CONFIG.ANCHOR, character.range * 0.82));
	return {
		x: Math.round(monster.x + nx * attackPocket),
		y: Math.round(monster.y + ny * attackPocket)
	};
}

function get_leader_target() {
	// En combat visible, suivre la position réelle du tank. Une destination CM
	// peut être plus loin et provoquer un déplacement continu autour d'une cible.
	var p = get_player(CONFIG.WARRIOR);
	if (p && cache.target) return { map: character.map, x: p.x, y: p.y, entity: p };
	// The destination broadcast lets followers leave immediately instead of
	// waiting until the warrior has already reached the next map or monster.
	if (leader_intent.at && Date.now() - leader_intent.at < 12000 && leader_intent.map) {
		var intentFar = character.map !== leader_intent.map || distance(character, leader_intent) > 110;
		if (intentFar) return { map: leader_intent.map, x: leader_intent.x, y: leader_intent.y, entity: null, intent: true };
	}
	// 1. Joueur directement visible à l'écran
	p = get_player(CONFIG.WARRIOR);
	if (p) return { map: character.map, x: p.x, y: p.y, entity: p };

	// 2. Données de groupe (get_party()) — Transmis par le jeu à travers TOUTES les cartes !
	var party = (typeof get_party === "function") ? get_party() : (typeof parent !== "undefined" ? parent.party : null);
	if (party && party[CONFIG.WARRIOR] && party[CONFIG.WARRIOR].map) {
		var mem = party[CONFIG.WARRIOR];
		return { map: mem.map, x: mem.x, y: mem.y, entity: null };
	}

	// 3. Dernière position radio CM
	if (tank_pos.at && (Date.now() - tank_pos.at < 60000)) {
		return { map: tank_pos.map, x: tank_pos.x, y: tank_pos.y, entity: null };
	}

	// 4. Aucun contact
	return null;
}

var travel_dest_map = "";
var last_pocket_move = { x: 0, y: 0, at: 0 };

async function movementLoop() {
	if (typeof EventExpedition !== "undefined" && await EventExpedition.actorTick()) { setTimeout(movementLoop, 500); return; }
	try {
		if (is_disabled(character) || character.rip) {
			setTimeout(movementLoop, 300);
			return;
		}
		// Pause le suivi si un voyage vers la mule ou Daisy est en cours
		if (state.dumpInProgress || state.huntInProgress) {
			setTimeout(movementLoop, 500);
			return;
		}

		updateCache();

		// 0. Evenements en direct : join() pour les instances, trajet pour les boss.
		if (typeof EventRouter !== "undefined" && await EventRouter.tick()) {
			setTimeout(movementLoop, 250);
			return;
		}

		if (typeof CaveDreams !== "undefined" && await CaveDreams.tick("follow")) {
			setTimeout(movementLoop, 300);
			return;
		}
		var leader = get_leader_target();

		if (!leader) {
			// Aucun contact avec le guerrier → ferme le smart_move en cours et attend
			if (smart.moving) stop();
			travel_dest_map = "";
			setTimeout(movementLoop, 1500);
			return;
		}

		// Si le guerrier est sur une autre carte
		if (leader.map && leader.map !== character.map) {
			// Si on voyage déjà VERS cette carte, laisser continuer
			if (smart.moving && travel_dest_map === leader.map) {
				setTimeout(movementLoop, 400);
				return;
			}
			// Sinon (nouveau trajet ou destination changée) : annuler et repartir
			if (smart.moving) stop();
			travel_dest_map = leader.map;
			set_message("→ " + leader.map);
			await smart_move({ map: leader.map, x: leader.x, y: leader.y });
			travel_dest_map = "";
			setTimeout(movementLoop, 250);
			return;
		}

		// Sur la même carte — trajet cross-map terminé
		travel_dest_map = "";

		// Si on avait un smart_move en cours (cross-map) et qu'on est arrivé, l'arrêter
		if (smart.moving) {
			setTimeout(movementLoop, 200);
			return;
		}

		var dist = distance(character, leader);

		if (leader.entity) {
			var warrior = leader.entity;

			// Kiting angulaire : si un monstre nous colle, echantillonner les
			// directions (real_x/real_y) au lieu d'un simple pas droit derriere.
			var tooCloseMob = null;
			for (var id in parent.entities) {
				var e = parent.entities[id];
				if (e && e.type === "monster" && !e.dead && e.visible && distance(character, e) < CONFIG.MELEE_SAFE) {
					tooCloseMob = e;
					break;
				}
			}

			if (tooCloseMob) {
				if (kite_step(tooCloseMob)) {
					setTimeout(movementLoop, 250);
					return;
				}
				// Fallback : simple pas droit derriere si aucune case kitee n'est libre
				var awayX = character.x + (character.x - tooCloseMob.x);
				var awayY = character.y + (character.y - tooCloseMob.y);
				if (can_move_to(awayX, awayY)) {
					move(awayX, awayY);
					setTimeout(movementLoop, 250);
					return;
				}
			}

			// Une cible deja a portee est une position de combat valide. Le prêtre
			// ne doit pas fuir le guerrier toutes les 250 ms uniquement parce que
			// celui-ci passe sous MIN_RANGE : les menaces au contact sont deja
			// traitees par le bloc de kiting ci-dessus.
			var targetInRange = cache.target && is_in_range(cache.target, "attack");
			var combatStable = targetInRange && dist <= CONFIG.FOLLOW_RANGE + 40;
			if (combatStable) {
				// Un pas de kite peut continuer plusieurs cycles après la sortie de la
				// zone dangereuse. L'arrêter dès que la portée est bonne évite qu'il
				// annule les projectiles suivants.
				if (character.moving) stop();
			}
			var attackPocketNeeded = cache.target && !targetInRange;
			var idleSpacingNeeded = !cache.target && dist < CONFIG.MIN_RANGE;
			if (!combatStable && (dist > CONFIG.FOLLOW_RANGE || idleSpacingNeeded || attackPocketNeeded)) {
				var pocket = get_heal_pocket(warrior, cache.target);
				var pocketChanged = pocket && (Math.hypot(pocket.x - last_pocket_move.x, pocket.y - last_pocket_move.y) > 18 || Date.now() - last_pocket_move.at > 750);
				if (pocketChanged) {
					last_pocket_move = { x: pocket.x, y: pocket.y, at: Date.now() };
					if (can_move_to(pocket.x, pocket.y)) {
						move(pocket.x, pocket.y);
					} else {
						await smart_move(pocket);
					}
				}
			}
		} else {
			// Guerrier sur la même carte mais hors de l'écran : se rapprocher
			if (dist > CONFIG.FOLLOW_RANGE) {
				set_message("rejoindre tank");
				await smart_move({ map: leader.map, x: leader.x, y: leader.y });
			}
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
	if (typeof EventExpedition !== "undefined" && EventExpedition.worker()) { setTimeout(huntLoop, 3000); return; }
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
				game_log("Contrat Daisy actif : " + myh.id + " (" + myh.c + " restant) ! Retour au groupe.", "#98c379");
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
// 9. GESTION DES ARMES, BÂTONS & ÉLIXIRS
// ============================================================================
function find_item(name) {
	var items = character.items || [];
	for (var i = 0; i < items.length; i++) {
		if (items[i] && items[i].name === name) return i;
	}
	return -1;
}

function item_count(name) {
	var n = 0, items = character.items || [];
	for (var i = 0; i < items.length; i++) {
		if (items[i] && items[i].name === name) n += items[i].q || 1;
	}
	return n;
}

async function auto_equip_weapon() {
	var current = character.slots && character.slots.mainhand && character.slots.mainhand.name;
	var prefs = CONFIG.WEAPON_PREFERENCE || ["vstaff", "firestaff", "staff"];

	for (var i = 0; i < prefs.length; i++) {
		var wname = prefs[i];
		if (current === wname) return; // Meilleur bâton déjà équipé
		var slot = find_item(wname);
		if (slot >= 0) {
			try {
				await equip(slot, "mainhand");
				game_log("Baton equipe : " + wname, "#5DAC40");
				return;
			} catch(e) {}
		}
	}
}

async function auto_drink_elixir() {
	// Let the dashboard own the elixir slot when a rule exists for this priest.
	if (typeof dashboard_elixir_rule === "function" && dashboard_elixir_rule()) return;
	if (!CONFIG.AUTO_ELIXIR) return;
	// Vérifie si un élixir est déjà actif
	var s = character.s || {};
	var hasElixir = s.elixir || s.elixirint0 || s.elixirint1 || s.elixirint2;
	if (hasElixir) return;

	var slot = find_item(CONFIG.AUTO_ELIXIR);
	if (slot >= 0) {
		try {
			await use(slot);
			game_log("Elixir bu : " + CONFIG.AUTO_ELIXIR, "#469ECF");
		} catch(e) {}
	}
}

async function equipmentLoop() {
	try {
		if (is_disabled(character) || character.rip) {
			setTimeout(equipmentLoop, 3000);
			return;
		}

		if (typeof StyleLoadout === "undefined" || !StyleLoadout.hasSlot("mainhand")) await auto_equip_weapon();
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
	var potionDelay = 250;
	try {
		if (character.rip) {
			try { respawn(); } catch(e) {}
			setTimeout(potionLoop, 2000);
			return;
		}

		var hpRatio = hp_ratio(character);
		var mp = character.mp || 0;
		var maxMp = character.max_mp || 1;

		// Potion HP de secours si soin en recharge
		if (hpRatio <= CONFIG.SELF_POT_HP_RATIO && !is_on_cooldown("use_hp")) {
			try { await use_skill("use_hp"); if (typeof ActionTiming !== "undefined") potionDelay = ActionTiming.after("use_hp", 250, 40); } catch(e) {}
		}

		// Potion MP si mana bas
		if ((mp / maxMp) <= CONFIG.SELF_POT_MP_RATIO && !is_on_cooldown("use_mp")) {
			try { await use_skill("use_mp"); if (typeof ActionTiming !== "undefined") potionDelay = ActionTiming.after("use_mp", 250, 40); } catch(e) {}
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
function is_potion_name(name) {
	return !!name && (name.startsWith("hpot") || name.startsWith("mpot"));
}

function equipped_count(name) {
	var count = 0;
	var slots = character.slots || {};
	for (var slot in slots) {
		if (slot.startsWith("trade")) continue;
		if (slots[slot] && slots[slot].name === name) count++;
	}
	return count;
}

function max_keep_count(name) {
	if (is_potion_name(name)) return 999999;
	if (name === "tracker") return 1;
	if (name.startsWith("elixir")) return 2;
	return 1;
}

/** Keep only the useful quota; extra copies of protected gear still go to the mule. */
function is_dumpable_slot(slotIndex) {
	var items = character.items || [];
	var item = items[slotIndex];
	if (!item || item.l) return false;
	if (is_potion_name(item.name)) return false;
	var loadoutItems = CONFIG.LOADOUT_ITEMS || [];
	for (var li = 0; li < loadoutItems.length; li++) {
		if (loadoutItems[li].item === item.name && (item.level || 0) >= (loadoutItems[li].minLevel || 0)) return false;
	}

	var keep = CONFIG.KEEP_ITEMS || [];
	var protectedName = item.name.startsWith("elixir") || item.name === "tracker" || keep.indexOf(item.name) >= 0;
	if (!protectedName) return true;

	var allowedInBag = Math.max(0, max_keep_count(item.name) - equipped_count(item.name));
	if (allowedInBag <= 0) return true;

	var sameSlots = [];
	for (var i = 0; i < items.length; i++) {
		var it = items[i];
		if (it && it.name === item.name) {
			sameSlots.push({ index: i, level: it.level || 0, shiny: !!it.shiny });
		}
	}

	sameSlots.sort(function(a, b) {
		if (b.level !== a.level) return b.level - a.level;
		return a.index - b.index;
	});

	var rank = -1;
	for (var r = 0; r < sameSlots.length; r++) {
		if (sameSlots[r].index === slotIndex) {
			rank = r;
			break;
		}
	}

	if (rank >= 0 && rank < allowedInBag) {
		return false;
	}

	return true;
}

function dumpable_count() {
	var count = 0;
	var items = character.items || [];
	for (var i = 0; i < items.length; i++) {
		if (items[i] && is_dumpable_slot(i)) count++;
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
	var sent = 0;
	var failures = 0;
	for (var i = 0; i < items.length; i++) {
		var it = items[i];
		if (it && is_dumpable_slot(i)) {
			try {
				await send_item(muleName, i, it.q || 1);
				sent++;
				await sleep_ms(150);
			} catch (e) {
				failures++;
				game_log("Dump impossible pour " + it.name + " (slot " + i + ") : " + String(e && e.message || e), "#e06c75");
			}
		}
	}

	if (character.gold > 60000) {
		try {
			await send_gold(muleName, character.gold - 50000);
		} catch(e) {}
	}

	var remaining = dumpable_count();
	if (sent > 0) game_log("Dump mule : " + sent + " slot(s) transfere(s), " + remaining + " restant(s).", "#98c379");
	if (failures > 0 || remaining > 0) {
		game_log("Dump incomplet : verifier les places libres d'EadroSell.", "#e5c07b");
		return false;
	}
	return true;
}

// ============================================================================
// Ramassage autonome des coffres (independant des chasses Daisy)
// ============================================================================
// loot() n'etait appele qu'a l'interieur de huntLoop(), lui-meme coupe quand
// CONFIG.hunts.enabled = false. Les coffres priesques expiraient donc sans
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

async function dumpLoop() {
	if (typeof EventExpedition !== "undefined" && EventExpedition.worker()) { setTimeout(dumpLoop, 3000); return; }
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

		// 1. Si la mule est tout près, décharger directement
		if (!state.dumpInProgress && mule && distance(character, mule) <= 250 && dumpable_count() > 0) {
			await dump_items_to_mule();
		}

		// 2. Trajet vers la mule si le sac est plein
		if (state.dumpInProgress) {
			if (freeSlots > dumpLimit && dumpable_count() === 0) {
				state.dumpInProgress = false;
				state.dumpFailures = 0;
				state.lastDumpTrip = Date.now();
				game_log("Inventaire vidé ! Retour au groupe.", "#98c379");
			} else if (mule && distance(character, mule) <= 250) {
				var completed = await dump_items_to_mule();
				if (completed) {
					state.dumpInProgress = false;
					state.dumpFailures = 0;
					state.lastDumpTrip = Date.now();
					game_log("Inventaire vidé ! Retour au groupe.", "#98c379");
				} else {
					state.dumpFailures++;
					if (state.dumpFailures >= 3) {
						state.dumpInProgress = false;
						state.dumpFailures = 0;
						state.lastDumpTrip = Date.now();
						game_log("Dump abandonne apres 3 essais. EadroSell est probablement plein.", "#e06c75");
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
				game_log("Sac plein (" + freeSlots + " slots) ! Départ vers " + CONFIG.MERCHANT + "...", "#e5c07b");
				if (smart.moving) stop();
				await smart_move(muleTarget);
			}
		}

	} catch(e) {}

	setTimeout(dumpLoop, 3000);
}

// ============================================================================
// 12. DÉMARRAGE DES BOUCLES D'EXÉCUTION
// ============================================================================
healLoop();
combatLoop();
movementLoop();
huntLoop();
equipmentLoop();
potionLoop();
dumpLoop();
lootLoop();

game_log("Aedroma v2 demarre — soigneur actif", "#78C13F");
