import { z } from "zod";
import { automationSchema, automationDefaults } from './automation';
import { eventExpeditionSchema } from './event-expedition';
const key = z
  .string()
  .regex(/^[a-zA-Z0-9_-]+$/)
  .max(80);
export const exchangeDefaults = {
  enabled: true,
  items: ["anniversarygift", "gem0", "gift0"],
  minimum: { anniversarygift: 50 } as Record<string, number>,
};
export const upgradeDefaults = {
  enabled: true,
  minGold: 0,
  rules: [
    { item: "wattire", maxLevel: 7 },
    { item: "wgloves", maxLevel: 7 },
    { item: "wshoes", maxLevel: 7 },
    { item: "hpants", maxLevel: 7 },
    { item: "hhelmet", maxLevel: 7 },
  ] as { item: string; maxLevel: number }[],
};
export const merchantWorkOrder = ['bank', 'sell', 'exchange', 'craft', 'compound', 'upgrade'] as const;
export const craftDefaults = {
  enabled: true,
  reserveGold: 1000000,
  rules: [{ item: "wingedboots" }] as { item: string }[],
};
export const buyDefaults = {
  managed: false,
  enabled: false,
  reserveGold: 1000000,
  budget: 100000,
  orders: [] as {
    item: string;
    level: number;
    price: number;
    quantity: number;
  }[],
};
/** minGold matches source CONFIG.PONTY_GOLD_KEEP — mule keeps at least this much before scanning/buying. */
export const pontyDefaults = {
  enabled: true,
  minGold: 200000,
  items: ["ololipop", "glolipop"] as string[],
};
export const kitSlots = [
  "mainhand",
  "offhand",
  "helmet",
  "chest",
  "pants",
  "shoes",
  "gloves",
  "belt",
  "amulet",
  "ring1",
  "ring2",
  "earring1",
  "earring2",
  "cape",
  "orb",
] as const;
export const kitDefaults = {
  enabled: true,
  rules: [] as {
    character: string;
    slot: (typeof kitSlots)[number];
    item: string;
    minLevel: number;
    shiny: boolean;
  }[],
};
export const farmStyles = ["aoe", "mono", "tank"] as const;
export type FarmStyle = string;
export function loadoutOptions(profile: { farming: { loadouts: Record<string, Record<string, unknown>> } }) {
  return [...new Set([...farmStyles, ...Object.values(profile.farming.loadouts).flatMap(board => Object.keys(board))])].map(value => ({ value, label: value === 'aoe' ? 'AOE' : value === 'mono' ? 'Single target' : value === 'tank' ? 'Tank / survival' : value }));
}
export const emptyStyleLoadout = () => ({
  base: undefined as (typeof farmStyles)[number] | undefined,
  gear: [] as {
    slot: (typeof kitSlots)[number];
    item: string;
    minLevel: number;
  }[],
  skills: [] as string[],
});
export const emptyCharacterLoadouts = (): Record<string, ReturnType<typeof emptyStyleLoadout>> => ({
  aoe: emptyStyleLoadout(),
  mono: emptyStyleLoadout(),
  tank: emptyStyleLoadout(),
});
export const loadoutsDefaults = {} as Record<
  string,
  ReturnType<typeof emptyCharacterLoadouts>
>;

const itemAliases: Record<string, string> = {
  ololipop0: "ololipop",
};

/** Normalize legacy or mistaken IDs that have a single canonical in-game item. */
export function canonicalItemId(id: string): string {
  return itemAliases[id] ?? id;
}
export const classSkills: Record<string, { id: string; label: string }[]> = {
  warrior: [
    { id: "taunt", label: "Taunt" },
    { id: "charge", label: "Charge" },
    { id: "warcry", label: "Warcry" },
    { id: "cleave", label: "Cleave" },
    { id: "stomp", label: "Stomp" },
    { id: "agitate", label: "Agitate" },
  ],
  priest: [
    { id: "heal", label: "Heal" },
    { id: "partyheal", label: "Party Heal" },
    { id: "curse", label: "Curse" },
    { id: "darkblessing", label: "Dark Blessing" },
    { id: "absorb", label: "Absorb" },
    { id: "revive", label: "Revive" },
  ],
  ranger: [
    { id: "3shot", label: "3-Shot" },
    { id: "5shot", label: "5-Shot" },
    { id: "supershot", label: "Supershot" },
    { id: "huntersmark", label: "Hunter's Mark" },
    { id: "poisonarrow", label: "Poison Arrow" },
  ],
  mage: [
    { id: "cburst", label: "Mana Burst" },
    { id: "energize", label: "Energize" },
    { id: "blink", label: "Blink" },
    { id: "reflection", label: "Reflection" },
    { id: "burst", label: "Burst" },
  ],
  rogue: [
    { id: "fanofknives", label: "Fan of Knives" },
    { id: "mentalburst", label: "Mental Burst" },
    { id: "rspeed", label: "Rogue Swiftness" },
  ],
};
const styleLoadoutSchema = z.object({
  base: z.enum(farmStyles).optional(),
  gear: z
    .array(
      z.object({
        slot: z.enum(kitSlots),
        item: key,
        minLevel: z.number().int().min(0).max(15).default(0),
      }),
    )
    .max(20)
    .default([]),
  skills: z.array(key).max(40).default([]),
});
const characterLoadoutsSchema = z.object({
  aoe: styleLoadoutSchema.default({ gear: [], skills: [] }),
  mono: styleLoadoutSchema.default({ gear: [], skills: [] }),
  tank: styleLoadoutSchema.default({ gear: [], skills: [] }),
}).catchall(styleLoadoutSchema).superRefine((board, ctx) => {
  for (const name of Object.keys(board)) {
    if (!key.safeParse(name).success || ['__proto__', 'constructor', 'prototype'].includes(name))
      ctx.addIssue({ code: 'custom', message: `Invalid loadout ID ${name}.` });
  }
  if (Object.keys(board).length > 33) ctx.addIssue({ code: 'custom', message: 'At most 30 custom loadouts are allowed.' });
});
export const consumablesDefaults = {
  enabled: true,
  rules: [] as {
    character: string;
    item: string;
    minQty: number;
    targetQty: number;
    maxQty: number;
    mode: "carry" | "elixir";
    source: "mule" | "bank" | "either";
  }[],
};
export const giftsDefaults = {
  enabled: true,
  rules: [] as {
    character: string;
    item: string;
    level: number;
    quantity: number;
  }[],
};
export const bankDepositDefaults = {
  enabled: true,
  items: [] as string[],
};
/** Empty characters means every enabled farmer, preserving legacy profiles. */
export const teamSupervisorDefaults = {
  enabled: true,
  characters: [] as string[],
  soloGuard: false,
};

/**
 * Timed open-world bosses the party can walk out to and check on a schedule.
 * respawn (seconds), hp and attack were checked against G.monsters[id]; the UI catalog is refreshed independently.
 * Bosses with no respawn timer (Giga Crab, Golden Bat) and Skeletor are left
 * out: the farm router skips arena/PvP maps and chance spawns have no camp.
 */
export const worldBosses = [
  {
    id: "dragold",
    name: "Dragold",
    map: "Cave",
    respawn: 7200,
    hp: 12000000,
    attack: 1200,
  },
  {
    id: "jr",
    name: "Jr.",
    map: "Spooky Town",
    respawn: 25920,
    hp: 3200,
    attack: 10,
  },
  {
    id: "greenjr",
    name: "Green Jr.",
    map: "Spooky Forest",
    respawn: 51840,
    hp: 4200,
    attack: 30,
  },
  {
    id: "mvampire",
    name: "Dracul",
    map: "Cave of Darkness",
    respawn: 1080,
    hp: 240000,
    attack: 245,
  },
  {
    id: "fvampire",
    name: "Ms. Dracul",
    map: "Spooky Forest",
    respawn: 1440,
    hp: 240000,
    attack: 875,
  },
  {
    id: "stompy",
    name: "Stompy",
    map: "Winterland",
    respawn: 2160,
    hp: 640000,
    attack: 3600,
  },
  {
    id: "bscorpion",
    name: "Black Scorpion",
    map: "Desertland",
    respawn: 6,
    hp: 576900,
    attack: 3200,
  },
  {
    id: "mrpumpkin",
    name: "Mr. Pumpkin",
    map: "Spooky Forest",
    respawn: 3240,
    hp: 36000000,
    attack: 1200,
  },
  {
    id: "mrgreen",
    name: "Mr. Green",
    map: "Spooky Town",
    respawn: 5640,
    hp: 36000000,
    attack: 1200,
  },
] as const;
export const bossIds = worldBosses.map((b) => b.id) as readonly string[];
/** Selectable check intervals, in minutes. */
export const bossCheckIntervals = [
  15, 30, 60, 120, 240, 360, 480, 720, 1440,
] as const;
/** Matches the warrior source BOSS_CHECKS default: the old hardcoded 4h Jr. → Green Jr. peek. */
export const bossChecksDefaults = {
  enabled: true,
  rules: [
    { boss: "jr", everyMinutes: 240 },
    { boss: "greenjr", everyMinutes: 240 },
  ] as { boss: string; everyMinutes: number }[],
};
/** "7h 12m" / "36m" for respawn windows and check intervals. */
export function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 60)
    return `${Math.max(0, Math.round(seconds))}s`;
  const total = Math.round(seconds / 60),
    h = Math.floor(total / 60),
    m = total % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** Ensure the boss-check board exists on profiles saved before it was added. */
export function ensureFarmingBoards<
  T extends { farming: Record<string, unknown> },
>(profile: T): T {
  const farming = profile.farming as any;
  if (!farming.bossChecks || typeof farming.bossChecks !== "object")
    farming.bossChecks = structuredClone(bossChecksDefaults);
  else {
    if (typeof farming.bossChecks.enabled !== "boolean")
      farming.bossChecks.enabled = bossChecksDefaults.enabled;
    if (!Array.isArray(farming.bossChecks.rules))
      farming.bossChecks.rules = structuredClone(bossChecksDefaults.rules);
  }
  if (typeof farming.dailyDungeon !== "boolean") farming.dailyDungeon = false;
  if (!farming.loadouts || typeof farming.loadouts !== "object")
    farming.loadouts = {};
  else
    for (const board of Object.values(farming.loadouts) as Record<string, unknown>[]) {
      if (!board || typeof board !== "object") continue;
      for (const style of Object.keys(board)) {
        const loadout = board[style] as { gear?: { item?: unknown }[] } | undefined;
        if (!Array.isArray(loadout?.gear)) continue;
        loadout.gear = loadout.gear.map((rule) =>
          typeof rule?.item === "string"
            ? { ...rule, item: canonicalItemId(rule.item) }
            : rule,
        );
      }
    }
  return profile;
}

/** Ensure newer seller boards exist on profiles saved before they were added. */
export function ensureSellerBoards<
  T extends { seller: Record<string, unknown> },
>(profile: T): T {
  const seller = profile.seller as any;
  if (seller.workOrder === undefined) seller.workOrder = [...merchantWorkOrder];
  if (!seller.ponty || typeof seller.ponty !== "object")
    seller.ponty = structuredClone(pontyDefaults);
  else {
    if (typeof seller.ponty.enabled !== "boolean") seller.ponty.enabled = true;
    if (!Array.isArray(seller.ponty.items))
      seller.ponty.items = structuredClone(pontyDefaults.items);
    if (
      typeof seller.ponty.minGold !== "number" ||
      !Number.isInteger(seller.ponty.minGold)
    )
      seller.ponty.minGold = pontyDefaults.minGold;
  }
  if (!seller.kit || typeof seller.kit !== "object")
    seller.kit = structuredClone(kitDefaults);
  if (!seller.consumables || typeof seller.consumables !== "object")
    seller.consumables = structuredClone(consumablesDefaults);
  else if (Array.isArray(seller.consumables.rules)) {
    seller.consumables.rules = seller.consumables.rules.map(
      (rule: Record<string, unknown>) => {
        const minQty = Number.isInteger(rule.minQty) ? Number(rule.minQty) : 1;
        const targetQty = Number.isInteger(rule.targetQty)
          ? Number(rule.targetQty)
          : minQty;
        const maxQty = Number.isInteger(rule.maxQty)
          ? Number(rule.maxQty)
          : Math.min(999999, Math.max(targetQty, targetQty * 2));
        return { ...rule, minQty, targetQty, maxQty };
      },
    );
  }
  if (!seller.gifts || typeof seller.gifts !== "object")
    seller.gifts = structuredClone(giftsDefaults);
  if (!seller.bankDeposit || typeof seller.bankDeposit !== "object")
    seller.bankDeposit = structuredClone(bankDepositDefaults);
  else {
    if (typeof seller.bankDeposit.enabled !== "boolean") seller.bankDeposit.enabled = true;
    if (!Array.isArray(seller.bankDeposit.items)) seller.bankDeposit.items = [];
  }
  if (!seller.teamSupervisor || typeof seller.teamSupervisor !== "object")
    seller.teamSupervisor = structuredClone(teamSupervisorDefaults);
  else {
    if (typeof seller.teamSupervisor.enabled !== "boolean")
      seller.teamSupervisor.enabled = true;
    if (!Array.isArray(seller.teamSupervisor.characters))
      seller.teamSupervisor.characters = [];
    if (typeof seller.teamSupervisor.soloGuard !== "boolean")
      seller.teamSupervisor.soloGuard = false;
  }
  if (!seller.craft || typeof seller.craft !== "object")
    seller.craft = structuredClone(craftDefaults);
  else {
    if (typeof seller.craft.enabled !== "boolean") seller.craft.enabled = false;
    if (!Array.isArray(seller.craft.rules)) seller.craft.rules = [];
    if (!Number.isInteger(seller.craft.reserveGold) || seller.craft.reserveGold < 0)
      seller.craft.reserveGold = craftDefaults.reserveGold;
  }
  if (seller.buy && typeof seller.buy === "object") {
    if (!Array.isArray(seller.buy.orders)) seller.buy.orders = [];
    if (seller.buy.enabled || seller.buy.orders.length) seller.buy.managed = true;
  }
  if (seller.upgrade && typeof seller.upgrade === "object") {
    if (
      !Array.isArray(seller.upgrade.rules) &&
      Array.isArray(seller.upgrade.items)
    ) {
      const fallback = Number.isInteger(seller.upgrade.maxLevel)
        ? seller.upgrade.maxLevel
        : 7;
      const minGold =
        typeof seller.upgrade.minGold === "number" &&
        Number.isInteger(seller.upgrade.minGold)
          ? seller.upgrade.minGold
          : upgradeDefaults.minGold;
      seller.upgrade = {
        enabled: !!seller.upgrade.enabled,
        minGold,
        rules: seller.upgrade.items.map((item: string) => ({
          item,
          maxLevel: fallback,
        })),
      };
    } else if (
      typeof seller.upgrade.minGold !== "number" ||
      !Number.isInteger(seller.upgrade.minGold)
    )
      seller.upgrade.minGold = upgradeDefaults.minGold;
  }
  return profile;
}
/** Normalize legacy upgrade {items,maxLevel} into per-item rules; keep minGold when present. */
export function normalizeUpgrade(raw: unknown) {
  if (!raw || typeof raw !== "object") return raw;
  const u = raw as Record<string, unknown>;
  const minGold =
    typeof u.minGold === "number" && Number.isInteger(u.minGold)
      ? u.minGold
      : upgradeDefaults.minGold;
  if (Array.isArray(u.rules))
    return { enabled: !!u.enabled, minGold, rules: u.rules };
  if (Array.isArray(u.items)) {
    const fallback =
      typeof u.maxLevel === "number" && Number.isInteger(u.maxLevel)
        ? u.maxLevel
        : 7;
    return {
      enabled: !!u.enabled,
      minGold,
      rules: (u.items as string[]).map((item) => ({
        item,
        maxLevel: fallback,
      })),
    };
  }
  return {
    enabled: !!u.enabled,
    minGold,
    rules: [] as { item: string; maxLevel: number }[],
  };
}
/** Default west edge of Bean's town square (matches eadrosell SHOP_XY.market). */
export const standSpotDefaults = { map: "main" as const, x: -100, y: -20 };
/** Clickable town-square picker bounds (game coordinates). */
export const standSpotBounds = { minX: -220, maxX: 220, minY: -220, maxY: 160 };
export const characterSchema = z.object({
  name: key,
  ctype: z.enum(["warrior", "priest", "ranger", "mage", "rogue", "merchant"]),
  enabled: z.boolean(),
  runtime: z.enum(["browser", "caracal"]),
  script: key,
  follow: z.string().max(80),
  events: z.boolean(),
  job: z.enum(["hunt", "upgrade", "combine"]),
  farmMonster: z.union([key, z.literal("")]).default(""),
  overrides: z.record(z.string(), z.unknown()),
});
export const profileSchema = z
  .object({
    name: z.string().trim().min(1).max(70),
    onboardingComplete: z.boolean().default(true),
    automation: automationSchema.default(automationDefaults),
    server: z.object({
      region: z.enum(["EU", "US", "ASIA"]),
      name: z.enum(["I", "II", "III", "PVP"]),
    }),
    characters: z.array(characterSchema).min(1).max(20),
    farming: z.object({
      defaultMonster: key,
      hunts: z.boolean(),
      allowedHunts: z.array(key).max(200),
      rareVisits: z.boolean(),
      dailyDungeon: z.boolean().default(false),
      style: z.record(key, key).default({}),
      loadouts: z.record(key, characterLoadoutsSchema).default({}),
      bossChecks: z
        .object({
          enabled: z.boolean(),
          rules: z
            .array(
              z.object({
                boss: key,
                everyMinutes: z.number().int().min(5).max(1440),
              }),
            )
            .max(20),
        })
        .default(bossChecksDefaults),
    }),
    events: z.object({
      expedition: eventExpeditionSchema.default({ enabled: false, allowed: ['mrgreen', 'mrpumpkin'], maxMinutes: 20, maxDeaths: 3 }),
      enabled: z.boolean(),
      allowed: z.array(key).max(100),
      style: z.record(key, key).default({}),
    }),
    seller: z.object({
      trickOrTreat: z.object({ enabled: z.boolean().default(false) }).default({ enabled: false }),
      witchCipher: z.object({ enabled: z.boolean().default(false) }).default({ enabled: false }),
      workOrder: z.array(z.enum(merchantWorkOrder)).length(merchantWorkOrder.length).refine(order => new Set(order).size === merchantWorkOrder.length, "Each task must appear once").default([...merchantWorkOrder]),
      buy: z
        .object({
          managed: z.boolean().default(false),
          enabled: z.boolean(),
          reserveGold: z.number().int().min(0).max(2e12),
          budget: z.number().int().positive().max(2e12),
          orders: z
            .array(
              z.object({
                item: key,
                level: z.number().int().min(0).max(15),
                price: z.number().int().positive().max(2e12),
                quantity: z.number().int().min(1).max(9999),
              }),
            )
            .max(8),
        })
        .default(buyDefaults),
      npcEnabled: z.boolean(),
      npcItems: z.array(key).max(500),
      standEnabled: z.boolean(),
      listings: z
        .array(
          z.object({
            item: key,
            level: z.number().int().min(0).max(15),
            price: z.number().int().positive().max(2e12),
            bankReserve: z.number().int().min(0).max(1000000).optional(),
          }),
        )
        .max(100),
      standSpot: z
        .object({
          map: z.literal("main").default("main"),
          x: z
            .number()
            .int()
            .min(standSpotBounds.minX)
            .max(standSpotBounds.maxX),
          y: z
            .number()
            .int()
            .min(standSpotBounds.minY)
            .max(standSpotBounds.maxY),
        })
        .default(standSpotDefaults),
      exchange: z
        .object({
          enabled: z.boolean(),
          items: z.array(key).max(500),
          minimum: z.record(key, z.number().int().min(1).max(999999)),
          bank: z.record(key, z.object({ enabled: z.boolean(), batchSize: z.number().int().min(1).max(500) })).optional(),
        })
        .default(exchangeDefaults),
      upgrade: z
        .preprocess(
          normalizeUpgrade,
          z.object({
            enabled: z.boolean(),
            minGold: z
              .number()
              .int()
              .min(0)
              .max(2e12)
              .default(upgradeDefaults.minGold),
            rules: z
              .array(
                z.object({
                  item: key,
                  maxLevel: z.number().int().min(0).max(15),
                  buyNpc: z.boolean().optional(),
                  paused: z.boolean().optional(),
                  steps: z.record(z.string().regex(/^(?:[0-9]|1[0-4])$/), z.object({ scroll: z.enum(["auto", "scroll0", "scroll1", "scroll2", "scroll3"]), offering: z.enum(["none", "offeringp", "offering"]), enabled: z.boolean().optional() })).optional(),
                  production: z.object({ enabled: z.boolean(), quantity: z.number().int().min(1).max(9999), budget: z.number().int().min(0).max(2e12), runId: z.string().min(1).max(80) }).optional(),
                }),
              )
              .max(500),
          }),
        )
        .default(upgradeDefaults),
      compound: z.object({
        enabled: z.boolean(),
        checkBankOnDeposit: z.boolean(),
        rules: z.array(z.object({ item: key, maxLevel: z.number().int().min(1).max(15) })).max(100),
      }).default({ enabled: false, checkBankOnDeposit: false, rules: [] }),
      craft: z
        .object({
          enabled: z.boolean(),
          reserveGold: z.number().int().min(0).max(2e12),
          rules: z.array(z.object({ item: key, paused: z.boolean().optional(), useBank: z.boolean().optional(), batchSize: z.number().int().min(1).max(500).optional() })).max(100),
        })
        .default(craftDefaults),
      ponty: z
        .object({
          enabled: z.boolean(),
          minGold: z
            .number()
            .int()
            .min(0)
            .max(2e12)
            .default(pontyDefaults.minGold),
          items: z.array(key).max(200),
        })
        .default(pontyDefaults),
      kit: z
        .object({
          enabled: z.boolean(),
          rules: z
            .array(
              z.object({
                character: key,
                slot: z.enum(kitSlots),
                item: key,
                minLevel: z.number().int().min(0).max(15),
                shiny: z.boolean().default(false),
              }),
            )
            .max(80),
        })
        .default(kitDefaults),
      consumables: z
        .object({
          enabled: z.boolean(),
          rules: z
            .array(
              z.object({
                character: key,
                item: key,
                minQty: z.number().int().min(1).max(999999),
                targetQty: z.number().int().min(1).max(999999),
                maxQty: z.number().int().min(1).max(999999),
                mode: z.enum(["carry", "elixir"]),
                source: z.enum(["mule", "bank", "either"]),
              }),
            )
            .max(40),
        })
        .default(consumablesDefaults),
      gifts: z
        .object({
          enabled: z.boolean(),
          rules: z
            .array(
              z.object({
                character: key,
                item: key,
                level: z.number().int().min(0).max(15),
                quantity: z.number().int().min(1).max(9999),
              }),
            )
            .max(80),
        })
        .default(giftsDefaults),
      bankDeposit: z
        .object({
          enabled: z.boolean(),
          items: z.array(key).max(500),
        })
        .default(bankDepositDefaults),
      teamSupervisor: z
        .object({
          enabled: z.boolean(),
          /** Empty keeps the backward-compatible meaning: all enabled farmers. */
          characters: z.array(key).max(20),
          /** Verified standalone CODE slots, outside dashboard-managed classes. */
          standaloneSlots: z.record(key, key).optional(),
          soloGuard: z.boolean().default(false),
        })
        .default(teamSupervisorDefaults),
    }),
  })
  .superRefine((p, ctx) => {
    if (p.events.expedition.enabled) {
      for (const type of ['merchant', 'warrior', 'priest']) {
        if (p.characters.filter(c => c.enabled && c.ctype === type && c.runtime === 'browser' && c.script.endsWith('-v2')).length !== 1) ctx.addIssue({ code: 'custom', message: `Event expedition needs an enabled Browser v2 ${type}.` });
      }
      for (const id of p.events.expedition.allowed) if (!p.events.allowed.includes(id)) ctx.addIssue({ code: 'custom', message: `Expedition event ${id} must be in the main event allowlist.` });
    }
    const names = p.characters.map((c) => c.name);
    if (new Set(p.automation.combatGear.map(r => r.character)).size !== p.automation.combatGear.length) ctx.addIssue({ code: 'custom', message: 'Only one combat glove rule per character is allowed.' });
    for (const rule of p.automation.combatGear) if (!p.characters.some(c => c.name === rule.character && c.ctype !== 'merchant')) ctx.addIssue({ code: 'custom', message: `Combat equipment targets unknown farmer ${rule.character}.` });
    for (const rule of p.automation.combatGear) if (rule.enabled && rule.combatItem === rule.movementItem) ctx.addIssue({ code: 'custom', message: 'Combat and travel gloves must be different.' });
    for (const board of [p.automation.activities, p.automation.lootGoals, p.automation.commercialGoals]) {
      if (new Set(board.map(row => row.id)).size !== board.length) ctx.addIssue({ code: 'custom', message: 'Automation rule IDs must be unique within each board.' });
    }
    for (const rule of [...p.automation.activities, ...p.automation.lootGoals]) {
      for (const name of rule.characters) if (!p.characters.some(c => c.name === name && c.ctype !== 'merchant')) ctx.addIssue({ code: 'custom', message: `Automation targets unknown farmer ${name}.` });
      if (new Set(rule.characters).size !== rule.characters.length) ctx.addIssue({ code: 'custom', message: 'Automation participants must be unique.' });
    }
    for (const activity of p.automation.activities) {
      if (activity.kind === 'cave' && activity.characters.length !== 3) ctx.addIssue({ code: 'custom', message: 'Cave activity requires exactly three farmers.' });
      if (activity.kind === 'cave' && ['warrior', 'priest', 'ranger'].some(type => !p.characters.some(c => c.ctype === type && activity.characters.includes(c.name)))) ctx.addIssue({ code: 'custom', message: 'Cave activity requires a warrior, priest and ranger.' });
      if (activity.kind === 'boss' && !bossIds.includes(activity.monster)) ctx.addIssue({ code: 'custom', message: 'Activity boss must be a checkable recurring boss.' });
      for (const name of Object.keys(activity.builds)) if (!activity.characters.includes(name)) ctx.addIssue({ code: 'custom', message: `Activity build targets excluded farmer ${name}.` });
    }
    if (new Set(p.automation.commercialGoals.filter(g => g.enabled).map(g => g.item)).size !== p.automation.commercialGoals.filter(g => g.enabled).length) ctx.addIssue({ code: 'custom', message: 'Only one active commercial goal per item is allowed.' });
    if (new Set(names).size !== names.length)
      ctx.addIssue({
        code: "custom",
        message: "Character names must be unique.",
      });
    for (const c of p.characters) {
      if (c.follow && !names.includes(c.follow))
        ctx.addIssue({
          code: "custom",
          message: `Unknown follow target for ${c.name}.`,
        });
      const visited = new Set<string>([c.name]);
      let next = c.follow;
      while (next) {
        if (visited.has(next)) {
          ctx.addIssue({
            code: "custom",
            message: `Follow cycle involving ${c.name}.`,
          });
          break;
        }
        visited.add(next);
        next = p.characters.find((x) => x.name === next)?.follow || "";
      }
      if (
        c.enabled &&
        c.follow &&
        !p.characters.find((x) => x.name === c.follow)?.enabled
      )
        ctx.addIssue({
          code: "custom",
          message: `Enable ${c.follow} before assigning ${c.name} to follow them.`,
        });
    }
    const bosses = p.farming.bossChecks.rules.map((r) => r.boss);
    if (new Set(bosses).size !== bosses.length)
      ctx.addIssue({
        code: "custom",
        message: "Each boss can have only one recurring check.",
      });
    for (const r of p.farming.bossChecks.rules)
      if (!bossIds.includes(r.boss))
        ctx.addIssue({
          code: "custom",
          message: `${r.boss} is not a checkable open-world boss.`,
        });
    if (
      new Set(p.seller.buy.orders.map((x) => x.item + ":" + x.level)).size !==
      p.seller.buy.orders.length
    )
      ctx.addIssue({
        code: "custom",
        message: "Buy orders must use unique item and level pairs.",
      });
    const listings = p.seller.listings.map((x) => `${x.item}:${x.level}`);
    if (new Set(listings).size !== listings.length)
      ctx.addIssue({
        code: "custom",
        message: "Each item and level can have only one stand price.",
      });
    if (
      new Set(p.seller.upgrade.rules.map((r) => r.item)).size !==
      p.seller.upgrade.rules.length
    )
      ctx.addIssue({
        code: "custom",
        message: "Each upgrade item can appear only once.",
      });
    if (new Set(p.seller.ponty.items).size !== p.seller.ponty.items.length)
      ctx.addIssue({
        code: "custom",
        message: "Ponty buy list items must be unique.",
      });
    if (new Set(p.seller.bankDeposit.items).size !== p.seller.bankDeposit.items.length)
      ctx.addIssue({
        code: "custom",
        message: "Recurring bank deposit items must be unique.",
      });
    if (new Set(p.seller.teamSupervisor.characters).size !== p.seller.teamSupervisor.characters.length)
      ctx.addIssue({
        code: "custom",
        message: "Team supervisor characters must be unique.",
      });
    for (const name of p.seller.teamSupervisor.characters) {
      const target = p.characters.find((character) => character.name === name);
      if (!target && !p.seller.teamSupervisor.standaloneSlots?.[name])
        ctx.addIssue({ code: "custom", message: `Team supervisor targets unknown character ${name}.` });
      else if (target?.ctype === "merchant")
        ctx.addIssue({ code: "custom", message: "The merchant cannot supervise-start itself." });
    }
    const kitKeys = p.seller.kit.rules.map((r) => `${r.character}:${r.slot}`);
    if (new Set(kitKeys).size !== kitKeys.length)
      ctx.addIssue({
        code: "custom",
        message:
          "Each character can have only one kit rule per equipment slot.",
      });
    for (const r of p.seller.kit.rules) {
      if (!names.includes(r.character))
        ctx.addIssue({
          code: "custom",
          message: `Kit rule targets unknown character ${r.character}.`,
        });
      if (
        p.characters.find((c) => c.name === r.character)?.ctype === "merchant"
      )
        ctx.addIssue({
          code: "custom",
          message: "Kit rules target farmers, not the merchant.",
        });
    }
    const consKeys = p.seller.consumables.rules.map(
      (r) => `${r.character}:${r.item}`,
    );
    if (new Set(consKeys).size !== consKeys.length)
      ctx.addIssue({
        code: "custom",
        message: "Each farmer can have only one consumable rule per item.",
      });
    for (const r of p.seller.consumables.rules) {
      if (!names.includes(r.character) && !p.seller.teamSupervisor.standaloneSlots?.[r.character])
        ctx.addIssue({
          code: "custom",
          message: `Consumable rule targets unknown character ${r.character}.`,
        });
      if (
        p.characters.find((c) => c.name === r.character)?.ctype === "merchant"
      )
        ctx.addIssue({
          code: "custom",
          message: "Consumable rules target farmers, not the merchant.",
        });
      if (r.minQty > r.targetQty)
        ctx.addIssue({
          code: "custom",
          message: `Consumable ${r.item} for ${r.character}: minimum must not exceed target.`,
        });
      if (r.targetQty > r.maxQty)
        ctx.addIssue({
          code: "custom",
          message: `Consumable ${r.item} for ${r.character}: target must not exceed maximum.`,
        });
    }
    const giftKeys = p.seller.gifts.rules.map(
      (r) => `${r.character}:${r.item}:${r.level}`,
    );
    if (new Set(giftKeys).size !== giftKeys.length)
      ctx.addIssue({
        code: "custom",
        message: "Each farmer can have only one keep-gift per item and level.",
      });
    for (const r of p.seller.gifts.rules) {
      if (!names.includes(r.character))
        ctx.addIssue({
          code: "custom",
          message: `Gift rule targets unknown character ${r.character}.`,
        });
      if (
        p.characters.find((c) => c.name === r.character)?.ctype === "merchant"
      )
        ctx.addIssue({
          code: "custom",
          message: "Gift rules target farmers, not the merchant.",
        });
    }
    for (const [who, board] of Object.entries(p.farming.loadouts || {})) {
      if (!names.includes(who))
        ctx.addIssue({
          code: "custom",
          message: `Loadout targets unknown character ${who}.`,
        });
      if (p.characters.find((c) => c.name === who)?.ctype === "merchant")
        ctx.addIssue({
          code: "custom",
          message: "Loadouts target farmers, not the merchant.",
        });
      for (const style of Object.keys(board)) {
        const slots = (board[style]?.gear || []).map((g) => g.slot);
        if (new Set(slots).size !== slots.length)
          ctx.addIssue({
            code: "custom",
            message: `${who} ${style} loadout can only set one item per slot.`,
          });
      }
    }
  });
export type Profile = z.infer<typeof profileSchema>;
export type Character = Profile["characters"][number];
export type ScriptInfo = {
  id: string;
  filename: string;
  label: string;
  ctype: string;
  kind: string;
  bytes: number;
  hash: string;
  config: Record<string, unknown>;
  variables: Record<string, unknown>;
};
export type Catalog = {
  scripts: ScriptInfo[];
  importedAt: string;
  sourceDirectory: string;
  monsters: {
    id: string;
    name: string;
    hp?: number;
    xp?: number;
    attack?: number;
    frequency?: number;
    damageType?: 'physical' | 'magical' | 'pure';
    armorPiercing?: number;
    resistancePiercing?: number;
    armor?: number;
    resistance?: number;
    respawn?: number;
    baseGold?: number;
    drops?: { rate: number; item: string; argument?: number; homeServer?: boolean }[];
  }[];
  items: {
    id: string;
    name: string;
    upgrade?: boolean;
    compound?: boolean;
    exchange?: boolean;
    goldValue?: number;
    stackSize?: number;
    npcShops?: string[];
    grades?: number[];
  }[];
  goldDrops?: { base: number; random: number; x10: number; x50: number };
  recipes?: Record<
    string,
    {
      cost: number;
      ingredients: { quantity: number; item: string; level: number }[];
    }
  >;
  assets: Record<
    string,
    {
      file: string;
      x: number;
      y: number;
      w: number;
      h: number;
      sheetWidth: number;
      sheetHeight: number;
    }
  >;
  maps?: Record<
    string,
    {
      src: string;
      minX: number;
      maxX: number;
      minY: number;
      maxY: number;
    }
  >;
};
export type Activity = {
  id: number;
  time: string;
  character: string;
  level: string;
  message: string;
};

