/**
 * Cross-server event coordinator for the farming party.
 *
 * Only the warrior opens observer sockets and chooses a destination. The plan
 * is sent through CM and shared storage so every farmer changes to the same
 * shard even if a CM is missed while a character is reloading.
 */
var WorldEventIntel = (function () {
	var PLAN_KEY = "alcc_world_event_plan_v1";
	var PLAN_TTL = 60000;
	var HOP_COOLDOWN = 120000;
	var observations = {};
	var sockets = [];
	var pending = null;
	var lastHopAt = 0;
	var quietSince = 0;
	var isLeader = character.name === CONFIG.WARRIOR;

	function current() {
		return {
			region: String((typeof parent !== "undefined" && parent.server_region) || (typeof server !== "undefined" && server.region) || ""),
			name: String((typeof parent !== "undefined" && parent.server_identifier) || (typeof server !== "undefined" && (server.id || server.name)) || "")
		};
	}
	function sameServer(a, b) { return !!a && !!b && a.region === b.region && a.name === b.name; }
	function home() {
		var configured = (typeof __ALCC !== "undefined" && __ALCC.homeServer) || CONFIG.PONTY_HOME || CONFIG.HOME || {};
		return { region: String(configured.region || ""), name: String(configured.name || "") };
	}
	function allowed() {
		if (typeof EventRouter !== "undefined" && EventRouter.orderedEvents) return EventRouter.orderedEvents();
		return typeof __ALCC !== "undefined" && __ALCC.eventsEnabled === true ? (__ALCC.events || []) : [];
	}
	function eventLive(value) {
		if (typeof EventRouter !== "undefined" && EventRouter.isLive) return EventRouter.isLive(value, true);
		if (!value) return false;
		if (value === true || value.live === true || Number(value.hp) > 0) return true;
		var endAt = new Date(value.end || 0).getTime();
		return isFinite(endAt) && endAt > Date.now();
	}
	function record(serverData, data) {
		if (!data || typeof data !== "object") return;
		observations[serverData.region + " " + serverData.name] = {
			region: serverData.region, name: serverData.name, data: data, seenAt: Date.now()
		};
	}
	function startScanner() {
		if (!isLeader) return;
		try {
			var list = parent && parent.X && parent.X.servers;
			if (!Array.isArray(list) || typeof parent.io !== "function") return;
			for (var i = 0; i < list.length; i++) (function (serverData) {
				if (!serverData || !serverData.region || !serverData.name || serverData.name === "PVP" || serverData.name === "TEST" || !serverData.address || !serverData.path) return;
				try {
					var socket = parent.io("wss://" + serverData.address, {
						path: serverData.path,
						transports: ["websocket"],
						reconnection: true,
						reconnectionDelay: 5000
					});
					socket.on("server_info", function (data) { record(serverData, data); });
					sockets.push(socket);
				} catch (e) {}
			})(list[i]);
		} catch (e) {}
	}
	function currentHasAllowedEvent() {
		var ids = allowed();
		var status = (typeof parent !== "undefined" && parent.S) || {};
		for (var i = 0; i < ids.length; i++) if (eventLive(status[ids[i]])) return true;
		return false;
	}
	function bestRemote() {
		if (!isLeader || currentHasAllowedEvent()) return null;
		var ids = allowed(), here = current(), now = Date.now(), candidates = [];
		for (var key in observations) {
			if (!Object.prototype.hasOwnProperty.call(observations, key)) continue;
			var row = observations[key];
			if (now - row.seenAt > 45000 || sameServer(row, here)) continue;
			for (var i = 0; i < ids.length; i++) {
				if (!eventLive(row.data[ids[i]])) continue;
				candidates.push({ region: row.region, name: row.name, event: ids[i], rank: i, localRegion: row.region === here.region ? 0 : 1 });
				break;
			}
		}
		candidates.sort(function (a, b) {
			return a.rank - b.rank || a.localRegion - b.localRegion || (a.region + a.name).localeCompare(b.region + b.name);
		});
		return candidates[0] || null;
	}
	function storePlan(plan) { try { if (typeof set === "function") set(PLAN_KEY, plan); } catch (e) {} }
	function loadPlan() { try { return typeof get === "function" ? get(PLAN_KEY) : null; } catch (e) { return null; } }
	function acceptPlan(plan) {
		if (!plan || plan.t !== "event_hop" || !plan.region || !plan.name || !plan.event) return false;
		if (Date.now() > Number(plan.expires || 0) || (plan.event !== "__home" && allowed().indexOf(plan.event) < 0) || sameServer(plan, current())) return false;
		pending = plan;
		return true;
	}
	function publish(candidate) {
		var now = Date.now();
		var plan = { t: "event_hop", region: candidate.region, name: candidate.name, event: candidate.event, createdAt: now, switchAt: now + 4500, expires: now + PLAN_TTL };
		pending = plan;
		storePlan(plan);
		try { send_cm(CONFIG.PARTY, plan); } catch (e) {}
		if (typeof game_log === "function") game_log(plan.event === "__home" ? ("Retour home " + plan.region + " " + plan.name) : ("Event " + plan.event + " sur " + plan.region + " " + plan.name + " — regroupement"), "#7CFC9A");
	}
	function onCm(name, data) { if (name === CONFIG.WARRIOR) acceptPlan(data); }
	function tick() {
    if (typeof EventExpedition !== "undefined" && EventExpedition.worker()) return false;
		var now = Date.now();
		if (!pending) acceptPlan(loadPlan());
		if (pending) {
			if (now > Number(pending.expires || 0)) pending = null;
			else if (!sameServer(pending, current())) {
				// Followers leave first; the leader waits for the CM to propagate.
				var advance = isLeader ? 0 : 1500;
				if (now + advance >= Number(pending.switchAt || 0) && now - lastHopAt >= HOP_COOLDOWN) {
					lastHopAt = now;
					if (typeof game_log === "function") game_log("Changement vers " + pending.region + " " + pending.name + " pour " + pending.event, "#7CFC9A");
					change_server(pending.region, pending.name);
				}
				return true;
			}
		}
		if (isLeader && now - lastHopAt >= HOP_COOLDOWN) {
			var here = current(), homeServer = home();
			if (homeServer.region && homeServer.name && !sameServer(here, homeServer)) {
				if (currentHasAllowedEvent()) quietSince = 0;
				else {
					if (!quietSince) quietSince = now;
					// Allow server_info to settle after a kill or phase transition before
					// sending the whole party back to its configured home shard.
					if (now - quietSince >= 90000) {
						publish({ region: homeServer.region, name: homeServer.name, event: "__home" });
						return true;
					}
				}
				// While away, finish this event and return home. Do not chain-hop to
				// another shard just because another scanner result is also live.
				return false;
			}
			quietSince = 0;
			var candidate = bestRemote();
			if (candidate) { publish(candidate); return true; }
		}
		return false;
	}
	function dragoldSnapshot() {
		var rows = [];
		for (var key in observations) {
			if (!Object.prototype.hasOwnProperty.call(observations, key)) continue;
			var row = observations[key], value = row.data && row.data.dragold;
			if (!value) continue;
			var spawnAt = value.spawn ? new Date(value.spawn).getTime() : 0;
			rows.push({ shard: row.region + row.name, live: value.live === true, spawnAt: isFinite(spawnAt) ? spawnAt : 0, seenAt: row.seenAt });
		}
		return { scanner: character.name, currentShard: current().region + current().name, startedAt: 0, observations: rows.slice(0, 80) };
	}

	startScanner();
	return { onCm: onCm, tick: tick, dragoldSnapshot: dragoldSnapshot };
})();
