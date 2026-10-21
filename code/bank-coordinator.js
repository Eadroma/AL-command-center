/** Bank hub v1: one visit owner, stock observations and durable stand allocations.
 * Production adapters are migrated separately; legacy storage stays compatible.
 */
var BankStock = (function () {
  var rows = null, observed = [], observedAt = 0, durable = true;
  var key = 'alcc:listing-bank-stock:' + character.name;
  function reservations() {
    if (rows) return rows;
    try { rows = get(key) || {}; } catch (e) { rows = {}; durable = false; }
    return rows;
  }
  function save(value) {
    rows = value;
    try { set(key, rows); durable = true; } catch (e) { durable = false; }
  }
  function observe() {
    if (!character.map || character.map.indexOf('bank') !== 0 || !character.bank) return false;
    var next = [];
    Object.keys(character.bank).sort().forEach(function (pack) {
      if (!/^items\d+$/.test(pack) || !Array.isArray(character.bank[pack])) return;
      character.bank[pack].forEach(function (it, slot) {
        if (!it) return;
        next.push({ pack: pack, slot: slot, item: it.name, level: it.level || 0,
          quantity: it.q || 1, eligible: !it.l && !it.b && (!it.oo || it.oo === character.name) });
      });
    });
    observed = next; observedAt = Date.now(); return true;
  }
  function snapshot() {
    var totals = {}, rules = typeof cc_listings === 'function' ? cc_listings() : [];
    observed.forEach(function (it) {
      var k = it.item + ':' + it.level;
      if (!totals[k]) totals[k] = { item: it.item, level: it.level, quantity: 0, eligible: 0, minimum: 0, availableForStand: 0 };
      totals[k].quantity += it.quantity;
      if (it.eligible) totals[k].eligible += it.quantity;
    });
    rules.forEach(function (r) {
      var row = totals[r.item + ':' + (r.level || 0)];
      if (row) row.minimum = Math.max(row.minimum, r.bankReserve || 0);
    });
    Object.keys(totals).forEach(function (k) {
      var row = totals[k];
      var configured = rules.some(function(r){return r.item===row.item&&(r.level||0)===row.level;});
      row.availableForStand = configured ? Math.max(0, row.eligible - row.minimum) : 0;
    });
    return { observedAt: observedAt, current: !!observedAt && !!character.map && character.map.indexOf('bank') === 0,
      durable: durable, stock: Object.keys(totals).slice(0, 200).map(function (k) { return totals[k]; }),
      reservations: Object.keys(reservations()).slice(0, 100).map(function (k) { return { stock: k, purpose: 'stand' }; }) };
  }
  return { reservations: reservations, save: save, observe: observe, snapshot: snapshot };
})();

var BankCoordinator = (function () {
  var owner = '', phase = 'idle', since = 0, visits = 0, countedVisit = false, journal = [], current = null, persistenceError = false;
  var key = 'alcc:bank-hub:' + character.name;
  try {
    var saved = get(key);
    if (saved && Array.isArray(saved.journal)) journal = saved.journal.slice(-50);
    if (saved && saved.current) { journal.push(Object.assign({},saved.current,{state:'review',evidence:'Legacy evidence hold removed; outcome unverified'}));journal=journal.slice(-50); }
  } catch (e) { persistenceError = true; }
  function persist() {
    try { set(key, { version: 1, journal: journal.slice(-50), current: current }); persistenceError = false; }
    catch (e) { persistenceError = true; }
  }
  function acquire(name) {
    if (current || owner && owner !== name) return false;
    if (!owner) { owner = name; since = Date.now(); countedVisit = false; phase = 'travel'; }
    return true;
  }
  function stage(value) { if (owner) { phase = value; if(value==='bank'&&!countedVisit){visits++;countedVisit=true;} } }
  function release(name) {
    if (owner !== name) return false;
    owner = ''; phase = 'idle'; return true;
  }
  function releaseNavigation(name) {
    if (owner === name && current && current.state === 'review') { owner = ''; phase = 'review'; return true; }
    return release(name);
  }
  function begin(kind, item, level, quantity, pack) {
    if (current) return false;
    current = { kind: kind, item: item, level: level || 0, quantity: quantity || 1,
      pack: pack, at: Date.now(), state: 'pending', before: counts(item, level || 0) };
    persist(); return true;
  }
  function finish(confirmed, evidence) {
    if (!current) return;
    current.state = confirmed ? 'confirmed' : 'review'; current.evidence = evidence;
    journal.push(Object.assign({}, current)); journal = journal.slice(-50);
    current = null;
    persist(); BankStock.observe();
  }
  function counts(item, level) {
    var carried = 0, bank = 0;
    (character.items || []).forEach(function (it) { if(it && it.name === item && (it.level || 0) === level)carried += it.q || 1; });
    Object.keys(character.bank || {}).forEach(function (pack) {
      if(!/^items\d+$/.test(pack) || !Array.isArray(character.bank[pack]))return;
      character.bank[pack].forEach(function (it) { if(it && it.name === item && (it.level || 0) === level)bank += it.q || 1; });
    });
    return { carried: carried, bank: bank };
  }
  function inspectionEvidence() {
    var packs=Object.keys(character.bank||{}).filter(function(pack){return /^items\d+$/.test(pack)&&Array.isArray(character.bank[pack]);}).sort(function(a,b){return Number(a.slice(5))-Number(b.slice(5));});
    var levels={};
    if(current) packs.forEach(function(pack){character.bank[pack].forEach(function(it){if(it&&it.name===current.item){var lv=it.level||0;levels[lv]=(levels[lv]||0)+(it.q||1);}});});
    var actual=current?counts(current.item,current.level):null;
    var direction=current&&current.kind==='deposit'?-1:1;
    return {packs:packs,levels:levels,actual:actual,expected:current&&current.before?{carried:current.before.carried+direction*current.quantity,bank:current.before.bank-direction*current.quantity}:null};
  }
  // Pieces withdrawn for a stand listing belong to that listing: no NPC sale, upgrade or compound.
  function reserved(it) { return typeof listing_bank_stock_reserved === 'function' && !!listing_bank_stock_reserved(it); }
  function dismissReview(item, level) {
    if(owner || !current || current.state!=='review' || current.item!==item || current.level!==level)return false;
    journal.push(Object.assign({},current,{evidence:'Review dismissed by user; outcome remains unverified'}));journal=journal.slice(-50);
    current=null;phase='idle';persist();
    if(typeof game_log==='function')game_log('Bank hub: review dismissed by user for '+item+' +'+level+'; bank operations unlocked');return true;
  }
  async function run(name, work) {
    if (current || owner && owner !== name && owner !== 'deposit') return false;
    var borrowed = owner === 'deposit';
    if (!borrowed && !acquire(name)) return false;
    try { return await work(); }
    finally { if (!borrowed) release(name); }
  }
  function snapshot() {
    BankStock.observe();
    return { version: 1, owner: owner, phase: phase, since: since, visits: visits,
      persistenceError: persistenceError, current: current, journal: journal.slice(-10), ledger: BankStock.snapshot() };
  }
  persist();
  return { acquire: acquire, stage: stage, release: release, releaseNavigation: releaseNavigation, begin: begin, finish: finish, run: run, inspectionEvidence: inspectionEvidence, reserved: reserved, dismissReview: dismissReview, snapshot: snapshot };
})();

