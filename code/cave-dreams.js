/**
 * Cave of Many Dreams — shared daily-dungeon runner
 * =================================================
 * Loaded after farmer CODE. One account visit per home-server midnight.
 * The party of three enters together at Dorr (`dreamkeeper` on Mainland).
 *
 * Safety: never open the level-100 wolf pen, never fight the Dark Mage,
 * never take the six-guard double fight. Votes prefer hunts, escorts,
 * tools, and fights this level-70 party can tank. Free doorway revive.
 */
var CaveDreams = (function () {
	var DORR_NPC = "dreamkeeper";
	var DORR = { map: "main", x: 816, y: 1160 };
	var ENTER_RANGE = 80;
	var WAIT_MS = 12 * 60 * 1000;
	var RETRY_MS = 8 * 60 * 1000;
	var last_vote = "";
	var last_vote_at = 0;
	var last_enter = 0;
	var last_info = 0;
	var last_cm = 0;
	var last_log = "";
	var visit = null;
	var gather_until = 0;
	var gather_started = 0;
	var gather_fail_until = 0;
	var run_log = null;
	var cave_detour_side = 1;
	var leader_missing_since = 0;
	var leader_exit_requested = false;
	var dashboard_exit_requested = false;

	function enabled() {
		if (typeof __ALCC !== "undefined" && __ALCC.dailyDungeon != null) return !!__ALCC.dailyDungeon;
		return !!(typeof CONFIG !== "undefined" && CONFIG.DAILY_DUNGEON);
	}

	function buy_shops() {
		if (typeof __ALCC !== "undefined" && __ALCC.dailyDungeonBuy != null) return !!__ALCC.dailyDungeonBuy;
		return !!(typeof CONFIG !== "undefined" && CONFIG.DAILY_DUNGEON_BUY);
	}

	function in_cave() {
		return !!(character && character.cave);
	}

	function state() {
		return character.cave || null;
	}

	function note(msg) {
		if (msg === last_log) return;
		last_log = msg;
		try { game_log("cave: " + msg); } catch (e) {}
		try {
			var hist = get("cave_log") || { runs: [] };
			hist.last = { at: Date.now(), msg: String(msg).slice(0, 180), floor: state() && state().floor };
			set("cave_log", hist);
		} catch (e2) {}
	}

	function persist_run(extra) {
		try {
			var hist = get("cave_log") || { runs: [] };
			run_log = run_log || { started: Date.now(), votes: [], chests: 0 };
			for (var k in extra) run_log[k] = extra[k];
			hist.lastRun = run_log;
			var runs = hist.runs || [];
			if (runs.length && runs[runs.length - 1].started === run_log.started) runs[runs.length - 1] = run_log;
			else runs = runs.concat([run_log]).slice(-8);
			hist.runs = runs;
			set("cave_log", hist);
		} catch (e) {}
	}

	function snapshot() {
		var c = state();
		var out = {
			inside: !!c,
			enabled: enabled(),
			available: visit ? !!visit.available : undefined,
			last: last_log || ""
		};
		if (c) {
			out.floor = (c.floor || 0) + 1;
			out.remainingMs = c.remaining_ms || c.ms || 0;
			out.paused = !!c.paused;
			out.amber = purse_amber(c);
			out.gold = purse_gold(c);
		}
		if (visit && visit.resets) out.resets = visit.resets;
		return out;
	}

	function purse_gold(c) {
		c = c || state();
		if (!c) return 0;
		if (c.gold != null) return c.gold;
		if (c.purse && c.purse.gold != null) return c.purse.gold;
		return 0;
	}

	function purse_amber(c) {
		c = c || state();
		if (!c) return 0;
		if (c.amber != null) return c.amber;
		if (c.purse && c.purse.amber != null) return c.purse.amber;
		return 0;
	}

	function cave_flags() {
		var c = state();
		if (!c) return {};
		return c.flags || c.supplies || c.items || {};
	}

	function allies() {
		var roster = cave_roster();
		var names = [];
		for (var i = 0; i < roster.length; i++) if (roster[i] !== character.name) names.push(roster[i]);
		return names;
	}

	/** The cave accepts exactly the combat trio. PARTY_GUESTS never belong here. */
	function cave_roster() {
		var cfg = typeof CONFIG !== "undefined" ? CONFIG : {};
		var names = [
			cfg.WARRIOR || (character.ctype === "warrior" ? character.name : ""),
			cfg.PRIEST || (character.ctype === "priest" ? character.name : ""),
			cfg.RANGER || (character.ctype === "ranger" ? character.name : "")
		];
		var out = [];
		for (var i = 0; i < names.length; i++) {
			var name = names[i];
			if (!name || name === cfg.MERCHANT || out.indexOf(name) >= 0) continue;
			out.push(name);
		}
		return out;
	}

	function party_table() {
		try {
			if (typeof get_party === "function") return get_party() || {};
			return (typeof parent !== "undefined" && parent.party) || {};
		} catch (e) { return {}; }
	}

	function exact_cave_party() {
		var roster = cave_roster();
		if (roster.length !== 3) return false;
		var party = party_table();
		for (var i = 0; i < roster.length; i++) if (!party[roster[i]]) return false;
		for (var name in party) if (roster.indexOf(name) < 0) return false;
		return true;
	}

	/** Leader removes the merchant/outsiders and invites a missing farmer one action at a time. */
	async function ensure_cave_party() {
		if (!is_lead()) return false;
		var roster = cave_roster();
		if (roster.length !== 3) {
			note("invalid roster: need warrior + priest + ranger");
			return true;
		}
		var party = party_table();
		for (var name in party) {
			if (roster.indexOf(name) >= 0) continue;
			if (typeof kick_party_member !== "function") return true;
			try {
				await kick_party_member(name);
				note("removed " + name + " from cave party");
			} catch (e) { note("party kick " + name + ": " + ((e && e.reason) || e)); }
			return true;
		}
		for (var i = 0; i < roster.length; i++) {
			var member = roster[i];
			if (member === character.name || party[member]) continue;
			if (typeof send_party_invite !== "function") return true;
			try {
				await send_party_invite(member);
				note("invite " + member + " for cave");
			} catch (e2) { note("party invite " + member + ": " + ((e2 && e2.reason) || e2)); }
			return true;
		}
		return false;
	}

	function is_lead() {
		// The farming board may declare the autonomous ranger as a leader. Inside
		// the cave the warrior must remain the single authority for doors and
		// routing, otherwise two characters can advance to different floors.
		if (typeof CONFIG !== "undefined" && CONFIG.WARRIOR) return character.name === CONFIG.WARRIOR;
		if (typeof my_role === "function") return my_role() === "Leader";
		if (typeof CONFIG !== "undefined" && CONFIG.PARTNER) return character.name !== CONFIG.PARTNER;
		return character.ctype === "warrior";
	}

	/** A follower must not remain in a generated zone after the warrior has left the run. */
	function leader_has_left_run() {
		if (is_lead()) return false;
		var cfg = typeof CONFIG !== "undefined" ? CONFIG : {};
		var leaderName = cfg.WARRIOR;
		if (!leaderName || typeof get_player !== "function") return false;
		var leader = get_player(leaderName);
		if (!leader) return false; // transient visibility loss is not proof of an exit
		if (leader.map === character.map) return false;
		var c = state(), prefix = c && c.run ? "zone_" + c.run + "_" : "";
		if (prefix && String(leader.map || "").indexOf(prefix) === 0) return false;
		if (leader.cave && (!c || !c.run || !leader.cave.run || leader.cave.run === c.run)) return false;
		return true;
	}

	async function maybe_follow_leader_exit() {
		if (is_lead() || !in_cave()) { leader_missing_since = 0; leader_exit_requested = false; return false; }
		if (!leader_exit_requested && !leader_has_left_run()) { leader_missing_since = 0; return false; }
		if (!leader_missing_since) leader_missing_since = Date.now();
		if (!leader_exit_requested && Date.now() - leader_missing_since < 8000) return true;
		note("leader left, exiting cave");
		try {
			if (typeof cave_exit === "function") await cave_exit();
			else if (typeof town === "function") await town();
		} catch (e) {
			try { if (typeof town === "function") await town(); } catch (e2) {}
		}
		return true;
	}

	/** Dashboard commands wait until combat clears, then exit each client directly. */
	async function maybe_dashboard_exit() {
		if (!dashboard_exit_requested) return false;
		if (!in_cave()) { dashboard_exit_requested = false; return false; }
		if (!character.rip && in_combat()) {
			note("dashboard exit waiting for combat");
			return true;
		}
		note("dashboard exit requested");
		if (is_lead()) {
			try { send_cm(allies(), { t: "cave", a: "exit" }); } catch (e0) {}
		}
		try {
			if (typeof cave_exit === "function") await cave_exit();
			else if (typeof town === "function") await town();
		} catch (e) { note("dashboard exit failed: " + ((e && e.reason) || e)); }
		return true;
	}

	function cave_local_step(x, y) {
		var cx = character.real_x == null ? character.x : character.real_x;
		var cy = character.real_y == null ? character.y : character.real_y;
		if (typeof can_move_to !== "function") {
			try { move(x, y); } catch (e0) {}
			return;
		}
		if (can_move_to(x, y)) {
			cave_detour_side = 1;
			try { move(x, y); } catch (e1) {}
			return;
		}
		// Generated zone_<run>_<floor> maps are intentionally absent from
		// G.maps, so smart_move crashes while reading map.small_steps. Walk a
		// short, collision-checked step and slide consistently around walls.
		var base = Math.atan2(y - cy, x - cx);
		var step = 42;
		for (var i = 1; i <= 8; i++) {
			var offset = Math.ceil(i / 2) * Math.PI / 8 * (i % 2 ? cave_detour_side : -cave_detour_side);
			var nx = Math.round(cx + Math.cos(base + offset) * step);
			var ny = Math.round(cy + Math.sin(base + offset) * step);
			if (!can_move_to(nx, ny)) continue;
			try { move(nx, ny); } catch (e2) {}
			return;
		}
		cave_detour_side *= -1;
	}

	async function walk_xy(x, y, why, range, map) {
		var dest = { map: map || character.map, x: x, y: y };
		if (typeof smart !== "undefined" && smart.moving) {
			if (smart.map === dest.map && simple_distance({ x: smart.x, y: smart.y }, dest) < 50) return;
			try { stop("smart"); } catch (e0) {}
		}
		if (in_cave()) {
			// Never call smart_move for a generated cave map: the vanilla runner
			// indexes G.maps[character.map], which is undefined for these zones.
			if (!dest.map || dest.map === character.map) cave_local_step(x, y);
			return;
		}
		if (typeof go_to === "function") {
			await go_to(dest, why || "cave", range || 40);
			return;
		}
		if (typeof can_move_to === "function" && can_move_to(x, y)) {
			try { move(x, y); } catch (e) {}
			return;
		}
		try { await smart_move(dest); } catch (e2) {}
	}

	async function refresh_visit() {
		if (Date.now() - last_info < 20000) return visit;
		last_info = Date.now();
		if (typeof cave_info !== "function") return visit;
		try {
			visit = await cave_info();
		} catch (e) {
			note("info: " + ((e && e.reason) || e));
		}
		return visit;
	}

	function resumable(info) {
		return !!(info && info.resume && Number(info.resume.remaining_ms) > 0);
	}

	async function maybe_resume(info) {
		if (!resumable(info)) return false;
		if (is_lead() && await ensure_cave_party()) return true;
		if (!near_dorr(character, ENTER_RANGE)) {
			note("resume run " + (info.resume.run || ""));
			await go_dorr("resume Cave of Many Dreams");
			return true;
		}
		if (Date.now() - last_enter < 8000) return true;
		last_enter = Date.now();
		try {
			var rec = await cave_enter();
			note("resumed run " + ((rec && rec.run) || info.resume.run || ""));
		} catch (e) {
			note("resume fail: " + ((e && e.reason) || e));
			last_info = 0;
		}
		return true;
	}

	function dorr_spot() {
		if (typeof find_npc === "function") {
			var npc = find_npc(DORR_NPC);
			if (npc && npc.x != null) return { map: npc.map || "main", x: npc.x, y: npc.y };
		}
		if (typeof npc_xy === "function") {
			var p = npc_xy(DORR_NPC);
			if (p && p.x != null) return { map: character.map || "main", x: p.x, y: p.y };
		}
		return DORR;
	}

	function near_dorr(who, range) {
		who = who || character;
		if (!who || who.map !== "main") return false;
		return simple_distance(who, dorr_spot()) <= (range || ENTER_RANGE);
	}

	function party_at_dorr() {
		if (!exact_cave_party()) return false;
		if (!near_dorr(character, ENTER_RANGE)) return false;
		var names = allies();
		for (var i = 0; i < names.length; i++) {
			var p = get_player(names[i]);
			if (!p || p.rip) return false;
			if (!near_dorr(p, 160)) return false;
		}
		return cave_roster().length === 3;
	}

	function ally_almost_here() {
		var dest = dorr_spot();
		var names = allies();
		for (var i = 0; i < names.length; i++) {
			var p = get_player(names[i]);
			if (!p || p.rip || p.map !== "main") continue;
			var d = simple_distance(p, dest);
			if (d > 160 && d < 900) return true;
		}
		return false;
	}

	function begin_gather() {
		if (!gather_started) gather_started = Date.now();
		if (ally_almost_here()) gather_started = Date.now();
		gather_until = gather_started + WAIT_MS;
	}

	function end_gather() {
		gather_until = 0;
		gather_started = 0;
	}

	function in_combat() {
		if (character.target) return true;
		for (var id in parent.entities) {
			var e = parent.entities[id];
			if (e && e.type === "monster" && !e.rip && e.target === character.name) return true;
		}
		return false;
	}

	function live_event_busy() {
		try {
			if (typeof pick_live_event === "function" && pick_live_event()) return true;
		} catch (e) {}
		return false;
	}

	function option_text(o) {
		return String((o && (o.label || o.id)) || "").toLowerCase();
	}

	function option_fight(o) {
		var fights = [];
		if (o.fight) fights.push(o.fight);
		var outs = o.outcomes || [];
		for (var i = 0; i < outs.length; i++) {
			if (outs[i] && outs[i].fight) fights.push(outs[i].fight);
		}
		return fights;
	}

	function fight_is_deadly(fight) {
		if (!fight) return false;
		var type = fight[0] || fight;
		var n = fight[1] || 1;
		if (type === "cave_darkmage") return true;
		if (type === "cave_wolf" && n >= 4) return true;
		if (type === "cave_bat" && n >= 12) return true;
		if (type === "cave_rat" && n >= 16) return true;
		return false;
	}

	function is_shop_inspect(o) {
		var effect = (o && o.effect) || "";
		var text = option_text(o);
		if (effect === "inspect") return true;
		if (text.indexOf("open the shop") >= 0) return true;
		if (text.indexOf("see the item") >= 0) return true;
		if (text.indexOf("check the price") >= 0) return true;
		return false;
	}

	function is_shop_continue(o) {
		var text = option_text(o);
		if (text === "continue" || text.indexOf("continue") >= 0) return true;
		if (text.indexOf("keep our gold") >= 0) return true;
		if (text.indexOf("keep the gold") >= 0) return true;
		if (text.indexOf("do not need") >= 0 || text.indexOf("don't need") >= 0) return true;
		if (text.indexOf("leave it for another") >= 0) return true;
		if (text.indexOf("move on") >= 0 && text.indexOf("gold") >= 0) return true;
		return false;
	}

	function score_option(o, choice) {
		if (!o || o.unavailable) return -1;
		var effect = o.effect || "";
		var text = option_text(o);
		var revive = effect === "revive" || text.indexOf("revive") >= 0;
		// Revive prompts are personal. Alive party members used to answer the
		// doorway NPC as well, recreating the prompt and starving combat.
		if (revive && !character.rip) return -1;
		if (effect === "wolves" || text.indexOf("level 100") >= 0) return -1;
		if (effect === "bad_double" || text.indexOf("six guards") >= 0) return -1;
		var fights = option_fight(o);
		for (var i = 0; i < fights.length; i++) {
			if (fight_is_deadly(fights[i])) return -1;
		}
		if (is_shop_continue(o)) return 96;
		if (is_shop_inspect(o)) return buy_shops() ? 25 : 4;
		if (o.needs === "tool" && !cave_flags().tool) return 8;
		if (o.needs === "lamp" && !cave_flags().lamp) return 8;
		if (o.cost && purse_gold() < o.cost) return 5;
		if (o.amber && purse_amber() < o.amber) return 5;

		if (character.rip) {
			if (text.indexOf("door") >= 0 || text.indexOf("free") >= 0) return 200;
			if (effect === "revive" && !o.amber) return 190;
			if (text.indexOf("nera") >= 0 && o.amber) return 40;
			return 10;
		}

		var scores = {
			hunt_quick: 88,
			hunt: 84,
			hunt_helper: 82,
			hunt_late: 78,
			escort: 80,
			save: 76,
			lure: 74,
			cover: 70,
			plant: 68,
			tool: 66,
			lamp: 64,
			decoy: 62,
			gift: 60,
			reveal: 58,
			appraise: 50,
			free_die: 55,
			guide: 52,
			join: 48,
			hire: 46,
			pay: 44,
			bad_fight: 50,
			careful: 42,
			moths: 58,
			exchange: 36,
			inspect: buy_shops() ? 40 : 18,
			story: 12,
			leave: 20,
			watch: 14,
			both: 8,
			neither: 22,
			peace: 30,
			testimony: 34,
			left: 40,
			right: 40,
			dice: 6,
			dice6: 4,
			die: 10
		};
		var s = scores[effect];
		if (s == null) s = 28;
		if (o.offer) s += 6;
		if (effect === "hunt_double") s = 24;
		if (text.indexOf("lockbreaker") >= 0) s = Math.min(s, 55);
		if (text.indexOf("sentinel") >= 0) s = Math.min(s, 52);
		if (text.indexOf("shadow") >= 0) s = Math.min(s, 25);
		return s;
	}

	function pick_option(choice) {
		if (!choice || !choice.options || !choice.options.length) return null;
		var best = null;
		var best_s = -1;
		for (var i = 0; i < choice.options.length; i++) {
			var o = choice.options[i];
			var s = score_option(o, choice);
			if (s > best_s) {
				best_s = s;
				best = o;
			}
		}
		if (!best || best_s < 0) return null;
		return best;
	}

	async function maybe_vote() {
		var c = state();
		var choice = c && (c.choice || (c.paused && c.vote));
		if (!choice || choice.resolved) return false;
		if (choice.id === last_vote) return !!(c.paused || character.rip);
		var opt = pick_option(choice);
		if (!opt) {
			last_vote = choice.id;
			// A personal revive prompt visible to an alive character must not stop
			// that character from defending the party.
			return !!(c.paused || character.rip);
		}
		// Allow the server state to settle after a reply. This prevents a dead
		// client from answering regenerated doorway prompts several times/second.
		if (Date.now() - last_vote_at < 2500) return true;
		try {
			await cave_reply(choice.id, opt.id);
			last_vote = choice.id;
			last_vote_at = Date.now();
			note("vote " + choice.id + " -> " + opt.id + " (" + (opt.label || opt.effect || "") + ")");
			persist_run({});
			if (run_log && run_log.votes) run_log.votes.push({ id: choice.id, opt: opt.id });
		} catch (e) {
			note("vote fail: " + ((e && e.reason) || e));
		}
		return true;
	}

	async function loot_cave_chests() {
		var c = state();
		if (!c || c.paused || character.rip) return false;
		if (!parent || !parent.chests) return false;
		for (var id in parent.chests) {
			var chest = parent.chests[id];
			if (!chest || chest.map !== character.map) continue;
			if (distance(character, chest) > 400) continue;
			try {
				var reward = await loot(id);
				if (run_log) run_log.chests = (run_log.chests || 0) + 1;
				var cave = reward && reward.cave;
				if (cave) note("chest +" + (cave.gold || 0) + "g +" + (cave.amber || 0) + " amber");
				else note("chest opened");
				return true;
			} catch (e) {}
		}
		return false;
	}

	function hunt_focus() {
		var hunts = (state() && state().hunts) || [];
		var types = {};
		var ids = {};
		for (var i = 0; i < hunts.length; i++) {
			var h = hunts[i];
			if (!h) continue;
			if (h.mtype) types[h.mtype] = true;
			if (h.type) types[h.type] = true;
			if (h.monster) types[h.monster] = true;
			var list = h.ids || h.targets || [];
			for (var j = 0; j < list.length; j++) ids[String(list[j])] = true;
		}
		return { hunts: hunts, types: types, ids: ids };
	}

	function is_hunt_mob(e) {
		if (!e) return false;
		var f = hunt_focus();
		if (f.ids[String(e.id)] || f.ids[e.name]) return true;
		if (e.mtype && f.types[e.mtype]) return true;
		if (e.cave && (e.cave.hunt || e.cave.marked)) return true;
		if (f.hunts.length && (e.mtype === "cave_crab" || e.mtype === "cave_bat" || e.mtype === "cave_rat" || e.mtype === "cave_wolf" || e.mtype === "cave_spider" || e.mtype === "cave_scorpion" || e.mtype === "cave_snake")) return true;
		return false;
	}

	function is_cave_monster(e) {
		if (!e || e.type !== "monster" || e.rip) return false;
		var t = e.mtype || "";
		var side = e.cave && e.cave.side;
		// Cave actors all look like monsters to the client. The server-side
		// allegiance is the only reliable discriminator and may change live.
		if (side === "neutral" || side === "ally" || side === "victim") return false;
		if (t === "cave_darkmage") return false;
		if (side) return true;
		if (is_hunt_mob(e)) return true;
		if (t.indexOf("cave_") !== 0) return false;
		if (t === "cave_npc" || t === "cave_rogue") {
			if (is_hunt_mob(e)) return true;
			var aggro = e.target;
			if (!aggro) return false;
			if (aggro === character.name) return true;
			return typeof is_party_member === "function" && is_party_member(aggro);
		}
		return true;
	}

	function is_party_aggro(e) {
		if (!e || !e.target) return false;
		if (e.target === character.name) return true;
		if (typeof is_party_member === "function" && is_party_member(e.target)) return true;
		return cave_roster().indexOf(e.target) >= 0;
	}

	function goal_room_bounds(spot) {
		if (!spot || spot.kind !== "room") return null;
		var game = (typeof parent !== "undefined" && parent.G) || (typeof G !== "undefined" && G);
		var def = game && game.maps && game.maps[character.map];
		var rooms = (def && def.rooms) || [];
		var best = null, best_d = Infinity;
		for (var i = 0; i < rooms.length; i++) {
			var room = rooms[i], bounds = room && room.bounds;
			if (!bounds || bounds.length < 4) continue;
			if (spot.x >= bounds[0] && spot.x <= bounds[2] && spot.y >= bounds[1] && spot.y <= bounds[3]) return bounds;
			var d = Math.hypot((room.x || 0) - spot.x, (room.y || 0) - spot.y);
			if (d < best_d) { best_d = d; best = bounds; }
		}
		return best_d <= 260 ? best : null;
	}

	function target_matches_goal(e, spot) {
		if (!spot) return true;
		var partyAggro = is_party_aggro(e);
		if (partyAggro) return true;
		if (spot.kind === "door") return false;
		var bounds = goal_room_bounds(spot);
		if (bounds) return e.x >= bounds[0] - 32 && e.x <= bounds[2] + 32 && e.y >= bounds[1] - 32 && e.y <= bounds[3] + 32;
		return simple_distance(e, spot) <= 320;
	}

	function pick_cave_target(spot, aggro_only) {
		var best = null;
		// Distance is a ranking penalty, not a rejection criterion. With -1 as
		// the sentinel, any hostile farther away could receive a negative score
		// and disappear from targeting entirely while still chasing the party.
		var best_s = -Infinity;
		var hunting = hunt_focus().hunts.length > 0;
		for (var id in parent.entities) {
			var e = parent.entities[id];
			if (!is_cave_monster(e)) continue;
			var partyAggro = is_party_aggro(e);
			if (aggro_only && !partyAggro) continue;
			if (!target_matches_goal(e, spot)) continue;
			var d = distance(character, e);
			if (hunting && !is_hunt_mob(e) && !partyAggro && d > 160) continue;
			var s = 10;
			if (is_hunt_mob(e)) s += 90;
			if (e.target === character.name) s += 40;
			if (partyAggro && e.target !== character.name) s += 50;
			if (e.mtype === "cave_lockbreaker" || e.mtype === "cave_sentinel" || e.mtype === "cave_mothkeeper") s += 30;
			if (e.mtype === "cave_broodmother") s += 20;
			s -= d / 12;
			if (s > best_s) {
				best_s = s;
				best = e;
			}
		}
		return best;
	}

	function stop_smart_now() {
		if (typeof smart === "undefined" || !smart.moving) return;
		try { stop("smart"); } catch (e) {}
	}

	function skill_allowed(name) {
		return typeof StyleLoadout === "undefined" || !StyleLoadout.allows || StyleLoadout.allows(name);
	}

	function ranged_pack(spot, aggro_only, skill) {
		var out = [];
		for (var id in parent.entities) {
			var e = parent.entities[id];
			if (!is_cave_monster(e)) continue;
			if (aggro_only && !is_party_aggro(e)) continue;
			if (!target_matches_goal(e, spot)) continue;
			if (typeof is_in_range === "function" && !is_in_range(e, skill)) continue;
			out.push(e);
		}
		out.sort(function (a, b) {
			var aa = is_party_aggro(a) ? 1 : 0;
			var ba = is_party_aggro(b) ? 1 : 0;
			return ba - aa || distance(character, a) - distance(character, b);
		});
		return out;
	}

	async function use_cave_pack_skill(spot, aggro_only) {
		if (character.ctype === "ranger") {
			var five = ranged_pack(spot, aggro_only, "5shot");
			if (five.length >= 5 && skill_allowed("5shot") && typeof can_use === "function" && can_use("5shot")) {
				try { await use_skill("5shot", five.slice(0, 5).map(function (e) { return e.id; })); return true; } catch (e0) {}
			}
			var three = ranged_pack(spot, aggro_only, "3shot");
			if (three.length >= 3 && skill_allowed("3shot") && typeof can_use === "function" && can_use("3shot")) {
				try { await use_skill("3shot", three.slice(0, 3).map(function (e) { return e.id; })); return true; } catch (e1) {}
			}
		}
		if (character.ctype === "warrior" && skill_allowed("cleave") && typeof can_use === "function" && can_use("cleave")) {
			var close = ranged_pack(spot, true, "cleave");
			if (close.length >= 2) {
				try { await use_skill("cleave"); return true; } catch (e2) {}
			}
		}
		return false;
	}

	async function fight_cave(spot, aggro_only) {
		var tgt = pick_cave_target(spot, aggro_only);
		if (!tgt) {
			var hunts = hunt_focus().hunts;
			if (hunts.length && hunts[0].x != null) {
				var h = hunts[0];
				if (simple_distance(character, h) > 55) {
					note("go hunt pack");
					await walk_xy(h.x, h.y, "cave hunt", 30, cave_map(h));
					return true;
				}
			}
			return false;
		}
		change_target(tgt);
		stop_smart_now();
		if (await use_cave_pack_skill(spot, aggro_only)) return true;
		if (!is_in_range(tgt)) {
			if (character.ctype === "warrior" && typeof can_use === "function" && can_use("charge")) {
				try { await use_skill("charge"); } catch (e4) {}
			}
			if (typeof can_move_to === "function" && can_move_to(tgt.x, tgt.y)) {
				try { move(tgt.x, tgt.y); } catch (e5) {}
			} else {
				await walk_xy(tgt.x, tgt.y, "cave pack", 18);
			}
		}
		if (character.ctype === "warrior" && tgt.target && tgt.target !== character.name && typeof can_use === "function" && can_use("taunt")) {
			try { await use_skill("taunt", tgt); } catch (e6) {}
		}
		try { await attack(tgt); } catch (e7) {}
		return true;
	}

	function cave_map(point) {
		var c = state();
		if (point && point.map) return point.map;
		var floor = point && point.floor != null ? point.floor : c && c.floor != null ? c.floor : 0;
		if (c && c.run) return "zone_" + c.run + "_" + floor;
		return character.map;
	}

	function goal_label(o) {
		if (!o) return "room";
		if (o.name) return o.name;
		if (o.name_message && o.name_message.phrase) return String(o.name_message.phrase);
		return o.kind || "room";
	}

	function is_shop_goal(o) {
		if (!o) return false;
		var kind = String(o.kind || "").toLowerCase();
		var name = String(goal_label(o)).toLowerCase();
		if (kind === "merchant" || kind === "shop") return true;
		if (name.indexOf("shop") >= 0) return true;
		return false;
	}

	function unfinished(o, floor) {
		return !!(o && o.x != null && (o.floor == null || o.floor === floor) && !o.done && !o.complete && !o.cleared);
	}

	function objective_spot(o) {
		return { map: cave_map(o), x: o.x, y: o.y, why: goal_label(o), kind: "room", objective: o };
	}

	function escort_result(choice, objective) {
		if (!choice || !choice.resolved || !objective) return false;
		var escorts = { e23_0: true, e35_0: true, e45_0: true };
		if (!escorts[choice.result]) return false;
		var cp = choice.title_message && choice.title_message.phrase;
		var op = objective.name_message && objective.name_message.phrase;
		return !cp || !op || cp === op;
	}

	function required_open() {
		var c = state();
		var objs = (c && c.objectives) || [];
		for (var i = 0; i < objs.length; i++) {
			if (objs[i] && objs[i].required && !objs[i].done && !objs[i].complete) return true;
		}
		return false;
	}

	/** Required rooms, optional shop, open stairs, then optional camps. */
	function next_go_target() {
		var c = state();
		if (!c) return null;
		var floor = c.floor || 0;
		var objs = c.objectives || [];
		// Required objectives gate the floor and always win.
		for (var i = 0; i < objs.length; i++) {
			var o = objs[i];
			if (!unfinished(o, floor) || !o.required) continue;
			if (escort_result(c.choice, o)) {
				for (var ed = 0; ed < (c.doors || []).length; ed++) {
					var landing = c.doors[ed];
					if (landing && landing.down && landing.x != null) return { map: cave_map(landing), x: landing.x, y: landing.y, why: "escort to stairs", kind: "escort", objective: o };
				}
			}
			return objective_spot(o);
		}
		// The shop is useful only when the dashboard explicitly allows spending.
		if (buy_shops()) {
			for (var s = 0; s < objs.length; s++) {
				var shopGoal = objs[s];
				if (unfinished(shopGoal, floor) && is_shop_goal(shopGoal)) return objective_spot(shopGoal);
			}
		}
		var doors = c.doors || [];
		for (var d = 0; d < doors.length; d++) {
			var door = doors[d];
			if (!door || door.x == null || door.locked) continue;
			if (door.down) return { map: cave_map(door), x: door.x, y: door.y, why: "stairs down", kind: "door" };
		}
		// Optional camps come last. This avoids spending the shared reward caps
		// before the completion chest and prevents respawning camps from parking us.
		for (var p = 0; p < objs.length; p++) {
			var optional = objs[p];
			if (unfinished(optional, floor) && !optional.required && !is_shop_goal(optional)) return objective_spot(optional);
		}
		if (!required_open()) {
			for (var e = 0; e < doors.length; e++) {
				var exitd = doors[e];
				if (!exitd || exitd.x == null || exitd.locked) continue;
				if (exitd.to === "main") return { map: cave_map(exitd), x: exitd.x, y: exitd.y, why: "exit", kind: "door" };
			}
		}
		return null;
	}

	async function maybe_talk_cave() {
		if (typeof cave_talk !== "function") return false;
		if (!is_lead()) return false;
		for (var id in parent.entities) {
			var e = parent.entities[id];
			if (!e || e.rip) continue;
			if (!e.cave || !e.cave.room) continue;
			if (is_cave_monster(e)) continue;
			if (distance(character, e) > 160) continue;
			try {
				await cave_talk(e.cave.room, e.id);
				note("talk " + (e.name || e.cave.room));
				return true;
			} catch (err) {}
		}
		return false;
	}

	async function maybe_use_door(spot) {
		if (!spot || spot.kind !== "door") return false;
		if (simple_distance(character, spot) > 55) return false;
		if (typeof use_nearest_door !== "function") return false;
		var leader = typeof CONFIG !== "undefined" && CONFIG.WARRIOR ? get_player(CONFIG.WARRIOR) : null;
		if (!is_lead() && leader && leader.map === character.map) return true;
		if (is_lead()) {
			var roster = cave_roster();
			for (var i = 0; i < roster.length; i++) {
				if (roster[i] === character.name) continue;
				var member = get_player(roster[i]);
				if (!member || member.map !== character.map || distance(character, member) > 150) return true;
			}
		}
		try {
			await use_nearest_door();
			note("door " + (spot.why || ""));
			return true;
		} catch (e) {
			return false;
		}
	}

	async function maybe_shop() {
		var c = state();
		var choice = c && (c.choice || (c.paused && c.vote));
		if (choice && !choice.resolved && !buy_shops()) {
			var skip = null;
			var opts = choice.options || [];
			for (var i = 0; i < opts.length; i++) {
				if (opts[i] && !opts[i].unavailable && is_shop_continue(opts[i])) {
					skip = opts[i];
					break;
				}
			}
			if (skip && choice.id !== last_vote) {
				try {
					await cave_reply(choice.id, skip.id);
					last_vote = choice.id;
					note("vote " + choice.id + " -> " + skip.id + " (continue, skip shop)");
					return true;
				} catch (e) {}
			}
		}
		if (!buy_shops()) return false;
		var shop = c && (c.shop || (choice && choice.shop));
		if (!shop || !shop.room) return false;
		if (shop.sold || shop.bought) return false;
		try {
			await cave_buy(shop.room);
			note("bought cave shop item");
			return true;
		} catch (e) {
			return false;
		}
	}

	async function run_inside() {
		var c = state();
		if (!run_log) {
			run_log = { started: Date.now(), votes: [], chests: 0, floor: (c && c.floor) || 0 };
			note("inside floor " + (((c && c.floor) || 0) + 1));
			persist_run({ floor: (c && c.floor) || 0 });
		}
		try { set_message("Cave F" + (((c && c.floor) || 0) + 1)); } catch (e) {}
		if (await maybe_dashboard_exit()) return true;
		if (await maybe_follow_leader_exit()) return true;
		if (c && c.paused) {
			if (await maybe_shop()) return true;
			await maybe_vote();
			return true;
		}
		if (character.rip) {
			await maybe_vote();
			return true;
		}
		// Never walk past a pack already attacking the trio. The previous order
		// navigated toward a distant objective first and accumulated every room.
		if (await fight_cave(null, true)) return true;
		var remain = c.remaining_ms || c.ms || 999999;
		if (remain < 12000) {
			note("time up, exiting");
			try { await cave_exit(); } catch (e2) {}
			persist_run({ ended: Date.now(), reason: "timeout", amber: purse_amber(), gold: purse_gold() });
			run_log = null;
			return true;
		}
		if (await maybe_shop()) return true;
		if (await maybe_vote()) return true;
		if (await loot_cave_chests()) return true;
		var spot = next_go_target();
		if (spot) {
			if (await maybe_use_door(spot)) return true;
			// Do not let a visible optional camp keep the team from its required
			// room or from an already-open staircase.
			if (spot.kind === "door" || simple_distance(character, spot) > 260 || (spot.map && spot.map !== character.map)) {
				note("go " + spot.why);
				await walk_xy(spot.x, spot.y, "cave go " + spot.why, 40, spot.map);
				return true;
			}
			if (await fight_cave(spot)) return true;
			if (simple_distance(character, spot) > 50 || (spot.map && spot.map !== character.map)) {
				note("go " + spot.why);
				await walk_xy(spot.x, spot.y, "cave go " + spot.why, 40, spot.map);
				return true;
			}
			if (await maybe_talk_cave()) return true;
		}
		if (await fight_cave(null)) return true;
		if (!is_lead()) {
			var lead = (typeof party_leader === "function" && get_player(party_leader()))
				|| (typeof CONFIG !== "undefined" && CONFIG.PARTNER && get_player(CONFIG.PARTNER))
				|| (typeof CONFIG !== "undefined" && CONFIG.WARRIOR && get_player(CONFIG.WARRIOR));
			if (lead && distance(character, lead) > 90) {
				await walk_xy(lead.x, lead.y, "cave follow", 50);
				return true;
			}
		}
		return true;
	}

	async function ping_gather() {
		if (Date.now() - last_cm < 4000) return;
		last_cm = Date.now();
		var dest = dorr_spot();
		var names = allies();
		try {
			await send_cm(names, { t: "cave", a: "gather", x: dest.x, y: dest.y, map: "main" });
		} catch (e) {}
	}

	async function ping_cancel() {
		if (!gather_until && !gather_started) return;
		end_gather();
		try {
			await send_cm(allies(), { t: "cave", a: "cancel" });
		} catch (e) {}
	}

	async function go_dorr(why) {
		if (near_dorr(character, 70)) return true;
		if (typeof smart !== "undefined" && smart.moving) return true;
		if (character.map === "main" && typeof can_move_to === "function" && !can_move_to(character.x, character.y)) {
			if (typeof town === "function") {
				try { await town(); } catch (e) {}
			}
			return true;
		}
		/** Same as fancypots / Cue: smart_move the NPC id, not a map key or vine xy. */
		if (typeof go_to === "function") await go_to(DORR_NPC, why || "Dorr / Cave of Many Dreams", 70);
		else try { await smart_move(DORR_NPC); } catch (e2) {}
		return true;
	}

	async function stay_for_party(why) {
		begin_gather();
		await ping_gather();
		if (is_lead() && await ensure_cave_party()) return true;
		if (Date.now() > gather_until) {
			note("party late, leave Dorr");
			end_gather();
			gather_fail_until = Date.now() + RETRY_MS;
			return false;
		}
		if (!near_dorr(character, 70)) {
			note("walk to Dorr");
			await go_dorr(why);
			return true;
		}
		if (!party_at_dorr()) {
			note("wait for party at Dorr");
			return true;
		}
		return "ready";
	}

	async function maybe_enter() {
		if (!enabled()) return false;
		if (Date.now() < gather_fail_until) return false;
		if (live_event_busy()) {
			if (gather_started) {
				note("hold dungeon, live event");
				await ping_cancel();
			}
			return false;
		}
		if (typeof ALCombat !== "undefined" && ALCombat.inDanger && ALCombat.inDanger()) return false;
		var info = await refresh_visit();
		if (await maybe_resume(info)) return true;
		if (info && info.available === false && !info.unlimited) {
			end_gather();
			return false;
		}
		if (character.esize < 2) {
			note("bag tight, dump before dungeon");
			return false;
		}
		var wait = await stay_for_party("Dorr / daily dungeon");
		if (wait !== "ready") return wait;
		if (Date.now() - last_enter < 8000) return true;
		last_enter = Date.now();
		try {
			var rec = await cave_enter();
			note("entered run " + ((rec && rec.run) || "") + " lv" + ((rec && rec.level) || "?"));
			run_log = { started: Date.now(), votes: [], chests: 0, run: rec && rec.run };
			persist_run({});
			end_gather();
		} catch (e) {
			note("enter fail: " + ((e && e.reason) || e));
			last_info = 0;
		}
		return true;
	}

	async function follow_gather() {
		if (!enabled() && !in_cave()) return false;
		if (in_cave()) return await run_inside();
		if (Date.now() < gather_fail_until) return false;
		if (live_event_busy()) {
			end_gather();
			return false;
		}
		if (typeof ALCombat !== "undefined" && ALCombat.inDanger && ALCombat.inDanger()) return false;
		var info = await refresh_visit();
		if (await maybe_resume(info)) return true;
		if (info && info.available === false && !info.unlimited) {
			end_gather();
			return false;
		}
		var wait = await stay_for_party("join Dorr for cave");
		return wait === "ready" ? true : wait;
	}

	function on_cm(name, data) {
		if (!data || data.t !== "cave") return;
		if (data.a === "gather") {
			if (!gather_started) gather_started = Date.now();
			gather_until = gather_started + WAIT_MS;
		}
		if (data.a === "cancel") end_gather();
		if (data.a === "exit" && (!CONFIG.WARRIOR || name === CONFIG.WARRIOR)) leader_exit_requested = true;
	}

	function reserving_party() {
		return !!(in_cave() || (enabled() && (gather_started || gather_until > Date.now())));
	}

	function allows_party_member(name) {
		return !reserving_party() || cave_roster().indexOf(name) >= 0;
	}

	async function tick(role) {
		if (in_cave()) return await run_inside();
		if (role === "lead" || is_lead()) return await maybe_enter();
		return await follow_gather();
	}

	try {
		if (character && character.on) {
			character.on("cave", function (st) {
				if (!st) {
					note("left the cave");
					if (is_lead()) {
						try { send_cm(allies(), { t: "cave", a: "exit" }); } catch (e0) {}
					}
					if (run_log) persist_run({ ended: Date.now(), reason: "exit" });
					run_log = null;
					last_vote = "";
					last_vote_at = 0;
					return;
				}
				if (st.paused) note("vote pause floor " + ((st.floor || 0) + 1));
			});
		}
	} catch (e) {}

	return {
		tick: tick,
		onCm: on_cm,
		inCave: in_cave,
		paused: function () { var c = state(); return !!(c && c.paused); },
		enabled: enabled,
		snapshot: snapshot,
		pickOption: pick_option,
		scoreOption: score_option,
		nextGoal: next_go_target,
		isHostile: is_cave_monster,
		isPartyAggro: is_party_aggro,
		pickTarget: pick_cave_target,
		isLeader: is_lead,
		roster: cave_roster,
		exactParty: exact_cave_party,
		reservingParty: reserving_party,
		allowsPartyMember: allows_party_member,
		requestExit: function () { dashboard_exit_requested = true; note("dashboard exit queued"); return true; }
	};
})();
