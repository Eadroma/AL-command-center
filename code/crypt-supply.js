/**
 * Crypt supply — merchant side of the crypt run (see crypt-run.js)
 * ================================================================
 * HUD "Start crypt" -> ask warrior, priest AND ranger for "ready" -> take
 * one cryptkey out of the bank (rest of the stack goes back to its slot,
 * journaled by BankCoordinator) -> hand it to the warrior at the Cave door
 * -> keep the run ledger (instance id, census, kills) for the HUD.
 * The merchant never enters the crypt.
 */
var CryptSupply = (function () {
	var KEY = "cryptkey";
	var DOOR = { map: "cave", x: -193, y: -1296 };
	var STORE = "alcc:crypt:v1:run";
	var READY_MS = 60000, DELIVER_MS = 10 * 60 * 1000, OPEN_MS = 3 * 60 * 1000, RUN_MS = 95 * 60 * 1000; // farmers stop at 90 min
	var REPORT_FRESH_MS = 5 * 60 * 1000;
	// An empty instance pauses instead of dying; a server restart is what really ends it.
	var RESUME_MS = 2 * 60 * 60 * 1000;
	var ACTIVE = ["ready", "fetch", "deliver", "wait_open", "inside"];
	var run = load();

	function cfg() { return typeof CONFIG !== "undefined" ? CONFIG : {}; }
	function now() { return Date.now(); }
	function load() { try { var r = get(STORE); return r && r.runId ? r : null; } catch (e) { return null; } }
	function save() { try { set(STORE, run); } catch (e) {} }
	function note(msg) { if (run) { run.last = String(msg).slice(0, 160); save(); } try { game_log("crypt: " + msg); } catch (e) {} }
	function roster() { var c = cfg(); return [c.WARRIOR, c.PRIEST, c.RANGER].filter(Boolean); }
	function active() { return !!run && ACTIVE.indexOf(run.phase) >= 0; }
	function phase(p) { run.phase = p; run.phaseAt = now(); save(); }
	function cm(names, data) { try { if (names.length) send_cm(names, data); } catch (e) {} }

	function carried_slot() {
		var items = character.items || [];
		for (var i = 0; i < items.length; i++) if (items[i] && items[i].name === KEY) return i;
		return -1;
	}

	/** Bags and stand trade slots: a key moved onto the stand has not left the merchant. */
	function carried_count() {
		var n = (character.items || []).reduce(function (s, it) { return s + (it && it.name === KEY ? it.q || 1 : 0); }, 0);
		var slots = character.slots || {};
		Object.keys(slots).forEach(function (k) { var it = slots[k]; if (k.indexOf("trade") === 0 && it && it.name === KEY) n += it.q || 1; });
		return n;
	}

	/** Bank packs with a key, from the live bank when inside it. */
	function find_in_bank() {
		var bank = character.bank || {}, best = null;
		Object.keys(bank).forEach(function (pack) {
			if (!/^items\d+$/.test(pack) || !Array.isArray(bank[pack])) return;
			bank[pack].forEach(function (it, slot) {
				if (!best && it && it.name === KEY && !it.l) best = { pack: pack, slot: slot, quantity: it.q || 1 };
			});
		});
		return best;
	}

	function bank_floor(pack) {
		var n = Number(String(pack).replace("items", ""));
		return n <= 7 ? "bank" : n <= 23 ? "bank_b" : "bank_u";
	}

	/** Known key count in the bank, or null when the bank was never observed this session. */
	function bank_keys() {
		if (typeof BankStock === "undefined" || !BankStock.snapshot) return null;
		var s = BankStock.snapshot();
		if (!s.observedAt) return null;
		var row = (s.stock || []).filter(function (r) { return r.item === KEY; })[0];
		return row ? row.quantity : 0;
	}

	function keys_available() { return carried_slot() >= 0 || bank_keys() !== 0; }

	/** Farmers with no fresh status report (dead, offline or on another server). */
	function missing_roster() {
		var c = cfg(), reports = typeof farmer_reports !== "undefined" ? farmer_reports : null;
		var names = roster();
		if (names.length < 3) return ["WARRIOR", "PRIEST", "RANGER"].filter(function (k) { return !c[k]; });
		if (!reports) return [];
		return names.filter(function (n) { var r = reports[n]; return !r || now() - r.at > REPORT_FRESH_MS; });
	}

	function start() {
		if (active()) return false;
		if (character.ctype !== "merchant" || character.rip) return false;
		if (missing_roster().length || !keys_available()) return false;
		run = { runId: "crypt-" + now(), phase: "ready", at: now(), phaseAt: now(), ready: {}, kills: {}, seen: {} };
		save();
		cm(roster(), { t: "crypt", a: "start", runId: run.runId });
		note("start sent to " + roster().join(", "));
		return true;
	}

	/** The last run left an instance behind (abort, timeout, wipe) that can be rejoined without a key. */
	function resumable() { return !!run && !active() && !!run.id && now() - (run.openedAt || run.at || 0) < RESUME_MS; }

	function resume() {
		if (!resumable() || character.ctype !== "merchant" || character.rip || missing_roster().length) return false;
		var id = run.id, openedAt = run.openedAt;
		run = { runId: "crypt-" + now(), phase: "ready", at: now(), phaseAt: now(), ready: {}, kills: {}, seen: {}, id: id, openedAt: openedAt, resumed: true };
		save();
		cm(roster(), { t: "crypt", a: "start", runId: run.runId, id: id });
		note("resume of " + id + " sent to " + roster().join(", "));
		return true;
	}

	function abort(reason) {
		if (!active()) return false;
		cm(roster(), { t: "crypt", a: "abort", runId: run.runId });
		run.reason = reason;
		phase("aborted");
		note("aborted: " + reason);
		return true;
	}

	function on_cm(name, data) {
		if (!run || !data || data.t !== "crypt" || data.runId !== run.runId) return;
		var c = cfg();
		if (roster().indexOf(name) < 0) return;
		if (data.a === "busy" && run.phase === "ready") { abort(name + " busy: " + String(data.reason || "").slice(0, 60)); return; }
		if (data.a === "ready" && run.phase === "ready") {
			run.ready[name] = 1;
			if (name === c.WARRIOR && data.hasKey) run.warriorHasKey = true;
			if (roster().every(function (n) { return run.ready[n]; })) {
				phase(run.resumed ? "inside" : run.warriorHasKey ? "wait_open" : "fetch");
				note("trio ready" + (run.resumed ? ", rejoining " + run.id + " (no key)" : run.warriorHasKey ? ", warrior already has a key" : ""));
			} else save();
		}
		if (name !== c.WARRIOR) return;
		if (data.a === "at_door") { run.warriorAtDoor = now(); save(); }
		if (data.a === "open" && typeof data.id === "string") { run.id = data.id.slice(0, 64); run.openedAt = now(); phase("inside"); note("instance " + run.id); }
		if (data.a === "census" && data.seen && typeof data.seen === "object") {
			Object.keys(data.seen).slice(0, 20).forEach(function (k) {
				var s = data.seen[k];
				if (/^[a-z0-9_]{1,20}$/.test(k) && s && typeof s === "object") run.seen[k] = { x: Number(s.x) || 0, y: Number(s.y) || 0, hp: Number(s.hp) || 0, max_hp: Number(s.max_hp) || 0, safe: !!s.safe };
			});
			save();
		}
		if (data.a === "retreat") note("retreat: " + String(data.reason || "").slice(0, 60) + ", back in 60 s");
		if (data.a === "kill" && /^[a-z0-9_]{1,20}$/.test(String(data.mtype))) { run.kills[data.mtype] = (run.kills[data.mtype] || 0) + 1; save(); }
		if (data.a === "done" && active()) { run.reason = String(data.reason || "").slice(0, 60); run.endedAt = now(); phase("done"); note("done: " + run.reason); }
	}

	/** Timeouts that need no travel; called from the merchant's 3 s supervisor loop. */
	function watch() {
		if (!active()) return;
		var age = now() - (run.phaseAt || run.at);
		if (run.phase === "ready" && age > READY_MS) abort("not ready: " + roster().filter(function (n) { return !run.ready[n]; }).join(", "));
		else if (run.phase === "deliver" && age > DELIVER_MS) abort("warrior never reached the door");
		else if (run.phase === "wait_open" && age > OPEN_MS + (run.warriorHasKey ? DELIVER_MS : 0)) abort("instance never opened");
		else if (run.phase === "inside" && age > RUN_MS) { run.reason = "stale"; phase("done"); }
	}

	function needs_merchant() { return active() && (run.phase === "fetch" || run.phase === "deliver"); }

	/** One cryptkey in the bags; the rest of the stack goes back to its bank slot. */
	async function fetch_key() {
		if (carried_slot() >= 0) return true;
		if (typeof BankCoordinator !== "undefined" && !BankCoordinator.acquire("crypt")) return false;
		// The stand loop otherwise walks the merchant out of the bank mid-withdrawal (character.bank turns null).
		if (typeof hold_stand === "function") hold_stand(180000);
		try {
			if (!character.map || character.map.indexOf("bank") !== 0) await smart_move("bank");
			// Run 25: character.bank was not loaded yet and an unread bank read as "no key"; wait, then retry next tick.
			for (var w = 0; w < 10 && !character.bank; w++) await new Promise(function (r) { setTimeout(r, 500); });
			if (!character.bank) { note("bank not loaded yet, key fetch retried"); return false; }
			var found = find_in_bank();
			if (!found) { abort("no Crypt Key in the bank"); return false; }
			var floor = bank_floor(found.pack);
			if (character.map !== floor) { await smart_move(floor); if (character.map !== floor) return false; }
			var empty = character.items.findIndex(function (it) { return !it; });
			if (empty < 0 || (found.quantity > 1 && (typeof split !== "function" || free_slots() < 2))) { note("no free slot for the key"); return false; }
			if (typeof BankCoordinator !== "undefined" && !BankCoordinator.begin("withdraw", KEY, 0, 1, found.pack)) return false;
			var ok = false;
			try {
				await bank_retrieve(found.pack, found.slot, empty);
				if (!character.items[empty] || character.items[empty].name !== KEY) throw Error("Unconfirmed key withdrawal");
				if (found.quantity > 1) {
					await split(empty, 1);
					if (!character.items[empty] || character.items[empty].q !== found.quantity - 1) throw Error("Unconfirmed key split");
					if (!character.bank || !character.bank[found.pack]) throw Error("Left the bank before returning the key stack");
					if (character.bank[found.pack][found.slot]) throw Error("Key return slot changed");
					await bank_store(empty, found.pack, found.slot);
				}
				var slot = carried_slot();
				ok = slot >= 0 && (character.items[slot].q || 1) === 1;
				if (typeof BankCoordinator !== "undefined") BankCoordinator.finish(ok, ok ? "One key withdrawn from " + found.pack + " slot " + found.slot + ", rest of the stack returned" : "Key withdrawal not confirmed in bags");
			} catch (e) {
				if (typeof BankCoordinator !== "undefined") BankCoordinator.finish(false, "Key withdrawal failed: " + String((e && (e.reason || e.message)) || e).slice(0, 120));
				note("withdraw: " + ((e && (e.reason || e.message)) || e));
			}
			if (ok) run.keyFrom = found.pack;
			return ok;
		} finally {
			if (typeof BankCoordinator !== "undefined") BankCoordinator.releaseNavigation("crypt");
		}
	}

	/** send_item needs the same map and 400 px; the warrior waits at the door. */
	async function hand_over() {
		var warrior = cfg().WARRIOR, slot = carried_slot();
		if (slot < 0) { phase("fetch"); return false; }
		if (character.map !== DOOR.map || distance(character, DOOR) > 80) {
			if (typeof hold_stand === "function") hold_stand(120000);
			await smart_move(DOOR);
			return false;
		}
		var w = get_player(warrior);
		if (!w || w.map !== character.map || distance(character, w) > 380) return false;
		var before = carried_count();
		try { await send_item(warrior, slot, 1); } catch (e) { note("send key: " + ((e && e.reason) || e)); return false; }
		// Inventory updates arrive after the call resolves; never resend before the bag changed.
		for (var i = 0; i < 30 && carried_count() === before; i++) await sleep(100);
		if (carried_count() !== before - 1) { abort("key transfer unconfirmed, check the warrior's bags"); return false; }
		cm([warrior], { t: "crypt", a: "key", runId: run.runId });
		phase("wait_open");
		note("key handed to " + warrior);
		return true;
	}

	/** Travel steps; the merchant chores loop calls it while needs_merchant(). */
	async function tick() {
		if (!needs_merchant() || character.rip) return false;
		if (run.phase === "fetch") {
			if (await fetch_key()) { phase("deliver"); note("key withdrawn"); }
			else if (active()) { run.fetchTries = (run.fetchTries || 0) + 1; save(); if (run.fetchTries >= 4) abort("could not withdraw a key"); }
			return true;
		}
		await hand_over();
		return true;
	}

	function snapshot() {
		if (!run) return null;
		return { runId: run.runId, phase: run.phase, active: active(), id: run.id || "", kills: run.kills || {}, seen: run.seen || {},
			openedAt: run.openedAt || 0, reason: run.reason || "", last: run.last || "" };
	}

	return { start: start, abort: abort, onCm: on_cm, watch: watch, tick: tick, needsMerchant: needs_merchant,
		resume: resume, resumable: resumable,
		snapshot: snapshot, keysAvailable: keys_available, keeps: function (it) { return active() && !!it && it.name === KEY; }, missingRoster: missing_roster, active: active, fetchKey: fetch_key };
})();
