/** Daily Trick or Treat route. Read live game rules and authoritative character
 * progress; never invent door coordinates or start a second account character.
 * Caller owns chores_in_progress throughout tick(), including awaited travel. */
var MerchantHalloween = (function () {
    var key = 'alcc:trickortreat:' + character.name;
    var journal = null, busy = false, routeRunning = false, returnHome = false, retryAt = 0, message = '';
    function today() { return new Date().toISOString().slice(0, 10); }
    function progress() {
        if (!journal || journal.day !== today()) {
            try { journal = typeof get === 'function' ? get(key) : null; } catch (e) {}
            if (!journal || journal.day !== today()) journal = { day: today(), doors: [], limited: false };
        }
        return journal;
    }
    function save() { try { if (typeof set === 'function') set(key, journal); } catch (e) {} }
    function statuses() {
        if (typeof server !== 'undefined' && server.status) return server.status;
        return typeof parent !== 'undefined' && parent.S || {};
    }
    function season() {
        var value = statuses().halloween;
        if (!value || value.live === false || value.active === false) return false;
        var end = statuses().event_ends && statuses().event_ends.halloween;
        return !end || new Date(end).getTime() > Date.now();
    }
    function enabled() { return typeof __ALCC !== 'undefined' && __ALCC.trickOrTreat && __ALCC.trickOrTreat.enabled === true; }
    function note(text) {
        if (message === text) return;
        message = text;
        if (typeof game_log === 'function') game_log('Trick or Treat: ' + text, '#F5A05B');
    }
    function near(point, range) {
        return character.map === point.map && Math.hypot(character.x - point.x, character.y - point.y) <= range;
    }
    function threatened() {
        var entities = typeof parent !== 'undefined' && parent.entities || {};
        return Object.keys(entities).some(function (id) {
            var e = entities[id];
            return e && !e.dead && !e.rip && e.type === 'monster' && e.target === character.name;
        });
    }
    function otherWork() {
        if (typeof EventExpedition !== 'undefined' && EventExpedition.snapshot) {
            var mission = EventExpedition.snapshot();
            if (mission && ['forming', 'engaging', 'returning', 'blocked'].indexOf(mission.phase) >= 0) return true;
        }
        if (typeof BankCoordinator !== 'undefined' && BankCoordinator.snapshot().current) return true;
        return !!(character.q && (character.q.exchange || character.q.upgrade || character.q.compound));
    }
    async function home() {
        var spot = typeof cc_stand_spot === 'function' ? cc_stand_spot() : __ALCC.standSpot;
        if (!spot) return false;
        if (near(spot, 45)) { returnHome = false; return false; }
        await walk_to(spot, 'Trick or Treat: return to stand');
        if (near(spot, 45)) returnHome = false;
        return true;
    }
    function reason(error) {
        return String(error && (error.reason || error.message) || error || 'request failed');
    }
    async function tick() {
        if (busy || character.ctype !== 'merchant' || character.rip || character.cave || String(character.map).indexOf('zone_') === 0 || otherWork()) return false;
        busy = true;
        try {
            var p = progress();
            if (!enabled() || !season()) return returnHome ? await home() : false;
            if (returnHome && p.limited) return await home();
            if (Date.now() < retryAt) return returnHome;
            var state = character.trickortreat;
            var doors = typeof G !== 'undefined' && G.events && G.events.trickortreat && G.events.trickortreat.doors;
            if (!state || !Array.isArray(state.doors) || !Array.isArray(doors) || typeof knock !== 'function') return false;
            if (state.doors_left <= 0 || p.limited) { note('daily route complete or account limit reached'); return returnHome ? await home() : false; }
            var index = doors.findIndex(function (door, i) { return Array.isArray(door) && typeof door[0] === 'string' && Number.isFinite(door[1]) && Number.isFinite(door[2]) && state.doors.indexOf(i) < 0 && p.doors.indexOf(i) < 0; });
            if (index < 0) return returnHome ? await home() : false;
            if (threatened() || character.hp < character.max_hp * .7) {
                retryAt = Date.now() + 120000;
                note('danger: retreat and pause for two minutes');
                if (returnHome && typeof town === 'function') { try { await town(); } catch (e) {} }
                return returnHome ? await home() : false;
            }
            if (Number(character.esize) < 3) { note('needs three free inventory slots'); return returnHome ? await home() : false; }
            var door = doors[index], point = { map: door[0], x: door[1], y: door[2] + 24 };
            returnHome = true;
            if (!near(point, 45)) { await walk_to(point, 'Trick or Treat: door ' + (index + 1)); return true; }
            // Recheck after travel and before the server mutation. A verified
            // result is journaled immediately; delayed telemetry cannot repeat it.
            if (!enabled() || !season() || state.doors.indexOf(index) >= 0) return true;
            try {
                var timer;
                var result;
                try {
                    result = await Promise.race([knock(index), new Promise(function (_, reject) { timer = setTimeout(function () { reject(new Error('knock timeout')); }, 12000); })]);
                } finally { if (timer) clearTimeout(timer); }
                if (result && result.failed) throw result;
                if (!result || result.success !== true || result.door !== index) throw new Error('No server confirmation');
                p.doors.push(index); save();
                retryAt = Date.now() + 1500;
                note('door ' + (index + 1) + '/' + doors.length + (result && result.trick ? ': ' + result.trick : ': collected'));
                // A Ghost result alone does not end the circuit. The normal
                // threat check retreats only if a monster actually targets us.
            } catch (error) {
                var why = reason(error);
                if (why === 'trickortreat_knocked') p.doors.push(index);
                else if (why === 'trickortreat_limit') p.limited = true;
                retryAt = Date.now() + (why === 'trickortreat_knocked' ? 1500 : 60000);
                save(); note(why);
                if (p.limited || why === 'trickortreat_season') await home();
            }
            return true;
        } finally { busy = false; }
    }
    async function runRoute() {
        if (routeRunning) return false;
        routeRunning = true;
        var previousChores = chores_in_progress, handled = false;
        chores_in_progress = true;
        try {
            // Keep navigation ownership across every door and its cooldown.
            // Releasing it between ticks lets stand/restock loops pull us home.
            while (await tick()) {
                handled = true;
                await sleep(500);
            }
            return handled;
        } finally { chores_in_progress = previousChores; routeRunning = false; }
    }
    return { tick: tick, runRoute: runRoute, blocked: otherWork, threatened: threatened, snapshot: function () { var p = progress(); return { day: p.day, doors: p.doors.slice(), limited: p.limited, returning: returnHome, message: message }; } };
})();
