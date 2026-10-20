/**
 * Farm-style loadouts from Command Center (AOE / Mono / Tank).
 * Appended after farmer CODE. Empty skills keep the original defaults
 * (AOE shots/cleave only in AOE). Empty gear keeps WEAR_SLOTS / WEAPONS.pack.
 */
var StyleLoadout = (function () {
	function active_mtype() {
		if (typeof combat_mtype === "function") return combat_mtype();
		if (typeof EventRouter !== "undefined" && EventRouter.activeMonster) {
			var eventMonster = EventRouter.activeMonster();
			if (eventMonster) return eventMonster;
		}
		if (typeof cache !== "undefined" && cache && cache.target && cache.target.mtype) return cache.target.mtype;
		if (typeof farm_monster === "function") return farm_monster();
		return null;
	}
	var lastDescription = "";
	function pack_mode(mtype) {
		if (mtype == null) mtype = active_mtype();
		var activityBuild = typeof __ALCC !== "undefined" && __ALCC.automation && __ALCC.automation.activeBuilds && __ALCC.automation.activeBuilds[character.name];
		if (activityBuild && (activityBuild.monster === "*" || activityBuild.monster === mtype)) return activityBuild.style;
		var styles = (typeof CONFIG !== "undefined" && CONFIG.PACK_STYLE) || {};
		var s = mtype && styles[mtype];
		if (s && ((CONFIG.STYLE_LOADOUTS || {})[s] || s === "aoe" || s === "mono" || s === "tank")) return s;
		return "aoe";
	}
	function current(mtype) {
		var all = (typeof CONFIG !== "undefined" && CONFIG.STYLE_LOADOUTS) || {};
		var lo = all[pack_mode(mtype)] || {};
		return { gear: lo.gear || [], skills: lo.skills || [] };
	}
	function base_mode(mtype) {
		var mode = pack_mode(mtype);
		if (mode === "aoe" || mode === "mono" || mode === "tank") return mode;
		return ((CONFIG.STYLE_LOADOUTS || {})[mode] || {}).base || "aoe";
	}
	function has_slot(slot, mtype) {
		var gear = current(mtype).gear;
		for (var i = 0; i < gear.length; i++) if (gear[i] && gear[i].slot === slot && gear[i].item) return true;
		return false;
	}
	function allows(skill, mtype) {
		if (!skill) return true;
		if (String(skill).indexOf("use_") === 0) return true;
		var skills = current(mtype).skills;
		if (!skills.length) {
			var mode = base_mode(mtype);
			if (mode === "mono" || mode === "tank") {
				if (skill === "3shot" || skill === "5shot" || skill === "cleave" || skill === "stomp" || skill === "agitate" || skill === "cburst") { if (typeof RuntimePolicy !== "undefined") RuntimePolicy.skillBlocked(skill); return false; }
			}
			return true;
		}
		var permitted = skills.indexOf(skill) >= 0;
		if (!permitted && typeof RuntimePolicy !== "undefined") RuntimePolicy.skillBlocked(skill);
		return permitted;
	}
	function selected(skill, mtype) {
		return current(mtype).skills.indexOf(skill) >= 0;
	}
	function is_aoe(mtype) {
		if (current(mtype).skills.length) {
			return allows("3shot", mtype) || allows("5shot", mtype) || allows("cleave", mtype) || allows("cburst", mtype);
		}
		return base_mode(mtype) === "aoe";
	}
	async function wear_rule(r) {
		if (!r || !r.slot || !r.item || typeof character === "undefined" || typeof globalThis.equip !== "function") return false;
		if (typeof CombatGear !== "undefined" && CombatGear.ownsSlot(r.slot)) return CombatGear.apply();
			var minimum = Math.max(0, Number(r.minLevel) || 0);
			var worn = character.slots && character.slots[r.slot];
			if (worn && worn.name === r.item && (worn.level || 0) >= minimum && (!r.shiny || worn.shiny)) return false;
			var items = character.items || [], best = -1, bestLevel = -1;
			for (var j = 0; j < items.length; j++) {
				var item = items[j];
				if (!item || item.name !== r.item || (item.level || 0) < minimum || (r.shiny && !item.shiny)) continue;
				if ((item.level || 0) > bestLevel) { best = j; bestLevel = item.level || 0; }
			}
			if (best < 0) return false;
			try { await globalThis.equip(best, r.slot); return true; } catch (e) { return false; }
	}
	async function equip_style(mtype) {
		var monster = mtype == null ? active_mtype() : mtype;
		var loadout = current(monster);
		var gear = loadout.gear;
		var description = pack_mode(monster) + ":" + (monster || "default") + ":" + loadout.skills.join(",");
		if (description !== lastDescription) {
			lastDescription = description;
			if (typeof game_log === "function") game_log("Loadout " + pack_mode(monster) + " · " + (monster || "default") + " · " + (loadout.skills.length ? loadout.skills.join(", ") : "skills script"), "#7CFC9A");
		}
		if (!gear.length) return false;
		var changed = false;
		for (var i = 0; i < gear.length; i++) {
			if (await wear_rule(gear[i])) changed = true;
		}
		return changed;
	}
	return { mode: pack_mode, current: current, hasSlot: has_slot, allows: allows, selected: selected, isAoe: is_aoe, wear: wear_rule, equip: equip_style };
})();
