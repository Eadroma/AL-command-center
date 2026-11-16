var slots = character.slots || {};
 for (var i = 1; i <= (typeof merchant_trade_capacity==='function'?merchant_trade_capacity():16); i++) {
  var it = slots["trade" + i];
  if (!it || it.b) continue;
  if (__ALCC.standEnabled && __ALCC.listings && __ALCC.listings.some(function(rule){return rule.item===it.name && rule.level===(it.level||0);})) continue;
  if (is_heavy_piece(it.name) || is_junk_wanderer(it.name) || it.name === "feather0" || it.name === "wingedboots" || it.name === CONFIG.TOKEN) return "trade" + i;
 }
 return null;