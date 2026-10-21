/**
 * ============================================================================
 * EADROSELL — MARCHAND / MULE (MERCHANT) V2
 * ============================================================================
 *
 * Script simplifié, modulaire et hautement lisible pour marchand dans Adventure Land.
 * Conçu pour être facilement modifiable et configurable par un humain,
 * tout en restant 100% compatible avec le Command Center (dashboard).
 *
 * Rôles :
 * - Tenir le stand de marché ouvert (vente joueur-à-joueur).
 * - Buff mluck sur toute l'équipe et ravitaillement en potions.
 * - Achat auto de potions HP/MP et parchemins normaux (scroll0).
 * - Vente des déchets à Gabriel (NPC), échanges chez Xyn.
 * - Amélioration d'équipements (Cue, Mass Production avant).
 * - Fusion de bijoux x3 (compound, bank si nécessaire).
 * - Dépôt en banque quand l'inventaire est plein.
 * ============================================================================
 *
 * Architecture en boucles indépendantes :
 *   1. CONFIG                  — Toutes les préférences ici
 *   2. Interface Command Center — BOARD_CTL, apply_ctl, poll_board
 *   3. Utilitaires              — Inventaire, déplacement, NPCs
 *   4. Communication Farmers   — on_cm, ping_farmers, mluck
 *   5. serviceLoop()           — mluck buff + potions en ville
 *   6. stockLoop()             — Achat potions + parchemins
 *   7. standLoop()             — Stand de marché
 *   8. townChoresLoop()        — Gabriel sell + Xyn exchange + banque
 *   9. upgradeLoop()           — Upgrades + compound
 *  10. Démarrage des boucles
 * ============================================================================
 */

// GUI externe dans le navigateur (DPS / XP / stats)
// if (typeof parent !== "undefined" && parent.$) {
// 	load_code("gui", function () { game_log("gui slot missing"); });
// }

// ============================================================================
// 1. CONFIGURATION — Modifiez vos préférences ici
// ============================================================================
var CONFIG = {
	// --- Personnages ---
	NAME: "EadroSell",
	FARMERS: ["Eadroma", "Droma", "Aedroma"],
	WARRIOR: "Eadroma",
	PRIEST: "Aedroma",
	RANGER: "Droma",
	// --- Démarrage automatique de l'équipe depuis cette fenêtre marchand ---
	TEAM_SLOTS: {
		Eadroma: "CC_Eadroma",
		Aedroma: "CC_Aedroma",
		Droma: "CC_Droma"
	},
	TEAM_SUPERVISOR_ENABLED: true,
	TEAM_START_INTERVAL_MS: 8000,
	TEAM_START_RETRY_MS: 60000,

	// --- Potions ---
	HPOT: "hpot1",           // Potion HP achetée et distribuée
	MPOT: "mpot1",           // Potion MP achetée et distribuée
	POT_STOCK: 3000,         // Quantité à maintenir en stock (HP)
	MPOT_STOCK: 3000,        // Quantité à maintenir en stock (MP)
	POT_GIVE: 1000,          // Donne jusqu'à N potions HP par farmer
	MPOT_GIVE: 1000,         // Donne jusqu'à N potions MP par farmer
	POT_THRESHOLD_H: 800,    // Farmer a besoin de potions HP si en dessous
	POT_THRESHOLD_M: 800,    // Farmer a besoin de potions MP si en dessous
	SELF_HP_RATIO: 0.70,     // Potion HP personnelle sous 70% de vie
	SELF_MP_RATIO: 0.65,     // Mana prioritaire : mluck et production doivent rester disponibles
	SELF_HPOT_RESERVE: 100,  // Stock personnel que les livraisons ne peuvent pas céder
	SELF_MPOT_RESERVE: 150,
	// Hystérésis d'achat (Crowns3bc) : on ne relance un voyage d'achat qu'une fois
	// le stock passé SOUS le seuil bas, puis on remplit jusqu'à POT_STOCK/MPOT_STOCK.
	// Évite le spam d'aller-retours quand le stock oscille autour de la cible.
	POT_STOCK_LOW_H: 1200,   // Seuil BAS avant de relancer un achat HP
	POT_STOCK_LOW_M: 1200,   // Seuil BAS avant de relancer un achat MP
	RESTOCK_COOLDOWN_MS: 60000, // Délai minimum entre deux voyages d'achat de potions

	// --- Parchemins (achat automatique) ---
	SCROLL_STOCK: {
		scroll0: 50,           // Parchemins d'upgrade normaux (grade 0)
		cscroll0: 8,           // Parchemins compound normaux (grade 0)
		cscroll1: 2,           // Parchemins compound (grade 1)
	},

	// --- Stand de marché ---
	BAG_DUMP: 10,            // Dépose en banque si slots libres <= cette valeur

	// --- Échanges Xyn ---
	EXCHANGE_ITEMS: [
		"anniversarygift", "gem0", "gift0",
		"candy1", "candy0", "mistletoe",
		"candy1v2", "candy0v2", "candy1v3", "candy0v3"
	],
	EXCHANGE_MIN: { anniversarygift: 50 }, // Seuil minimum avant d'aller chez Xyn

	// --- Vente NPC Gabriel ---
	GABRIEL_SELL: [
		"ringsj", "seashell", "beewings", "gslime", "hpbelt", "hpamulet",
		"rattail", "spores", "reefglass", "crabclaw", "dstones",
		"helmet", "coat", "gloves", "pants", "shoes",
		"helmet1", "coat1", "gloves1", "pants1", "shoes1",
		"poker", "confetti",
		"stinger", "mushroomstaff", "slimestaff", "partyhat",
		"wcap", "wbreeches", "wgloves", "wshoes",
		"pumpkinspice", "smoke", "phelmet", "xmasshoes", "merry"
	],

	// --- Upgrades (Cue) ---
	// Items à ne JAMAIS améliorer
	NEVER_UPGRADE: {
		blade:1, fireblade:1, wcap:1, wbreeches:1,
		ecape:1, quiver:1, alloyquiver:1,
		ololipop:1, glolipop:1
	},
	UPGRADE_GOLD_MIN: 0,    // Gold minimum requis pour lancer un upgrade (override dashboard)

	// --- Banque ---
	BAG_BANK_THRESHOLD: 10, // Va à la banque si slots libres <= cette valeur
	BANK_COOLDOWN_MS: 45000, // Cooldown minimum de 45s entre deux visites à la banque pour éviter le spam
	// Politique de tri (inspire du "Bank Sorter" de Crowns3bc).
	// BANK_ALWAYS : items qui partent TOUJOURS en banque, meme si une autre regle
	// les laisserait sur le personnage. Ils sont deposes en PRIORITE (avant que la
	// banque ne se remplisse).
	BANK_ALWAYS: [
		"gem0", "gem1", "gem2", "gem3", "gem4",
		"candy0", "candy1", "mistletoe",
		"vorb", "offering", "goldenpower", "seashell", "frozenstone",
		"platinumnugget", "goldnugget", "armorbox", "weaponbox", "xbox",
		"essenceofgreed", "essenceoflife", "essenceoffire", "essenceofnature"
	],
	// BANK_NEVER : items qui ne doivent JAMAIS aller en banque (consommables de
	// craft en cours, monnaies d'echange, objets a ameliorer).
	BANK_NEVER: {
		hpot0: 1, hpot1: 1, mpot0: 1, mpot1: 1,
		scroll0: 1, scroll1: 1, cscroll0: 1, cscroll1: 1,
		stand0: 1, computer: 1, tracker: 1,
		marketparcel: 1, monstertoken: 1,
		feather0: 1, wingedboots: 1
	},

	// --- Divers ---
	MUX_MS: 8000,           // Intervalle de ping aux farmers (ms)
	REACH: 300,             // Distance de portée pour donner des items/potions
	HOME: { map: "main", x: -100, y: -20 }, // Position idle / stand par défaut
};

// ============================================================================
// 2. INTERFACE COMMAND CENTER (Dashboard)
// ============================================================================
//
// IMPORTANT : builder.ts remplace apply_ctl() et poll_board() par des stubs vides.
// Il remplace aussi BOARD_CTL par le board guerrier (sans listings, standEnabled, etc.).
// On lit donc __ALCC DIRECTEMENT via get_alcc() — nom inconnu du builder.
//

var BOARD_CTL = {};

// Ne PAS renommer : builder.ts remplace ces deux fonctions par return;
function apply_ctl() {}
function poll_board() {}

/**
 * Lit la configuration injectée par le Command Center (__ALCC).
 * Toujours utiliser cette fonction plutôt que BOARD_CTL ou poll_board().
 * Le builder ne touche pas à get_alcc() => toujours fonctionnel.
 */
function get_alcc() {
	return (typeof __ALCC !== "undefined" && __ALCC) ? __ALCC : {};
}

/** stand activé dans le dashboard ? */
function cc_stand_enabled() {
	var a = get_alcc();
	return a.standEnabled !== false && a.standEnabled !== undefined ? true : !!a.standEnabled;
}

/** listings configurés dans le dashboard */
function cc_listings() {
	return get_alcc().listings || [];
}

/** spot du stand (dashboard ou défaut) */
function cc_stand_spot() {
	var s = get_alcc().standSpot;
	return (s && s.map) ? s : CONFIG.HOME;
}

/** vente NPC activée ? */
function cc_npc_enabled() {
	return get_alcc().npcEnabled !== false;
}

/** items à vendre à Gabriel */
function cc_npc_items() {
	return get_alcc().npcItems || CONFIG.GABRIEL_SELL;
}

/** échanges Xyn activés ? */
function cc_exchange_enabled() {
	var a = get_alcc();
	return !a.exchange || a.exchange.enabled !== false;
}

/** items à échanger chez Xyn */
function cc_exchange_items() {
	var a = get_alcc();
	return (a.exchange && a.exchange.items) || CONFIG.EXCHANGE_ITEMS;
}

/** seuils minimum pour Xyn */
function cc_exchange_min() {
	var a = get_alcc();
	return (a.exchange && a.exchange.minimum) || CONFIG.EXCHANGE_MIN;
}

/** upgrades activées ? */
function cc_upgrade_enabled() {
	var a = get_alcc();
	return !a.upgrade || a.upgrade.enabled !== false;
}

/** règles d'upgrade */
function cc_upgrade_rules() {
	var a = get_alcc();
	return (a.upgrade && a.upgrade.rules) || [];
}

/** or minimum pour lancer un upgrade */
function cc_upgrade_gold_min() {
	var a = get_alcc();
	return (a.upgrade && a.upgrade.minGold) || CONFIG.UPGRADE_GOLD_MIN;
}

/** Craft configuré dans le dashboard ? */
function cc_craft_enabled() {
	var a = get_alcc();
	return !!(a.craft && a.craft.enabled && a.craft.rules && a.craft.rules.length) || !!(a.automation && (a.automation.commercialGoals || []).some(function(g) { return g.enabled; }));
}

function cc_craft_rules() {
	var a = get_alcc();
	var rules = (a.craft && a.craft.enabled && a.craft.rules) || [];
	var goals = a.automation && a.automation.commercialGoals || [];
	return rules.concat(goals.filter(function(g) { return g.enabled && !rules.some(function(r) { return r.item === g.item; }); }).map(function(g) { return { item: g.item }; }));
}

function cc_craft_gold_reserve() {
	var a = get_alcc();
	return (a.craft && typeof a.craft.reserveGold === "number") ? a.craft.reserveGold : 1000000;
}

/** Keep dropped materials; reserve NPC bases only once the other materials are ready. */
function craft_item_reserved(name, level) {
	if (!cc_craft_enabled()) return false;
	var rules = cc_craft_rules();
	for (var r = 0; r < rules.length; r++) {
		if (rules[r].item === name) return true;
		var recipe = typeof G !== "undefined" && G.craft && G.craft[rules[r].item];
		var rows = recipe && recipe.items || [];
		for (var i = 0; i < rows.length; i++) {
			if (rows[i][1] !== name) continue;
			var requiredLevel = Number(rows[i][2]) || 0;
			if (level !== undefined && (Number(level) || 0) !== requiredLevel) continue;
			if (requiredLevel !== 0 || !craft_shop_for(name)) return true;
			var materialsReady = rows.every(function(row) {
				var materialLevel = Number(row[2]) || 0;
				// Missing NPC bases can be bought when the dropped materials are ready.
				return (materialLevel === 0 && !!craft_shop_for(row[1])) ||
					item_count_level(row[1], materialLevel) >= (Number(row[0]) || 1);
			});
			if (materialsReady) return true;
		}
	}
	return false;
}


// ============================================================================
// 3. UTILITAIRES — Inventaire, Déplacement, NPCs
// ============================================================================

/** Compte le nombre d'un item dans l'inventaire. */
function item_count(name) {
	var n = 0;
	var items = character.items || [];
	for (var i = 0; i < items.length; i++) {
		var it = items[i];
		if (it && it.name === name) n += it.q || 1;
	}
	return n;
}

/** Compte un item au niveau exact demandé par une recette. */
function item_count_level(name, level) {
	var n = 0;
	var items = character.items || [];
	for (var i = 0; i < items.length; i++) {
		var it = items[i];
		if (it && it.name === name && (it.level || 0) === (level || 0)) n += it.q || 1;
	}
	return n;
}

/** Retourne l'index du premier slot contenant cet item, ou -1. */
function find_item(name) {
	var items = character.items || [];
	for (var i = 0; i < items.length; i++) {
		if (items[i] && items[i].name === name) return i;
	}
	return -1;
}

/** Vrai si l'item n'est pas verrouillé (pas de .l) et appartient à notre personnage. */
function item_owned(it) {
	if (!it || it.l) return false;
	if (it.oo && it.oo !== character.name) return false;
	return true;
}

/** Slots libres dans l'inventaire. */
function free_slots() {
	return character.esize || 0;
}

/** Vrai si l'inventaire est presque plein. */
function bag_is_full() {
	return free_slots() <= CONFIG.BAG_BANK_THRESHOLD;
}

/** Coordonnées de position des NPCs/boutiques importants. */
var SHOP_XY = {
	market:    { map: "main", x: -100, y: -20 },   // Place de marché (stand)
	fancypots: { map: "main", x: -35, y: -162 },   // Fancy Pots (potions HP/MP)
	scrolls:   { map: "main", x: -464, y: -96 },   // Boutique parchemins
	basics:    { map: "main", x: -89, y: -165 },   // Gabriel (NPC sell)
	exchange:  { map: "main", x: -25, y: -450 },   // Xyn (échanges)
	craftsman: { map: "main", x: 92, y: 670 },     // Leo (craft)
	newupgrade:{ map: "main", x: -204, y: -129 },  // Cue (upgrades/compound)
	bankdoor:  { map: "main", x: 168, y: -149 },   // Entrée de la banque
};

/** Vrai si on est suffisamment proche d'un point. */
function near_point(pt, range) {
	if (!pt) return false;
	if (pt.map && pt.map !== character.map) return false;
	return simple_distance(character, pt) <= (range || 45);
}

/** Se déplace vers une destination (avec fermeture du stand si nécessaire). */
async function walk_to(dest, reason) {
	if (!dest) return;
	var target = typeof dest === "string" ? SHOP_XY[dest] : dest;
	if (!target) return;
	if (near_point(target, 45)) return;

	// Si un smart_move est déjà en cours vers cette zone, ne pas relancer
	if (smart.moving) {
		await sleep(500);
		return;
	}

	// Ferme le stand si ouvert avant tout déplacement
	if (character.stand || character.standed) {
		try { await ensure_stand_closed(); } catch(e) {}
		await sleep(250);
	}

	if (target.map && target.map !== character.map) {
		try { await smart_move({ map: target.map, x: target.x, y: target.y }); } catch(e) {}
		return;
	}

	var dist = simple_distance(character, target);
	if (dist < 120 && can_move_to(target.x, target.y)) {
		try { move(target.x, target.y); } catch(e) {}
		await sleep(300);
		return;
	}

	try {
		await smart_move({ map: target.map || character.map, x: target.x, y: target.y });
	} catch(e) {}
}

/** Achète un item dans une boutique. */
async function buy_from_shop(name, qty, shop_key) {
	if (free_slots() < 1) return false;
	var shop = shop_key || (name === "hpot1" || name === "mpot1" || name === "hpot0" || name === "mpot0" ? "fancypots" :
	           (name === "scroll0" || name === "scroll1" || name === "scroll2" || name.indexOf("cscroll") === 0 || name.indexOf("scroll") === 0 ? "scrolls" : "basics"));
	var shopPoint = typeof shop === "string" ? SHOP_XY[shop] : shop;
    var remoteBuy = merchant_remote_exchange_available();
    if (remoteBuy && character.map && character.map.indexOf("bank") === 0) return false;
	if (!remoteBuy && !near_point(shopPoint, 80)) {
		await walk_to(shop, "buy " + name);
		var waitTime = 0;
		while (!near_point(shopPoint, 80) && waitTime < 8000) {
			await sleep(400);
			waitTime += 400;
		}
	}
	if (!remoteBuy && !near_point(shopPoint, 80)) return false;

	var left = qty;
	var bought_any = false;
	while (left > 0) {
		var n = Math.min(left, 100);
		try {
			await buy(name, n);
			left -= n;
			bought_any = true;
			await sleep(250);
		} catch(e) {
			game_log("buy " + name + ": " + (e.reason || e));
			break;
		}
	}
	return bought_any;
}

/** Utilise les potions sur soi-même si nécessaire. */
async function self_pot() {
	var mpRatio = character.max_mp ? character.mp / character.max_mp : 1;
	var hpRatio = character.max_hp ? character.hp / character.max_hp : 1;
	var hasMp = item_count(CONFIG.MPOT) > 0 || item_count("mpot0") > 0;
	var hasHp = item_count(CONFIG.HPOT) > 0 || item_count("hpot0") > 0;

	// Les potions partagent leur cooldown : restaurer la mana en premier évite
	// que mluck, massproduction et massexchange restent bloqués.
	if (mpRatio <= (CONFIG.SELF_MP_RATIO || 0.65) && hasMp && !is_on_cooldown("use_mp")) {
		try { await use_skill("use_mp"); return true; } catch(e) {}
	}
	if (hpRatio <= (CONFIG.SELF_HP_RATIO || 0.70) && hasHp && !is_on_cooldown("use_hp")) {
		try { await use_skill("use_hp"); return true; } catch(e) {}
	}
	return false;
}

/** Vérifie si on a le buff Mass Production/Mass Exchange actif. */
function has_mass_buff(kind) {
	var s = character.s || {};
	if (kind === "exchange") return !!(s.massexchange || s.massexchangepp);
	return !!(s.massproduction || s.massproductionpp);
}

/** Lance le buff Mass Production ou Mass Exchange si pas déjà actif. */
async function ensure_mass_buff(kind) {
	if (has_mass_buff(kind)) return true;
	var lv = character.level || 0;
	var skill;
	if (kind === "exchange") {
		skill = lv >= 70 ? "massexchangepp" : lv >= 40 ? "massexchange" : null;
	} else {
		skill = lv >= 60 ? "massproductionpp" : lv >= 30 ? "massproduction" : null;
	}
	if (!skill) return false;
	try {
		await use_skill(skill);
		for (var n = 0; n < 20 && !has_mass_buff(kind); n++) {
			await new Promise(r => setTimeout(r, 50));
		}
	} catch(e) {}
	return has_mass_buff(kind);
}

// ============================================================================
// 4. COMMUNICATION FARMERS — on_cm, ping, mluck
// ============================================================================

/** Rapports des farmers (potions, inventaire, position). */
var farmer_reports = {};
/**
 * File de demandes de ravitaillement (protocole "supply", inspire d'albot-js).
 * Le farmer qui signale need_h/need_m passe EN PRIORITE sur le scan generique.
 */
var supply_requests = {};
/** Timestamp du dernier ping envoyé. */
var last_mux_ms = 0;
/** Cache mluck : timestamp du dernier buff par farmer. */
var last_mluck = {};
/** Timestamp du dernier voyage à la banque pour cooldown anti-spam. */
var last_bank_trip = 0;
var bank_dump_active = false;
/** Backoff scoped to the exact inventory that failed, so a newly received item
 * can still trigger an immediate trip without recreating a bank-entry loop. */
var last_bank_failure_signature = "";
var last_bank_failure_at = 0;
/** Verrou pour empecher le stand de forcer le retour quand le marchand fait des courses. */
var chores_in_progress = false;
/** Timestamp jusqu'auquel le stand ne doit PAS etre re-ouvert (anti-flapping). */
var stand_hold_until = 0;
/** Cooldown pour eviter de spammer les achats de parchemins chez Lukas. */
var last_stock_scrolls = 0;
/** Cooldowns d'achat de potions (hysteresis anti-yoyo). */
var last_restock_mp = 0;
var last_restock_hp = 0;
/** État du superviseur qui démarre les farmers manquants. */
var team_start_busy = false;
var last_team_start = 0;
var team_start_retry_at = {};
var team_supervisor_started_at = Date.now();

function team_child_state(name) {
	try {
		var live = typeof get_active_characters === "function" ? get_active_characters() : null;
		return live && live[name] || "";
	} catch (e) { return ""; }
}

function team_child_running(name) {
	if (fresh_farmer_report(name)) return true;
	var state = team_child_state(name);
	if (state === "starting" || state === "loading" || state === "active" || state === "code") return true;
	if (typeof parent !== "undefined" && parent.active_characters && parent.active_characters[name]) return true;
	return !!get_player(name);
}

function get_start_character_fn() {
	if (typeof start_character === "function") return start_character;
	if (typeof parent !== "undefined" && typeof parent.start_character === "function") return parent.start_character;
	return null;
}

/** Démarre au maximum un farmer par passage pour respecter les limites du client. */
function maybe_start_team() {
	// Only an explicit false disables startup; older injected CONFIG objects did not
	// contain this flag and must keep their historical behavior.
	if (CONFIG.TEAM_SUPERVISOR_ENABLED === false || character.bot || team_start_busy) return false;
	var fn = get_start_character_fn();
	// Laisser le premier ping CM établir la présence des farmers ouverts dans
	// d'autres fenêtres, invisibles depuis get_active_characters().
	if (Date.now() - team_supervisor_started_at < 15000) return false;
	if (!fn || Date.now() - last_team_start < (CONFIG.TEAM_START_INTERVAL_MS || 8000)) return false;
	var names = CONFIG.FARMERS || [];
	var slots = CONFIG.TEAM_SLOTS || {};
	for (var i = 0; i < names.length; i++) {
		var name = names[i], slot = slots[name];
		if (!name || name === character.name || !slot || team_child_running(name)) continue;
		if (team_start_retry_at[name] && Date.now() < team_start_retry_at[name]) continue;
		last_team_start = Date.now();
		team_start_busy = true;
		set_message("start " + name);
		game_log("team supervisor: starting " + name + " with " + slot, "#469ECF");
		try {
			var pending = fn(name, slot);
			if (pending && typeof pending.then === "function") {
				pending.then(function () {
					game_log("team supervisor: " + name + " started", "#78C13F");
					team_start_retry_at[name] = 0;
				}).catch(function (e) {
					var why = String((e && (e.reason || e.message)) || e);
					if (why === "already_running" || why.indexOf("already_running") >= 0) {
						game_log("team supervisor: " + name + " already running", "#78C13F");
						team_start_retry_at[name] = Date.now() + 300000;
					} else {
						game_log("team supervisor: start " + name + ": " + why, "#E56369");
						team_start_retry_at[name] = Date.now() + (CONFIG.TEAM_START_RETRY_MS || 60000);
					}
				}).then(function () { team_start_busy = false; });
			} else team_start_busy = false;
		} catch (e2) {
			team_start_busy = false;
			team_start_retry_at[name] = Date.now() + (CONFIG.TEAM_START_RETRY_MS || 60000);
			game_log("team supervisor: start " + name + ": " + ((e2 && (e2.reason || e2.message)) || e2), "#E56369");
		}
		return true;
	}
	return false;
}

async function teamStartLoop() {
	while (true) {
		try { if (!character.rip) { merchant_guard_tick(); if (typeof UpgradeProduction !== "undefined" && UpgradeProduction.reconcile) UpgradeProduction.reconcile(); if (typeof EventExpedition !== "undefined") await EventExpedition.merchantTick(); maybe_start_team(); } } catch (e) {}
		await sleep(3000);
	}
}

/**
 * Anti-flapping du stand (Crowns3bc : le stand n'est gere que quand state === "idle").
 * Un voyage de corvee (Gabriel / Xyn / banque / upgrade / achat) ne doit pas etre
 * annule par une reouverture du stand des que le marchand s'eloigne de son spot.
 */
function hold_stand(ms) {
	stand_hold_until = Math.max(stand_hold_until, Date.now() + (ms || 60000));
}

var exchange_space_pause = false;
/** Hysteresis prevents returning to Xyn after freeing just one slot. */
function exchange_space_paused() {
    if (!cc_exchange_enabled()) { exchange_space_pause = false; return false; }
    if (!exchange_space_pause && free_slots() <= 4 && locate_exchange_item() >= 0) {
        exchange_space_pause = true;
        game_log("exchange paused: inventory space; clearing carried stock");
    }
    if (exchange_space_pause && free_slots() >= 8) {
        exchange_space_pause = false;
        game_log("exchange resumed: inventory space recovered");
    }
    return exchange_space_pause;
}
/** Shared arbitration for the chores and stationary production loops. */
function merchant_work_next() {
    var bankReview = typeof BankCoordinator !== 'undefined' && !!BankCoordinator.snapshot().current;
    // Once a bank trip owns the chores loop, finish it before remote sales.
    // Selling is rejected inside bank maps and must not interrupt a deposit.
    if (bank_dump_active && merchant_task_allowed("bank")) return "bank";
    if (exchange_space_paused()) {
        // Never purchase new bases or start another production batch under pressure.
        if (character.q && character.q.exchange) return null;
        production_trip = null;
        if (cc_npc_enabled() && locate_sell_item() >= 0 && merchant_task_allowed("sell")) return "sell";
        if (!bankReview && character.items && character.items.some(should_bank_item) && merchant_task_allowed("bank") && !(bankable_signature() === last_bank_failure_signature && Date.now() - last_bank_failure_at < (CONFIG.BANK_COOLDOWN_MS || 45000))) return "bank";
        if (cc_upgrade_enabled() && locate_upgrade_item(false) >= 0 && merchant_task_allowed("upgrade")) return "upgrade";
        set_message("exchange blocked: inventory space");
        return null;
    }
    if (bank_dump_active && (typeof MerchantLoopGuard === "undefined" || MerchantLoopGuard.allowed("bank"))) return "bank";
    if (production_trip === "exchange" && (typeof MerchantLoopGuard === "undefined" || MerchantLoopGuard.allowed("exchange"))) return "exchange";
    if (production_trip === "craft" && (typeof MerchantLoopGuard === "undefined" || MerchantLoopGuard.allowed("craft")) && next_craft_job()) return "craft";
    if (craft_batch && craft_batch.remaining > 0 && (typeof MerchantLoopGuard === "undefined" || MerchantLoopGuard.allowed("craft")) && next_craft_job()) return "craft";
    var ready = {
        bank: !bankReview && character.items && character.items.some(should_bank_item) && !(bankable_signature() === last_bank_failure_signature && Date.now() - last_bank_failure_at < (CONFIG.BANK_COOLDOWN_MS || 45000)),
        sell: cc_npc_enabled() && locate_sell_item() >= 0,
        exchange: cc_exchange_enabled() && free_slots() >= 1 && (locate_exchange_item() >= 0 || (typeof next_exchange_bank_job === 'function' && !!next_exchange_bank_job())),
        craft: !!next_craft_job(),
        compound: !!find_compound_set(),
        upgrade: cc_upgrade_enabled() && (locate_upgrade_item(false) >= 0 || !!next_upgrade_purchase())
    };
    var order = typeof __ALCC !== "undefined" && __ALCC.workOrder || ["bank", "sell", "exchange", "craft", "compound", "upgrade"];
    for (var i = 0; i < order.length; i++) if (ready[order[i]] && (typeof MerchantLoopGuard === "undefined" || MerchantLoopGuard.allowed(order[i]))) return order[i];
    return null;
}

function merchant_task_allowed(task) { return typeof MerchantLoopGuard === "undefined" || MerchantLoopGuard.allowed(task); }
function merchant_guard_tick() {
    if (typeof MerchantLoopGuard === "undefined") return;
    MerchantLoopGuard.tick(merchant_work_next());
    if (bank_dump_active && !merchant_task_allowed("bank")) { bank_dump_active = false; chores_in_progress = false; }
    if (production_trip && !merchant_task_allowed(production_trip)) { production_trip = ""; chores_in_progress = false; }
}

/** Vrai si une corvee est en cours OU en attente : le stand doit rester ferme. */
function chores_pending() {
	if (production_trip && !((production_trip==='exchange'||production_trip==='craft')&&merchant_remote_exchange_available())) return true;
	if (chores_in_progress) return true;
	if (smart.moving) return true;
	if (character.map && character.map.indexOf("bank") === 0) return true;
	// Vente a Gabriel en attente
	// NPC sales are remote and do not require closing the stand.
	// Echange chez Xyn en attente
	if (merchant_work_next() === "exchange" && !merchant_remote_exchange_available()) return true;
	// Craft chez Leo prêt (inclut l'achat d'un ingrédient NPC manquant).
	if (merchant_work_next() === "craft" && !merchant_remote_exchange_available()) return true;
	// Upgrade / compound en attente
	// Upgrades are stationary idle work and never prevent opening the stand.
	return false;
}

// Retain the NPC destination until all actionable work there has drained.
// Re-evaluate eligibility each tick: insufficient space/scrolls/gold releases
// the trip rather than keeping the merchant permanently away from his stand.
var production_trip = null;
/** Prefer the Computer stand; slot zero is a valid inventory position. */
function merchant_stand_item_slot() {
    var preferred = ['supercomputer', 'computer', 'stand0'];
    for (var p = 0; p < preferred.length; p++) {
        for (var i = 0; i < (character.items || []).length; i++) {
            if (character.items[i] && character.items[i].name === preferred[p]) return i;
        }
    }
    return -1;
}
/** A carried Computer enables remote NPC buying, crafting and exchanges. */
function merchant_remote_exchange_available() {
    return !!(character.computer||character.supercomputer||(character.items||[]).some(function(it){return it&&(it.name==='computer'||it.name==='supercomputer');}));
}
function refresh_production_trip() {
    var sortState = typeof ALCCBankSorter !== "undefined" && ALCCBankSorter.snapshot ? ALCCBankSorter.snapshot().state : "idle";
    if (sortState === "queued" || sortState === "running") { production_trip = null; return null; }
	var exchangeBusy = !!(character.q && character.q.exchange);
    var exchanges = cc_exchange_enabled() && (exchangeBusy || (!exchange_space_paused() && free_slots() >= 1 && locate_exchange_item() >= 0));
	// Keep ownership across rewards, remote sales and the server exchange timer.
    // Newly bankable rewards wait until this batch drains; a full bag releases it.
    if (character.rip || (production_trip === "exchange" && !exchanges) || (production_trip === "craft" && !next_craft_job())) production_trip = null;
	if (!production_trip && !character.rip && !chores_in_progress && !bank_dump_active) {
		var nextWork = merchant_work_next();
        production_trip = nextWork === "exchange" && exchanges ? "exchange" : nextWork === "craft" ? "craft" : null;
	}
	return production_trip;
}

/** Only block the stand for upgrade work that can actually run now. */
function upgrade_work_pending() {
    if (next_upgrade_purchase()) return true;
	var slot = locate_upgrade_item(true);
	if (slot >= 0) {
		var item = character.items && character.items[slot];
		var scroll = upgrade_scroll_for(item);
		if (scroll && item_count(scroll) > 0) return true;
	}
	var set = find_compound_set();
	if (set && set.slots && set.slots.length) {
		var sample = character.items && character.items[set.slots[0]];
		var cscroll = compound_scroll_for(sample);
		if (cscroll && item_count(cscroll) > 0) return true;
	}
	return false;
}

/** Vrai si le stand peut etre (re)ouvert maintenant. */
function stand_open_allowed() {
	// Le hold empêche les boucles concurrentes de rouvrir pendant un trajet.
	// Une fois revenu au marché sans corvée restante, il ne faut cependant pas
	// rester fermé artificiellement pendant 60–90 secondes.
	return !chores_pending();
}

/** Reçoit un message CM d'un farmer. */
function supply_farmer_names() {
 var names = (CONFIG.FARMERS || []).slice();
 var expedition = typeof __ALCC !== 'undefined' && __ALCC.eventExpedition;
 if (expedition && expedition.enabled) [expedition.warrior, expedition.priest].forEach(function(name) { if(name && names.indexOf(name)<0) names.push(name); });
 return names;
}
function on_cm(name, data) {
	if (typeof EventExpedition !== "undefined") EventExpedition.onCm(name, data);
	if (!data || typeof data !== "object") return;
	if (supply_farmer_names().indexOf(name) < 0) return;
	// Rapport status (potions, or, dump, position)
	if (data.t === "mux" || data.t === "pots") {
		farmer_reports[name] = {
			name: name,
			hpot: typeof data.hpot === 'number' && isFinite(data.hpot) && data.hpot >= 0 ? data.hpot : null,
			mpot: typeof data.mpot === 'number' && isFinite(data.mpot) && data.mpot >= 0 ? data.mpot : null,
			gold: data.gold || 0,
			dump: data.dump || 0,
			map: data.map,
			x: data.x,
			y: data.y,
			need_luck: !!data.need_luck,
			coming: !!data.coming,
			need_h: !!data.need_h,
			need_m: !!data.need_m,
			at: Date.now(),
		};
		// Protocole "supply" (albot-js) : un farmer qui signale un manque devient
		// une demande PRIORITAIRE traitee avant le scan generique du serviceLoop.
		if (data.need_h || data.need_m) {
			supply_requests[name] = { name: name, at: Date.now(), need_h: !!data.need_h, need_m: !!data.need_m };
		} else {
			delete supply_requests[name];
		}
	}
	// Demande de ravitaillement explicite (le farmer demande, le marchand vient).
	if (data.t === "supply") {
		supply_requests[name] = { name: name, at: Date.now(), need_h: !!data.need_h, need_m: !!data.need_m };
	}
	// Demande de buff mluck
	if (data.t === "mluck") {
		game_log(name + " wants mluck");
	}
}

/** Accepte automatiquement les invitations de party des farmers. */
function on_party_invite(name) {
	var farmers = CONFIG.FARMERS;
	for (var i = 0; i < farmers.length; i++) {
		if (farmers[i] === name) { accept_party_invite(name); return; }
	}
}

/** Envoie un ping à tous les farmers pour obtenir leur status. */
async function ping_farmers() {
	if (Date.now() - last_mux_ms < CONFIG.MUX_MS) return;
	last_mux_ms = Date.now();
	var farmers = supply_farmer_names();
	for (var i = 0; i < farmers.length; i++) {
		try { await send_cm(farmers[i], { t: "mux", src: "merch" }); } catch(e) {}
	}
}

function fresh_farmer_report(name) {
	var report = farmer_reports[name];
	return report && Date.now() - report.at < 60000 ? report : null;
}

/**
 * Demandes de ravitaillement encore fraiches, triees par urgence
 * (le guerrier d'abord, pour garder l'aggro et la ligne de front).
 * Inspire du protocole "yo, I need some HP/MP" d'albot-js.
 */
function pending_supply_requests() {
	var now = Date.now();
	var list = [];
	for (var nm in supply_requests) {
		var req = supply_requests[nm];
		if (!req) continue;
		if (now - req.at > 45000) { delete supply_requests[nm]; continue; }
		list.push(req);
	}
	list.sort(function (a, b) {
		var aw = a.name === CONFIG.WARRIOR ? 0 : 1;
		var bw = b.name === CONFIG.WARRIOR ? 0 : 1;
		if (aw !== bw) return aw - bw;
		return a.at - b.at; // le plus ancien d'abord
	});
	return list;
}

function visible_potion_count(player, itemName) {
	if (!player || !Array.isArray(player.items)) return null;
	var total = 0;
	var items = (player && player.items) || [];
	for (var i = 0; i < items.length; i++) if (items[i] && items[i].name === itemName) total += items[i].q || 1;
	return total;
}

function farmer_potion_state(name) {
	var player = get_player(name);
	var report = fresh_farmer_report(name);
	if (!player && !report) return null;
	var hp = report ? report.hpot : visible_potion_count(player, CONFIG.HPOT);
	var mp = report ? report.mpot : visible_potion_count(player, CONFIG.MPOT);
	if (hp === null || mp === null) return null;
	return {
		player: player,
		report: report,
		hpot: hp,
		mpot: mp
	};
}

/** Compatibility surface used by the dashboard-injected seller boards. */
function near_farmer(name) {
	var player = get_player(name);
	if (player && distance(character, player) <= CONFIG.REACH) return true;
	var report = fresh_farmer_report(name);
	return !!(report && report.map === character.map && simple_distance(character, report) <= CONFIG.REACH);
}

function act(message) {
	try { set_message(String(message || "").slice(0, 28)); } catch (e) {}
}

async function ensure_stand_closed() {
	if (character.stand || character.standed) {
        remember_stand_listings();
		try { await close_stand(); } catch (e) {}
	}
}

// --- Fin garde du stand : la logique vit avec chores_pending()/stand_open_allowed()
// plus haut (une seule definition, pas de doublon de fonction). ---

async function go_to(destination, reason, range) {
	if (destination === "bank") {
		await ensure_stand_closed();
		try { await smart_move("bank"); } catch (e) { game_log("bank path: " + (e.reason || e.message || e)); }
		return;
	}
	await walk_to(destination, reason, range);
}

function each_bank_item(callback) {
	var bank = character.bank || {};
	for (var pack in bank) {
		if (pack.indexOf("items") !== 0 || !Array.isArray(bank[pack])) continue;
		for (var slot = 0; slot < bank[pack].length; slot++) if (bank[pack][slot]) callback(bank[pack][slot], pack, slot);
	}
}

/** Mirrors the game's get_trade_slots: merchant 70/cstand=24, 80=30. */
function merchant_trade_capacity() {
    if(character.ctype==='merchant' && character.level>=80)return 30;
    if(character.ctype==='merchant' && (character.level>=70 || character.stand==='cstand' || character.standed==='cstand'))return 24;
    return 16;
}

var last_listing_bank_check = 0;
var remembered_stand_listings = null;
function remember_stand_listings() {
    var rows={};
    for(var n=1;n<=merchant_trade_capacity();n++){
        var it=(character.slots||{})['trade'+n];
        if(it&&!it.b)rows[it.name+':'+(it.level||0)]=true;
    }
    remembered_stand_listings=rows;
    try{set('alcc:stand-listings:'+character.name,rows);}catch(e){}
}

/** Bank withdrawals for listings are distinct from newly produced outputs. */
var listing_bank_stock_cache = null;
function listing_bank_leases() {
    if(typeof BankStock!=='undefined')return BankStock.reservations();
    if(typeof listing_bank_stock_cache!=='undefined'&&listing_bank_stock_cache)return listing_bank_stock_cache;
    try { listing_bank_stock_cache=get('alcc:listing-bank-stock:'+character.name)||{}; } catch(e) { listing_bank_stock_cache={}; }
    return listing_bank_stock_cache;
}
function save_listing_bank_leases(rows) {
    if(typeof BankStock!=='undefined'){BankStock.save(rows);return;}
    // Storage is a restart backup. A delayed/failed write must not erase the
    // active reservation on the next inventory scan.
    listing_bank_stock_cache=rows;
    try { set('alcc:listing-bank-stock:'+character.name,rows); } catch(e) {}
}
function release_listing_bank_stock(it) {
    if (!it) return; var rows=listing_bank_leases();delete rows[it.name+':'+(it.level||0)];save_listing_bank_leases(rows);
}
function stand_listing_posted(it) {
    if(!it)return false;
    for(var n=1;n<=merchant_trade_capacity();n++){
        var row=(character.slots||{})['trade'+n];
        if(row&&!row.b&&row.name===it.name&&(row.level||0)===(it.level||0))return true;
    }
    if(character.stand||character.standed)return false;
    if(typeof remembered_stand_listings==='undefined'||remembered_stand_listings===null){
        try{remembered_stand_listings=get('alcc:stand-listings:'+character.name)||{};}catch(e){remembered_stand_listings={};}
    }
    return !!remembered_stand_listings[it.name+':'+(it.level||0)];
}
function listing_bank_stock_reserved(it) {
    if(!it || !cc_stand_enabled())return false;
    var rule=cc_listings().find(function(r){return r.item===it.name&&(r.level||0)===(it.level||0);});
    if(!rule)return false;
    var rows=listing_bank_leases(),key=it.name+':'+(it.level||0),lease=rows[key];
    // This is ownership of a specific withdrawn piece, not a timed work lease.
    // Other chores may postpone publication; timeout would redeposit that piece.
    if(!lease)return false;
    // A posted copy fulfils this rule. The carried copy is surplus, but reading
    // this policy must not delete its lease while snapshots are transitioning.
    if(stand_listing_posted(it))return false;
    // Reading inventory policy must not mutate reservations. A matching trade
    // slot can be a different copy or a transient snapshot while opening the
    // stand; only successful publication releases the withdrawn piece.
    if(lease.rid)return it.rid===lease.rid;
    return (character.items||[]).find(function(row){return row&&row.name===it.name&&(row.level||0)===(it.level||0);})===it;
}
function stand_inventory_allowed(it) {
    if(listing_bank_stock_reserved(it))return true;
    var rule=cc_listings().find(function(r){return r.item===it.name&&(r.level||0)===(it.level||0);});
    return !upgrade_target_complete(it) && !(rule&&rule.bankReserve>0);
}

function listing_present(rule) {
	var items = character.items || [], slots = character.slots || {};
	for (var i = 0; i < items.length; i++) if (items[i] && items[i].name === rule.item && (items[i].level || 0) === (rule.level || 0)) return true;
	for (var n = 1; n <= merchant_trade_capacity(); n++) {
		var listed = slots["trade" + n];
		if (listed && !listed.b && listed.name === rule.item && (listed.level || 0) === (rule.level || 0)) return true;
	}
    // Closing the stand hides its extended trade slots in the live snapshot.
    // Preserve the last open snapshot for bank restocking, refresh on reopening.
    if(character.stand||character.standed)remember_stand_listings();
    else {
        if(typeof remembered_stand_listings==='undefined'||remembered_stand_listings===null){
            try{remembered_stand_listings=get('alcc:stand-listings:'+character.name)||{};}catch(e){remembered_stand_listings={};}
        }
        if(remembered_stand_listings[rule.item+':'+(rule.level||0)])return true;
    }
	return false;
}

/** Pull one configured but missing sell listing from the shared bank. */
async function maybe_restock_listing_from_bank(options) {
    if(typeof BankCoordinator!=='undefined')return BankCoordinator.run('stand',function(){return restock_listing_bank_stock(options);});
    return restock_listing_bank_stock(options);
}
async function restock_listing_bank_stock(options) {
    var stayInBank=!!(options&&options.stayInBank);
	if (!cc_stand_enabled() || !cc_listings().length || character.esize < 1) return false;
    var reserveBuys=typeof __ALCC!=='undefined'&&__ALCC.buy&&__ALCC.buy.enabled&&__ALCC.buy.orders&&__ALCC.buy.orders.length>0;
    var sellMax=merchant_trade_capacity()-(reserveBuys?8:0),tradeSpace=false;
    for(var tradeIndex=1;tradeIndex<=sellMax;tradeIndex++)if(!(character.slots||{})['trade'+tradeIndex])tradeSpace=true;
    if(!tradeSpace)return false;
	var missing = null, rules = cc_listings(), missingRules = [];
	for (var i = 0; i < rules.length; i++) if (!listing_present(rules[i])) missingRules.push(rules[i]);
	missing = missingRules[0] || null;
	if (!missing) return false;

    var previousChores=typeof chores_in_progress!=='undefined'?chores_in_progress:false;
    chores_in_progress=true;
    try {
	var inBank = character.map && character.map.indexOf("bank") === 0;
	if (!inBank) {
		if (Date.now() - last_listing_bank_check < 300000) return false;
		last_listing_bank_check = Date.now();
		hold_stand(90000);
		act("bank listing " + missing.item);
		await go_to("bank", "listing restock");
        if(!character.map || character.map.indexOf('bank')!==0)return false;
	}

	for (var wait = 0; !character.bank && wait < 10; wait++) await sleep(250);
    if(typeof BankCoordinator!=='undefined')BankCoordinator.stage('bank');
	var totals={};
    each_bank_item(function(item){if(item.l||item.b||(item.oo&&item.oo!==character.name))return;var key=item.name+':'+(item.level||0);totals[key]=(totals[key]||0)+(item.q||1);});
    var found = null;
	each_bank_item(function (item, pack, slot) {
		if (found || item.l || item.b || (item.oo && item.oo !== character.name)) return;
		for (var ri = 0; ri < missingRules.length; ri++) {
			var rule = missingRules[ri];
			if (item.name === rule.item && (item.level || 0) === (rule.level || 0) && (totals[item.name+':'+(item.level||0)]||0) > (rule.bankReserve||0)) {
				missing = rule;
				found = { pack: pack, slot: slot, quantity: item.q||1 };
				break;
			}
		}
	});
	if (!found) {
		last_listing_bank_check=Date.now();
		game_log("listing stock absent or bank reserve reached: " + missing.item + " +" + (missing.level || 0));
		if(stayInBank)return false;
		await walk_to(cc_stand_spot(), "return stand");
		return true;
	}
	var packNumber = Number(String(found.pack).replace("items", ""));
	var floor = packNumber <= 7 ? "bank" : packNumber <= 23 ? "bank_b" : "bank_u";
	if (character.map !== floor) {
		await smart_move(floor);
        if(character.map!==floor)return false;
	}
	try {
        var takeQuantity=missing.bankReserve>0?1:found.quantity;
        var empty=character.items.findIndex(function(it){return !it;});
        if(empty<0 || (found.quantity>takeQuantity && (free_slots()<2 || typeof split!=='function')))return false;
        if(typeof BankCoordinator!=='undefined'&&!BankCoordinator.begin('withdraw',missing.item,missing.level,takeQuantity,found.pack))return false;
        await bank_retrieve(found.pack, found.slot, empty);
        var received=character.items[empty];
        if(!received||received.name!==missing.item||(received.level||0)!==(missing.level||0))throw Error('Unconfirmed listing withdrawal');
        if(found.quantity>takeQuantity){
            await split(empty,takeQuantity);
            if(!character.items[empty]||character.items[empty].q!==found.quantity-takeQuantity)throw Error('Unconfirmed listing split');
            if(character.bank[found.pack][found.slot])throw Error('Listing return slot changed');
            await bank_store(empty,found.pack,found.slot);
            received=character.items.find(function(it){return it&&it.name===missing.item&&(it.level||0)===(missing.level||0);});
        }
        if(!received)throw Error('Listing stock unavailable');
        var leases=listing_bank_leases();leases[received.name+':'+(received.level||0)]={rid:received.rid||null,at:Date.now()};save_listing_bank_leases(leases);
        if(typeof BankCoordinator!=='undefined')await sleep(400);
        if(typeof BankCoordinator!=='undefined')BankCoordinator.finish(true,'Verified bank withdrawal and carried allocation');
		last_listing_bank_check = 0;
		game_log("listing bank pull: " + missing.item + " +" + (missing.level || 0));
	} catch (e) {
        if(typeof BankCoordinator!=='undefined')BankCoordinator.finish(false,'Withdrawal or split requires reconciliation');
        game_log("listing bank pull: " + (e.reason || e.message || e));
        if(stayInBank)return false;
    }
    // Keep navigation ownership until safely back at the stand, including when
    // this withdrawal was requested outside the ordinary deposit loop.
    if(!stayInBank&&character.map && character.map.indexOf('bank')===0)await walk_to(cc_stand_spot(), 'return stand');
	return true;    } finally { chores_in_progress=previousChores; }
}

/** Replaced by dashboard-v2 when seller boards are enabled. */
async function maybe_dashboard_kit() { return false; }
async function maybe_dashboard_consumables() { return false; }
async function maybe_dashboard_gifts() { return false; }

/** Move to an off-screen farmer using their fresh ping position. */
async function reach_farmer(name, state) {
	var player = state && state.player;
	if (player && distance(character, player) <= CONFIG.REACH) return player;
	if (typeof EventExpedition !== "undefined" && EventExpedition.needsReturnService()) return null;
	var report = state && state.report;
	if (!report || !report.map || report.x == null || report.y == null) return null;
	await walk_to({ map: report.map, x: report.x, y: report.y }, "supply " + name);
	player = get_player(name);
	return player && distance(character, player) <= CONFIG.REACH ? player : null;
}

async function give_potion_stack(name, itemName, current, target) {
	if (typeof current !== 'number' || !isFinite(current) || current < 0) return 0;
	var reserve = itemName === CONFIG.MPOT ? (CONFIG.SELF_MPOT_RESERVE || 0) :
		itemName === CONFIG.HPOT ? (CONFIG.SELF_HPOT_RESERVE || 0) : 0;
	var available = Math.max(0, item_count(itemName) - reserve);
	var amount = Math.min(Math.max(0, target - current), available);
	if (amount < 1) return 0;
	var slot = find_item(itemName);
	if (slot < 0) return 0;
	try {
		await send_item(name, slot, amount);
		game_log("supply " + itemName + " x" + amount + " -> " + name);
		return amount;
	} catch (e) {
		game_log("supply " + itemName + " -> " + name + ": " + (e.reason || e.message || e));
		return 0;
	}
}

/** Vrai si notre buff mluck est actif sur nous-même. */
function our_mluck() {
	var s = character.s || {};
	return !!(s.mluck && s.mluck.ms > 0);
}

/** Vrai si le buff mluck sur nous-même est suffisamment fort (posé par un marchand). */
function mluck_ok() {
	var s = character.s || {};
	if (!s.mluck) return false;
	return !!(s.mluck.f === character.name && s.mluck.ms > 30000);
}

/**
 * Buffe mluck sur un joueur visible à portée.
 * Retourne true si le buff a été lancé.
 */
async function give_mluck(target_name) {
	var p = get_player(target_name);
	if (!p) return false;
	if (distance(character, p) > 200) return false;
	try {
		await use_skill("mluck", p);
		last_mluck[target_name] = Date.now();
		game_log("mluck -> " + target_name);
		return true;
	} catch(e) {
		return false;
	}
}

// ============================================================================
// 5. SERVICE LOOP — Mluck buff + Potions en ville
// ============================================================================

var MLUCK_REFRESH_MS = 60 * 1000; // Re-buffe mluck toutes les 60s minimum
var respawn_in_progress = false;

/**
 * Dedicated death watchdog. Merchant chores can keep the service loop busy for
 * minutes, so respawning must not depend on any business or movement routine.
 */
async function deathLoop() {
	while (true) {
		if (character.rip && !respawn_in_progress) {
			respawn_in_progress = true;
			try {
				set_message("respawning");
				await respawn();
				chores_in_progress = false;
				stand_hold_until = 0;
				game_log("merchant respawned");
			} catch(e) {
				game_log("respawn: " + (e.reason || e.message || e));
			} finally {
				respawn_in_progress = false;
			}
		}
		await sleep(character.rip ? 1000 : 2000);
	}
}

async function serviceLoop() {
	while (true) {
		try {
			if (character.rip) { await sleep(1000); continue; }
			if (typeof ALCCBankSorter !== "undefined" && /^(queued|running)$/.test(ALCCBankSorter.snapshot().state)) { await sleep(1000); continue; }
			await self_pot();
			await ping_farmers();

			// 1. Se buff mluck soi-même
			if (!mluck_ok() && !is_on_cooldown("mluck")) {
				try { await use_skill("mluck", character); } catch(e) {}
			}

			// 2. Buffe mluck les farmers visibles en ville
			var farmers = CONFIG.FARMERS;
			for (var i = 0; i < farmers.length; i++) {
				var name = farmers[i];
				var p = get_player(name);
				if (!p) continue;
				var needs_luck = true;
				var s = p.s || {};
				if (s.mluck && s.mluck.ms > 45000) needs_luck = false;
				var last = last_mluck[name] || 0;
				if (!needs_luck && Date.now() - last < MLUCK_REFRESH_MS) continue;
				if (is_on_cooldown("mluck")) break;
				await give_mluck(name);
				await sleep(300);
			}

			// Dashboard kit, consumable and gift boards share the same travel lock.
			if (refresh_production_trip()) { await sleep(1000); continue; }
			if (!chores_in_progress) {
				chores_in_progress = true;
				var dashboard_handled = false;
				try {
					dashboard_handled = await maybe_dashboard_kit();
					if (!dashboard_handled) dashboard_handled = await maybe_dashboard_consumables();
					if (!dashboard_handled) dashboard_handled = await maybe_dashboard_gifts();
				} finally {
					chores_in_progress = false;
				}
				if (dashboard_handled) { await sleep(500); continue; }
			}

			// 3. Ravitailler activement les farmers, même hors écran.
			// Priorite 1 : les demandes explicites (protocole "supply" d'albot-js),
			// le guerrier puis le plus ancien. Priorite 2 : scan generique du stock.
			if (!chores_in_progress) {
				// Le guerrier reste la cible par defaut (contrat historique du builder).
				var supply_order = [CONFIG.WARRIOR];
				// Les demandes explicites passent DEVANT : elles sont inserees en tete,
				// la plus recente d'abord (unshift parcourt donc a l'envers).
				var pending = pending_supply_requests();
				for (var pi = pending.length - 1; pi >= 0; pi--) {
					var pname = pending[pi].name;
					if (!pname || pname === CONFIG.WARRIOR) continue;
					if (supply_order.indexOf(pname) >= 0) continue;
					supply_order.unshift(pname);
				}
				for (var j = 0; j < farmers.length; j++) {
					if (farmers[j] === CONFIG.WARRIOR) continue;
					if (supply_order.indexOf(farmers[j]) >= 0) continue;
					supply_order.push(farmers[j]);
				}
				for (var k = 0; k < supply_order.length; k++) {
					var fname = supply_order[k];
					var supply = farmer_potion_state(fname);
					if (!supply) continue;
					// Un farmer qui a explicitement demande passe meme si le rapport
					// de stock visible est au-dessus du seuil (cache perime / autre map).
					var req = supply_requests[fname];
					var forced = !!req;
					var needs_mp = (forced && req.need_m) || supply.mpot < CONFIG.POT_THRESHOLD_M;
					var needs_hp = (forced && req.need_h) || supply.hpot < CONFIG.POT_THRESHOLD_H;
					needs_mp = needs_mp && item_count(CONFIG.MPOT) > 0;
					needs_hp = needs_hp && item_count(CONFIG.HPOT) > 0;
					if (!needs_mp && !needs_hp) { delete supply_requests[fname]; continue; }
					chores_in_progress = true;
					try {
						var fp = await reach_farmer(fname, supply);
						if (!fp) { game_log("supply " + fname + ": position no longer visible"); break; }
						// Mana first so Eadroma can keep attacking; HP follows in the same visit.
						var sent_m = needs_mp ? await give_potion_stack(fname, CONFIG.MPOT, supply.mpot, CONFIG.MPOT_GIVE) : 0;
						var sent_h = needs_hp ? await give_potion_stack(fname, CONFIG.HPOT, supply.hpot, CONFIG.POT_GIVE) : 0;
						if (supply.report) {
							supply.report.mpot += sent_m;
							supply.report.hpot += sent_h;
						}
						// Livraison faite : la demande est satisfaite (le farmer re-signalera
						// s'il retombe sous son seuil au prochain cycle de rapport).
						if (sent_m > 0 || sent_h > 0) delete supply_requests[fname];
					} finally {
						chores_in_progress = false;
					}
					break;
				}
			}
		} catch(e) {
			game_log("serviceLoop: " + (e.reason || e.message || e));
		}
		await sleep(2000);
	}
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ============================================================================
// 6. STOCK LOOP — Achat potions + parchemins
// ============================================================================

async function stockLoop() {
	while (true) {
		try {
			if (typeof ALCCBankSorter !== "undefined" && /^(queued|running)$/.test(ALCCBankSorter.snapshot().state)) { await sleep(1000); continue; }
			if (refresh_production_trip()) { await sleep(1000); continue; }
			if (character.rip) { await sleep(3000); continue; }
			if (chores_in_progress) { await sleep(1500); continue; }

			var spot = cc_stand_spot();
			var freeSlots = free_slots();

			// Ne rien acheter si le sac est plein ou presque plein
			if (freeSlots < 2) {
				await sleep(5000);
				continue;
			}

			// 1. Potions MP : priorité au mana pour éviter une équipe incapable d'attaquer.
			// Hystérésis : on n'achète QUE si le stock est passé sous le seuil bas,
			// puis on remplit jusqu'à MPOT_STOCK (pas de yoyo d'aller-retours).
			var mp_now = item_count(CONFIG.MPOT);
			var mp_restock_ok = (Date.now() - last_restock_mp) > (CONFIG.RESTOCK_COOLDOWN_MS || 60000);
			var need_m = CONFIG.MPOT_STOCK - mp_now;
			if (mp_now <= (CONFIG.POT_STOCK_LOW_M || 0) && need_m >= 200 && character.gold >= 10000 && mp_restock_ok) {
				chores_in_progress = true;
				last_restock_mp = Date.now();
				set_message("stock mpot");
				var price_m = (G.items[CONFIG.MPOT] && G.items[CONFIG.MPOT].g) || 100;
				var can_buy_m = Math.min(need_m, Math.floor(Math.max(0, character.gold - 5000) / price_m));
				if (can_buy_m >= 50) {
					await buy_from_shop(CONFIG.MPOT, can_buy_m, "fancypots");
				}
				await walk_to(spot, "retour stand");
				await sleep(1000);
				chores_in_progress = false;
			}

			// 2. Potions HP (même hystérésis que les MP)
			var hp_now = item_count(CONFIG.HPOT);
			var hp_restock_ok = (Date.now() - last_restock_hp) > (CONFIG.RESTOCK_COOLDOWN_MS || 60000);
			var need_h = CONFIG.POT_STOCK - hp_now;
			if (hp_now <= (CONFIG.POT_STOCK_LOW_H || 0) && need_h >= 200 && character.gold >= 10000 && hp_restock_ok) {
				chores_in_progress = true;
				last_restock_hp = Date.now();
				set_message("stock hpot");
				var price_h = (G.items[CONFIG.HPOT] && G.items[CONFIG.HPOT].g) || 100;
				var can_buy_h = Math.min(need_h, Math.floor(Math.max(0, character.gold - 5000) / price_h));
				if (can_buy_h >= 50) {
					await buy_from_shop(CONFIG.HPOT, can_buy_h, "fancypots");
				}
				await walk_to(spot, "retour stand");
				await sleep(1000);
				chores_in_progress = false;
			}

			// 3. Parchemins chez Lukas (scroll0, cscroll0, cscroll1)
			// Condition stricte : uniquement si le stock est critiquement bas ET cooldown de 60s respecte
			var now = Date.now();
			var scroll_cd_ok = (now - last_stock_scrolls) > 60000;
			var low_scroll0 = item_count("scroll0") < 10;
			var low_cscroll0 = item_count("cscroll0") < 2;
			var low_cscroll1 = item_count("cscroll1") < 1;
			var needs_scrolls = (low_scroll0 || low_cscroll0 || low_cscroll1) && character.gold >= 20000;

			if (needs_scrolls && scroll_cd_ok && free_slots() >= 2) {
				chores_in_progress = true;
				last_stock_scrolls = Date.now();

				for (var sname in CONFIG.SCROLL_STOCK) {
					var s_target = CONFIG.SCROLL_STOCK[sname];
					var current_c = item_count(sname);
					// N'acheter que si reellement bas pour cette categorie
					var threshold = sname === "scroll0" ? 10 : (sname === "cscroll0" ? 2 : 1);
					if (current_c > threshold) continue;

					var s_need = s_target - current_c;
					if (s_need <= 0) continue;
					var s_price = (G.items[sname] && G.items[sname].g) || 800;
					if (character.gold < s_price + 10000) continue;
					var s_buy = Math.min(s_need, Math.floor(Math.max(0, character.gold - 10000) / s_price));
					if (s_buy < 1) continue;

					set_message("stock " + sname);
					await buy_from_shop(sname, s_buy, "scrolls");
				}

				// Retour propre au stand de marche
				await walk_to(spot, "retour stand");
				await sleep(1000);
				chores_in_progress = false;
			}

		} catch(e) {
			chores_in_progress = false;
			game_log("stockLoop: " + (e.reason || e.message || e));
		}
		await sleep(10000);
	}
}

// ============================================================================
// 7. STAND LOOP — Gestion du stand de marché
// ============================================================================

/** Point d'extension remplacé par le builder v2 (annonces + ordres d'achat). */
async function maybe_keep_shop() { return false; }

async function standLoop() {
	while (true) {
		try {
			if (character.rip) { await sleep(3000); continue; }
			if (typeof MerchantLoopGuard !== "undefined" && !MerchantLoopGuard.allowed("stand")) { await sleep(1500); continue; }
			var sortState = typeof ALCCBankSorter !== "undefined" && ALCCBankSorter.snapshot ? ALCCBankSorter.snapshot().state : "idle";
			if (sortState === "queued" || sortState === "running") { await sleep(750); continue; }
			// A false result from the injected stand manager allows the standalone
			// fallback below. Guard both paths before either can walk to market.
			var standTrip=refresh_production_trip();
            if (standTrip && !((standTrip==='exchange'||standTrip==='craft')&&merchant_remote_exchange_available())) { await sleep(750); continue; }

			// Si des corvees ou achats sont en cours, attendre qu'ils soient termines
			if (chores_in_progress) {
				await sleep(1500);
				continue;
			}

			// Le build Command Center sérialise ici toute modification des slots trade.
			// Le script source conserve ensuite son comportement autonome en fallback.
			if (typeof maybe_keep_shop === "function" && await maybe_keep_shop()) {
				await sleep(750);
				continue;
			}

			var stand_enabled = cc_stand_enabled();
			var listings = cc_listings();

			// Si stand désactivé explicitement dans le dashboard : fermer le stand
			if (!stand_enabled) {
				if (character.stand || character.standed) {
					try { await ensure_stand_closed(); } catch(e) {}
				}
				await sleep(5000);
				continue;
			}

			// Position cible du stand (dashboard standSpot ou défaut)
			var spot = cc_stand_spot();

			// Aller au bon endroit si pas déjà là
			if (!near_point(spot, 45)) {
				set_message("walk stand");
				if (character.stand || character.standed) {
					try { await ensure_stand_closed(); } catch(e) {}
				}
				await walk_to(spot, "stand spot");
				await sleep(1500);
				continue;
			}

			// Computer / Super Computer can open their own stand; stand0 is the fallback.
			if (!character.stand && !character.standed && merchant_stand_item_slot() === -1) {
				// Acheter un stand si assez d'or
				if (character.gold >= 40000) {
					var merchant_npc = { map: "main", x: -193, y: 680 };
					if (!near_point(merchant_npc, 80)) {
						await walk_to(merchant_npc, "buy stand");
					} else {
						try { await buy("stand0", 1); game_log("bought stand0"); } catch(e) {}
					}
				}
				await sleep(3000);
				continue;
			}

			// Auditer les prix avant d'ouvrir le stand. Ainsi, une ancienne annonce
			// incorrecte n'est jamais remise en ligne pendant sa correction.
			var listing_reset = false;
			var live_slots = character.slots || {};
			for (var audit_i = 0; audit_i < listings.length && !listing_reset; audit_i++) {
				var audit_rule = listings[audit_i];
				for (var audit_slot = 1; audit_slot <= merchant_trade_capacity(); audit_slot++) {
					var live_listing = live_slots["trade" + audit_slot];
					if (!live_listing || live_listing.b) continue;
					if (live_listing.name !== audit_rule.item || (live_listing.level || 0) !== (audit_rule.level || 0)) continue;
					if (Number(live_listing.price) === Number(audit_rule.price)) break;
					// Never reopen while an unsafe listing is still present, including
					// when unequip fails because the inventory has no free slot.
					listing_reset = true;
					try {
						if (character.stand || character.standed) await ensure_stand_closed();
						await unequip("trade" + audit_slot);
						game_log("removed stale listing " + audit_rule.item + " @" + live_listing.price + "; expected " + audit_rule.price);
					} catch(e) {
						game_log("reprice " + audit_rule.item + ": " + (e.reason || e.message || e));
					}
					break;
				}
			}
			if (listing_reset) {
				await sleep(500);
				continue;
			}

			// Ouvrir le stand uniquement après validation des annonces existantes,
			// et seulement si aucune corvee n'est en cours/en attente (anti-flapping).
			if (!character.stand && !character.standed) {
				if (!stand_open_allowed()) {
					await sleep(2000);
					continue;
				}
				var stand_slot = merchant_stand_item_slot();
				try {
					await open_stand(stand_slot);
					for (var stand_wait = 0; stand_wait < 4 && !character.stand && !character.standed; stand_wait++) await sleep(250);
					if (!character.stand && !character.standed) game_log("stand remains closed after open_stand (slot " + stand_slot + ")");
				} catch(e) { game_log("open_stand: " + (e.reason || e)); }
				await sleep(500);
			}

			// Publier les items manquants directement au prix du Command Center.
			for (var li = 0; li < listings.length; li++) {
				var rule = listings[li];
				if (!rule.item || !rule.price) continue;
				// Trouver l'item dans l'inventaire
				var items = character.items || [];
				var found_slot = -1;
				for (var is = 0; is < items.length; is++) {
					var it = items[is];
					if (!it || it.l) continue;
					if (it.name === rule.item && (it.level || 0) === (rule.level || 0) && stand_inventory_allowed(it)) {
						// Vérifier que pas déjà dans un slot trade
						var already_listed = false;
						var slots = character.slots || {};
						for (var ti = 1; ti <= merchant_trade_capacity(); ti++) {
							var ts = slots["trade" + ti];
							if (ts && ts.name === rule.item && (ts.level || 0) === (rule.level || 0)) {
								already_listed = true;
								break;
							}
						}
						if (!already_listed) { found_slot = is; break; }
						else { found_slot = -2; break; } // déjà listé
					}
				}
				if (found_slot >= 0) {
					// Trouver un slot trade libre
					var slots2 = character.slots || {};
					for (var ti2 = 1; ti2 <= merchant_trade_capacity(); ti2++) {
						if (!slots2["trade" + ti2]) {
							try {
								// trade() publishes the item and its price atomically. Using
								// equip() first creates a 1-gold listing; if set_trade() then
								// fails, that unsafe price remains live.
								var listing_qty = (items[found_slot] && items[found_slot].q) || 1;
								var listingItem = items[found_slot];
                                await trade(found_slot, ti2, rule.price, listing_qty);
                                release_listing_bank_stock(listingItem);
								game_log("listed " + rule.item + " +" + (rule.level || 0) + " @" + rule.price + " x" + listing_qty);
							} catch(e) {
								game_log("list " + rule.item + ": " + (e.reason || e.message || e));
							}
							break;
						}
					}
				}
			}
			set_message(exchange_space_pause ? "exchange paused: inventory space" : "stand open");

		} catch(e) {
			game_log("standLoop: " + (e.reason || e.message || e));
		}
		await sleep(5000);
	}
}

// ============================================================================
// 8. TOWN CHORES LOOP — Vente Gabriel + Échanges Xyn + Banque
// ============================================================================

/** Vrai si cet item doit être vendu à Gabriel. */
function should_sell(it) {
	if (!item_owned(it)) return false;
    if(typeof BankCoordinator!=='undefined'&&BankCoordinator.reserved(it))return false;
    if (typeof CompoundProduction !== "undefined" && CompoundProduction.reserved(it)) return false;
    if (upgrade_target_complete(it)) return false;
	if (craft_item_reserved(it.name, it.level || 0)) return false;
	var npc_items = cc_npc_items();
	for (var i = 0; i < npc_items.length; i++) {
		if (npc_items[i] !== it.name) continue;
		// Conserver les pièces encore en cours d'amélioration, puis vendre les
		// exemplaires qui ont atteint (ou dépassé) la cible du dashboard.
		if (cc_upgrade_enabled()) {
			var rules = cc_upgrade_rules();
			for (var r = 0; r < rules.length; r++) {
				if (rules[r].item === it.name && (it.level || 0) < rules[r].maxLevel) return false;
			}
		}
		return true;
	}
	return false;
}

/** Retourne l'index du premier item à vendre à Gabriel, ou -1. */
function locate_sell_item() {
	var items = character.items || [];
	for (var i = 0; i < items.length; i++) {
		if (should_sell(items[i])) return i;
	}
	return -1;
}

var exchange_drain = {}; // Suit si on est en train de drainer un item

var exchange_bank_retry = {};
/** Batch size is exchanges, not raw item quantity. Inventory stock drains first. */
function next_exchange_bank_job() {
    var board=typeof __ALCC!=='undefined'&&__ALCC.exchange;
    if(!board||!board.enabled||!board.bank||free_slots()<2)return null;
    for(var i=0;i<board.items.length;i++){
        var name=board.items[i],rule=board.bank[name],def=G.items&&G.items[name];
        if(!rule||!rule.enabled||!def||!def.e||Date.now()<(exchange_bank_retry[name]||0))continue;
        var unit=Number(def.e)||1;if(item_count(name)>=unit)continue;
        var available=0;each_bank_item(function(it){if(it.name===name&&!it.l&&!it.b&&(!it.oo||it.oo===character.name)&&(it.level||0)===0)available+=it.q||1;});
        // No bank snapshot yet: one bounded visit, then back off if stock is absent.
        if(character.bank&&available<unit)continue;
        var exchanges=character.bank?Math.min(rule.batchSize,Math.floor(available/unit)):rule.batchSize;
        if(exchanges<1)continue;
        return {item:name,batch:exchanges,kind:'exchange',bank:[{item:name,level:0,quantity:exchanges*unit}],missing:[]};
    }
    return null;
}
async function stock_exchange_bank(job){
    exchange_bank_retry[job.item]=Date.now()+300000;
    var previousChores=chores_in_progress;chores_in_progress=true;
    var result;try { result=await stock_craft_bank(job); } finally { chores_in_progress=previousChores; }
    if(item_count(job.item)>=(Number(G.items[job.item].e)||1)){exchange_drain[job.item]=true;production_trip='exchange';exchange_bank_retry[job.item]=Date.now()+1000;}
    return result;
}
/** Retourne l'index du premier item à échanger chez Xyn, ou -1. */
function locate_exchange_item() {
	var ex_items = cc_exchange_items();
	var ex_min = cc_exchange_min();
	for (var i = 0; i < ex_items.length; i++) {
		var name = ex_items[i];
		var min_q = (ex_min && ex_min[name]) || 1;
		var q = item_count(name);
		var batch = G.items && G.items[name] && G.items[name].e || 1;
        if (q < batch) { exchange_drain[name] = false; continue; }
        // Bank-fed rules drain carried recipe stock before requesting another batch.
        var bankRule = typeof __ALCC !== 'undefined' && __ALCC.exchange && __ALCC.exchange.bank && __ALCC.exchange.bank[name];
		if (q >= min_q || (bankRule && bankRule.enabled)) exchange_drain[name] = true;
		if (!exchange_drain[name]) continue;
		var slot = find_item(name);
		if (slot >= 0 && character.items[slot] && !character.items[slot].l) return slot;
	}
	return -1;
}

/**
 * Liste d'items protégés qui ne doivent JAMAIS être déposés à la banque.
 * Inclut: potions, parchemins, outils, tokens, parcels et listings du stand.
 */
function is_protected_item(it) {
	if (!it) return true;
    if (typeof UpgradeProduction !== "undefined" && UpgradeProduction.reserved && UpgradeProduction.reserved(it.name)) return true;
    if (typeof CompoundProduction !== "undefined" && CompoundProduction.reserved(it)) return true;
	if (it.l) return true; // item verrouillé
	var name = it.name;
	// Consommables
	if (name === CONFIG.HPOT || name === CONFIG.MPOT || name === "hpot0" || name === "mpot0" || name === "hpot1" || name === "mpot1") return true;
	// Parchemins
	if (typeof upgrade_supply_reserved === "function" && upgrade_supply_reserved(name)) return true;
	if (name === "scroll0" || name === "scroll1" || name === "scroll2" || name === "scroll3" || name === "cscroll0" || name === "cscroll1") return true;
	// Outils / stand
	if (name === "stand0" || name === "computer" || name === "supercomputer" || name === "tracker") return true;
	// Objets spéciaux à garder sur soi (ne jamais bank)
	if (name === "marketparcel" || name === "monstertoken" || name === "feather0" || name === "wingedboots") return true;
	if (craft_item_reserved(name, it.level || 0)) return true;
	// Items listés sur le stand (Command Center)
	var listings = cc_listings();
	for (var i = 0; i < listings.length; i++) {
		if (listings[i].item === name && (listings[i].level || 0) === (it.level || 0)) return true;
	}
	// Items à vendre à Gabriel (vont à Gabriel, pas en banque)
	if (should_sell(it)) return true;
	// Items à échanger chez Xyn
	var ex_items = cc_exchange_items();
	if (ex_items.indexOf(name) >= 0) return true;
	return false;
}

/**
 * Vrai si cet item doit être déposé en banque lors d'un dump.
 *
 * Anciennement `!is_protected_item(it)`, ce qui bankait TOUT ce qui n'était pas
 * explicitement protégé — y compris des items qu'une corvée en attente allait
 * consommer (upgrade / compound), cassant la boucle d'amélioration.
 */
/** Explicit upgrade targets are also output destinations: finished pieces go to bank. */
function upgrade_target_complete(it) {
    if (!it || it.l || it.b || (it.oo && it.oo !== character.name) || !cc_upgrade_enabled()) return false;
    var def = G.items && G.items[it.name];
    if (!def || !def.upgrade) return false;
    var rules = cc_upgrade_rules();
    return rules.some(function (rule) { return rule.item === it.name && rule.maxLevel > 0 && (it.level || 0) >= rule.maxLevel; });
}
function should_bank_item(it) {
    if (!it || it.l || it.b) return false;
    if (typeof listing_bank_stock_reserved === "function" && listing_bank_stock_reserved(it)) return false;
    // An active compound trio owns its inputs before stand-surplus deposit rules.
    // Otherwise an existing +1 listing sends freshly withdrawn +1 trios straight back.
    if (typeof CompoundProduction !== "undefined" && CompoundProduction.eligible(it) && !CompoundProduction.depositEligible(it)) return false;
    var listingRule=(typeof cc_listings === "function" ? cc_listings() : []).find(function(r){return r.item===it.name&&(r.level||0)===(it.level||0);});
    if(listingRule&&stand_listing_posted(it)&&(!it.oo||it.oo===character.name))return true;
    if(listingRule&&listingRule.bankReserve>0&&(!it.oo||it.oo===character.name))return true;
    if (typeof CompoundProduction !== "undefined" && CompoundProduction.depositEligible(it)) return true;
    if (upgrade_target_complete(it)) return true;
	// Dashboard allowlist: an empty or disabled list means "deposit nothing".
	// Never fall back to the former "everything not protected" behaviour.
	var board = typeof __ALCC !== "undefined" && __ALCC.bankDeposit;
	if (!board || !board.enabled || !board.items || board.items.indexOf(it.name) < 0) return false;
	if (is_protected_item(it)) return false;
	// Liste noire explicite : jamais en banque.
	if (CONFIG.BANK_NEVER && CONFIG.BANK_NEVER[it.name]) return false;
	// Ne pas bank un item qu'on s'apprête à améliorer (scroll dispo + autorisé).
	if (cc_upgrade_enabled() && should_upgrade(it)) {
		var scroll = upgrade_scroll_for(it);
		if (scroll && item_count(scroll) >= 1) return false;
	}
	return true;
}

function bankable_signature() {
	return (character.items || []).filter(should_bank_item).map(function(it) {
		return it.name + ":" + (it.level || 0) + ":" + (it.q || 1);
	}).sort().join("|");
}

/**
 * Priorité de dépôt (tri type "Bank Sorter" de Crowns3bc).
 * 2 = haute valeur (BANK_ALWAYS ou valeur marchande élevée) : déposé en premier,
 *     avant que la banque ne se remplisse.
 * 1 = dépôt normal.
 * 0 = ne pas déposer.
 */
function bank_priority(it) {
	if (!should_bank_item(it)) return 0;
	if (typeof __ALCC !== "undefined" && __ALCC.bankDeposit && __ALCC.bankDeposit.items.indexOf(it.name) >= 0) return 2;
	var base = (G.items[it.name] && G.items[it.name].g) || 0;
	var value = base * (1 + (it.level || 0));
	return value >= 100000 ? 2 : 1;
}

/**
 * Retourne la liste des packs de banque disponibles sur la carte actuelle.
 * bank_packs est TOUJOURS disponible (même hors banque) : { packName: [map, x, y] }
 * character.bank n'est disponible QUE dans la banque.
 */
function get_available_bank_packs() {
	if (!character.bank) return [];
	return Object.keys(character.bank).filter(function(k) { return /^items\d+$/.test(k); })
		.sort(function(a, b) { return Number(a.slice(5)) - Number(b.slice(5)); });
}

function bank_pack_floor(pack) {
	var n = Number(String(pack).replace("items", ""));
	return n <= 7 ? "bank" : n <= 23 ? "bank_b" : "bank_u";
}

/**
 * Vérifie si la banque a au moins un slot libre.
 * - Dans la banque : compte les vrais slots vides dans character.bank
 * - Hors banque : se base sur bank_packs (on ne peut pas savoir exactement, on retourne true par défaut)
 */
function has_bank_space() {
	if (character.map && character.map.indexOf("bank") === 0 && character.bank) {
		// On est dans la banque : vérification réelle
		var packs = get_available_bank_packs();
		for (var i = 0; i < packs.length; i++) {
			var list = character.bank[packs[i]];
			if (!list) continue; // Un pack non chargé n'est jamais supposé vide.
			for (var j = 0; j < 42; j++) {
				if (!list[j]) return true;
			}
		}
		return false; // Vraiment pleine
	}
	// Hors banque : on suppose qu'il y a de la place (on ne peut pas vérifier).
	// Le script ira à la banque et vérifiera sur place.
	return get_available_bank_packs().length > 0;
}

/**
 * Parcourt TOUS les packs de la banque (items0, items1, items2, ...)
 * pour trouver le meilleur slot libre (stack ou premier slot vide).
 * DOIT être appelé uniquement quand character.map === "bank".
 */
function find_empty_bank_slot(item) {
	if (!character.bank) {
		game_log("find_empty_bank_slot: character.bank absent (pas dans la banque ?)");
		return null;
	}
	var packs = get_available_bank_packs();
	if (packs.length === 0) packs = Object.keys(character.bank).filter(function(k) { return k !== "gold"; });

	// 1. Chercher si l'item peut stacker dans un pack existant
	if (item && item.q && G.items[item.name] && G.items[item.name].s) {
		var max_s = G.items[item.name].s;
		for (var p1 = 0; p1 < packs.length; p1++) {
			var list1 = character.bank[packs[p1]];
			if (!list1) continue;
			for (var i = 0; i < 42; i++) {
				var bit = list1[i];
				if (bit && bit.name === item.name && (bit.level || 0) === (item.level || 0) && (bit.q || 1) < max_s) {
					return { pack: packs[p1], slot: i, merge: true };
				}
			}
		}
	}
	// 2. Chercher le premier slot vide parmi tous les packs disponibles
	for (var p2 = 0; p2 < packs.length; p2++) {
		var list2 = character.bank[packs[p2]];
		if (!list2) continue;
		for (var j = 0; j < 42; j++) {
			if (!list2[j]) {
				return { pack: packs[p2], slot: j, merge: false };
			}
		}
	}
	game_log("Banque vraiment pleine (" + packs.length + " packs, aucun slot libre) !");
	return null;
}

/** Boutique autorisée pour un ingrédient de craft achetable. Liste explicite anti-spam. */
function craft_shop_for(name) {
    var definition = G.items && G.items[name];
    if (!definition || definition.cash || !(definition.g > 0)) return null;
    var shop = G.npcs && G.npcs.basics;
    if (shop && shop.items && shop.items.indexOf(name) >= 0) return "basics";
    var maps = Object.keys(G.maps || {});
    for (var m = 0; m < maps.length; m++) {
        var map = G.maps[maps[m]];
        if (map.instance || map.ignore) continue;
        var npcs = map.npcs || [];
        for (var n = 0; n < npcs.length; n++) {
            var npc = npcs[n], seller = G.npcs && G.npcs[npc.id];
            if (seller && seller.role === "merchant" && !seller.moving && seller.items && seller.items.indexOf(name) >= 0 && Array.isArray(npc.position)) return { map: maps[m], x: npc.position[0], y: npc.position[1] };
        }
    }
    return null;
}
var craft_batch = null;
var craft_bank_retry = {};
/** Withdraw into an empty slot, split the required quantity, return excess to its original empty slot. */
async function stock_craft_bank(job) {
    craft_bank_retry[job.item] = Date.now() + 60000;
    hold_stand(90000);
    if (character.stand || character.standed) await ensure_stand_closed();
    if (!character.map || character.map.indexOf("bank") !== 0) await smart_move("bank");
    if (!character.bank) return false;
    for (var i = 0; i < job.bank.length; i++) {
        var part = job.bank[i];
        while (item_count_level(part.item, part.level) < part.quantity && free_slots() >= 2) {
            var found = null;
            each_bank_item(function(it, pack, slot) {
                if (!found && !it.l && !it.b && (!it.oo || it.oo === character.name) && it.name === part.item && (it.level || 0) === part.level) found = { pack: pack, slot: slot };
            });
            if (!found) break;
            var floor = bank_pack_floor(found.pack);
            if (character.map !== floor) await smart_move(floor);
            var empty = character.items.findIndex(function(it) { return !it; });
            if (empty < 0) break;
            var need = part.quantity - item_count_level(part.item, part.level);
            await bank_retrieve(found.pack, found.slot, empty);
            var received = character.items[empty];
            if (!received || received.name !== part.item) throw Error("Unconfirmed craft withdrawal");
            if ((received.q || 1) > need) {
                if (typeof split !== "function") throw Error("Stack splitting unavailable; craft held in bank");
                var originalQuantity = received.q;
                await split(empty, need);
                received = character.items[empty];
                if (!received || received.name !== part.item || received.q !== originalQuantity - need) throw Error("Unconfirmed craft split");
                if (character.bank[found.pack][found.slot]) throw Error("Craft bank return slot changed; no swap attempted");
                await bank_store(empty, found.pack, found.slot);
            }
            game_log((job.kind === "exchange" ? "exchange bank: " : "craft bank: ") + part.item + " stocked for " + job.batch + (job.kind === "exchange" ? " exchanges" : " crafts"));
        }
    }
    return true;
}

/** Retourne le prochain craft réellement exécutable, ou null. */
function craft_rule_paused(rule) {
    var paused = !!rule.paused;
    try { var overrides=get('alcc:craft-pauses:'+character.name)||{}; if(typeof overrides[rule.item]==='boolean')paused=overrides[rule.item]; } catch(e) {}
    return paused;
}
function next_craft_job() {
	if (!cc_craft_enabled() || typeof G === "undefined" || !G.craft) return null;
	var rules = cc_craft_rules();
	for (var r = 0; r < rules.length; r++) {
		var name = rules[r] && rules[r].item;
        if (!rules[r] || (typeof craft_rule_paused === 'function' ? craft_rule_paused(rules[r]) : rules[r].paused)) continue;
		if (typeof RuntimePolicy !== "undefined" && !RuntimePolicy.commercialAllowed(name)) continue;
		var recipe = name && G.craft[name];
		if (!recipe || !Array.isArray(recipe.items)) continue;
		var retained = {}; try { retained=get('alcc:craft-batches:'+character.name)||{}; } catch(e) {}
        var batch = craft_batch && craft_batch.item === name ? craft_batch.remaining : Math.max(1, Math.min(500, Number(retained[name]) || Number(rules[r].batchSize) || 1));
        // Non-stackable NPC bases and results each need an inventory slot.
        if (!craft_batch || craft_batch.item !== name) batch = Math.min(batch, Math.max(1, Math.floor((free_slots() - 2) / 2)));
        // Decide the whole batch before computing ingredient purchases.
        for (var k = 0; k < recipe.items.length; k++) {
            var material = recipe.items[k], perCraft = Number(material[0]) || 1, materialLevel = Number(material[2]) || 0;
            if (!craft_shop_for(material[1]) && (!rules[r].useBank || Date.now() < (craft_bank_retry[name] || 0))) batch = Math.min(batch, Math.floor(item_count_level(material[1], materialLevel) / perCraft));
        }
        if (typeof RuntimePolicy !== "undefined" && RuntimePolicy.commercialBatchLimit) batch = RuntimePolicy.commercialBatchLimit(name, batch);
        if (batch < 1) continue;
        var missing = [], bank = [], extraCost = 0, blocked = false;
		for (var i = 0; i < recipe.items.length; i++) {
			var row = recipe.items[i], qty = Number(row[0]) || 1, ingredient = row[1], level = Number(row[2]) || 0;
			var need = Math.max(0, qty * batch - item_count_level(ingredient, level));
			if (!need) continue;
			var shop = level === 0 ? craft_shop_for(ingredient) : null;
			if (!shop) {
                if (item_count_level(ingredient, level) >= qty) continue;
                if (rules[r].useBank && Date.now() >= (craft_bank_retry[name] || 0)) { bank.push({ item: ingredient, level: level, quantity: qty * batch }); continue; }
                blocked = true; break;
            }
			missing.push({ item: ingredient, quantity: need, shop: shop });
			extraCost += ((G.items[ingredient] && Number(G.items[ingredient].g)) || 0) * need;
		}
		if (blocked || (missing.length && free_slots() < 1)) continue;
        if(bank.length && typeof BankCoordinator!=='undefined' && BankCoordinator.snapshot().current) continue;
		var cost = (Number(recipe.cost) || 0) * batch;
		if ((character.gold || 0) < cc_craft_gold_reserve() + cost + extraCost) continue;
		return { item: name, recipe: recipe, missing: missing, bank: bank, batch: batch };
	}
	return null;
}

/** Achète les composants NPC manquants puis craft exactement une unité chez Leo. */
async function run_next_craft() {
	var job = next_craft_job();
	if (!job) { if(craft_batch && !cc_craft_rules().some(function(r){return r.item===craft_batch.item && craft_rule_paused(r);})) craft_batch = null; return false; }
    if (!craft_batch || craft_batch.item !== job.item) { craft_batch = { item: job.item, remaining: job.batch }; try { var retained=get('alcc:craft-batches:'+character.name)||{};delete retained[job.item];set('alcc:craft-batches:'+character.name,retained); } catch(e) {} }
    else craft_batch.remaining = Math.min(craft_batch.remaining, job.batch);
    try { var retained=get('alcc:craft-batches:'+character.name)||{};delete retained[job.item];set('alcc:craft-batches:'+character.name,retained); } catch(e) {}
    if (job.bank.length) return await stock_craft_bank(job);
    var remoteCraft = merchant_remote_exchange_available();
    if (remoteCraft && (character.map && character.map.indexOf('bank') === 0 || !near_point(cc_stand_spot(), 24))) {
        await walk_to(cc_stand_spot(), 'remote craft at stand');
        return true;
    }
    if (remoteCraft) stand_hold_until = 0;
    else hold_stand(90000);
	if (!remoteCraft && (character.stand || character.standed)) {
		try { await ensure_stand_closed(); } catch(e) {}
		await sleep(250);
	}
	if (job.missing.length) {
		var part = job.missing[0];
		set_message("craft stock " + part.item);
		var beforeStock = item_count_level(part.item, 0);
		if (typeof RuntimePolicy !== "undefined") RuntimePolicy.reserve(job.item, part.quantity * Number(G.items[part.item].g || 0));
		var bought = await buy_from_shop(part.item, part.quantity, part.shop);
		if (typeof RuntimePolicy !== "undefined") RuntimePolicy.settle(job.item, Math.max(0, item_count_level(part.item, 0) - beforeStock) * Number(G.items[part.item].g || 0), 0);
		if (bought) game_log("craft stock: bought " + part.quantity + " " + part.item);
		return true;
	}
	if (character.q && character.q.craft) return true;
	if (!remoteCraft && !near_point(SHOP_XY.craftsman, 80)) {
		set_message("craft " + job.item + " (Leo)");
		await walk_to("craftsman", "craft " + job.item);
		return true;
	}
	await ensure_mass_buff("produce");
	job = next_craft_job();
	if (!job || job.missing.length) return true;
	try {
		if (typeof RuntimePolicy !== "undefined") RuntimePolicy.reserve(job.item, Number(job.recipe.cost || 0));
		var crafted = await auto_craft(job.item);
		if (crafted && crafted.failed) throw crafted;
		if (typeof RuntimePolicy !== "undefined") RuntimePolicy.settle(job.item, Number(job.recipe.cost || 0), 1);
		game_log("crafted 1 " + job.item + (remoteCraft ? " at stand (Computer)" : " at Leo"));
        if (craft_batch && --craft_batch.remaining <= 0) { craft_batch = null; if (production_trip === "craft") production_trip = null; }
	} catch(e) {
		game_log("craft " + job.item + ": " + (e.reason || e.message || e));
	}
	return true;
}


async function townChoresLoop() {
	while (true) {
		try {
			if (character.rip) { await sleep(3000); continue; }
			var bankSortState = typeof ALCCBankSorter !== "undefined" && ALCCBankSorter.snapshot ? ALCCBankSorter.snapshot().state : "idle";
			if (bankSortState === "queued" || bankSortState === "running") { await sleep(1000); continue; }
			// Les routines de kit/consommables/upgrade possèdent leur trajet. Ne pas
			// les interrompre ni les expulser de la banque pendant leur opération.
			if (chores_in_progress && !bank_dump_active) { await sleep(1000); continue; }
            // A persisted review blocks mutations, not the character's return.
            if (typeof BankCoordinator !== 'undefined' && BankCoordinator.snapshot().current && character.map && character.map.indexOf('bank') === 0) {
                chores_in_progress=true;bank_dump_active=false;
                try { await walk_to(cc_stand_spot(),'bank transaction held: return to stand'); }
                finally { chores_in_progress=false;BankCoordinator.releaseNavigation('deposit'); }
                await sleep(1000);continue;
            }
			// Returning workers need room to unload: never block remote sales or
            // inventory-pressure cleanup while waiting for their transfer.
			if (!chores_in_progress && !bank_dump_active && !exchange_space_paused() && merchant_work_next() !== "sell" && typeof EventExpedition !== "undefined" && EventExpedition.needsReturnService()) {
				await go_to(cc_stand_spot(), "event duo unloading", 60); await sleep(1000); continue;
			}
			refresh_production_trip();
            // Daily seasonal route shares navigation ownership with all merchant chores.
            if (!chores_in_progress && !bank_dump_active && !production_trip && typeof MerchantHalloween !== 'undefined') {
                chores_in_progress = true;
                var halloweenHandled = false;
                try {
                    if (typeof MerchantWitchCipher !== 'undefined') halloweenHandled = await MerchantWitchCipher.tick();
                    if (!halloweenHandled) halloweenHandled = await MerchantHalloween.tick();
                }
                finally { chores_in_progress = false; }
                if (halloweenHandled) { await sleep(500); continue; }
            }
            if (production_trip === "exchange" && character.q && character.q.exchange) { await sleep(500); continue; }
			// The dashboard bank allowlist is an explicit queue. Once one matching
			// item exists, defer Gabriel/Xyn/craft until it has been deposited.
			var immediate_bankable = merchant_work_next() === "bank" && character.items && character.items.some(should_bank_item);

			// --- 1. Vente à Gabriel ---
			var sell_slot = locate_sell_item();
			if (merchant_work_next() === "sell" && !immediate_bankable && sell_slot >= 0 && cc_npc_enabled() && (typeof remote_sale_busy === 'undefined' || !remote_sale_busy)) {
                // A reload or another bank service may leave us inside a bank.
                // Remote NPC selling is unavailable there; finish the exit first.
                if(character.map && character.map.indexOf('bank')===0){
                    chores_in_progress=true;
                    try { await walk_to(cc_stand_spot(), 'leave bank before NPC sale'); }
                    finally { chores_in_progress=false; }
                    await sleep(500);continue;
                }
				set_message("sell Gabriel");
				sell_slot = locate_sell_item();
				if (sell_slot >= 0) {
					var sit = character.items[sell_slot];
					if (sit) {
						try {
							remote_sale_busy = true;
                            try { await sell(sell_slot, sit.q || 1); } finally { remote_sale_busy = false; }
							game_log("sold " + sit.name + " to Gabriel");
						} catch(e) {
							game_log("sell err: " + (e.reason || e));
						}
					}
				}
				await sleep(200);
				continue;
			}

			// --- 2. Échanges Xyn ---
			var bankExchangeJob = typeof next_exchange_bank_job === 'function' ? next_exchange_bank_job() : null;
            if(merchant_work_next()==='exchange' && bankExchangeJob && locate_exchange_item()<0){await stock_exchange_bank(bankExchangeJob);await sleep(500);continue;}
            var ex_slot = locate_exchange_item();
			if ((merchant_work_next() === "exchange" || (typeof merchant_parallel_stand_ready === 'function' && merchant_parallel_stand_ready() && merchant_remote_exchange_available() && merchant_task_allowed('exchange') && !exchange_space_paused())) && !immediate_bankable && ex_slot >= 0 && cc_exchange_enabled() && free_slots() >= 1) {
				set_message("exchange Xyn");
                var remoteExchange=merchant_remote_exchange_available();
				if(!remoteExchange)hold_stand(60000);
				if (character.q && character.q.exchange) { await sleep(500); continue; }
                if(character.map&&character.map.indexOf('bank')===0){
                    chores_in_progress=true;
                    try{await walk_to(cc_stand_spot(),'leave bank before exchange');}finally{chores_in_progress=false;}
                    await sleep(500);continue;
                }
				if (!remoteExchange&&(character.stand || character.standed)) {
					try { await ensure_stand_closed(); } catch(e) {}
				}
                if(remoteExchange&&!near_point(cc_stand_spot(),24)){
                    await walk_to(cc_stand_spot(),'remote exchange at stand');await sleep(500);continue;
                }
                if(remoteExchange)stand_hold_until=0;
				if (!remoteExchange&&!near_point(SHOP_XY.exchange, 80)) {
					await walk_to("exchange", "Xyn exchange");
					await sleep(1000);
					continue;
				}
				ex_slot = locate_exchange_item();
				if (ex_slot >= 0) {
					var eit = character.items[ex_slot];
					if (eit) {
						await ensure_mass_buff("exchange");
						ex_slot = locate_exchange_item();
						if (ex_slot >= 0) {
							try {
								var ex_result = await exchange(ex_slot);
								game_log("exchanged " + eit.name + " -> " + ((ex_result && ex_result.reward) || "ok"));
							} catch(e) {
								game_log("exchange err: " + (e.reason || e));
							}
						}
					}
				}
				await sleep(300);
				continue;
			}

            // Finish stationary production before starting a logistics trip.
            if (character.q && (character.q.upgrade || character.q.compound)) { await sleep(500); continue; }
			// --- 3. Craft chez Leo (une seule unité par passage) ---
			if (merchant_work_next() === "craft" && !immediate_bankable && await run_next_craft()) {
				await sleep(500);
				continue;
			}

			// --- 4. Banque dès qu'un item explicitement autorisé est présent ---
			var has_bankable = character.items && character.items.some(should_bank_item);
			var in_bank = character.map && character.map.indexOf("bank") === 0;
			var now = Date.now();
			var bank_signature = has_bankable ? bankable_signature() : "";
			var same_failure_backoff = bank_signature && bank_signature === last_bank_failure_signature && (now - last_bank_failure_at) < (CONFIG.BANK_COOLDOWN_MS || 45000);
			if (bank_dump_active && !has_bankable) { bank_dump_active = false; if(typeof BankCoordinator!=='undefined')BankCoordinator.release('deposit'); }

			// Aucune pression d'inventaire n'est requise : la liste du dashboard est
			// une file de dépôt. Le cooldown ne bloque que le même contenu après échec.
			if (merchant_work_next() === "bank" && has_bankable && !same_failure_backoff) {
				bank_dump_active = true;
				chores_in_progress = true;
			}
			var need_bank = bank_dump_active && has_bankable;

			if (need_bank) {
                if(typeof BankCoordinator!=='undefined'&&!BankCoordinator.acquire('deposit')){
                    act('bank transaction needs review');
                    bank_dump_active=false;
                    try { if(in_bank) await walk_to(cc_stand_spot(),'bank review: return to stand'); }
                    finally { chores_in_progress=false;BankCoordinator.releaseNavigation('deposit'); }
                    await sleep(1500);continue;
                }
				set_message("bank (dump items)");
				hold_stand(90000);
				if (character.stand || character.standed) {
					try { await ensure_stand_closed(); } catch(e) {}
					await sleep(250);
				}

				if (!in_bank) {
					// smart_move gère la porte et attend la transition. L'ancienne boucle
					// use_nearest_door pouvait renvoyer la commande toutes les 1,5 s.
					try { await smart_move("bank"); } catch(e) { game_log("bank travel: " + (e.reason || e)); }
					await sleep(500);
					continue;
				}

				// On est dans la banque : attendre que character.bank soit chargé par le socket
                if(typeof BankCoordinator!=='undefined')BankCoordinator.stage('bank');
				var waitBank = 0;
				while (!character.bank && waitBank < 2500) {
					await sleep(250);
					waitBank += 250;
				}

				if (character.bank && !has_bank_space()) {
					game_log("Banque pleine — aucun slot libre disponible.");
					last_bank_failure_signature = bank_signature;
					last_bank_failure_at = Date.now();
					last_bank_trip = Date.now();
					bank_dump_active = false;
                    if(typeof BankCoordinator!=='undefined')BankCoordinator.release('deposit');
					chores_in_progress = false;
					// Ressortir et s'éloigner
					try { await smart_move("main"); } catch(e) {}
					await sleep(500);
					if (character.map && character.map.indexOf("bank") !== 0) {
						try { await walk_to("market", "banque pleine"); } catch(e) {}
					}
					continue;
				}

				// Déposer les items bancables — triés par priorité (haute valeur
				// d'abord, cf. bank_priority). On re-scanne à chaque tour car
				// bank_store() compacte character.items.
				var bank_guard = 0, bank_failed = false, bank_deposited = false;
				while (bank_guard++ < 60) {
					var best_i = -1, best_p = 0;
					for (var bi = 0; bi < character.items.length; bi++) {
						var cand = character.items[bi];
						if (!cand) continue;
						var prio = bank_priority(cand);
						if (prio > best_p) { best_p = prio; best_i = bi; }
					}
					if (best_i < 0) break;
					var bit = character.items[best_i];
					var bslot = find_empty_bank_slot(bit);
					if (!bslot) {
						game_log("Banque pleine — impossible de stocker " + bit.name);
						bank_failed = true;
						break;
					}
					try {
						var tx_id = typeof MerchantTransactions !== "undefined" ? MerchantTransactions.begin("bank", bit.name + " -> " + bslot.pack) : null;
						var before_count = item_count_level(bit.name, bit.level || 0);
						var target_floor = bank_pack_floor(bslot.pack);
						if (character.map !== target_floor) {
							await smart_move(target_floor);
							await sleep(500);
						}
						// Never pass an occupied destination slot here. The bank API treats
						// bank_store(inv, pack, slot) as an explicit swap, even for compatible
						// stacks. Omitting the slot invokes the server's normal store path,
						// which merges compatible stacks before consuming a free slot.
                        if(typeof BankCoordinator!=='undefined'&&!BankCoordinator.begin('deposit',bit.name,bit.level,bit.q||1,bslot.pack)){bank_failed=true;break;}
						await bank_store(best_i, bslot.pack);
						await sleep(400);
						var after_count = item_count_level(bit.name, bit.level || 0);
						if (after_count >= before_count) {
                            if(typeof BankCoordinator!=='undefined')BankCoordinator.finish(false,'Inventory did not decrease');
							if (tx_id) MerchantTransactions.fail(tx_id, "inventory quantity did not decrease");
							game_log("bank verify failed: " + bit.name + " remained in inventory");
							bank_failed = true;
							break;
						}
						bank_deposited = true;
                        if(typeof BankCoordinator!=='undefined')BankCoordinator.finish(true,'Inventory decreased after bank store');
                        if(stand_listing_posted(bit))release_listing_bank_stock(bit);
						if (tx_id) MerchantTransactions.commit(tx_id, "stored " + (before_count - after_count) + " in " + bslot.pack + (bslot.merge ? " (merged)" : ""));
						game_log("banked " + bit.name + (bit.level ? "+" + bit.level : "") + " -> " + bslot.pack + (bslot.merge ? " (merged)" : ""));
					} catch(e) {
						if (typeof tx_id !== "undefined" && tx_id && typeof MerchantTransactions !== "undefined") MerchantTransactions.fail(tx_id, e.reason || e.message || e);
                        if(typeof BankCoordinator!=='undefined')BankCoordinator.finish(false,'Bank store response uncertain');
						game_log("bank err: " + (e.reason || e));
						bank_failed = true;
						break; // évite une boucle infinie sur un item refusé par le serveur
					}
				}

				if (bank_deposited && typeof CompoundProduction !== "undefined") {
					try { await CompoundProduction.checkBank(); } catch (e) { game_log("compound bank: " + (e.reason || e.message || e)); }
				}
                // Reuse the bank visit for missing stand stock, after deposits.
                // The withdrawal lease protects the retrieved finished piece.
                if (!bank_failed) {
                    try {
                        if(typeof BankCoordinator!=='undefined')BankCoordinator.stage('restock');
                        for(var restock=0;restock<merchant_trade_capacity()&&free_slots()>1;restock++){
                            if(!await maybe_restock_listing_from_bank({stayInBank:true}))break;
                        }
                    } catch (e) { game_log("bank listing restock: " + (e.reason || e.message || e)); }
                }
				// Marquer le voyage effectué pour déclencher le cooldown
				last_bank_trip = Date.now();
				if (bank_failed) {
					last_bank_failure_signature = bankable_signature() || bank_signature;
					last_bank_failure_at = last_bank_trip;
				} else if (bank_deposited) {
					last_bank_failure_signature = "";
					last_bank_failure_at = 0;
				}
				// Ressortir de la banque proprement
				if (character.map && character.map.indexOf("bank") === 0) {
					try { await smart_move("main"); } catch(e) {}
					await sleep(500);
				}
				// S'éloigner IMMÉDIATEMENT de la porte de la banque pour ne pas réactiver le trigger de porte
				if (character.map && character.map.indexOf("bank") !== 0) {
					try { await walk_to("market", "retour marche"); } catch(e) {}
					await sleep(1000);
				}
				bank_dump_active = false;
				chores_in_progress = false;
                if(typeof BankCoordinator!=='undefined')BankCoordinator.releaseNavigation('deposit');
				continue;
			}

			// Une autre routine (kit, consommables, stand) peut avoir amené le
			// marchand ici. Elle reste propriétaire du trajet et décide de la sortie.

		} catch(e) {
			game_log("townChoresLoop: " + (e.reason || e.message || e));
			if (bank_dump_active) {
				last_bank_failure_signature = bankable_signature();
				last_bank_failure_at = Date.now();
				bank_dump_active = false;
				chores_in_progress = false;
				last_bank_trip = Date.now();
			}
		}
		await sleep(3000);
	}
}


// ============================================================================
// 9. UPGRADE LOOP — Upgrades + Compound (Joaillerie)
// ============================================================================

/** Vrai si cet item peut être amélioré (règles dashboard ou script). */
function should_upgrade(it) {
	if (!cc_upgrade_enabled()) return false;
	if (!it || it.l) return false;
    if(typeof BankCoordinator!=='undefined'&&BankCoordinator.reserved(it))return false;
	if (character.gold < cc_upgrade_gold_min()) return false;
    if (!upgrade_attempt_allowed(it)) return false;
    var never = CONFIG.NEVER_UPGRADE;
	if (never[it.name]) return false;
	// Vérifier les règles du dashboard
	var rules = cc_upgrade_rules();
	for (var i = 0; i < rules.length; i++) {
		var r = rules[i];
		if (!r.paused && r.item === it.name && (it.level || 0) < r.maxLevel) return true;
	}
	return false;
}

/** Retourne l'index du premier item à upgrader, ou -1. */
function locate_upgrade_item(requireScroll) {
	var items = character.items || [];
	for (var i = 0; i < items.length; i++) {
		if (should_upgrade(items[i]) && (!requireScroll || upgrade_material_slot(upgrade_scroll_for(items[i])) >= 0)) return i;
	}
	return -1;
}

/** Choisit le bon parchemin d'upgrade selon le grade de l'item. */
function upgrade_step_for(it) {
    var rule = cc_upgrade_rules().find(function(r) { return r.item === it.name; });
    return rule && rule.steps && rule.steps[it.level || 0] || { scroll: "auto", offering: "none" };
}
function upgrade_scroll_for(it) {
    if (!it) return null;
    var step = upgrade_step_for(it);
    if (step.enabled === false) return null;
    var grade = typeof item_grade === "function" ? item_grade(it) : 0;
    var chosen = !step.scroll || step.scroll === "auto" ? "scroll" + grade : step.scroll;
    if (grade > 3 || Number(chosen.slice(6)) < grade) return null;
    return chosen;
}
function upgrade_material_slot(name) {
    if (!name || name === "none") return -1;
    return (character.items || []).findIndex(function(it) { return it && it.name === name && !it.l && !it.b && (!it.oo || it.oo === character.name); });
}
function upgrade_attempt_cost(it) {
    var scroll = upgrade_scroll_for(it), offering = upgrade_step_for(it).offering;
    return Number(G.items[scroll] && G.items[scroll].g || 0) + Number(offering && offering !== "none" && G.items[offering] && G.items[offering].g || 0);
}
function upgrade_attempt_allowed(it) {
    var scroll = upgrade_scroll_for(it);
    if (!scroll) return false;
    var restock = typeof upgrade_purchase_state !== "undefined" && upgrade_purchase_state[scroll];
    if (restock && restock.pending && upgrade_material_slot(scroll) >= 0) { delete upgrade_purchase_state[scroll]; if (typeof save_upgrade_purchase_state === "function") save_upgrade_purchase_state(); }
    if (upgrade_material_slot(scroll) < 0 && restock && (restock.pending || Date.now() < restock.retryAt)) return false;
    var offering = upgrade_step_for(it).offering;
    if (offering && offering !== "none" && upgrade_material_slot(offering) < 0) return false;
    return typeof UpgradeProduction === "undefined" || UpgradeProduction.allowed(it.name, upgrade_attempt_cost(it));
}
function upgrade_supply_reserved(name) {
    if (!cc_upgrade_enabled()) return false;
    return cc_upgrade_rules().some(function(rule) { return Object.keys(rule.steps || {}).some(function(level) { var step = rule.steps[level]; return step.enabled !== false && (step.offering === name || step.scroll === name); }); });
}

/** Vrai si cet item peut être compound (bijou x3 => niveau suivant). */
function is_compound_jewel(it) {
	if (!it || it.l) return false;
    if(typeof BankCoordinator!=='undefined'&&BankCoordinator.reserved(it))return false;
    if (typeof CompoundProduction !== "undefined") return CompoundProduction.eligible(it);
	var def = G.items[it.name];
	if (!def || !def.compound) return false;
	var t = def.type;
	var ok = (t === "ring" || t === "earring" || t === "amulet" || t === "belt");
	if (!ok && it.name !== "ftrinket" && it.name !== "wbook0") return false;
	// Scroll disponible ?
	var lv = it.level || 0;
	if (!def.grades) return false;
	if (lv < def.grades[0]) return true;
// cscroll0

	if (lv < def.grades[1]) return true; // cscroll1
	return false;
}

/** Cherche un set de 3 bijoux identiques de même niveau à combiner. */
function find_compound_set() {
	var groups = {};
	var items = character.items || [];
	for (var i = 0; i < items.length; i++) {
		var it = items[i];
		if (!is_compound_jewel(it)) continue;
		var key = it.name + "@" + (it.level || 0);
		if (!groups[key]) groups[key] = [];
		groups[key].push(i);
	}
	for (var k in groups) {
		if (groups[k].length >= 3) return { key: k, slots: groups[k].slice(0, 3) };
	}
	return null;
}

/** Parchemin compound selon le niveau de l'item. */
function compound_scroll_for(it) {
	if (!it) return null;
	var def = G.items[it.name];
	if (!def || !def.grades) return null;
	var lv = it.level || 0;
	if (lv < def.grades[0]) return "cscroll0";
	if (lv < def.grades[1]) return "cscroll1";
	if (G.items.cscroll2) return "cscroll2";
	return null;
}

// Purchase intent is persisted before sending buy: CODE restarts must not duplicate
// an unconfirmed request. Any observed copy resolves the pending state.
var upgrade_purchase_state = {};
try { if (typeof get === "function") upgrade_purchase_state = get("alcc:upgrade-buy:" + character.name) || {}; } catch (e) {}
function save_upgrade_purchase_state() {
    try { if (typeof set === "function") set("alcc:upgrade-buy:" + character.name, upgrade_purchase_state); } catch (e) {}
}
function upgrade_npc_destination(name) {
    var definition = G.items && G.items[name];
    if (!definition || !definition.upgrade || definition.cash || !(definition.g > 0)) return null;
    var maps = Object.keys(G.maps || {}).sort(function (a, b) { return Number(b === character.map) - Number(a === character.map) || Number(b === "main") - Number(a === "main"); });
    for (var m = 0; m < maps.length; m++) {
        var map = G.maps[maps[m]], npcs = map.npcs || [];
        if (map.instance || map.ignore) continue;
        for (var n = 0; n < npcs.length; n++) {
            var npc = npcs[n], shop = G.npcs && G.npcs[npc.id];
            if (shop && shop.role === "merchant" && !shop.moving && shop.items && shop.items.indexOf(name) >= 0 && Array.isArray(npc.position)) return { map: maps[m], x: npc.position[0], y: npc.position[1] };
        }
    }
    return null;
}
function next_upgrade_purchase() {
    if (exchange_space_pause) return null;
    if (!cc_upgrade_enabled() || free_slots() < 2 || character.rip) return null;
    var rules = cc_upgrade_rules();
    for (var i = 0; i < rules.length; i++) {
        var rule = rules[i], state = upgrade_purchase_state[rule.item];
        if (rule.paused || !rule.buyNpc || rule.maxLevel <= 0) continue;
        if (typeof UpgradeProduction !== "undefined" && !UpgradeProduction.allowed(rule.item, (G.items[rule.item] && G.items[rule.item].g) || 0)) continue;
        if (item_count(rule.item) > 0) { if (state && state.pending) { delete upgrade_purchase_state[rule.item]; save_upgrade_purchase_state(); } continue; }
        if (state && (state.pending || Date.now() < state.retryAt)) continue;
        var destination = upgrade_npc_destination(rule.item);
        var scroll = upgrade_scroll_for({ name: rule.item, level: 0 });
        if (!destination || !scroll || item_count(scroll) < 1 || character.gold - G.items[rule.item].g < cc_upgrade_gold_min()) continue;
        return { item: rule.item, destination: destination };
    }
    return null;
}
async function purchase_upgrade_base(job) {
    // Re-check immediately before remote purchase; keep the stand open.
    var current = next_upgrade_purchase();
    if (!current || current.item !== job.item) return;
    upgrade_purchase_state[job.item] = { pending: true, at: Date.now() }; save_upgrade_purchase_state();
    set_message("buy upgrade " + job.item);
    var tx = typeof MerchantTransactions !== "undefined" ? MerchantTransactions.begin("upgrade purchase", job.item + " +0") : null;
    try {
        var productionTicket = typeof UpgradeProduction !== "undefined" ? UpgradeProduction.begin(job.item, G.items[job.item].g, { kind: "purchase", level: 0 }) : null;
        var response = await buy(job.item, 1);
        if (response && response.failed) throw Error(response.reason || "NPC purchase failed");
        for (var wait = 0; wait < 12 && item_count(job.item) < 1; wait++) await sleep(250);
        if (item_count(job.item) < 1) { if (tx) MerchantTransactions.fail(tx, "Unconfirmed purchase; automatic retries held until a copy is observed"); return; }
        delete upgrade_purchase_state[job.item]; save_upgrade_purchase_state();
        if (typeof UpgradeProduction !== "undefined") UpgradeProduction.settle(productionTicket, false);
        if (tx) MerchantTransactions.commit(tx, "One base item received");
    } catch (e) {
        if (typeof UpgradeProduction !== "undefined" && UpgradeProduction.observe) UpgradeProduction.observe(productionTicket, e);
        // A timeout can be an accepted purchase. Keep ambiguous failures pending.
        if (e && /gold|space|buyable|distance|not enough|cannot buy/i.test(String(e.reason || e.message || e))) upgrade_purchase_state[job.item] = { pending: false, retryAt: Date.now() + 60000 };
        save_upgrade_purchase_state();
        if (tx) MerchantTransactions.fail(tx, String(e.reason || e.message || e).slice(0, 180));
        game_log("upgrade buy " + job.item + ": " + (e.reason || e.message || e));
    }
}

/** A missing receipt holds scroll restocking instead of buying repeatedly. */
async function purchase_upgrade_scroll(name) {
    var previous = upgrade_purchase_state[name];
    if (previous && (previous.pending || Date.now() < previous.retryAt)) return;
    upgrade_purchase_state[name] = { pending: true, at: Date.now() }; save_upgrade_purchase_state();
    set_message("buy upgrade scroll " + name);
    try {
        var response = await buy(name, 1);
        if (response && response.failed) throw response;
        for (var wait = 0; wait < 12 && upgrade_material_slot(name) < 0; wait++) await sleep(250);
        if (upgrade_material_slot(name) < 0) { game_log("Unconfirmed scroll purchase: " + name + "; retries held"); return; }
        delete upgrade_purchase_state[name]; save_upgrade_purchase_state();
    } catch(e) {
        if (/gold|space|buyable|distance|not enough|cannot buy/i.test(String(e.reason || e.message || e))) upgrade_purchase_state[name] = { pending: false, retryAt: Date.now() + 60000 };
        save_upgrade_purchase_state();
        game_log("upgrade scroll " + name + ": " + (e.reason || e.message || e));
    }
}

/** Upgrade/compound are lowest-priority stationary work, after logistics. */
function merchant_parallel_stand_ready() {
    if (character.rip || chores_in_progress || bank_dump_active || smart.moving || character.moving) return false;
    if (character.map && character.map.indexOf('bank') === 0) return false;
    if (!near_point(cc_stand_spot(), 24)) return false;
    if (cc_stand_enabled() && !character.stand && !character.standed) return false;
    var sort = typeof ALCCBankSorter !== 'undefined' ? ALCCBankSorter.snapshot().state : 'idle';
    if (sort === 'queued' || sort === 'running') return false;
    var next = merchant_work_next();
    return !next || ['sell','upgrade','compound'].indexOf(next) >= 0 || ((next === 'exchange' || next === 'craft') && merchant_remote_exchange_available());
}
var remote_sale_busy = false;
async function parallelStandSalesLoop() {
    while (true) {
        try {
            if (merchant_parallel_stand_ready() && merchant_work_next() !== 'sell' && cc_npc_enabled() && merchant_task_allowed('sell') && (typeof remote_sale_busy === 'undefined' || !remote_sale_busy)) {
                var slot = locate_sell_item(), item = character.items[slot];
                if (slot >= 0 && item && item.name !== 'placeholder' && !(character.q && character.q.upgrade && character.q.upgrade.num === slot)) {
                    remote_sale_busy = true;
                    try { await sell(slot, item.q || 1); game_log('sold ' + item.name + ' to Gabriel'); }
                    finally { remote_sale_busy = false; }
                }
            }
        } catch (e) { game_log('parallel sale: ' + (e.reason || e.message || e)); }
        await sleep(500);
    }
}
function upgrade_idle_ready() {
    if (character.rip || chores_in_progress || bank_dump_active || smart.moving || character.moving) return false;
    var parallel = typeof merchant_parallel_stand_ready === 'function' && merchant_parallel_stand_ready();
    if (!parallel && ["upgrade", "compound"].indexOf(merchant_work_next()) < 0) return false;
    var sortState = typeof ALCCBankSorter !== "undefined" && ALCCBankSorter.snapshot ? ALCCBankSorter.snapshot().state : "idle";
    if (sortState === "queued" || sortState === "running") return false;
    if (!parallel && (refresh_production_trip() || chores_pending())) return false;
    if (!near_point(cc_stand_spot(), 24)) return false;
    if (cc_stand_enabled() && !character.stand && !character.standed) return false;
    return !(character.q && (character.q.upgrade || character.q.compound || (!parallel && character.q.exchange)));
}
async function upgradeLoop() {
	while (true) {
		try {
			if (character.rip) { await sleep(3000); continue; }
			if (!upgrade_idle_ready()) { await sleep(500); continue; }
			if (!cc_upgrade_enabled() && !(typeof CompoundProduction !== "undefined" && CompoundProduction.enabled())) { await sleep(10000); continue; }
// --- 1. Compound (Joaillerie - Fusion) ---
			var compound_set = merchant_work_next() === "compound" ? find_compound_set() : null;
			if (compound_set && typeof CompoundProduction !== "undefined" && CompoundProduction.enabled()) {
				var required_scroll = compound_scroll_for(character.items[compound_set.slots[0]]);
				var scroll_cost = required_scroll && G.items[required_scroll] && G.items[required_scroll].g;
				if (required_scroll && !item_count(required_scroll) && scroll_cost > 0 && character.gold - scroll_cost >= cc_upgrade_gold_min()) {
					try { await buy(required_scroll, 1); } catch (e) { game_log("compound scroll: " + (e.reason || e)); }
					await sleep(2000);
					continue;
				}
			}
			if (compound_set && compound_scroll_for(character.items[compound_set.slots[0]]) && item_count(compound_scroll_for(character.items[compound_set.slots[0]])) >= 1) {
				set_message("compound " + compound_set.key);
				var sample = character.items[compound_set.slots[0]];
				if (sample) {
					var c_scroll = compound_scroll_for(sample);
					if (c_scroll && item_count(c_scroll) >= 1) {
						var compound_set2 = find_compound_set();
						if (compound_set2) {
							var scroll_slot = find_item(c_scroll);
							if (scroll_slot >= 0) {
								await ensure_mass_buff("produce");
								compound_set2 = find_compound_set();
								if (compound_set2) {
									var a = compound_set2.slots[0];
									var b = compound_set2.slots[1];
									var c = compound_set2.slots[2];
									scroll_slot = find_item(c_scroll);
									if (scroll_slot >= 0 && scroll_slot !== a && scroll_slot !== b && scroll_slot !== c) {
										try {
											var compoundItemName = character.items[a].name;
											var cr = await compound(a, b, c, scroll_slot);
												if (typeof CompoundProduction !== "undefined") CompoundProduction.record(compoundItemName, cr, G.items[c_scroll] && G.items[c_scroll].g);
											game_log("compound " + compound_set2.key + " ok=" + (cr && cr.success));

					} catch(e) {
											game_log("compound err: " + (e.reason || e));
											if (typeof CompoundProduction !== "undefined" && compoundItemName) CompoundProduction.record(compoundItemName, null, 0);
										}
									}
								}
							}
						}
					}
				}
				await sleep(500);
				continue;
			}

			// --- 2. Upgrade d'équipements ---
			var up_slot = cc_upgrade_enabled() && (merchant_work_next() === "upgrade" || (typeof merchant_parallel_stand_ready === 'function' && merchant_parallel_stand_ready() && merchant_task_allowed('upgrade'))) ? locate_upgrade_item(false) : -1;
			if (up_slot >= 0) {
				var up_it = character.items[up_slot];
				var up_scroll = up_it ? upgrade_scroll_for(up_it) : null;
                if (up_scroll && upgrade_material_slot(up_scroll) < 0) {
                    var scrollCost = Number(G.items[up_scroll] && G.items[up_scroll].g || 0);
                    if (scrollCost > 0 && free_slots() > 0 && character.gold - scrollCost >= cc_upgrade_gold_min()) {
                        await purchase_upgrade_scroll(up_scroll);
                    }
                    await sleep(2000); continue;
                }
				if (up_scroll && item_count(up_scroll) >= 1) {
					set_message("upgrade " + (up_it && up_it.name));
					up_slot = locate_upgrade_item(true);
					if (up_slot >= 0) {
						await ensure_mass_buff("produce");
						up_slot = locate_upgrade_item(true);
						up_it = character.items[up_slot];
						up_scroll = up_it ? upgrade_scroll_for(up_it) : null;
						var sc_slot = up_scroll ? upgrade_material_slot(up_scroll) : -1;
                        var offeringName = up_it && upgrade_step_for(up_it).offering;
                        var offeringSlot = upgrade_material_slot(offeringName);
						if (up_slot >= 0 && sc_slot >= 0 && sc_slot !== up_slot && upgrade_attempt_allowed(up_it)) {
							try {
								var productionTicket = typeof UpgradeProduction !== "undefined" ? UpgradeProduction.begin(up_it.name, upgrade_attempt_cost(up_it), { kind: "upgrade", level: up_it.level || 0, scroll: up_scroll, offering: offeringName }) : null;
                                var targetLevel = cc_upgrade_rules().find(function (r) { return r.item === up_it.name; }).maxLevel;
                                var resultingLevel = (up_it.level || 0) + 1;
                                var ur = await upgrade(up_slot, sc_slot, offeringSlot >= 0 ? offeringSlot : null);
                                if (ur && typeof ur.success === "boolean" && typeof UpgradeProduction !== "undefined") UpgradeProduction.settle(productionTicket, ur.success && resultingLevel >= targetLevel, ur.success ? "success" : "destroyed");
								game_log("upgrade " + (up_it && up_it.name) + "+" + ((up_it && up_it.level) || 0) + " ok=" + (ur && ur.success));
							} catch(e) {
								if (typeof UpgradeProduction !== "undefined" && UpgradeProduction.observe) UpgradeProduction.observe(productionTicket, e);
								game_log("upgrade err: " + (e.reason || e));
							}
						}
					}
					await sleep(500);
					continue;
				}
			}

            // Buy a base only after all actionable carried upgrades/compounds drain.
            var purchase = merchant_work_next() === "upgrade" ? next_upgrade_purchase() : null;
            if (purchase) {
                chores_in_progress = true;
                try { await purchase_upgrade_base(purchase); } finally { chores_in_progress = false; }
                await sleep(500); continue;
            }
		} catch(e) {
			game_log("upgradeLoop: " + (e.reason || e.message || e));
		}
		await sleep(8000);
	}
}

// ============================================================================
// 10. DÉMARRAGE DES BOUCLES
// ============================================================================

// Initialisation
apply_ctl();

// Lancement de toutes les boucles indépendantes
deathLoop();
teamStartLoop();
serviceLoop();
stockLoop();
standLoop();
townChoresLoop();
upgradeLoop();
parallelStandSalesLoop();

game_log("EadroSell v2 started — 8 loops running");

