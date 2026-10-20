import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { parse } from "acorn";
import type { Profile, ScriptInfo } from "../shared/schema";
import {
  merchantWorkOrder,
  exchangeDefaults,
  upgradeDefaults,
  standSpotDefaults,
  pontyDefaults,
  kitDefaults,
  consumablesDefaults,
  giftsDefaults,
  bossChecksDefaults,
  bossIds,
} from "../shared/schema";
import { automationDefaults } from '../shared/automation';
export const sourceDir = path.resolve(
  process.env.AL_CODE_DIR || path.join(import.meta.dirname, "../../code"),
);
export function ast(source: string): any {
  return parse(source, {
    ecmaVersion: "latest",
    sourceType: "script",
    allowReturnOutsideFunction: true,
  });
}
// Read literal settings without executing any player code.
function literal(n: any): any {
  if (n.type === "Literal") return n.value;
  if (n.type === "ArrayExpression") return n.elements.map(literal);
  if (n.type === "ObjectExpression")
    return Object.fromEntries(
      n.properties.map((p: any) => {
        if (p.type !== "Property" || p.computed || p.kind !== "init")
          throw Error("Not a literal setting");
        const k = p.key.name ?? p.key.value;
        if (["__proto__", "constructor", "prototype"].includes(k))
          throw Error("Unsafe key");
        return [k, literal(p.value)];
      }),
    );
  if (n.type === "UnaryExpression" && n.operator === "-")
    return -literal(n.argument);
  if (
    n.type === "BinaryExpression" &&
    ["*", "+", "/", "-"].includes(n.operator)
  ) {
    const a = literal(n.left),
      b = literal(n.right);
    return n.operator === "*"
      ? a * b
      : n.operator === "+"
        ? a + b
        : n.operator === "/"
          ? a / b
          : a - b;
  }
  throw Error("Not a literal setting");
}
export function variables(source: string) {
  const out: Record<string, unknown> = {};
  for (const node of ast(source).body)
    if (node.type === "VariableDeclaration")
      for (const d of node.declarations)
        if (d.id.type === "Identifier" && d.init) {
          try {
            out[d.id.name] = literal(d.init);
          } catch {}
        }
  return out;
}
export function scripts(): ScriptInfo[] {
  return fs
    .readdirSync(sourceDir)
    .filter((f) => f.endsWith(".js"))
    .map((filename) => {
      const source = fs.readFileSync(path.join(sourceDir, filename), "utf8"),
        vars = variables(source);
      const ctype = filename.includes("-rogue")
        ? "rogue"
        : filename.includes("eadroma-")
        ? "warrior"
        : filename.includes("aedroma-")
          ? "priest"
          : filename.includes("droma-")
            ? "ranger"
            : filename.includes("tonerre-")
              ? "mage"
              : filename.includes("merchant")
                ? "merchant"
                : "utility";
      const kind = filename.includes("crypt")
        ? "crypt"
        : ctype === "utility"
          ? "utility"
          : "farm";
      // Farm bundles also embed these shared runtime modules. Include them in
      // the catalog hash so Fleet Health requests a rebuild when one changes.
      const sharedFarmSource = kind === "farm" && ctype !== "merchant"
        ? ["event-expedition.js", "action-timing.js", "event-router.js", "style-loadout.js", "cave-dreams.js", "world-event-intel.js", "movement-watchdog.js", "runtime-policy.js", "combat-gear.js", ...(ctype === "warrior" ? ["dragold-intel.js"] : [])]
            .map(name => path.join(sourceDir, name))
            .filter(file => fs.existsSync(file))
            .map(file => fs.readFileSync(file, "utf8"))
            .join("\n")
        : ctype === "merchant"
          ? ["event-expedition.js", "bank-sorter.js", "movement-watchdog.js", "runtime-policy.js"].map(name => path.join(sourceDir, name)).filter(file => fs.existsSync(file)).map(file => fs.readFileSync(file, "utf8")).join("\n")
          : "";
      return {
        id: filename.slice(0, -3),
        filename,
        label: filename
          .replace(".js", "")
          .split("-")
          .map((x) => x[0].toUpperCase() + x.slice(1))
          .join(" · "),
        ctype,
        kind,
        bytes: Buffer.byteLength(source),
        hash: crypto.createHash("sha256").update(source).update(sharedFarmSource).update(ctype === "merchant" ? fs.readFileSync(path.join(sourceDir, "compound-production.js"), "utf8") : "").digest("hex"),
        config: (vars.CONFIG || {}) as Record<string, unknown>,
        variables: Object.fromEntries(
          ["HUNT_ALLOW", "JOIN_EVENTS", "WANDERER_SLOT", "BOSS_CHECKS"]
            .filter((k) => vars[k])
            .map((k) => [k, vars[k]]),
        ),
      };
    })
    .filter((s) => s.config && s.config.STANDALONE !== true && Object.keys(s.config).length > 0);
}
/** Seed the boss board from the warrior source's own BOSS_CHECKS so both stay in step. */
function bossRules(warrior: ScriptInfo) {
  const raw = warrior.variables.BOSS_CHECKS;
  if (!Array.isArray(raw)) return structuredClone(bossChecksDefaults.rules);
  const rules = raw
    .filter(
      (r: any) =>
        r &&
        bossIds.includes(String(r.boss)) &&
        Number.isInteger(r.everyMinutes),
    )
    .map((r: any) => ({
      boss: String(r.boss),
      everyMinutes: Number(r.everyMinutes),
    }));
  return rules.length ? rules : structuredClone(bossChecksDefaults.rules);
}
/** Prefer the -v2 revision of a script family, falling back to the base id (tonerre-mage has no -v2). */
export function preferRevision(
  list: ScriptInfo[],
  base: string,
): ScriptInfo | undefined {
  return (
    list.find((s) => s.id === `${base}-v2`) ||
    list.find((s) => s.id === base)
  );
}
export function initialProfile(list: ScriptInfo[]): Profile {
  const warrior = preferRevision(list, "eadroma-warrior")!,
    merchant = preferRevision(list, "eadrosell-merchant")!;
  const pack = ((warrior.config.WEAPONS as any)?.pack || {}) as Record<
    string,
    string
  >;
  const styleOf = (ids: string[]): Record<string, "aoe" | "mono" | "tank"> =>
    Object.fromEntries(
      ids.map((id) => [id, pack[id] === "fireblade" ? "mono" : "aoe"]),
    );
  const hunts = Object.keys(warrior.variables.HUNT_ALLOW || {});
  /** Seed characters on the -v2 revision when it exists (fallback: base id). */
  const pick = (base: string) => preferRevision(list, base)?.id || base;
  const events = [
    "crabxx",
    "goobrawl",
    "franky",
    "icegolem",
    "abtesting",
    "phoenix",
    "jr",
    "greenjr",
    "mrpumpkin",
    "mrgreen",
    "snowman",
    "dragold",
    "grinch",
    "wabbit",
    "pinkgoo",
    "slenderman",
    "tiger",
  ];
  return {
    name: "Main party",
    onboardingComplete: true,
    automation: structuredClone(automationDefaults),
    server: { region: "EU", name: "III" },
    characters: [
      {
        name: "Eadroma",
        ctype: "warrior",
        script: pick("eadroma-warrior"),
        follow: "",
        enabled: true,
      },
      {
        name: "Aedroma",
        ctype: "priest",
        script: pick("aedroma-priest"),
        follow: "Eadroma",
        enabled: true,
      },
      {
        name: "Droma",
        ctype: "ranger",
        script: pick("droma-ranger"),
        follow: "Eadroma",
        enabled: true,
      },
      {
        name: "EadroSell",
        ctype: "merchant",
        script: pick("eadrosell-merchant"),
        follow: "",
        enabled: true,
      },
      {
        name: "Tonerre",
        ctype: "mage",
        script: "tonerre-mage",
        follow: "Eadroma",
        enabled: false,
      },
    ].map((c) => ({
      ...c,
      runtime: "browser",
      events: c.ctype !== "merchant",
      job: "hunt",
      farmMonster: "",
      overrides: {},
    })) as Profile["characters"],
    farming: {
      defaultMonster: String(warrior.config.DEFAULT_FARM || "bigbird"),
      hunts: true,
      allowedHunts: hunts,
      rareVisits: true,
      dailyDungeon: false,
      style: styleOf(hunts),
      loadouts: {},
      bossChecks: { enabled: true, rules: bossRules(warrior) },
    },
    events: { enabled: true, allowed: events, style: styleOf(events), expedition: { enabled: false, allowed: ['mrgreen', 'mrpumpkin'], maxMinutes: 20, maxDeaths: 3 } },
    seller: {
      workOrder: [...merchantWorkOrder],
      buy: {
        managed: false,
        enabled: false,
        reserveGold: 1000000,
        budget: 100000,
        orders: [
          {
    "item": "tshirt9",
    "level": 0,
    "price": 15000000,
    "quantity": 10
},
{
    "item": "monstertoken",
    "level": 0,
    "price": 500000,
    "quantity": 100
}
        ],
      },
      npcEnabled: true,
      npcItems: (merchant.config.GABRIEL_SELL || []) as string[],
      standEnabled: false,
      listings: [],
      standSpot: { ...standSpotDefaults },
      exchange: {
        ...structuredClone(exchangeDefaults),
        items: (merchant.config.EXCHANGE_ITEMS ||
          exchangeDefaults.items) as string[],
        minimum: (merchant.config.EXCHANGE_MIN ||
          exchangeDefaults.minimum) as Record<string, number>,
      },
      upgrade: (() => {
        const max = Number(merchant.config.UPGRADE_MAX || 7);
        const minGold = Number(
          merchant.config.UPGRADE_GOLD_MIN ?? upgradeDefaults.minGold,
        );
        return {
          enabled: true,
          minGold: Number.isFinite(minGold) ? minGold : upgradeDefaults.minGold,
          rules: structuredClone(upgradeDefaults.rules).map((r) => ({
            item: r.item,
            maxLevel: max,
          })),
        };
      })(),
      compound: { enabled: false, checkBankOnDeposit: false, rules: [] },
      craft: {
        enabled: true,
        reserveGold: 1000000,
        rules: [{ item: "wingedboots" }],
      },
      ponty: {
        enabled: true,
        minGold:
          Number(merchant.config.PONTY_GOLD_KEEP ?? pontyDefaults.minGold) ||
          pontyDefaults.minGold,
        items: (
          (merchant.config.PONTY_ITEMS || pontyDefaults.items) as string[]
        ).slice(),
      },
      kit: { ...structuredClone(kitDefaults) },
      consumables: { ...structuredClone(consumablesDefaults) },
      gifts: { ...structuredClone(giftsDefaults) },
      bankDeposit: { enabled: true, items: [] },
      teamSupervisor: { enabled: true, characters: [], soloGuard: false },
    },
  };
}
/** Fill missing AOE/Mono/Tank choices from the warrior WEAPONS.pack (fireblade → mono). Never overwrites explicit profile picks. */
export function seedWeaponStyles(
  p: Profile,
  list: ScriptInfo[] = scripts(),
): Profile {
  const warrior = preferRevision(list, "eadroma-warrior");
  const pack = ((warrior?.config.WEAPONS as any)?.pack || {}) as Record<
    string,
    string
  >;
  const mode = (id: string): "aoe" | "mono" | "tank" =>
    pack[id] === "fireblade" ? "mono" : "aoe";
  const next = structuredClone(p);
  next.farming.style ??= {};
  next.events.style ??= {};
  for (const id of next.farming.allowedHunts)
    if (next.farming.style[id] === undefined) next.farming.style[id] = mode(id);
  if (
    next.farming.defaultMonster &&
    next.farming.style[next.farming.defaultMonster] === undefined
  )
    next.farming.style[next.farming.defaultMonster] = mode(
      next.farming.defaultMonster,
    );
  for (const c of next.characters)
    if (c.farmMonster && next.farming.style[c.farmMonster] === undefined)
      next.farming.style[c.farmMonster] = mode(c.farmMonster);
  for (const id of Object.keys(pack))
    if (next.farming.style[id] === undefined) next.farming.style[id] = mode(id);
  for (const id of next.events.allowed)
    if (next.events.style[id] === undefined) next.events.style[id] = mode(id);
  return next;
}
