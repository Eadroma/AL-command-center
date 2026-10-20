/** Shared mission protocol for the farmer trio. The leader may travel first,
 * but combat at the destination only starts after the priest acknowledges it. */
var TeamCoordinator = (function () {
	var mission = null;
	var ready = {};
	var lastReadySent = "";
	function now() { return Date.now(); }
	function leaderName() { return (typeof CONFIG !== "undefined" && (CONFIG.WARRIOR || CONFIG.NAME)) || "Eadroma"; }
	function priestName() { return (typeof CONFIG !== "undefined" && CONFIG.PRIEST) || "Aedroma"; }
	function isLeader() { return character.name === leaderName(); }
	function idFor(monster, destination) {
		return [monster || "travel", destination.map || character.map, Math.round((destination.x || 0) / 50), Math.round((destination.y || 0) / 50)].join(":");
	}
	function publish(monster, destination, targetId) {
		if (!isLeader() || !destination || !destination.map) return;
		var id = idFor(monster, destination);
		if (!mission || mission.id !== id) ready = {};
		mission = { id: id, leader: character.name, monster: monster || "", map: destination.map, x: Number(destination.x) || 0, y: Number(destination.y) || 0, targetId: targetId || "", phase: "travel", at: now() };
		try { send_cm(CONFIG.PARTY || [], { t: "team_mission", mission: mission }); } catch (e) {}
	}
	function onCm(name, data) {
		if (!data || typeof data !== "object") return;
		if (data.t === "team_mission" && data.mission && name === leaderName() && !isLeader()) {
			mission = data.mission;
			return;
		}
		if (data.t === "team_ready" && isLeader() && data.id && mission && data.id === mission.id) ready[name] = now();
	}
	function nearDestination() {
		if (!mission || character.map !== mission.map) return false;
		return Math.hypot((Number(character.x) || 0) - mission.x, (Number(character.y) || 0) - mission.y) <= 350;
	}
	function followerTick() {
		if (isLeader() || !mission || now() - mission.at > 15000 || !nearDestination()) return;
		var key = mission.id + ":" + character.map;
		if (key === lastReadySent && now() - (followerTick.sentAt || 0) < 5000) return;
		lastReadySent = key; followerTick.sentAt = now();
		try { send_cm(leaderName(), { t: "team_ready", id: mission.id, map: character.map, x: Math.round(character.x), y: Math.round(character.y) }); } catch (e) {}
	}
	function canEngage() {
		if (!isLeader() || !mission || now() - mission.at > 15000 || !nearDestination()) return true;
		var priest = priestName();
		try {
			var entity = typeof get_player === "function" && get_player(priest);
			if (entity && !entity.rip && entity.map === character.map && Math.hypot(character.x - entity.x, character.y - entity.y) <= 350) return true;
		} catch (e) {}
		return !!ready[priest] && now() - ready[priest] < 10000;
	}
	function snapshot() {
		return { role: isLeader() ? "leader" : "follower", mission: mission, ready: Object.keys(ready).filter(function (name) { return now() - ready[name] < 10000; }), canEngage: canEngage(), updatedAt: now() };
	}
	setInterval(followerTick, 1000);
	return { publish: publish, onCm: onCm, canEngage: canEngage, snapshot: snapshot };
})();
