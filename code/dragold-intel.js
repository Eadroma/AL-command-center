/** Backwards-compatible telemetry facade over the shared event scanner. */
var DragoldIntel = (function () {
	function snapshot() {
		if (typeof WorldEventIntel !== "undefined" && WorldEventIntel.dragoldSnapshot) return WorldEventIntel.dragoldSnapshot();
		return { scanner: character.name, currentShard: "", startedAt: 0, observations: [] };
	}
	return { snapshot: snapshot };
})();
