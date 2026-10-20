/**
 * Browser GUI for Eadroma and EadroSell.
 * Crowns3bc overlays: DPS, gold, XP, upgrade-shrine scroll buttons.
 * https://github.com/Crowns3bc/AdventureLand
 *
 * Loaded with load_code("gui") from a browser character. No-op without parent.$.
 * Wrapped so a CODE reload does not stack timers or hit/loot listeners.
 */
(function () {
	if (typeof parent === "undefined" || !parent.$) return;

	var prev = parent.__eadro_gui;
	if (prev) {
		try {
			if (prev.onHit && parent.socket && parent.socket.removeListener) {
				parent.socket.removeListener("hit", prev.onHit);
			}
		} catch (e) {}
		try {
			if (prev.onLoot && character.removeListener) character.removeListener("loot", prev.onLoot);
			else if (prev.onLoot && character.remove) character.remove("loot", prev.onLoot);
		} catch (e) {}
		if (prev.timers) {
			for (var ti = 0; ti < prev.timers.length; ti++) {
				try { clearInterval(prev.timers[ti]); } catch (e) {}
				try { clearTimeout(prev.timers[ti]); } catch (e) {}
			}
		}
	}

	var gui = { timers: [] };
	parent.__eadro_gui = gui;

	function track(id) {
		gui.timers.push(id);
		return id;
	}

	function still_mine() {
		return parent.__eadro_gui === gui;
	}

	/* ---- DPS meter (Crowns3bc DPS v4) ---- */
	var damageTypes = ["Base", "Blast", "HPS", "DPS"];
	var displayClassTypeColors = true;
	var displayDamageTypeColors = true;
	var showOverheal = false;
	var showOverManasteal = true;
	var damageTypeColors = {
		Base: "#A92000",
		Blast: "#782D33",
		Burn: "#FF7F27",
		HPS: "#9A1D27",
		MPS: "#353C9C",
		DR: "#E94959",
		RF: "#D880F0",
		DPS: "#FFD700",
		"Dmg Taken": "#FF4C4C"
	};
	var classColors = {
		mage: "#3FC7EB",
		paladin: "#F48CBA",
		priest: "#FFFFFF",
		ranger: "#AAD372",
		rogue: "#FFF468",
		warrior: "#C69B6D"
	};
	var METER_START = performance.now();
	var playerData = {};

	function getEntry(id) {
		return playerData[id] || (playerData[id] = {
			t: performance.now(),
			bD: 0,
			blD: 0,
			baD: 0,
			h: 0,
			m: 0,
			dr: 0,
			rf: 0,
			dtP: 0,
			dtM: 0
		});
	}

	function fmt(v) {
		return v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
	}

	parent.$("#bottomrightcorner").find("#dpsmeter").remove();
	var dpsBox = parent.$("<div id='dpsmeter'></div>").css({
		fontSize: "20px",
		color: "white",
		textAlign: "center",
		display: "table",
		overflow: "hidden",
		marginBottom: "-3px",
		width: "100%",
		backgroundColor: "rgba(0,0,0,1)"
	});
	dpsBox.append(parent.$("<div id='dpsmetercontent'></div>").css({
		display: "table-cell",
		verticalAlign: "middle",
		padding: "2px",
		border: "4px solid grey"
	}));
	parent.$("#bottomrightcorner").children().first().after(dpsBox);

	function onHit(d) {
		if (!still_mine()) return;
		function inParty(id) {
			return parent.party_list && parent.party_list.indexOf(id) !== -1;
		}
		if (!inParty(d.hid) && !inParty(d.id)) return;
		try {
			var dmg = d.damage || 0;
			var isPlayer = get_player(d.id);
			var isAttacker = get_player(d.hid);
			if (dmg && isPlayer) {
				var taken = getEntry(d.id);
				if (d.damage_type === "physical") taken.dtP += dmg;
				else taken.dtM += dmg;
			}
			if (d.dreturn && isAttacker) getEntry(d.hid).dtP += d.dreturn;
			if (d.reflect && isAttacker) getEntry(d.hid).dtM += d.reflect;
			if (d.dreturn && isPlayer && !get_player(d.hid)) getEntry(d.id).dr += d.dreturn;
			if (d.reflect && isPlayer && !get_player(d.hid)) getEntry(d.id).rf += d.reflect;
			if (isAttacker) {
				var e = getEntry(d.hid);
				if (dmg) {
					if (d.source === "burn") e.bD += dmg;
					else if (d.splash) e.blD += dmg;
					else e.baD += dmg;
				}
				if (d.heal || d.lifesteal) {
					var target = get_player(d.id);
					var maxhp = (target && target.max_hp) || 0;
					var curhp = (target && target.hp) || 0;
					e.h += showOverheal
						? (d.heal || 0) + (d.lifesteal || 0)
						: (d.heal ? Math.min(d.heal, maxhp - curhp) : 0) +
							(d.lifesteal ? Math.min(d.lifesteal, isAttacker.max_hp - isAttacker.hp) : 0);
				}
				if (d.manasteal) {
					e.m += showOverManasteal
						? d.manasteal
						: Math.min(d.manasteal, isAttacker.max_mp - isAttacker.mp);
				}
			}
		} catch (err) {
			console.error("hit handler error", err);
		}
	}
	gui.onHit = onHit;
	parent.socket.on("hit", onHit);

	function calcVal(type, e, elapsed) {
		var r = 1000 / elapsed;
		if (type === "Dmg Taken") return { phys: (e.dtP * r) | 0, mag: (e.dtM * r) | 0 };
		var vals = {
			DPS: (e.baD + e.blD + e.bD + e.dr + e.rf) * r,
			Burn: e.bD * r,
			Blast: e.blD * r,
			Base: e.baD * r,
			HPS: e.h * r,
			MPS: e.m * r,
			DR: e.dr * r,
			RF: e.rf * r
		};
		return vals[type] | 0;
	}

	track(setInterval(function () {
		if (!still_mine()) return;
		var $ = parent.$;
		var c = $("#dpsmetercontent");
		if (!c.length) return;
		var now = performance.now();
		var elapsed = now - METER_START;
		var hrs = (elapsed / 3600000) | 0;
		var mins = ((elapsed % 3600000) / 60000) | 0;
		var html = "<div>Elapsed Time: " + hrs + "h " + mins + "m</div><table border='1' style='width:100%'><tr><th></th>";
		damageTypes.forEach(function (t) {
			html += "<th style='color:" + (displayDamageTypeColors ? damageTypeColors[t] || "white" : "white") + "'>" + t + "</th>";
		});
		html += "</tr>";
		var sorted = Object.keys(playerData).map(function (id) {
			return { id: id, e: playerData[id], dps: calcVal("DPS", playerData[id], now - playerData[id].t) };
		}).sort(function (a, b) { return b.dps - a.dps; });
		sorted.forEach(function (row) {
			var p = get_player(row.id);
			if (!p) return;
			var ctype = (p.ctype && p.ctype.toLowerCase()) || "";
			html += "<tr><td style='color:" + (displayClassTypeColors ? classColors[ctype] || "#FFF" : "#FFF") + "'>" + p.name + "</td>";
			damageTypes.forEach(function (t) {
				var v = calcVal(t, row.e, now - row.e.t);
				html += "<td>" + fmt(v) + "</td>";
			});
			html += "</tr>";
		});
		html += "<tr><td style='color:" + damageTypeColors.DPS + "'>Total DPS</td>";
		damageTypes.forEach(function (t) {
			var tot = 0;
			Object.keys(playerData).forEach(function (id) {
				tot += calcVal(t, playerData[id], now - playerData[id].t);
			});
			html += "<td>" + fmt(tot) + "</td>";
		});
		html += "</tr></table>";
		c.html(html);
	}, 250));

	/* ---- Gold meter (Crowns3bc) ---- */
	var sumGold = 0;
	var largestGoldDrop = 0;
	var goldInterval = "hour";
	var goldStart = performance.now();
	var goldSpans = { minute: 60000, hour: 3600000, day: 86400000 };

	function countPartyChars() {
		var party = (parent && parent.party) || {};
		var count = 0;
		for (var name in party) {
			if (!Object.prototype.hasOwnProperty.call(party, name)) continue;
			var ent = parent.entities && parent.entities[name];
			if (name === character.name || (ent && ent.owner === character.owner)) count++;
		}
		// Lone Wolf runs without a party object. The loot event already contains
		// this character's share, so solo farming must use a multiplier of one.
		return Math.max(1, count);
	}

	function onLoot(d) {
		if (!still_mine()) return;
		if (d.gold && typeof d.gold === "number" && !isNaN(d.gold)) {
			var myGold = Math.round(d.gold * countPartyChars());
			sumGold += myGold;
			if (myGold > largestGoldDrop) largestGoldDrop = myGold;
		}
	}
	gui.onLoot = onLoot;

	track(setTimeout(function () {
		if (!still_mine()) return;
		var $ = parent.$;
		$("#bottomrightcorner").find("#goldtimer").remove();
		var box = $("<div id='goldtimer'></div>").css({
			fontSize: "25px",
			color: "white",
			textAlign: "center",
			display: "table",
			overflow: "hidden",
			marginBottom: "-5px",
			width: "100%"
		});
		$("<div id='goldtimercontent'></div>").css({ display: "table-cell", verticalAlign: "middle" }).appendTo(box);
		$("#bottomrightcorner").children().first().after(box);
		character.on("loot", onLoot);
		track(setInterval(function () {
			if (!still_mine()) return;
			var elapsed = performance.now() - goldStart;
			var divisor = elapsed / goldSpans[goldInterval];
			var avg = divisor > 0 ? ((sumGold / divisor) | 0) : 0;
			var label = goldInterval.charAt(0).toUpperCase() + goldInterval.slice(1);
			parent.$("#goldtimercontent").html(
				"<div>" + avg.toLocaleString("en") + " Gold/" + label + "</div>" +
				"<div>" + largestGoldDrop.toLocaleString("en") + " Jackpot</div>"
			).css({
				backgroundColor: "rgba(0,0,0,1)",
				border: "solid gray",
				borderWidth: "4px 4px",
				height: "50px",
				lineHeight: "25px",
				fontSize: "25px",
				color: "#FFD700",
				textAlign: "center"
			});
		}, 500));
	}, 1000));

	/* ---- XP meter (Crowns3bc) ---- */
	var xpInterval = "second";
	var targetXpRate = 40000;
	var xpStart = performance.now();
	var startXP = character.xp;
	var xpSpans = { second: 1000, minute: 60000, hour: 3600000, day: 86400000 };

	track(setTimeout(function () {
		if (!still_mine()) return;
		var $ = parent.$;
		$("#bottomrightcorner").find("#xptimer").remove();
		var box = $("<div id='xptimer'></div>").css({
			background: "black",
			border: "solid gray",
			borderWidth: "4px 4px",
			width: "98%",
			height: "66px",
			fontSize: "25px",
			color: "#0F0",
			textAlign: "center",
			display: "table",
			overflow: "hidden",
			marginBottom: "-5px",
			backgroundColor: "rgba(0,0,0,0.7)"
		});
		$("<div id='xptimercontent'></div>").css({ display: "table-cell", verticalAlign: "middle" }).html(
			'Estimated time until level up:<br><span id="xpcounter" style="font-size: 30px;">Loading...</span><br><span id="xprate">(Kill something!)</span>'
		).appendTo(box);
		$("#bottomrightcorner").children().first().after(box);
		track(setInterval(function () {
			if (!still_mine()) return;
			var xpGain = character.xp - startXP;
			if (xpGain === 0) return;
			var elapsed = performance.now() - xpStart;
			var elapsedSec = elapsed / 1000;
			if (elapsedSec < 1) return;
			var need = parent.G.levels[character.level] - character.xp;
			var xpPerSec = xpGain / elapsedSec;
			var secToLevel = (need / xpPerSec) | 0;
			var d = (secToLevel / 86400) | 0;
			var h = ((secToLevel % 86400) / 3600) | 0;
			var m = ((secToLevel % 3600) / 60) | 0;
			parent.$("#xpcounter").css("color", "#87CEEB").text(d + "d " + h + "h " + m + "min");
			var avgXP = (xpGain / (elapsed / xpSpans[xpInterval])) | 0;
			var color = avgXP < targetXpRate * 0.5 ? "#F00"
				: avgXP < targetXpRate ? "#FA0"
					: avgXP <= targetXpRate * 1.2 ? "#FF0"
						: avgXP <= targetXpRate * 1.5 ? "#9E9" : "#0F0";
			var label = xpInterval.charAt(0).toUpperCase() + xpInterval.slice(1);
			parent.$("#xprate").css("color", color).html(
				'<span class="xprate-container">' + fmt(avgXP) + " XP/" + label + "</span>"
			);
		}, 500));
	}, 1000));

	/* ---- Upgrade / compound scroll tray (Crowns3bc idea, no function patch) ---- */
	function shrine_open() {
		var t = parent.rendered_target;
		return t === "upgrade" || t === "compound";
	}

	function icon_html(skin, size, onclick) {
		if (parent.item_container) {
			return parent.item_container({ skin: skin, size: size, onclick: onclick });
		}
		return "<div class='gamebutton clickable' onclick=\"" + onclick + "\">" + skin + "</div>";
	}

	function qty_btn(name, qty) {
		return "<div class='gamebutton clickable' onclick='buy(\"" + name + "\", " + qty + ")' style='line-height:18px;font-size:22px;padding:3px 6px;border:2px solid gray;margin:2px 0'>+" + qty + "</div>";
	}

	function ensure_upgrade_tray() {
		if (!still_mine()) return;
		var $ = parent.$;
		var tray = $("#eadro_upgrade_tray");
		if (!tray.length) {
			tray = $("<div id='eadro_upgrade_tray'></div>").css({
				position: "absolute",
				left: "320px",
				top: "28px",
				zIndex: 200,
				background: "rgba(0,0,0,0.92)",
				border: "3px solid gray",
				padding: "6px",
				color: "white",
				display: "none"
			});
			tray.html(
				"<div style='display:flex;gap:8px;align-items:flex-start'>" +
					"<div>" + icon_html("scroll0", 20, "buy('scroll0')") + qty_btn("scroll0", 10) + qty_btn("scroll0", 100) + "</div>" +
					"<div>" + icon_html("scroll1", 20, "buy('scroll1')") + qty_btn("scroll1", 10) + qty_btn("scroll1", 100) + "</div>" +
					"<div>" + icon_html("scroll2", 20, "buy('scroll2')") + qty_btn("scroll2", 10) + qty_btn("scroll2", 100) + "</div>" +
					"<div>" + icon_html("scroll3", 20, "buy('scroll3')") + "</div>" +
					"<div>" +
						icon_html("skill_massproduction", 30, "use_skill('massproduction'); upgrade(u_item,u_scroll,u_offering);") +
						icon_html("skill_massproductionpp", 30, "use_skill('massproductionpp'); upgrade(u_item,u_scroll,u_offering);") +
						icon_html("shade_offering", 30, "buy('offering')") +
					"</div>" +
				"</div>"
			);
			$("body").append(tray);
		}
		if (shrine_open()) tray.show();
		else tray.hide();
	}

	parent.upgrade_buttons_added = true;
	track(setInterval(ensure_upgrade_tray, 250));
	game_log("gui: DPS / gold / XP meters on");
})();
