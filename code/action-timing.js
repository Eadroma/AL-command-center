/**
 * Ping-aware action timing shared by generated farming scripts.
 * Schedules against the game's authoritative cooldown and only applies a
 * conservative latency correction after a confirmed action.
 */
var ActionTiming = (function () {
  var MAX_COMPENSATION_MS = 180;
  var MIN_DELAY_MS = 20;

  function samples() {
    var values = [];
    try {
      if (typeof parent !== "undefined" && Array.isArray(parent.pings)) {
        for (var i = 0; i < parent.pings.length; i++) {
          var value = Number(parent.pings[i]);
          if (isFinite(value) && value >= 0) values.push(value);
        }
      }
      var current = Number(character && character.ping);
      if (isFinite(current) && current >= 0) values.push(current);
    } catch (e) {}
    return values;
  }

  function ping() {
    var values = samples();
    return values.length ? Math.min.apply(Math, values) : 0;
  }

  function cooldownMs(skill) {
    try {
      var next = parent && parent.next_skill && parent.next_skill[skill];
      if (!next) return 0;
      var at = typeof next.getTime === "function" ? next.getTime() : Number(next);
      return isFinite(at) ? Math.max(0, at - Date.now()) : 0;
    } catch (e) {
      return 0;
    }
  }

  function compensate(skill) {
    if (typeof reduce_cooldown !== "function") return 0;
    var amount = Math.min(MAX_COMPENSATION_MS, Math.max(0, ping() * 0.85));
    if (amount < 1) return 0;
    try {
      reduce_cooldown(skill, amount);
      return amount;
    } catch (e) {
      return 0;
    }
  }

  function next(skill, fallback, floor) {
    var minimum = Math.max(MIN_DELAY_MS, Number(floor) || MIN_DELAY_MS);
    var remaining = cooldownMs(skill);
    if (!remaining) return Math.max(minimum, Number(fallback) || minimum);
    return Math.max(minimum, remaining);
  }

  function after(skill, fallback, floor) {
    compensate(skill);
    return next(skill, fallback, floor);
  }

  function snapshot() {
    return { pingMs: ping(), maxCompensationMs: MAX_COMPENSATION_MS };
  }

  /** A missing game acknowledgement must not suspend the combat loop.
   * This bounds waiting only: it neither repeats nor confirms the action.
   * Late rejection is still consumed; server cooldowns remain authoritative. */
  function wait(action, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var settled = false;
      var timer = setTimeout(function () {
        settled = true;
        resolve({ confirmed: false, timedOut: true });
      }, timeoutMs);
      Promise.resolve(action).then(function (result) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(result);
      }, function (error) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  return { ping: ping, cooldownMs: cooldownMs, compensate: compensate, next: next, after: after, snapshot: snapshot, wait: wait };
})();
