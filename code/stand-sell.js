/**
 * Spam-sell into a nearby merchant stand
 * ======================================
 *
 * Paste this into any character's CODE editor and press RUN.
 * Stand next to the merchant. They must have an open buy listing
 * for ITEM. Supercomputer stands use trade17–trade48; we scan all
 * of them. Chat stays off.
 *
 * LEVEL null = any listing for that item. Q 0 = fill as many as
 * the listing will take this tick.
 */

var CONFIG = {
	MERCHANT: "MuaBan",
	ITEM: "feather0",
	LEVEL: null,
	MIN_PRICE: 0,
	Q: 0,
	RANGE: 600
};

var working = false;
var sold = 0;
var retry_at = 0;
var failures = 0;

function is_trade_slot(name) {
	return typeof name === "string" && name.indexOf("trade") === 0;
}

function listing_level_ok(it) {
	if (CONFIG.LEVEL == null) return true;
	if (it.level == null || it.level < 0) return true;
	return (it.level || 0) === CONFIG.LEVEL;
}

function listing_slot(merchant) {
	if (!merchant || !merchant.slots) return null;
	var best = null;
	var best_price = -1;
	for (var slot in merchant.slots) {
		if (!is_trade_slot(slot)) continue;
		var it = merchant.slots[slot];
		if (!it || !it.b || !it.name) continue;
		if (it.name !== CONFIG.ITEM) continue;
		if (!listing_level_ok(it)) continue;
		if ((it.price || 0) < (CONFIG.MIN_PRICE || 0)) continue;
		if (!it.rid) continue;
		if ((it.price || 0) > best_price) {
			best_price = it.price || 0;
			best = slot;
		}
	}
	return best;
}

function buy_names(merchant) {
	var names = [];
	if (!merchant || !merchant.slots) return names;
	for (var slot in merchant.slots) {
		if (!is_trade_slot(slot)) continue;
		var it = merchant.slots[slot];
		if (!it || !it.b || !it.name) continue;
		if (names.indexOf(it.name) < 0) names.push(it.name);
	}
	return names;
}

function bag_qty() {
	var n = 0;
	var items = character.items || [];
	for (var i = 0; i < items.length; i++) {
		var it = items[i];
		if (!it || it.l || it.name !== CONFIG.ITEM) continue;
		if (CONFIG.LEVEL != null && it.level != null && (it.level || 0) !== CONFIG.LEVEL) continue;
		n += it.q || 1;
	}
	return n;
}

setInterval(async function () {
	if (working || Date.now() < retry_at) return;
	working = true;
	try {
		if (character.rip) {
			set_message("dead");
			return;
		}
		var merchant = get_player(CONFIG.MERCHANT);
		if (!merchant) {
			set_message("no " + CONFIG.MERCHANT);
			return;
		}
		if (distance(character, merchant) > (CONFIG.RANGE || 600)) {
			set_message("too far " + Math.round(distance(character, merchant)));
			return;
		}
		var have = bag_qty();
		if (have < 1) {
			set_message("sold " + sold + " (empty)");
			return;
		}
		var slot = listing_slot(merchant);
		if (!slot) {
			var seen = buy_names(merchant);
			set_message(seen.length ? ("no " + CONFIG.ITEM + " (" + seen.slice(0, 4).join(",") + ")") : "stand has no buys");
			return;
		}
		var listing = merchant.slots[slot];
		if (!listing || !listing.rid) {
			set_message("listing gone");
			return;
		}
		var q = CONFIG.Q || listing.q || 1;
		if (q > have) q = have;
		if (listing.q && q > listing.q) q = listing.q;
		if (q < 1) q = 1;
		await trade_sell(merchant, slot, q);
		failures = 0;
		sold += q;
		set_message("sold " + sold + " " + CONFIG.ITEM);
		game_log("sold " + q + " " + CONFIG.ITEM + " -> " + CONFIG.MERCHANT + " " + slot + " @" + (listing.price || 0));
	} catch (e) {
		failures++;
		retry_at = Date.now() + Math.min(30000, 500 * Math.pow(2, Math.min(failures - 1, 6)));
		game_log("trade_sell: " + ((e && e.reason) || e));
		set_message("fail " + ((e && e.reason) || "trade"));
	} finally {
		working = false;
	}
}, 50);
