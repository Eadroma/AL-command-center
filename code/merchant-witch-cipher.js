/** Current five-slot Witch's Cipher. Inventory-only, clue-constrained brewing;
 * never joins the obsolete event flow or buys ingredients. */
var MerchantWitchCipher = (function () {
    var busy = false, retryAt = 0, returning = false, journal = null, lastMessage = '';
    var storageKey = 'alcc:witchcipher:' + character.name;
    function progress() {
        var day = new Date().toISOString().slice(0, 10);
        if (!journal || journal.day !== day) {
            try { journal = typeof get === 'function' ? get(storageKey) : null; } catch (e) {}
            if (!journal || journal.day !== day) journal = { day: day, spent: 0, attempts: {} };
        }
        return journal;
    }
    function save() { try { if (typeof set === 'function') set(storageKey, journal); } catch (e) {} }
    function note(text) { if (lastMessage !== text) { lastMessage = text; if (typeof game_log === 'function') game_log('Witch Cipher: ' + text, '#AF6AE2'); } }
    function live() {
        var table = typeof server !== 'undefined' && server.status || typeof parent !== 'undefined' && parent.S || {};
        var value = table.witchcipher;
        return value && value.live === true && (!value.end || new Date(value.end).getTime() > Date.now()) ? value : null;
    }
    function boardKey(cipher) { return String(cipher.id) + ':' + String(cipher.cracks || 0) + ':' + JSON.stringify(cipher.board); }
    function score(a, b) { var n = 0; for (var i = 0; i < a.length; i++) if (a[i] === b[i]) n++; return n; }
    function nextMix(cipher) {
        var rules = typeof G !== 'undefined' && G.events && G.events.witchcipher;
        if (!rules || rules.slots !== 5 || !Array.isArray(rules.ingredients) || !cipher || !Array.isArray(cipher.board)) return null;
        var names = rules.ingredients.map(function (r) { return r[0]; });
        if (names.length !== 4 || names.some(function (name) { return typeof name !== 'string'; })) return null;
        if (cipher.board.some(function (c) { return !c || !Array.isArray(c.mix) || c.mix.length !== 5 || !Number.isInteger(c.right) || c.right < 0 || c.right > 5 || c.mix.some(function (name) { return names.indexOf(name) < 0; }); })) return null;
        var stock = {};
        (character.items || []).forEach(function (item) { if (item && !item.l && !item.b) stock[item.name] = (stock[item.name] || 0) + (item.q || 1); });
        if (progress().awaitBoard === boardKey(cipher)) return null;
        var tried = progress().attempts[boardKey(cipher)] || [];
        for (var n = 0; n < 1024; n++) {
            var mix = [], counts = {};
            for (var i = 0, k = n; i < 5; i++, k = Math.floor(k / 4)) { var name = names[k % 4]; mix.push(name); counts[name] = (counts[name] || 0) + 1; }
            if (Object.keys(counts).some(function (name) { return counts[name] > (stock[name] || 0); }) || tried.indexOf(mix.join(',')) >= 0) continue;
            if (cipher.board.every(function (clue) { return clue.mix.join(',') !== mix.join(',') && score(mix, clue.mix) === clue.right; })) return mix;
        }
        return null;
    }
    function remoteAccess() { return !!(character.computer || character.supercomputer || (character.items || []).some(function (it) { return it && (it.name === 'computer' || it.name === 'supercomputer'); })); }
    async function home() {
        if (!returning) return false;
        var spot = cc_stand_spot();
        if (character.map === spot.map && Math.hypot(character.x - spot.x, character.y - spot.y) <= 45) { returning = false; return false; }
        await walk_to(spot, 'Witch Cipher: return to stand');
        return true;
    }
    async function bounded(value) {
        var timer;
        try { return await Promise.race([value, new Promise(function (_, reject) { timer = setTimeout(function () { reject(new Error('request timeout')); }, 12000); })]); }
        finally { if (timer) clearTimeout(timer); }
    }
    async function tick() {
        if (busy || character.ctype !== 'merchant' || character.rip || character.cave || String(character.map).indexOf('zone_') === 0 || MerchantHalloween.blocked()) return false;
        busy = true;
        try {
            var p = progress(), cipher = live();
            if (!__ALCC.witchCipher || !__ALCC.witchCipher.enabled || !cipher || p.spent >= 5) return await home();
            if (Date.now() < retryAt) return false;
            if (typeof brew !== 'function' || typeof witch_cipher_info !== 'function' || MerchantHalloween.threatened() || character.hp < character.max_hp * .7 || character.esize < 1) return await home();
            if (character.witchcipher && (character.witchcipher.mixes_left <= 0 || character.witchcipher.server)) return await home();
            var mix = nextMix(cipher);
            if (!mix) { note('waiting for unlocked ingredients or a new clue board'); return await home(); }
            if (!remoteAccess()) {
                var witch = G.quests && G.quests.witch;
                if (!witch || !witch.map || !Number.isFinite(witch.x) || !Number.isFinite(witch.y)) return false;
                returning = true;
                if (character.map !== witch.map || Math.hypot(character.x - witch.x, character.y - witch.y) > 45) { await walk_to(witch, 'Witch Cipher: cauldron'); return true; }
            }
            // Reconcile account-wide quota before each spend, including after a reload.
            var info = await bounded(witch_cipher_info());
            if (!info || !info.live || !(info.mixes_left > 0)) { retryAt = Date.now() + 60000; return await home(); }
            cipher = live(); mix = nextMix(cipher);
            if (!cipher || !mix || !__ALCC.witchCipher.enabled) return await home();
            var key = boardKey(cipher);
            (p.attempts[key] || (p.attempts[key] = [])).push(mix.join(',')); p.spent++; p.awaitBoard = key; save();
            // Reserve before sending: an uncertain network response must never cause
            // this exact spend to be replayed after reloading the script.
            var result = await bounded(brew(mix));
            if (!result || result.failed || result.success !== true) throw result || new Error('No server confirmation');
            retryAt = Date.now() + 5000;
            note((result.cracked ? 'recipe cracked; ' : '') + result.parcels + ' Parcels, ' + result.mixes_left + ' mixes left');
            if (result.mixes_left <= 0) return await home();
            return true;
        } catch (error) {
            retryAt = Date.now() + 60000;
            note(String(error && (error.reason || error.message) || 'request failed'));
            return returning ? await home() : false;
        } finally { busy = false; }
    }
    return { tick: tick, nextMix: nextMix, snapshot: function () { return { spent: progress().spent, message: lastMessage }; } };
})();
