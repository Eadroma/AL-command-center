import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { transform } from "esbuild";
import { ast, sourceDir, scripts } from "./scripts";
import { bossChecksDefaults } from "../shared/schema";
import type { Profile, Character, ScriptInfo } from "../shared/schema";
import { automationDefaults } from '../shared/automation';
const managed = new Set([
  "NAME",
  "PARTNER",
  "WARRIOR",
  "PRIEST",
  "MAGE",
  "RANGER",
  "MERCHANT",
  "PARTY",
  "FARMERS",
  "TEAM_SLOTS",
  "TEAM_SUPERVISOR_ENABLED",
  "HOME",
  "PONTY_HOME",
  "DEFAULT_FARM",
  "GABRIEL_SELL",
  "EXCHANGE_ITEMS",
  "EXCHANGE_MIN",
  "UPGRADE_MAX",
  "UPGRADE_GOLD_MIN",
  "PONTY_ITEMS",
  "PONTY_GOLD_KEEP",
]);
export const isManaged = (key: string) => managed.has(key);
function checkShape(base: unknown, value: unknown, key: string) {
  if (base === null) {
    if (
      value !== null &&
      typeof value !== "number" &&
      typeof value !== "string"
    )
      throw Error(`Invalid ${key}`);
    return;
  }
  if (Array.isArray(base)) {
    if (!Array.isArray(value)) throw Error(`${key} must be an array.`);
    if (base.length)
      for (const entry of value) checkShape(base[0], entry, key + "[]");
    return;
  }
  if (typeof base !== typeof value)
    throw Error(`${key} must be ${typeof base}.`);
  if (
    typeof base === "number" &&
    (!Number.isFinite(value) || Number(value) < 0)
  )
    throw Error(`${key} must be a non-negative number.`);
  if (typeof base === "object") {
    if (!value || Array.isArray(value))
      throw Error(`${key} must be an object.`);
    for (const [k, v] of Object.entries(value as object)) {
      if (["__proto__", "constructor", "prototype"].includes(k))
        throw Error(`Invalid setting key ${k}`);
      if (k in (base as object)) checkShape((base as any)[k], v, `${key}.${k}`);
    }
  }
  if (typeof value === "number" && key.includes("RATIO") && value > 1)
    throw Error(`${key} must be between 0 and 1.`);
}
export function validateProfile(p: Profile, list = scripts()) {
  for (const c of p.characters) {
    const s = list.find((s) => s.id === c.script);
    if (!s) throw Error(`Missing script: ${c.script}`);
    if (s.ctype !== c.ctype && s.id !== "stand-sell")
      throw Error(`${s.label} is not compatible with ${c.name}.`);
    if (s.kind === "crypt" && c.job !== "hunt")
      throw Error("Crypt scripts do not support upgrade/combine jobs.");
    for (const [k, v] of Object.entries(c.overrides)) {
      if (!(k in s.config))
        throw Error(`Unknown setting ${k} in ${s.filename}.`);
      if (s.id !== "stand-sell" && managed.has(k))
        throw Error(`${k} is managed by the party controls.`);
      checkShape(s.config[k], v, k);
    }
  }
  /** Dashboard upgrade list is the allowlist; catalog must mark the item upgradeable. */
  // Same lookup as deploymentsPayload so build errors match the dashboard preview.
  const merchant =
    list.find((s) => s.id === "eadrosell-merchant-v2") ||
    list.find((s) => s.id.startsWith("eadrosell-merchant"));
  const catalog = JSON.parse(
    fs.readFileSync(
      path.resolve(import.meta.dirname, "../public/assets/catalog.json"),
      "utf8",
    ),
  );
  const supportedUpgrade = new Set(
    catalog.items.filter((i: any) => i.upgrade).map((i: any) => i.id),
  );
  const automation = p.automation || automationDefaults;
  const needsPolicy = automation.dangers.enabled || automation.lootGoals.some(g => g.enabled) || automation.combatGear.some(g => g.enabled);
  for (const character of p.characters.filter(c => c.enabled && c.ctype !== 'merchant')) {
    if (needsPolicy && !character.script.endsWith('-v2')) throw Error(`Automation requires a v2 farmer script for ${character.name}.`);
  }
  const seller = p.characters.find(c => c.enabled && c.ctype === 'merchant');
  if (automation.commercialGoals.some(g => g.enabled) && seller?.script !== 'eadrosell-merchant-v2') throw Error('Commercial objectives require an enabled v2 merchant.');
  for (const goal of automation.commercialGoals.filter(g => g.enabled)) {
    if (!catalog.recipes?.[goal.item]) throw Error(`No craft recipe for ${goal.item}.`);
    if (p.seller.exchange.enabled && p.seller.exchange.items.includes(goal.item) || p.seller.upgrade.enabled && p.seller.upgrade.rules.some(r => r.item === goal.item) || p.seller.standEnabled && p.seller.listings.some(r => r.item === goal.item && r.level === 0) || p.seller.bankDeposit.enabled && p.seller.bankDeposit.items.includes(goal.item)) throw Error(`Commercial goal ${goal.item} conflicts with exchange, upgrade, listing or deposit rules. Keep production outputs until completion.`);
  }
  for (const rule of p.seller.upgrade.rules) {
    if (!supportedUpgrade.has(rule.item))
      throw Error(
        `${rule.item} cannot be upgraded (not an upgradeable item type).`,
      );
  }
  for (const rule of p.seller.compound?.rules || []) {
    if (!catalog.items.some((item: any) => item.id === rule.item && item.compound)) throw Error(`${rule.item} cannot be compounded.`);
  }
  const policy = merchantPolicy(p, merchant);
  if (policy.errors.length) throw Error(policy.errors[0]);
}
/**
 * Stand / exchange / upgrade / NPC intent must not fight each other or the
 * merchant's keep/unlist paths. Hard errors block build; warnings travel with the bundle.
 */
export function merchantPolicy(p: Profile, merchant?: ScriptInfo | null) {
  const warnings: string[] = [],
    errors: string[] = [];
  if (!merchant || !merchant.id.startsWith("eadrosell-merchant"))
    return { warnings, errors };
  // PONTY_ITEMS is builder-managed: the bundle receives the profile list, not the script default.
  const pontyItems = new Set(p.seller.ponty?.enabled ? p.seller.ponty.items : []);
  const exchange = p.seller.exchange.enabled
    ? new Set(p.seller.exchange.items)
    : new Set<string>();
  const upgrade = p.seller.upgrade.enabled
    ? new Set(p.seller.upgrade.rules.map((r) => r.item))
    : new Set<string>();
  const buy = new Set(
    (p.seller.buy.enabled ? p.seller.buy.orders : []).map(
      (o) => `${o.item}:${o.level}`,
    ),
  );
  if (p.seller.standEnabled)
    for (const rule of p.seller.listings) {
      const key = `${rule.item}:${rule.level}`;
      if (exchange.has(rule.item))
        errors.push(
          `${rule.item} cannot be both exchanged at Xyn and listed on the player stand.`,
        );
      if (p.seller.upgrade.enabled && p.seller.upgrade.rules.some(target => target.item === rule.item && rule.level < target.maxLevel))
        errors.push(
          `${rule.item} +${rule.level} is below its upgrade target; list it at the target level or above.`,
        );
      if (buy.has(key))
        errors.push(
          `${rule.item} +${rule.level} cannot be both a stand buy order and a sell listing.`,
        );
      if (pontyItems.has(rule.item))
        warnings.push(
          `${rule.item} is also in PONTY_ITEMS — Ponty tours may still buy more of it.`,
        );
    }
  if (p.seller.npcEnabled)
    for (const item of p.seller.npcItems) {
      if (exchange.has(item))
        warnings.push(
          `${item} is on both Gabriel and Xyn lists — exchange wins; NPC sales skip it.`,
        );
      if (upgrade.has(item))
        warnings.push(
          `${item} is on both Gabriel and upgrade lists — upgrade wins; NPC sales skip it.`,
        );
      if (
        p.seller.standEnabled &&
        p.seller.listings.some((r) => r.item === item)
      )
        warnings.push(
          `${item} is reserved for the stand — NPC sales will skip matching levels.`,
        );
    }
  const pontyRules = p.seller.ponty || { enabled: true, items: [] };
  if (pontyRules.enabled)
    for (const item of pontyRules.items) {
      if (
        p.seller.standEnabled &&
        p.seller.listings.some((r) => r.item === item)
      )
        warnings.push(
          `${item} is bought from Ponty and also listed on the stand — intentional but watch stock.`,
        );
    }
  return { warnings, errors };
}
export function effectiveConfig(p: Profile, c: Character, s: ScriptInfo) {
  const result = { ...s.config, ...c.overrides };
  if (s.id === "stand-sell") return result;
  const active = p.characters.filter((x) => x.enabled),
    find = (type: string) => active.find((x) => x.ctype === type)?.name || "";
  const set = (k: string, v: unknown) => {
    if (k in result) result[k] = v;
  };
  set("NAME", c.name);
  if (c.follow) {
    set("PARTNER", c.follow);
    set("WARRIOR", c.follow);
    result.PARTNER = c.follow;
  } else {
    set("WARRIOR", find("warrior"));
    if ("PARTNER" in result) result.PARTNER = find("warrior");
  }
  set("PRIEST", find("priest"));
  set("MAGE", find("ranger") || find("mage"));
  set("RANGER", find("ranger"));
  set("MERCHANT", find("merchant"));
  if (c.ctype === 'rogue') set('merchantSpot', p.seller.standSpot);
  set(
    "PARTY",
    active
      .filter((x) => x.name !== c.name && x.ctype !== "merchant" && (!p.events.expedition?.enabled || (["warrior", "priest"].includes(c.ctype) && ["warrior", "priest"].includes(x.ctype))))
      .map((x) => x.name),
  );
  set(
    "FARMERS",
    active.filter((x) => x.ctype !== "merchant").map((x) => x.name),
  );
  /** Merchant supervisor starts only the selected enabled farmers. Empty selection means all. */
  const teamSlots: Record<string, string> = {};
  if (s.id.startsWith("eadrosell-merchant")) {
    const selected = p.seller.teamSupervisor.characters;
    for (const x of active) {
      if (x.name === c.name || x.ctype === "merchant" || (p.events.expedition.enabled && ["warrior", "priest"].includes(x.ctype))) continue;
      if (selected.length && !selected.includes(x.name)) continue;
      teamSlots[x.name] = "CC_" + x.name;
    }
    for (const [name, slot] of Object.entries(p.seller.teamSupervisor.standaloneSlots || {})) {
      if (name === c.name || (selected.length && !selected.includes(name))) continue;
      teamSlots[name] = slot;
    }
    set("FARMERS", [...new Set([...active.filter(x => x.ctype !== 'merchant').map(x => x.name), ...Object.keys(teamSlots)])]);
  }
  set("TEAM_SLOTS", teamSlots);
  set("TEAM_SUPERVISOR_ENABLED", p.seller.teamSupervisor.enabled);
  set("HOME", p.server);
  set("PONTY_HOME", p.server);
  /** Dedicated scripts may pin their own farm instead of following the shared board. */
  const fixedFarm = result.FIXED_FARM === true;
  const farmTarget = fixedFarm
    ? String(s.config.DEFAULT_FARM || result.DEFAULT_FARM || "")
    : c.farmMonster || p.farming.defaultMonster;
  set("DEFAULT_FARM", farmTarget);
  set("FARM_INDEPENDENT", fixedFarm || !!c.farmMonster);
  result.DEFAULT_FARM = farmTarget;
  result.FARM_INDEPENDENT = fixedFarm || !!c.farmMonster;
  // A fixed farming route only applies outside the daily cave. Every combat
  // member must receive the cave runner or the three-character roster can never enter.
  result.DAILY_DUNGEON = !!p.farming.dailyDungeon;
  result.RARE_VISITS = fixedFarm ? false : !!p.farming.rareVisits;
  if (result.hunts && typeof result.hunts === "object")
    result.hunts = { ...(result.hunts as Record<string, unknown>), enabled: fixedFarm ? false : !!p.farming.hunts };
  const packStyle: Record<string, string> = {
    ...(p.events.style || {}),
    ...(p.farming.style || {}),
  };
  const fillPack = (id: string) => {
    if (
      !id ||
      packStyle[id] === "aoe" ||
      packStyle[id] === "mono" ||
      packStyle[id] === "tank"
    )
      return;
    packStyle[id] = "aoe";
  };
  fillPack(farmTarget);
  const activityBuild = p.automation?.activeBuilds[c.name];
  if (activityBuild && activityBuild.monster !== '*') packStyle[activityBuild.monster] = activityBuild.style;
  result.PACK_STYLE = packStyle;
  const emptyLoad = { gear: [] as { slot: string; item: string; minLevel: number }[], skills: [] as string[] };
  const board = p.farming.loadouts?.[c.name];
  result.STYLE_LOADOUTS = {
    aoe: board?.aoe || emptyLoad,
    mono: board?.mono || emptyLoad,
    tank: board?.tank || emptyLoad,
    ...board,
  };
  set("GABRIEL_SELL", p.seller.npcEnabled ? p.seller.npcItems : []);
  set(
    "EXCHANGE_ITEMS",
    p.seller.exchange.enabled ? p.seller.exchange.items : [],
  );
  set("EXCHANGE_MIN", p.seller.exchange.minimum);
  // Legacy global ceiling for source helpers; should_upgrade uses per-item rules.
  // Force-assign even when the key was absent from the source CONFIG (e.g. merchant-v2).
  set(
    "UPGRADE_MAX",
    p.seller.upgrade.rules.reduce((m, r) => Math.max(m, r.maxLevel), 0),
  );
  if (c.ctype === "merchant") {
    result.UPGRADE_MAX = p.seller.upgrade.rules.reduce((m, r) => Math.max(m, r.maxLevel), 0);
    result.UPGRADE_GOLD_MIN = p.seller.upgrade.minGold ?? 0;
  }
  set("UPGRADE_GOLD_MIN", p.seller.upgrade.minGold ?? 0);
  const ponty = p.seller.ponty || { enabled: true, minGold: 200000, items: [] };
  set("PONTY_ITEMS", ponty.enabled ? ponty.items : []);
  set("PONTY_GOLD_KEEP", ponty.minGold ?? 200000);
  if (c.ctype === "merchant") {
    result.PONTY_ITEMS = ponty.enabled ? ponty.items : [];
    result.PONTY_GOLD_KEEP = ponty.minGold ?? 200000;
  }
  if (
    s.id.startsWith("eadroma-warrior") &&
    result.WEAPONS &&
    typeof result.WEAPONS === "object"
  ) {
    const weapons = structuredClone(result.WEAPONS) as {
      default?: string;
      pack?: Record<string, string>;
      [k: string]: unknown;
    };
    const pack = { ...(weapons.pack || {}) };
    const apply = (id: string, mode: string) => {
      const base = ["aoe", "mono", "tank"].includes(mode) ? mode : board?.[mode]?.base ?? 'aoe';
      pack[id] = base === "aoe" ? "lolipop" : "fireblade";
    };
    for (const [id, mode] of Object.entries(p.farming.style || {}))
      apply(id, mode);
    for (const [id, mode] of Object.entries(p.events.style || {}))
      apply(id, mode);
    if (activityBuild) {
      if (activityBuild.monster === '*') {
        for (const id of new Set([...Object.keys(pack), ...Object.keys(packStyle), farmTarget])) apply(id, activityBuild.style);
        const activityBase = ["aoe", "mono", "tank"].includes(activityBuild.style) ? activityBuild.style : board?.[activityBuild.style]?.base ?? 'aoe';
        weapons.default = activityBase === 'aoe' ? 'lolipop' : 'fireblade';
      } else apply(activityBuild.monster, activityBuild.style);
    }
    weapons.pack = pack;
    result.WEAPONS = weapons;
  }
  if (c.ctype !== "merchant") {
    const extras: string[] = [];
    const kit = p.seller.kit || { enabled: true, rules: [] };
    if (kit.enabled)
      for (const r of kit.rules)
        if (r.character === c.name) extras.push(r.item);
    const cons = p.seller.consumables || { enabled: true, rules: [] };
    if (cons.enabled)
      for (const r of cons.rules)
        if (r.character === c.name) extras.push(r.item);
    const gifts = p.seller.gifts || { enabled: true, rules: [] };
    if (gifts.enabled)
      for (const r of gifts.rules)
        if (r.character === c.name) extras.push(r.item);
    const loads = p.farming.loadouts?.[c.name];
    const loadoutItems: { item: string; minLevel: number }[] = [];
    // Combat/travel gear uses the same level-aware reservations as loadouts.
    for (const rule of p.automation?.combatGear ?? []) {
      if (!rule.enabled || rule.character !== c.name) continue;
      loadoutItems.push({ item: rule.combatItem, minLevel: rule.combatMinLevel });
      if (rule.movementItem) loadoutItems.push({ item: rule.movementItem, minLevel: rule.movementMinLevel });
    }
    if (loads)
      for (const style of Object.keys(loads))
        for (const g of loads[style]?.gear || []) {
          // Loadout reservations are level-aware; a name-only keep would also retain loot below the minimum.
          loadoutItems.push({ item: g.item, minLevel: g.minLevel || 0 });
        }
    if (loadoutItems.length)
      result.LOADOUT_ITEMS = loadoutItems.filter((entry, index, all) =>
        all.findIndex(other => other.item === entry.item && other.minLevel === entry.minLevel) === index,
      );
    if (extras.length)
      result.KEEP_ITEMS = [
        ...new Set([...(Array.isArray(result.KEEP_ITEMS) ? result.KEEP_ITEMS as string[] : []), ...extras]),
      ];
  }
  if (p.events.expedition?.enabled && ['warrior', 'priest'].includes(c.ctype)) {
    if (result.hunts && typeof result.hunts === 'object') result.hunts = { ...result.hunts as object, enabled: false };
    result.RARE_VISITS = false;
    result.DAILY_DUNGEON = false;
    result.PARTY_GUESTS = [];
  }
  return result;
}
export function adaptSource(
  source: string,
  p: Profile,
  c: Character,
  s: ScriptInfo,
) {
  const tree = ast(source),
    edits: { start: number; end: number; text: string }[] = [];
  const board = {
    leader: c.follow || c.name,
    monster: "auto",
    roles: Object.fromEntries(
      p.characters.map((x) => [x.name, x.follow ? "Follow" : "Leader"]),
    ),
    events: Object.fromEntries(
      p.characters.map((x) => [x.name, p.events.enabled && x.events]),
    ),
  };
  const bossChecks = p.farming.bossChecks || bossChecksDefaults;
  const replacements: Record<string, unknown> = {
    CONFIG: effectiveConfig(p, c, s),
    BOARD_CTL: board,
    HUNT_ALLOW: Object.fromEntries(p.farming.allowedHunts.map((x) => [x, 1])),
    BOSS_CHECKS: bossChecks.enabled ? bossChecks.rules : [],
  };
  const replaceFn = (node: any, body: string) =>
    edits.push({
      start: node.body.start,
      end: node.body.end,
      text: `{${body}}`,
    });
  for (const node of tree.body) {
    if (node.type === "VariableDeclaration")
      for (const d of node.declarations)
        if (d.id.name in replacements && d.init)
          edits.push({
            start: d.init.start,
            end: d.init.end,
            text: JSON.stringify(replacements[d.id.name]),
          });
    if (node.type !== "FunctionDeclaration") continue;
    const name = node.id.name;
    if (c.ctype !== 'merchant' && s.id.endsWith('-v2') && (name === 'movementLoop' || name === 'huntLoop' && p.farming.hunts)) {
      edits.push({ start: node.body.start + 1, end: node.body.start + 1, text: `\nif(typeof RuntimePolicy!=='undefined'&&!RuntimePolicy.allowLoop(${JSON.stringify(name)})){setTimeout(${name},250);return;}\n` });
    }
    if (name === "live_control")
      replaceFn(node, `return ${JSON.stringify(board)};`);
    // Generated bundles never poll the old control board. The merchant owns team startup.
    else if (["poll_board", "apply_ctl"].includes(name))
      replaceFn(node, "return;");
    else if (name === "maybe_start_team") {
      if (!s.id.startsWith("eadrosell-merchant")) replaceFn(node, "return false;");
    } else if (name === "events_enabled")
      replaceFn(node, `return ${p.events.enabled && c.events};`);
    // pick_live_event filters allowed events itself through __ALCC (see the farm scripts).
    else if (
      !p.farming.hunts &&
      [
        "maybe_daisy",
        "daisy_need",
        "daisy_need_own",
        "daisy_need_ally",
        "own_hunt_usable",
        "hunt_should_try",
        "huntLoop",
      ].includes(name)
    )
      replaceFn(node, "return false;");
    else if (!p.farming.hunts && name === "pick_party_hunt")
      replaceFn(node, "return null;");
    else if (!p.farming.rareVisits && name === "nearby_phoenix")
      replaceFn(node, "return null;");
    // Recurring boss farming owns the scheduled camp walks; no rules means no walks.
    else if (
      !(bossChecks.enabled && bossChecks.rules.length) &&
      ["scheduled_boss_farm", "live_boss_check"].includes(name)
    )
      replaceFn(node, "return null;");
    else if (
      c.ctype === "merchant" &&
      s.id.startsWith("eadrosell-merchant") &&
      name === "maybe_keep_shop"
    ) {
      replaceFn(node, merchantStandBody);
    } else if (
      c.ctype === "merchant" &&
      s.id.startsWith("eadrosell-merchant") &&
      name === "maybe_dashboard_kit"
    ) {
      replaceFn(node, merchantKitBody);
    } else if (
      c.ctype === "merchant" &&
      s.id.startsWith("eadrosell-merchant") &&
      name === "maybe_dashboard_consumables"
    ) {
      replaceFn(node, merchantConsumablesBody);
    } else if (
      c.ctype === "merchant" &&
      s.id.startsWith("eadrosell-merchant") &&
      name === "maybe_dashboard_gifts"
    ) {
      replaceFn(node, merchantGiftsBody);
    } else if (
      c.ctype === "merchant" &&
      s.id.startsWith("eadrosell-merchant") &&
      name === "maybe_ponty_tour" &&
      !(
        p.seller.ponty?.enabled !== false &&
        (p.seller.ponty?.items || []).length
      )
    ) {
      replaceFn(node, "return false;");
    } else if (
      c.ctype === "merchant" &&
      s.id.startsWith("eadrosell-merchant") &&
      name === "locate_listed_keep"
    ) {
      /** Dashboard stand allowlist owns these slots — never unlist into a list/unlist fight. */
      replaceFn(
        node,
        `var slots = character.slots || {};
 for (var i = 1; i <= (typeof merchant_trade_capacity==='function'?merchant_trade_capacity():16); i++) {
  var it = slots["trade" + i];
  if (!it || it.b) continue;
  if (__ALCC.standEnabled && __ALCC.listings && __ALCC.listings.some(function(rule){return rule.item===it.name && rule.level===(it.level||0);})) continue;
  if (is_heavy_piece(it.name) || is_junk_wanderer(it.name) || it.name === "feather0" || it.name === "wingedboots" || it.name === CONFIG.TOKEN) return "trade" + i;
 }
 return null;`,
      );
    } else if (
      c.ctype === "merchant" &&
      s.id.startsWith("eadrosell-merchant") &&
      name === "should_sell"
    ) {
      // Dashboard NPC list is the only allowlist — ignore source NEVER_SELL / junk overrides.
      replaceFn(
        node,
        `if(!it || it.l || it.b) return false; if(typeof UpgradeProduction!=='undefined'&&UpgradeProduction.reserved&&UpgradeProduction.reserved(it.name)) return false; if(typeof upgrade_supply_reserved==='function'&&upgrade_supply_reserved(it.name)) return false; if(typeof upgrade_target_complete==='function'&&upgrade_target_complete(it)) return false; if(it.oo && it.oo!==character.name) return false; if(!__ALCC.npcEnabled || CONFIG.GABRIEL_SELL.indexOf(it.name)<0) return false; if (__ALCC.buy && __ALCC.buy.enabled && __ALCC.buy.orders.some(function(rule){return rule.item===it.name && rule.level===(it.level||0);})) return false; if (__ALCC.exchange.enabled && __ALCC.exchange.items.indexOf(it.name)>=0) return false; if (__ALCC.upgrade.enabled && __ALCC.upgrade.rules && __ALCC.upgrade.rules.some(function(rule){return rule.item===it.name&&(it.level||0)<rule.maxLevel;})) return false; if (__ALCC.craft && __ALCC.craft.enabled && typeof craft_item_reserved==='function' && craft_item_reserved(it.name)) return false; if (__ALCC.standEnabled && __ALCC.listings.some(function(rule){return rule.item===it.name && rule.level===(it.level||0);})) return false; if (__ALCC.kit && __ALCC.kit.enabled && __ALCC.kit.rules && __ALCC.kit.rules.some(function(rule){return rule.item===it.name;})) return false; if (__ALCC.consumables && __ALCC.consumables.enabled && __ALCC.consumables.rules && __ALCC.consumables.rules.some(function(rule){return rule.item===it.name;})) return false; if (__ALCC.gifts && __ALCC.gifts.enabled && __ALCC.gifts.rules && __ALCC.gifts.rules.some(function(rule){return rule.item===it.name;})) return false; return true;`,
      );
    } else if (
      (s.id.startsWith("eadroma-warrior") ||
        s.id.startsWith("aedroma-priest") ||
        s.id.startsWith("droma-ranger") ||
        s.id === "tonerre-mage") &&
      name === "maybe_ensure_gear"
    ) {
      const body = source.slice(node.body.start + 1, node.body.end - 1);
      replaceFn(
        node,
        `${body}
 await wear_dashboard_kit();
 await use_dashboard_consumables();`,
      );
    } else if (
      (s.id.startsWith("aedroma-priest") ||
        s.id.startsWith("droma-ranger") ||
        s.id === "tonerre-mage") &&
      name === "ensure_gear"
    ) {
      const body = source.slice(node.body.start + 1, node.body.end - 1);
      replaceFn(
        node,
        `await wear_dashboard_kit();await use_dashboard_consumables();${body}`,
      );
    } else if (
      c.ctype === "merchant" &&
      s.id.startsWith("eadrosell-merchant") &&
      name === "should_upgrade"
    ) {
      replaceFn(
        node,
        `if(!it || it.l || it.b || !__ALCC.upgrade.enabled || !__ALCC.upgrade.rules) return false; var need=__ALCC.upgrade.minGold; if(need==null) need=(CONFIG&&CONFIG.UPGRADE_GOLD_MIN)||0; if(character.gold < need) return false; var rule=null; for(var r=0;r<__ALCC.upgrade.rules.length;r++){if(__ALCC.upgrade.rules[r].item===it.name){rule=__ALCC.upgrade.rules[r];break;}} if(!rule || rule.paused) return false; return !!(G.items[it.name] && G.items[it.name].upgrade) && (it.level||0)<rule.maxLevel && (typeof upgrade_attempt_allowed==='function' ? upgrade_attempt_allowed(it) : typeof item_grade==='function' && item_grade(it)<=2);`,
      );
    }
  }
  for (const edit of edits.sort((a, b) => b.start - a.start))
    source = source.slice(0, edit.start) + edit.text + source.slice(edit.end);
  const kit = p.seller.kit || { enabled: true, rules: [] };
  const consumables = p.automation?.activeConsumables.length ? { ...p.seller.consumables, rules: p.seller.consumables.rules.filter(rule => p.automation.activeConsumables.includes(rule.item)) } : p.seller.consumables || { enabled: true, rules: [] };
  const gifts = p.seller.gifts || { enabled: true, rules: [] };
  const metadata = {
    character: c.name,
    script: c.script,
    runtime: c.runtime,
    events: p.events.allowed,
    eventsEnabledMaster: p.events.enabled,
    eventsEnabled: p.events.enabled && (p.events.expedition?.enabled ? ['warrior', 'priest'].includes(c.ctype) : c.events),
    eventExpedition: { ...p.events.expedition, merchant: p.characters.find(x => x.enabled && x.ctype === 'merchant')?.name || '', warrior: p.characters.find(x => x.enabled && x.ctype === 'warrior')?.name || '', priest: p.characters.find(x => x.enabled && x.ctype === 'priest')?.name || '' },
    dailyDungeon: !!p.farming.dailyDungeon,
    profile: p.name,
    homeServer: p.server,
    sourceHash: s.hash,
    buy: p.seller.buy,
    standEnabled: p.seller.standEnabled,
    trickOrTreat: p.seller.trickOrTreat || { enabled: false },
    witchCipher: p.seller.witchCipher || { enabled: false },
    listings: p.seller.listings,
    standSpot: p.seller.standSpot,
    npcEnabled: p.seller.npcEnabled,
    exchange: p.seller.exchange,
    upgrade: p.seller.upgrade,
    compound: p.seller.compound || { enabled: false, checkBankOnDeposit: false, rules: [] },
    craft: p.seller.craft,
    workOrder: p.seller.workOrder,
    ponty: p.seller.ponty || { enabled: true, items: [] },
    kit,
    consumables,
    gifts,
    bankDeposit: p.seller.bankDeposit,
    automation: p.automation || automationDefaults,
    farmers: p.characters.filter(character => character.enabled && character.ctype !== 'merchant').map(character => character.name),
    priests: p.characters.filter(character => character.enabled && character.ctype === 'priest').map(character => character.name),
  };
  const merchantTransactionsPath = path.join(sourceDir, "merchant-transactions.js");
  const merchantTransactionsPrelude = c.ctype === "merchant" && fs.existsSync(merchantTransactionsPath)
    ? `\n${fs.readFileSync(merchantTransactionsPath, "utf8")}\n`
    : "";
  const expeditionRuntime = (c.ctype === 'merchant' && s.id.endsWith('-v2') ? fs.readFileSync(path.join(sourceDir, 'merchant-halloween.js'), 'utf8') + '\n' + fs.readFileSync(path.join(sourceDir, 'merchant-witch-cipher.js'), 'utf8') + '\n' : '') + (s.id.endsWith("-v2") ? fs.readFileSync(path.join(sourceDir, "event-expedition.js"), "utf8") + "\nEventExpedition.install();\n" : "");
  const policyRuntime = s.id.endsWith('-v2') ? fs.readFileSync(path.join(sourceDir, 'runtime-policy.js'), 'utf8') + '\nRuntimePolicy.install();\n' + (c.ctype !== 'merchant' ? fs.readFileSync(path.join(sourceDir, 'combat-gear.js'), 'utf8') + '\nCombatGear.install();\n' : '') : '';
  const prelude = `// Generated by Adventure Land Command Center. Original source is unchanged.\n// Publish/restart explicitly. Closing the dashboard does not stop this script.\nvar __ALCC = ${JSON.stringify(metadata)};\nvar SCRIPT_JOB = ${JSON.stringify(c.job)};\n${merchantTransactionsPrelude}${c.ctype === "merchant" && s.id.endsWith("-v2") ? fs.readFileSync(path.join(sourceDir, "bank-coordinator.js"), "utf8") + fs.readFileSync(path.join(sourceDir, "manual-bank-deposit.js"), "utf8") : ""}${c.ctype === "merchant" ? fs.readFileSync(path.join(sourceDir, "upgrade-production.js"), "utf8") + fs.readFileSync(path.join(sourceDir, "compound-production.js"), "utf8") : ""}${expeditionRuntime}${c.ctype === "merchant" ? fs.readFileSync(path.join(sourceDir, "merchant-mission-gui.js"), "utf8") + fs.readFileSync(path.join(sourceDir, "merchant-operations-gui.js"), "utf8") + fs.readFileSync(path.join(sourceDir, "merchant-party-gui.js"), "utf8") + fs.readFileSync(path.join(sourceDir, "merchant-target-gui.js"), "utf8") + fs.readFileSync(path.join(sourceDir, "merchant-events-gui.js"), "utf8") + fs.readFileSync(path.join(sourceDir, "merchant-enemies-gui.js"), "utf8") + fs.readFileSync(path.join(sourceDir, "merchant-combat-gui.js"), "utf8") + fs.readFileSync(path.join(sourceDir, "merchant-actions-gui.js"), "utf8") : ""}${policyRuntime}`;
  const farmWear = `\nasync function wear_dashboard_kit(){if(typeof __ALCC==='undefined'||!__ALCC.kit||!__ALCC.kit.enabled||!__ALCC.kit.rules)return;var me=character.name;for(var i=0;i<__ALCC.kit.rules.length;i++){var r=__ALCC.kit.rules[i];if(r.character!==me)continue;if(typeof StyleLoadout!=='undefined'&&StyleLoadout.wear)await StyleLoadout.wear(r);else if(typeof wear_slot==='function')await wear_slot(r.slot,[r.item]);}}\nfunction dashboard_elixir_rule(){if(typeof __ALCC==='undefined'||!__ALCC.consumables||!__ALCC.consumables.enabled||!__ALCC.consumables.rules)return null;var me=character.name;for(var i=0;i<__ALCC.consumables.rules.length;i++){var r=__ALCC.consumables.rules[i];if(r.character===me&&r.mode==='elixir'&&r.item)return r;}return null;}\nfunction dashboard_elixir_active(rule){if(!rule)return false;var eq=character.slots&&character.slots.elixir;if(eq&&eq.name===rule.item)return true;var st=character.s||{},effect=st[rule.item];if(effect)return true;var generic=st.elixir;if(generic&&((generic.name&&generic.name===rule.item)||(generic.f&&generic.f===rule.item)))return true;return false;}\nasync function use_dashboard_consumables(){var r=dashboard_elixir_rule();if(!r||dashboard_elixir_active(r))return;if(!use_dashboard_consumables._at)use_dashboard_consumables._at=0;if(Date.now()-use_dashboard_consumables._at<4000)return;var items=character.items||[],slot=-1;for(var j=0;j<items.length;j++){if(items[j]&&items[j].name===r.item&&!items[j].l){slot=j;break;}}if(slot<0)return;use_dashboard_consumables._at=Date.now();try{await consume(slot);game_log('dashboard elixir '+r.item);}catch(e){game_log('dashboard elixir: '+((e&&e.reason)||e));}}\n`;
  const cavePath = path.join(sourceDir, "cave-dreams.js");
  const eventPath = path.join(sourceDir, "event-router.js");
  const stylePath = path.join(sourceDir, "style-loadout.js");
  const timingPath = path.join(sourceDir, "action-timing.js");
  const dragoldPath = path.join(sourceDir, "dragold-intel.js");
  const worldEventPath = path.join(sourceDir, "world-event-intel.js");
  const bankSorterPath = path.join(sourceDir, "bank-sorter.js");
  const movementWatchdogPath = path.join(sourceDir, "movement-watchdog.js");
  const teamCoordinatorPath = path.join(sourceDir, "team-coordinator.js");
  const extraLibs =
    s.kind === "farm" && c.ctype !== "merchant"
      ? [
          fs.existsSync(timingPath) ? "\n" + fs.readFileSync(timingPath, "utf8") : "",
          fs.existsSync(eventPath) ? "\n" + fs.readFileSync(eventPath, "utf8") : "",
          fs.existsSync(stylePath) ? "\n" + fs.readFileSync(stylePath, "utf8") : "",
          fs.existsSync(cavePath) ? "\n" + fs.readFileSync(cavePath, "utf8") : "",
          fs.existsSync(worldEventPath) ? "\n" + fs.readFileSync(worldEventPath, "utf8") : "",
          fs.existsSync(teamCoordinatorPath) ? "\n" + fs.readFileSync(teamCoordinatorPath, "utf8") : "",
          c.ctype === "warrior" && fs.existsSync(dragoldPath) ? "\n" + fs.readFileSync(dragoldPath, "utf8") : "",
        ].join("")
      : "";
  const movementWatchdog =
    (s.kind === "farm" || c.ctype === "merchant") && fs.existsSync(movementWatchdogPath)
      ? "\n" + fs.readFileSync(path.join(sourceDir, "owned-navigation.js"), "utf8") + "\n" + fs.readFileSync(movementWatchdogPath, "utf8")
      : "";
  const epilogue =
    (c.ctype === "merchant"
      ? `\nif(__ALCC.standSpot){SHOP_XY.market={map:__ALCC.standSpot.map||'main',x:Number(__ALCC.standSpot.x)||0,y:Number(__ALCC.standSpot.y)||0};}\n${fs.existsSync(bankSorterPath) ? fs.readFileSync(bankSorterPath, "utf8") : ""}\n`
      : "") + (c.ctype !== "merchant" && s.kind === "farm" ? farmWear : "") + extraLibs + movementWatchdog;
  const policy = s.id.startsWith("eadrosell-merchant")
    ? merchantPolicy(p, s)
    : { warnings: [], errors: [] };
  if (policy.errors.length) throw Error(policy.errors[0]);
  const warnings = [
    "Generated only; not uploaded or started.",
    "Profile edits require rebuilding and restarting CODE.",
    ...policy.warnings,
  ];
  if (s.id.startsWith("eadrosell-merchant")) {
    const slots = (replacements.CONFIG as any)?.TEAM_SLOTS || {};
    const kids = Object.keys(slots);
    if (!p.seller.teamSupervisor.enabled)
      warnings.push("Merchant team auto-start is paused.");
    else if (kids.length)
      warnings.push(
        "Merchant will start_character " +
          kids.join(" + ") +
          " into their CC_* CODE slots when they are not already running.",
      );
    else
      warnings.push(
        "No farmer TEAM_SLOTS configured — enable farmers so the merchant can start them.",
      );
  }
  if (p.farming.dailyDungeon)
    warnings.push(
      "Cave of Many Dreams: party gathers at Dorr when the daily visit is available. One visit per account; a live world event still wins. Rebuild all three farmers.",
    );
  if (s.kind === "crypt")
    warnings.push(
      "Crypt retains its own target and route; global open-world farming/event controls do not apply.",
    );
  if (s.id === "stand-sell")
    warnings.push(
      "Stand-sell uses its own merchant/item settings; party seller rules do not apply.",
    );
  if (c.ctype === "merchant")
    warnings.push(
      "Stand rules apply when the merchant reaches its idle-shop phase. Restocking, safety and gathering keep their existing priority. Existing sell listings outside the allowlist are removed when there is bag space; configured buy orders use the last eight slots of the available stand. Dashboard listings are never auto-unlisted by keep-gear.",
    );
  if (kit.enabled && kit.rules.length)
    warnings.push(
      "Kit board: mule delivers matching bag/bank pieces; farmers equip on their gear tick.",
    );
  if (consumables.enabled && consumables.rules.length)
    warnings.push(
      "Consumables: mule tops farmers up from bag/bank; elixir mode auto-drinks on the farmer gear tick.",
    );
  if (gifts.enabled && gifts.rules.length)
    warnings.push(
      "Give & keep: mule hands matching bag items to farmers; those item names stay in KEEP_ITEMS so they are not dumped back.",
    );
  return {
    code: prelude + source + epilogue,
    warnings,
    config: replacements.CONFIG,
    policy,
  };
}

export const merchantKitBody = `
 var kit=__ALCC.kit; if(!kit||!kit.enabled||!kit.rules||!kit.rules.length) return false;
 for (var i=0;i<kit.rules.length;i++){
  var rule=kit.rules[i];
  var farmer=get_player(rule.character);
  if(!farmer||farmer.rip) continue;
  var worn=farmer.slots&&farmer.slots[rule.slot];
  if(worn&&worn.name===rule.item&&(worn.level||0)>=rule.minLevel&&(!rule.shiny||worn.shiny)) continue;
  var best=-1,bestLv=-1,bestShiny=false,items=character.items||[];
  for(var j=0;j<items.length;j++){
   var it=items[j]; if(!it||it.l||it.name!==rule.item) continue;
   if((it.level||0)<rule.minLevel) continue; if(rule.shiny&&!it.shiny) continue;
   var lv=it.level||0; if(lv>bestLv||(lv===bestLv&&it.shiny&&!bestShiny)){best=j;bestLv=lv;bestShiny=!!it.shiny;}
  }
  if(best<0){
   if(character.bank&&typeof each_bank_item==='function'&&character.esize>0){
    var found=null;
    each_bank_item(function(bit,pack,slot){
     if(!bit||bit.name!==rule.item) return;
     if((bit.level||0)<rule.minLevel) return; if(rule.shiny&&!bit.shiny) return;
     if(!found||(bit.level||0)>(found.it.level||0)||((bit.level||0)===(found.it.level||0)&&bit.shiny&&!found.it.shiny)) found={pack:pack,slot:slot,it:bit};
    });
    if(found){
     await ensure_stand_closed();
     if(character.map!=='bank'){act('kit bank pull');await go_to('bank','kit from bank');return true;}
     try{await bank_retrieve(found.pack,found.slot);game_log('kit bank '+rule.item+' for '+rule.character);return true;}catch(e){game_log('kit bank: '+((e&&e.reason)||e));}
    }
   }
   continue;
  }
  if(worn&&worn.name===rule.item&&bestLv<=(worn.level||0)&&(!rule.shiny||!!worn.shiny)) continue;
  if(typeof near_farmer==='function'&&!near_farmer(rule.character)){
   act('kit deliver '+rule.item+' to '+rule.character);
   await go_to({map:farmer.map,x:farmer.x,y:farmer.y},'kit '+rule.character,40);
   return true;
  }
  try{
   await send_item(rule.character,best,1);
   game_log('kit handoff '+rule.item+'+'+bestLv+' '+rule.slot+' -> '+rule.character);
   act('kit '+rule.item+' to '+rule.character);
   return true;
  }catch(e){game_log('kit handoff: '+((e&&e.reason)||e));}
 }
 return false;
`;

export const merchantConsumablesBody = `
 var cons=__ALCC.consumables; if(!cons||!cons.enabled||!cons.rules||!cons.rules.length) return false;
 function bag_count(name){var n=0,items=character.items||[];for(var i=0;i<items.length;i++){var it=items[i];if(it&&it.name===name)n+=it.q||1;}return n;}
 function farmer_count(farmer,name){if(!farmer)return 0;var n=0,items=farmer.items||[];for(var i=0;i<items.length;i++){var it=items[i];if(it&&it.name===name)n+=it.q||1;}if(farmer.slots){for(var slot in farmer.slots){var eq=farmer.slots[slot];if(eq&&eq.name===name)n+=eq.q||1;}}return n;}
 for(var i=0;i<cons.rules.length;i++){
  var rule=cons.rules[i];
  var farmer=get_player(rule.character);
  if(!farmer||farmer.rip) continue;
  var have=farmer_count(farmer,rule.item);
  if(have>=rule.minQty) continue;
  var target=rule.targetQty||rule.minQty;
  var maximum=rule.maxQty||target;
  target=Math.min(target,maximum);
  var need=Math.max(0,target-have);
  if(need<1) continue;
  var fromBag=bag_count(rule.item);
  var cfg=typeof CONFIG!=='undefined'&&CONFIG?CONFIG:{};
  var reserve=rule.item===cfg.MPOT?(cfg.SELF_MPOT_RESERVE||0):rule.item===cfg.HPOT?(cfg.SELF_HPOT_RESERVE||0):0;
  var available=Math.max(0,fromBag-reserve);
  if(available<1&&(rule.source==='bank'||rule.source==='either')&&character.bank&&typeof each_bank_item==='function'&&character.esize>0){
   var found=null;
   each_bank_item(function(bit,pack,slot){if(!bit||bit.name!==rule.item)return;if(!found)found={pack:pack,slot:slot};});
   if(found){
    await ensure_stand_closed();
    if(character.map!=='bank'){act('consumable bank');await go_to('bank','consumable from bank');return true;}
    try{await bank_retrieve(found.pack,found.slot);game_log('consumable bank '+rule.item+' for '+rule.character);return true;}catch(e){game_log('consumable bank: '+((e&&e.reason)||e));}
   }
  }
  fromBag=bag_count(rule.item); available=Math.max(0,fromBag-reserve);
  if(available<1) continue;
  if(typeof near_farmer==='function'&&!near_farmer(rule.character)){
   act('consumable '+rule.item+' to '+rule.character);
   await go_to({map:farmer.map,x:farmer.x,y:farmer.y},'consumable '+rule.character,40);
   return true;
  }
  var slot=-1,items=character.items||[];
  for(var j=0;j<items.length;j++){if(items[j]&&items[j].name===rule.item){slot=j;break;}}
  if(slot<0) continue;
  var q=Math.min(need,items[slot].q||1,available);
  try{
   await send_item(rule.character,slot,q);
   game_log('consumable '+rule.item+' x'+q+' -> '+rule.character);
   act('consumable '+rule.item+' to '+rule.character);
   return true;
  }catch(e){game_log('consumable: '+((e&&e.reason)||e));}
 }
 return false;
`;

export const merchantGiftsBody = `
 var gifts=__ALCC.gifts; if(!gifts||!gifts.enabled||!gifts.rules||!gifts.rules.length) return false;
 var sent={}; try{sent=get('gift_sent')||{};}catch(e){sent={};}
 function farmer_have(farmer,name,level){
  if(!farmer) return 0;
  var n=0,items=farmer.items||[];
  for(var i=0;i<items.length;i++){var it=items[i];if(it&&it.name===name&&(it.level||0)===level)n+=it.q||1;}
  if(farmer.slots){for(var slot in farmer.slots){var eq=farmer.slots[slot];if(eq&&eq.name===name&&(eq.level||0)===level)n+=eq.q||1;}}
  return n;
 }
 for(var i=0;i<gifts.rules.length;i++){
  var rule=gifts.rules[i];
  var key=rule.character+':'+rule.item+':'+(rule.level||0);
  var already=sent[key]||0;
  var farmer=get_player(rule.character);
  if(!farmer||farmer.rip) continue;
  var have=Math.max(already,farmer_have(farmer,rule.item,rule.level||0));
  if(have>=rule.quantity) continue;
  var need=rule.quantity-have;
  var items=character.items||[],best=-1;
  for(var j=0;j<items.length;j++){
   var it=items[j]; if(!it||it.l||it.b||it.name!==rule.item) continue;
   if((it.level||0)!==(rule.level||0)) continue;
   best=j; break;
  }
  if(best<0) continue;
  if(typeof near_farmer==='function'&&!near_farmer(rule.character)){
   act('gift '+rule.item+' to '+rule.character);
   await go_to({map:farmer.map,x:farmer.x,y:farmer.y},'gift '+rule.character,40);
   return true;
  }
  var q=Math.min(need,items[best].q||1);
  try{
   await send_item(rule.character,best,q);
   sent[key]=already+q;
   try{set('gift_sent',sent);}catch(e2){}
   game_log('gift '+rule.item+'+'+(rule.level||0)+' x'+q+' -> '+rule.character);
   act('gift '+rule.item+' to '+rule.character);
   return true;
  }catch(e){game_log('gift: '+((e&&e.reason)||e));}
 }
 return false;
`;

// Uses the source merchant's navigation and serialized tick; no competing timer.
// Browser CODE runner signatures: trade(bagIndex, tradeSlot, price, quantity)
// and wishlist(tradeSlot, name, price, level, quantity). The runner forwards
// quantity/level to parent.wishlist in the opposite order internally.
export const merchantStandBody = `
 // Travel work wins over listing maintenance regardless of whether its lease has been acquired yet.
 if(typeof merchant_work_next==='function'){
  var nextStandWork=merchant_work_next();
  if(['bank','craft'].indexOf(nextStandWork)>=0||nextStandWork==='exchange'&&!(typeof merchant_remote_exchange_available==='function'&&merchant_remote_exchange_available()))return false;
 }
 if(typeof upgrade_target_complete==='function'&&(character.items||[]).some(function(it){return upgrade_target_complete(it)&&!(typeof listing_bank_stock_reserved==='function'&&listing_bank_stock_reserved(it));})) return false;
 var slots = character.slots || {};
 var tradeSlotCount=typeof merchant_trade_capacity==='function'?merchant_trade_capacity():16;
 var buySlotStart=tradeSlotCount-7;
 function shopHasListings(){for(var sn=1;sn<=tradeSlotCount;sn++){var si=slots['trade'+sn];if(si&&!si.b)return true;}return false;}
 var buy=__ALCC.buy||{enabled:false,orders:[],budget:0,reserveGold:0};
 var now=Date.now(),buyPostPending=!!__ALCC._buyPostAt&&now-__ALCC._buyPostAt<10000;
 var manageBuy=buy.managed||buy.enabled||(buy.orders&&buy.orders.length>0);
 var buyOrderCount=(buy.enabled&&buy.orders)?buy.orders.length:0;
 // Reserve only the last eight slots for real buy orders. Capacity follows the game.
 var reserveBuySlots=manageBuy&&buyOrderCount>0;
 var sellSlotMax=reserveBuySlots?buySlotStart-1:tradeSlotCount;
 var buyCandidate=null,hasBuy=false;
 var available=Math.min(buy.budget,Math.max(0,character.gold-buy.reserveGold));
 for(var outside=1;outside<buySlotStart;outside++){var pendingOrder=slots['trade'+outside];if(pendingOrder&&pendingOrder.b)available=Math.max(0,available-pendingOrder.price*(pendingOrder.q||1));}

 // Cancel buy orders outside the managed zone, or every buy when no orders remain.
 if(manageBuy&&!buyPostPending){
  for(var bn=1;bn<=tradeSlotCount;bn++){
   var buySlot=slots['trade'+bn];
   if(!buySlot||!buySlot.b) continue;
   var inBuyZone=bn>=buySlotStart&&bn<=tradeSlotCount;
   if(!reserveBuySlots||!inBuyZone){
    await ensure_stand_closed();
    await unequip('trade'+bn);
    game_log('cleared buy order on trade'+bn);
    return true;
   }
  }
 }

 if(reserveBuySlots)for(var b=0;b<8;b++){
  var order=buy.orders[b],owned=0,desired=0,current=slots['trade'+(buySlotStart+b)];
  if(order){
   (character.items||[]).forEach(function(it){if(it&&it.name===order.item&&(it.level||0)===order.level)owned+=it.q||1;});
   Object.keys(slots).forEach(function(key){var it=slots[key];if(it&&!it.b&&it.name===order.item&&(it.level||0)===order.level)owned+=it.q||1;});
   // The server caps upgradeable/compound equipment wishlists at 99 units.
   // Compare the live slot against that posted batch, not the uncapped target.
   var definition=typeof G!=='undefined'&&G.items?G.items[order.item]:null;
   var batchLimit=definition&&(definition.upgrade||definition.compound)?99:9999;
   desired=Math.min(batchLimit,Math.max(0,order.quantity-owned),Math.floor(available/order.price));available-=desired*order.price;
  }
  if(!buyPostPending&&current&&current.b&&(!order||!desired||current.name!==order.item||(current.level||0)!==order.level||current.price!==order.price||(current.q||1)!==desired)){
   await ensure_stand_closed();await unequip('trade'+(buySlotStart+b));return true;
  }
  if(current&&current.b)hasBuy=true;
  if(order&&desired&&!current&&!buyCandidate&&!buyPostPending)buyCandidate={slot:buySlotStart+b,rule:order,quantity:desired};
 }

 function ruleFor(it) {
  if (!it || it.l || it.b) return null;
  for (var r = 0; r < __ALCC.listings.length; r++) {
   var rule = __ALCC.listings[r];
   if (rule.item === it.name && rule.level === (it.level || 0)) return rule;
  }
  return null;
 }
 for (var n=1;n<=tradeSlotCount;n++) {
  var existing=slots['trade'+n]; if (!existing || existing.b) continue;
  var rule=__ALCC.standEnabled && !(reserveBuySlots&&n>=buySlotStart) ? ruleFor(existing) : null;
  if (!rule || existing.price!==rule.price) {
   await ensure_stand_closed();
   if (character.esize<1) { act('stand paused: free a bag slot to update listings'); return true; }
   await unequip('trade'+n); return true;
  }
 }
 if (!__ALCC.standEnabled&&!buyCandidate&&!hasBuy&&!buyPostPending) { await ensure_stand_closed(); return false; }
 var candidate=-1, selectedRule=null;
 for (var i=0;i<(character.items||[]).length;i++) {
  var item=character.items[i], match=__ALCC.standEnabled?ruleFor(item):null; if(!match)continue;
  if(typeof stand_inventory_allowed==='function'&&!stand_inventory_allowed(item))continue;
  if(item.name==='tracker' && typeof tracker_keep_bag==='function' && bag_named_count('tracker')<=tracker_keep_bag()) continue;
  var listedSlot=null;
  for(var j=1;j<=tradeSlotCount;j++){
   var listedItem=slots['trade'+j];
   if(listedItem&&!listedItem.b&&listedItem.name===item.name&&(listedItem.level||0)===(item.level||0)){listedSlot='trade'+j;break;}
  }
  if(!listedSlot){candidate=i;selectedRule=match;break;}
  // Keep a valid live stack intact. Unequipping it does not merge it with the
  // bag stack: it creates two inventory stacks and causes an unlist/relist loop.
  // The bag surplus is listed naturally after the current trade stack sells.
 }
 if(candidate<0 && !__ALCC.standEnabled&&!shopHasListings()&&!buyCandidate&&!hasBuy&&!buyPostPending) { await ensure_stand_closed(); return false; }
 if(candidate<0&&__ALCC.standEnabled&&typeof maybe_restock_listing_from_bank==='function'){
  if(await maybe_restock_listing_from_bank())return true;
 }
 if(character.c&&(character.c.fishing||character.c.mining))return false;
 function standInventorySlot(){
  if(typeof merchant_stand_item_slot==='function')return merchant_stand_item_slot();
  var preferred=['supercomputer','computer','stand0'],bag=character.items||[];
  for(var p=0;p<preferred.length;p++)for(var i=0;i<bag.length;i++)if(bag[i]&&bag[i].name===preferred[p])return i;
  return typeof find_item==='function'?find_item('stand0'):(typeof locate_item==='function'?locate_item('stand0'):-1);
 }
 var standItem=standInventorySlot();
 var ownsStand=!!(character.stand||character.standed)||standItem>=0||(typeof has_stand==='function'&&has_stand());
 if(!ownsStand)return false;
 var park=SHOP_XY.market;
 var needsStandWork=candidate>=0||!!buyCandidate||buyPostPending;
 // standEnabled means the shop itself is intentional, even while its configured
 // stock is temporarily empty. Keep it parked/open so new drops can be listed.
 var keepListedOpen=__ALCC.standEnabled||shopHasListings()||hasBuy;
 // NPC sell/exchange/dump must beat idle stand reopen. Listings stay on trade
 // slots while the stand is closed, so keepListedOpen alone used to yank the
 // mule back to market every tick and cancel Gabriel/Xyn walks.
 var townChore=(typeof locate_exchange_item==='function'&&locate_exchange_item()!==-1&&!(typeof merchant_remote_exchange_available==='function'&&merchant_remote_exchange_available()))
  ||(typeof bag_needs_dump==='function'&&bag_needs_dump())

  ||(typeof locate_dexscroll_item==='function'&&locate_dexscroll_item()!==-1)

  ||(typeof accessory_work_pending==='function'&&accessory_work_pending());
 // Production batches own travel even when new stand listings are waiting.
 // Posting those listings must not interrupt Xyn or the upgrade NPC.
 if(typeof refresh_production_trip==='function'){
  var standTrip=refresh_production_trip();
  if(standTrip&&!((standTrip==='exchange'||standTrip==='craft')&&typeof merchant_remote_exchange_available==='function'&&merchant_remote_exchange_available()))return false;
 }
 // Leave bank only when there is new list/buy work. On main, also walk back to reopen
 // an already-listed stand that was closed — but not while a town chore is pending.
 if(character.map==='bank'||character.map!=='main'||simple_distance(character,park)>24){
  if(character.map==='bank'&&!needsStandWork) return false;
  if(!needsStandWork&&!keepListedOpen) return false;
  if(!needsStandWork&&townChore) return false;
  act(character.map==='bank'?'leave bank for stand':'town stand');
  await go_to('market','open stand',20);
  return true;
 }
 if(character.moving||smart.moving)return true;
 if(!(character.stand||character.standed)){
  if(!needsStandWork&&townChore) return false;
  if(__ALCC._standRetryAt&&Date.now()-__ALCC._standRetryAt<3000)return true;
  __ALCC._standRetryAt=Date.now();
  var standSlot=standInventorySlot();
  try{
   if(standSlot!==-1)await open_stand(standSlot);else await open_stand();
   for(var openWait=0;openWait<4&&!(character.stand||character.standed);openWait++)await sleep(250);
  }catch(e){game_log('stand: '+((e&&e.reason)||e));act('stand open failed');return true;}
  if(!(character.stand||character.standed)){game_log('stand remains closed after open_stand (slot '+standSlot+')');act('stand still closed');return true;}
  game_log('stand opened (slot '+standSlot+')');
  __ALCC._standRetryAt=0;
  act('stand open · configured listings');
  return true;
 }
 if(buyCandidate){
  var wishlistTx=typeof MerchantTransactions!=='undefined'?MerchantTransactions.begin('stand_buy',buyCandidate.rule.item+' +'+buyCandidate.rule.level+' x'+buyCandidate.quantity+' @'+buyCandidate.rule.price):null;
  if(typeof MerchantTransactions!=='undefined'&&!wishlistTx)return true;
  try{
  await wishlist(buyCandidate.slot,buyCandidate.rule.item,buyCandidate.rule.price,buyCandidate.rule.level,buyCandidate.quantity);
   __ALCC._buyPostAt=Date.now();
   game_log('posted buy order '+buyCandidate.rule.item+' x'+buyCandidate.quantity);
   if(wishlistTx)MerchantTransactions.commit(wishlistTx,'posted trade'+buyCandidate.slot);
  }catch(e){if(wishlistTx)MerchantTransactions.fail(wishlistTx,(e&&e.reason)||e);game_log('wishlist: '+((e&&e.reason)||e));}
  return true;
 }
 if(candidate>=0){
  slots=character.slots||{};
  for(var free=1;free<=sellSlotMax;free++)if(!slots['trade'+free]){
   var current=character.items[candidate];
   if(!current||ruleFor(current)!==selectedRule)return true;
   var listingTx=typeof MerchantTransactions!=='undefined'?MerchantTransactions.begin('stand_sell',current.name+' +'+(current.level||0)+' x'+(current.q||1)+' @'+selectedRule.price):null;
   if(typeof MerchantTransactions!=='undefined'&&!listingTx)return true;
   try{
    await trade(candidate,free,selectedRule.price,current.q||1);
    if(typeof release_listing_bank_stock==='function')release_listing_bank_stock(current);
    game_log('listed '+current.name+' +'+(current.level||0)+' @'+selectedRule.price);
    if(listingTx)MerchantTransactions.commit(listingTx,'posted trade'+free);
   }catch(e){if(listingTx)MerchantTransactions.fail(listingTx,(e&&e.reason)||e);game_log('list: '+((e&&e.reason)||e)+' '+((current&&current.name)||'?'));}
   return true;
  }
  act('stand full · no free trade slot for '+selectedRule.item);
  return true;
 }
 // Idle with stand open: do not consume the tick so upgrades/bank can run.
 act('stand open · configured listings');
 return false;
`;
export async function buildBundle(p: Profile, name: string) {
  const list = scripts();
  validateProfile(p, list);
  const c = p.characters.find((c) => c.name === name);
  if (!c) throw Error("Unknown character.");
  const s = list.find((s) => s.id === c.script)!;
  const result = adaptSource(
    fs.readFileSync(path.join(sourceDir, s.filename), "utf8"),
    p,
    c,
    s,
  );
  const compiled = await transform(result.code, {
    loader: "js",
    target: "es2017",
    minify: false,
    legalComments: "inline",
  });
  return {
    ...result,
    code: compiled.code,
    hash: crypto.createHash("sha256").update(compiled.code).digest("hex"),
    filename: `${c.name}.${c.runtime}.js`,
    sourceHash: s.hash,
  };
}



