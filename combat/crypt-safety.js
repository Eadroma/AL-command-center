/** Shared Crypt path checks, embedded into the three standalone Crypt scripts. */
function crypt_segment_safe(ax, ay, bx, by, approach) {
	var a = { x: ax, y: ay }, b = { x: bx, y: by };
	for (var id in parent.entities) {
		var e = parent.entities[id];
		if (!e || e.type !== "monster" || e.rip || e.hp <= 0) continue;
		var unique = is_unique(e);
		if (!unique && e.mtype !== CONFIG.FARM) continue;
		var pad = unique ? unique_radius(e) : ((e.range || (G.monsters[e.mtype] || {}).range || 35) + 10);
		if (!unique && approach && approach.id === e.id) pad = 8;
		var dx = bx - ax, dy = by - ay;
		var t = Math.max(0, Math.min(1, ((e.x - ax) * dx + (e.y - ay) * dy) / (dx * dx + dy * dy || 1)));
		var closest = Math.hypot(ax + dx * t - e.x, ay + dy * t - e.y);
		// Starting in danger is allowed only when the route does not go deeper.
		if (closest < Math.min(dist2(a, e) - 1, pad)) return false;
		if (dist2(a, e) < pad && dist2(b, e) < dist2(a, e) - 1) return false;
	}
	return true;
}
