/**
 * Command Center bank sorter.
 * Commands are queued by authenticated telemetry and executed only by the
 * merchant. Sorting is opt-in, preserves carried items, and reports progress.
 */
var ALCCBankSorter = (function () {
  var requested = false;
  var running = false;
  var finalBank = null;
  var status = { state: "idle", phase: "idle", moved: 0, merged: 0, total: 0, updatedAt: Date.now(), message: "Ready" };

  var CATEGORY_ORDER = ["helmet", "chest", "pants", "gloves", "shoes", "cape", "ring", "earring", "amulet", "belt", "orb", "weapon", "shield", "offhand", "elixir", "pot", "scroll", "material", "exchange", "other"];
  var OFFHAND_TYPES = { source: 1, quiver: 1, misc_offhand: 1 };
  var SCROLL_TYPES = { cscroll: 1, uscroll: 1, pscroll: 1, offering: 1 };
  var FLOOR_ENTRY = {
    bank: { bank_b: { x: 1, y: -436 }, bank_u: { x: 1, y: -436 } },
    bank_b: { bank: { x: -264, y: -412 }, bank_u: { x: -104, y: -171 } },
    bank_u: { bank: { x: 0, y: -41 }, bank_b: { x: 0, y: -41 } }
  };

  function update(patch) {
    for (var key in patch) status[key] = patch[key];
    status.updatedAt = Date.now();
  }

  function category(item) {
    var def = (G.items && G.items[item.name]) || {};
    var type = String(def.type || "");
    if (OFFHAND_TYPES[type]) return "offhand";
    if (SCROLL_TYPES[type]) return "scroll";
    if (def.e || def.exchange) return "exchange";
    return CATEGORY_ORDER.indexOf(type) >= 0 ? type : "other";
  }

  function compare(a, b) {
    if (!a && !b) return 0;
    if (!a) return 1;
    if (!b) return -1;
    var ca = CATEGORY_ORDER.indexOf(category(a)), cb = CATEGORY_ORDER.indexOf(category(b));
    if (ca !== cb) return ca - cb;
    // Group identical objects together. NPC price is not a useful visual order
    // and made the previous sorter report success for a confusing arrangement.
    if (a.name !== b.name) return a.name < b.name ? -1 : 1;
    return (b.level || 0) - (a.level || 0);
  }

  function packFloor(pack) {
    var n = Number(String(pack).replace("items", ""));
    return n <= 7 ? "bank" : n <= 23 ? "bank_b" : "bank_u";
  }

  function packs() {
    if (!character.bank) return [];
    return Object.keys(character.bank).filter(function (key) { return key !== "gold" && /^items\d+$/.test(key); })
      .sort(function (a, b) { return Number(a.slice(5)) - Number(b.slice(5)); });
  }

  function freeInventorySlot() {
    for (var i = 0; i < character.items.length; i++) if (!character.items[i]) return i;
    return -1;
  }

  async function go(floor) {
    if (character.map === floor) return;
    update({ phase: "travel", message: "Travelling to " + floor });
    var from = character.map;
    var entry = FLOOR_ENTRY[floor] && FLOOR_ENTRY[floor][from];
    await smart_move(entry ? { map: floor, x: entry.x, y: entry.y } : floor);
    await sleep(500);
    if (character.map !== floor) throw new Error("Could not reach " + floor);
  }

  function desiredLayout(bankPacks) {
    var items = [];
    for (var p = 0; p < bankPacks.length; p++) {
      var pack = bankPacks[p], list = character.bank[pack] || [];
      for (var slot = 0; slot < 42; slot++) if (list[slot]) items.push(list[slot]);
    }
    items.sort(compare);
    var targets = {};
    for (var i = 0; i < items.length; i++) targets[bankPacks[Math.floor(i / 42)] + ":" + (i % 42)] = items[i];
    return { items: items, targets: targets };
  }

  function same(a, b) {
    return !!a && !!b && signature(a) === signature(b);
  }

  function signature(item) {
    if (!item) return "";
    var data = {};
    Object.keys(item).sort().forEach(function (key) { data[key] = item[key]; });
    return JSON.stringify(data);
  }
  function bagCounts() {
    var counts = {};
    (character.items || []).forEach(function (item) { if (item) { var key = signature(item); counts[key] = (counts[key] || 0) + 1; } });
    return counts;
  }
  // bank_store may compact the inventory. Find the extra bank item relative to
  // the carried inventory, instead of assuming its old buffer index survives.
  function bufferedSlot(baseline) {
    var counts = Object.assign({}, baseline), extra = -1;
    for (var i = 0; i < character.items.length; i++) {
      var item = character.items[i]; if (!item) continue;
      var key = signature(item);
      if (counts[key]) counts[key]--;
      else { if (extra >= 0) throw new Error("Inventory changed during bank sort"); extra = i; }
    }
    for (var key in counts) if (counts[key]) throw new Error("Carried inventory changed during bank sort");
    return extra;
  }
  async function confirmed(check, label) {
    for (var i = 0; i < 30; i++) {
      if (check()) return;
      await sleep(100);
    }
    throw new Error("Bank did not confirm " + label);
  }

  async function mergeSimple(bankPacks) {
    update({ phase: "merge", message: "Merging compatible stacks" });
    var groups = {};
    for (var p = 0; p < bankPacks.length; p++) {
      var pack = bankPacks[p], list = character.bank[pack] || [];
      for (var slot = 0; slot < 42; slot++) {
        var item = list[slot], limit = item && G.items[item.name] && G.items[item.name].s;
        if (!item || !item.q || !limit || item.q >= limit) continue;
        var metadata = Object.assign({}, item); delete metadata.q;
        var key = signature(metadata);
        (groups[key] || (groups[key] = [])).push({ pack: pack, slot: slot, q: item.q, limit: limit });
      }
    }
    for (var key in groups) {
      var rows = groups[key];
      rows.sort(function (a, b) { return a.q - b.q; });
      while (rows.length > 1) {
        var low = rows[0], high = rows[rows.length - 1];
        if (low.q + high.q > high.limit) break;
        var a = freeInventorySlot();
        if (a < 0) return;
        await go(packFloor(low.pack));
        var baseline = bagCounts();
        var carried = JSON.parse(JSON.stringify(character.bank[low.pack][low.slot]));
        await bank_retrieve(low.pack, low.slot, a);
        await confirmed(function () { var slot = bufferedSlot(baseline); return slot >= 0 && same(character.items[slot], carried) && !(character.bank[low.pack] || [])[low.slot]; }, "merge retrieval");
        await go(packFloor(high.pack));
        a = bufferedSlot(baseline);
        if (a < 0) throw new Error("Merge buffer unavailable");
        var occupiedBefore = (character.bank[high.pack] || []).filter(Boolean).length;
        // An explicit occupied slot SWAPS stacks. The automatic store path is
        // what merges compatible stacks inside this pack.
        await bank_store(a, high.pack);
        await confirmed(function () { return bufferedSlot(baseline) < 0; }, "stack merge");
        if ((character.bank[high.pack] || []).filter(Boolean).length !== occupiedBefore) throw new Error("Bank stored the stack without merging it");
        status.merged++;
        rows.shift();
        high.q += low.q;
        update({ merged: status.merged, message: "Merged " + carried.name });
        await sleep(120);
      }
    }
  }

  async function sortFloor(floor, floorPacks) {
    await go(floor);
    update({ phase: "sort", message: "Sorting " + floor });
    var layout = desiredLayout(floorPacks);
    status.total += layout.items.length;
    update({ total: status.total });
    var positions = [];
    for (var p = 0; p < floorPacks.length; p++) {
      for (var slot = 0; slot < 42; slot++) positions.push({ pack: floorPacks[p], slot: slot });
    }
    var fixed = {};
    var guard = 0;
    while (guard++ < positions.length * 3 + 20) {
      var first = -1;
      for (var index = 0; index < positions.length; index++) {
        var pos = positions[index], key = pos.pack + ":" + pos.slot;
        var wanted = layout.targets[key] || null;
        var current = (character.bank[pos.pack] || [])[pos.slot] || null;
        if ((!wanted && !current) || same(wanted, current)) fixed[key] = true;
        else if (!fixed[key]) { first = index; break; }
      }
      if (first < 0) return;

      var target = positions[first], targetKey = target.pack + ":" + target.slot;
      var desired = layout.targets[targetKey];
      var buffer = freeInventorySlot();
      if (buffer < 0) throw new Error("One empty inventory slot is required");
      var source = null;
      for (var scan = first + 1; scan < positions.length; scan++) {
        var candidate = positions[scan];
        if (same((character.bank[candidate.pack] || [])[candidate.slot], desired)) { source = candidate; break; }
      }
      if (!source) throw new Error("Sort source not found for " + (desired && desired.name));
      var baseline = bagCounts();
      var retrieved = JSON.parse(JSON.stringify((character.bank[source.pack] || [])[source.slot]));
      await bank_retrieve(source.pack, source.slot, buffer);
      await confirmed(function () { var slot = bufferedSlot(baseline); return slot >= 0 && same(character.items[slot], retrieved) && !(character.bank[source.pack] || [])[source.slot]; }, "retrieval");

      var cycleGuard = 0;
      while ((buffer = bufferedSlot(baseline)) >= 0 && cycleGuard++ < positions.length + 2) {
        var held = character.items[buffer], destination = null;
        for (var find = 0; find < positions.length; find++) {
          var wantedPos = positions[find], wantedKey = wantedPos.pack + ":" + wantedPos.slot;
          if (!fixed[wantedKey] && same(layout.targets[wantedKey], held)) { destination = wantedPos; break; }
        }
        if (!destination) throw new Error("No destination for buffered " + held.name);
        var placed = JSON.parse(JSON.stringify(held));
        await bank_store(buffer, destination.pack, destination.slot);
        await confirmed(function () { return same((character.bank[destination.pack] || [])[destination.slot], placed); }, "placement");
        fixed[destination.pack + ":" + destination.slot] = true;
        status.moved++;
        update({ moved: status.moved, message: "Placed item " + status.moved + "/" + status.total });
        await sleep(100);
      }
      if (bufferedSlot(baseline) >= 0) throw new Error("Sort cycle safety limit reached");
    }
    throw new Error("Sort safety limit reached");
  }

  /** Publish the completed bank snapshot only on an explicit sort request. */
  async function publishALData(bank) {
    if (!character.owner || !bank) { game_log("ALData bank update skipped: bank owner or data unavailable"); return; }
    var ALDATA_KEY = "ImNotEadroma";
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 15000);
    try {
      var response = await fetch("https://aldata.earthiverse.ca/bank/" + encodeURIComponent(character.owner) + "/" + encodeURIComponent(ALDATA_KEY), {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bank), signal: controller.signal
      });
      game_log("ALData bank update: HTTP " + response.status + (response.status === 200 ? " — successfully updated" : " — update not confirmed"));
    } catch (e) {
      // Do not expose the URL/key in fetch error messages.
      game_log("ALData bank update failed: " + (controller.signal.aborted ? "request timed out" : "network request failed"));
    } finally { clearTimeout(timer); }
  }
  async function run() {
    if (running) return;
    running = true;
    requested = false;
    update({ state: "running", phase: "prepare", moved: 0, merged: 0, total: 0, message: "Preparing bank sort" });
    var ownsLock = false, ownsBankHub = false;
    try {
      if (typeof hold_stand === "function") hold_stand(15 * 60 * 1000);
      // Existing merchant chores must finish before taking the travel lock.
      var wait = 0;
      while (typeof chores_in_progress !== "undefined" && chores_in_progress && wait++ < 120) await sleep(250);
      if (typeof chores_in_progress !== "undefined" && chores_in_progress) throw new Error("Merchant is busy; retry after the current chore");
      if(typeof BankCoordinator!=='undefined'){
        if(!BankCoordinator.acquire('sort'))throw new Error('Bank movement pending; inspect evidence before sorting');
        ownsBankHub=true;
      }
      if (typeof chores_in_progress !== "undefined") { chores_in_progress = true; ownsLock = true; }
      if (typeof production_trip !== "undefined") production_trip = null;
      if (typeof ensure_stand_closed === "function") await ensure_stand_closed();
      await go("bank");
      var bankWait = 0;
      while (!character.bank && bankWait < 5000) { await sleep(250); bankWait += 250; }
      if (!character.bank) throw new Error("Bank data unavailable");
      if(ownsBankHub)BankCoordinator.stage('bank');
      if (freeInventorySlot() < 0) throw new Error("One empty inventory slot is required");
      var allPacks = packs();
      await mergeSimple(allPacks);
      for (var f = 0; f < 3; f++) {
        var floor = ["bank", "bank_b", "bank_u"][f];
        var floorPacks = allPacks.filter(function (pack) { return packFloor(pack) === floor; });
        if (floorPacks.length) await sortFloor(floor, floorPacks);
      }
      finalBank = { at: Date.now(), bank: JSON.parse(JSON.stringify(character.bank)) };
      update({ state: "complete", phase: "complete", message: status.moved || status.merged ? "Bank sorted successfully" : "Bank already sorted; no moves needed" });
      game_log("Bank sort complete: " + status.moved + " moves, " + status.merged + " merges");
      await publishALData(finalBank.bank);
    } catch (e) {
      update({ state: "failed", phase: "failed", message: String((e && (e.reason || e.message)) || e).slice(0, 160) });
      game_log("Bank sort failed: " + status.message);
    } finally {
      if(ownsBankHub)BankCoordinator.release('sort');
      if (ownsLock) chores_in_progress = false;
      running = false;
    }
  }

  function request(command) {
    if (running || requested) return false;
    requested = true;
    update({ state: "queued", phase: "queued", commandId: command && command.id, message: "Bank sort queued: category, item name, highest level first" });
    setTimeout(run, 0);
    return true;
  }

  function snapshot() {
    return {
      state: status.state, phase: status.phase, moved: status.moved, merged: status.merged,
      total: status.total, updatedAt: status.updatedAt, message: status.message,
      commandId: status.commandId
    };
  }

  return { request: request, snapshot: snapshot, bankSnapshot: function () { return finalBank; } };
})();
