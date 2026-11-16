/**
 * The CONFIG a character's bundle receives: the script's own CONFIG, the character's overrides, then the values the
 * profile manages (names, party, farming, merchant lists…). A port of dashboard-v2's effectiveConfig, kept identical
 * value for value and key order for key order (golden tests in test/builder.test.ts).
 *
 * Each phase returns steps: "set" changes a key only if the script declares it, "force" always writes it. Phases run
 * in v2's order because later ones read what earlier ones wrote.
 */
import type { Profile, ProfileCharacter } from '../../shared/profile.ts';
import type { ScriptInfo } from './catalogue.ts';
import type { JsonRecord } from '../../shared/raw.ts';
import { field, isRecord, list, nullishOr, record, recordOr, strings, text, truthy } from '../../shared/raw.ts';

type Step = readonly [key: string, value: unknown, mode: 'set' | 'force'];

interface Context {
  readonly profile: Profile;
  readonly character: ProfileCharacter;
  readonly script: ScriptInfo;
  readonly active: readonly ProfileCharacter[];
  readonly expedition: boolean;
}

const COMBAT_PAIR = new Set(['warrior', 'priest']);
const STYLES = new Set(['aoe', 'mono', 'tank']);
const isMerchantScript = (script: ScriptInfo): boolean => script.id.startsWith('eadrosell-merchant');

function section(context: Context, name: string): unknown {
  return context.profile[name];
}

function nameOf(context: Context, type: string): string {
  return context.active.find((entry) => entry.ctype === type)?.name ?? '';
}

function partySteps(context: Context, result: JsonRecord): Step[] {
  const { character, active } = context;
  const follow = character.follow;
  const leader: Step[] = follow === ''
    ? [['WARRIOR', nameOf(context, 'warrior'), 'set'], ...('PARTNER' in result ? [['PARTNER', nameOf(context, 'warrior'), 'force'] as const] : [])]
    : [['PARTNER', follow, 'set'], ['WARRIOR', follow, 'set'], ['PARTNER', follow, 'force']];
  const inParty = (other: ProfileCharacter): boolean => other.name !== character.name && other.ctype !== 'merchant'
    && (!context.expedition || (COMBAT_PAIR.has(character.ctype) && COMBAT_PAIR.has(other.ctype)));
  return [
    ['NAME', character.name, 'set'],
    ...leader,
    ['PRIEST', nameOf(context, 'priest'), 'set'],
    ['MAGE', nameOf(context, 'ranger') === '' ? nameOf(context, 'mage') : nameOf(context, 'ranger'), 'set'],
    ['RANGER', nameOf(context, 'ranger') || nameOf(context, 'rogue'), 'set'],
    ['MERCHANT', nameOf(context, 'merchant'), 'set'],
    ...(character.ctype === 'rogue' ? [['merchantSpot', field(section(context, 'seller'), 'standSpot'), 'set'] as const] : []),
    ['PARTY', active.filter(inParty).map((entry) => entry.name), 'set'],
    ['FARMERS', active.filter((entry) => entry.ctype !== 'merchant').map((entry) => entry.name), 'set'],
  ];
}

/** CODE slots the merchant starts: selected enabled farmers (all when none is selected), plus standalone slots. */
function teamSlots(context: Context, supervisor: JsonRecord): JsonRecord {
  const slots: JsonRecord = {};
  if (!isMerchantScript(context.script)) {
    return slots;
  }
  const selected = strings(supervisor['characters']);
  const allowed = (name: string): boolean => name !== context.character.name && (selected.length === 0 || selected.includes(name));
  for (const other of context.active) {
    const busy = context.expedition && COMBAT_PAIR.has(other.ctype);
    if (other.ctype !== 'merchant' && !busy && allowed(other.name)) {
      slots[other.name] = `CC_${other.name}`;
    }
  }
  for (const [name, slot] of Object.entries(record(supervisor['standaloneSlots']))) {
    if (allowed(name)) {
      slots[name] = slot;
    }
  }
  return slots;
}

function supervisorSteps(context: Context): Step[] {
  const supervisor = record(field(section(context, 'seller'), 'teamSupervisor'));
  const slots = teamSlots(context, supervisor);
  const farmers = context.active.filter((entry) => entry.ctype !== 'merchant').map((entry) => entry.name);
  return [
    ...(isMerchantScript(context.script) ? [['FARMERS', [...new Set([...farmers, ...Object.keys(slots)])], 'set'] as const] : []),
    ['TEAM_SLOTS', slots, 'set'],
    ['TEAM_SUPERVISOR_ENABLED', supervisor['enabled'], 'set'],
    ['HOME', context.profile.server, 'set'],
    ['PONTY_HOME', context.profile.server, 'set'],
  ];
}

/** Farm target: a FIXED_FARM script keeps its own; otherwise the character's, else the team default. */
function farmTarget(context: Context, result: JsonRecord): string {
  if (result['FIXED_FARM'] === true) {
    const own = context.script.config['DEFAULT_FARM'];
    if (truthy(own)) {
      return String(own);
    }
    return truthy(result['DEFAULT_FARM']) ? String(result['DEFAULT_FARM']) : '';
  }
  return context.character.farmMonster === '' ? text(field(section(context, 'farming'), 'defaultMonster')) : context.character.farmMonster;
}

function farmSteps(context: Context, result: JsonRecord, target: string): Step[] {
  const farming = section(context, 'farming');
  const fixed = result['FIXED_FARM'] === true;
  const independent = fixed || context.character.farmMonster !== '';
  const hunts = result['hunts'];
  return [
    ['DEFAULT_FARM', target, 'set'],
    ['FARM_INDEPENDENT', independent, 'set'],
    ['DEFAULT_FARM', target, 'force'],
    ['FARM_INDEPENDENT', independent, 'force'],
    // Every combat member receives the cave runner, or the three-character roster can never enter.
    ['DAILY_DUNGEON', truthy(field(farming, 'dailyDungeon')), 'force'],
    ['RARE_VISITS', fixed ? false : truthy(field(farming, 'rareVisits')), 'force'],
    ...(isRecord(hunts) ? [['hunts', { ...hunts, enabled: fixed ? false : truthy(field(farming, 'hunts')) }, 'force'] as const] : []),
  ];
}

function activityBuild(context: Context): JsonRecord | null {
  const build = field(field(section(context, 'automation'), 'activeBuilds'), context.character.name);
  return isRecord(build) ? build : null;
}

function packStyle(context: Context, target: string): JsonRecord {
  const styles: JsonRecord = { ...recordOr(field(section(context, 'events'), 'style'), {}), ...recordOr(field(section(context, 'farming'), 'style'), {}) };
  if (target !== '' && !STYLES.has(text(styles[target]))) {
    styles[target] = 'aoe';
  }
  const build = activityBuild(context);
  if (build !== null && build['monster'] !== '*') {
    styles[text(build['monster'])] = build['style'];
  }
  return styles;
}

function board(context: Context): unknown {
  return field(field(section(context, 'farming'), 'loadouts'), context.character.name);
}

function loadoutSteps(context: Context, target: string): Step[] {
  const own = board(context);
  const empty = { gear: [], skills: [] };
  const pick = (style: string): unknown => (truthy(field(own, style)) ? field(own, style) : empty);
  return [
    ['PACK_STYLE', packStyle(context, target), 'force'],
    ['STYLE_LOADOUTS', { aoe: pick('aoe'), mono: pick('mono'), tank: pick('tank'), ...record(own) }, 'force'],
  ];
}

function sellerSteps(context: Context): Step[] {
  const seller = section(context, 'seller');
  const exchange = field(seller, 'exchange');
  const upgrade = field(seller, 'upgrade');
  const maxLevel = list(field(upgrade, 'rules')).reduce<number>((max, rule) => Math.max(max, Number(field(rule, 'maxLevel'))), 0);
  const minGold = nullishOr(field(upgrade, 'minGold'), 0);
  const ponty = recordOr(field(seller, 'ponty'), { enabled: true, minGold: 200_000, items: [] });
  const pontyItems = truthy(ponty['enabled']) ? ponty['items'] : [];
  const pontyKeep = nullishOr(ponty['minGold'], 200_000);
  const merchant = context.character.ctype === 'merchant';
  return [
    ['GABRIEL_SELL', truthy(field(seller, 'npcEnabled')) ? field(seller, 'npcItems') : [], 'set'],
    ['EXCHANGE_ITEMS', truthy(field(exchange, 'enabled')) ? field(exchange, 'items') : [], 'set'],
    ['EXCHANGE_MIN', field(exchange, 'minimum'), 'set'],
    // Legacy global ceiling for source helpers; should_upgrade uses per-item rules. Forced for the merchant.
    ['UPGRADE_MAX', maxLevel, 'set'],
    ...(merchant ? [['UPGRADE_MAX', maxLevel, 'force'], ['UPGRADE_GOLD_MIN', minGold, 'force']] as const : []),
    ['UPGRADE_GOLD_MIN', minGold, 'set'],
    ['PONTY_ITEMS', pontyItems, 'set'],
    ['PONTY_GOLD_KEEP', pontyKeep, 'set'],
    ...(merchant ? [['PONTY_ITEMS', pontyItems, 'force'], ['PONTY_GOLD_KEEP', pontyKeep, 'force']] as const : []),
  ];
}

/** The warrior's weapon per pack: lolipop for AOE, fireblade otherwise (a custom style uses its base). */
function weaponSteps(context: Context, result: JsonRecord, target: string): Step[] {
  const weapons = result['WEAPONS'];
  if (!context.script.id.startsWith('eadroma-warrior') || !isRecord(weapons)) {
    return [];
  }
  const next: JsonRecord = structuredClone(weapons);
  const pack: JsonRecord = { ...recordOr(next['pack'], {}) };
  const baseOf = (mode: string): unknown => (STYLES.has(mode) ? mode : nullishOr(field(field(board(context), mode), 'base'), 'aoe'));
  const weaponFor = (mode: string): string => (baseOf(mode) === 'aoe' ? 'lolipop' : 'fireblade');
  for (const [id, mode] of Object.entries(recordOr(field(section(context, 'farming'), 'style'), {}))) {
    pack[id] = weaponFor(text(mode));
  }
  for (const [id, mode] of Object.entries(recordOr(field(section(context, 'events'), 'style'), {}))) {
    pack[id] = weaponFor(text(mode));
  }
  const build = activityBuild(context);
  if (build !== null && build['monster'] === '*') {
    for (const id of new Set([...Object.keys(pack), ...Object.keys(packStyle(context, target)), target])) {
      pack[id] = weaponFor(text(build['style']));
    }
    next['default'] = weaponFor(text(build['style']));
  } else if (build !== null) {
    pack[text(build['monster'])] = weaponFor(text(build['style']));
  }
  next['pack'] = pack;
  return [['WEAPONS', next, 'force']];
}

function ruleItems(value: unknown, name: string): string[] {
  const rules = recordOr(value, { enabled: true, rules: [] });
  return truthy(rules['enabled']) ? list(rules['rules']).filter((rule) => field(rule, 'character') === name).map((rule) => text(field(rule, 'item'))) : [];
}

interface Reserved {
  readonly item: unknown;
  readonly minLevel: unknown;
}

/** Combat and travel gear first, then every loadout piece: reservations are level-aware. */
function reservedGear(context: Context): Reserved[] {
  const name = context.character.name;
  const combat = list(field(section(context, 'automation'), 'combatGear'))
    .filter((rule) => truthy(field(rule, 'enabled')) && field(rule, 'character') === name)
    .flatMap((rule): Reserved[] => [
      { item: field(rule, 'combatItem'), minLevel: field(rule, 'combatMinLevel') },
      ...(truthy(field(rule, 'movementItem')) ? [{ item: field(rule, 'movementItem'), minLevel: field(rule, 'movementMinLevel') }] : []),
    ]);
  const loadouts = Object.keys(record(board(context))).flatMap((style) => list(field(field(board(context), style), 'gear')).map((gear): Reserved => {
    const minLevel = field(gear, 'minLevel');
    return { item: field(gear, 'item'), minLevel: truthy(minLevel) ? minLevel : 0 };
  }));
  // StyleLoadout swaps the priest to Lantern +4 against magical monsters: keep it in the bag.
  const lantern: Reserved[] = context.character.ctype === 'priest' ? [{ item: 'lantern', minLevel: 4 }] : [];
  return [...combat, ...loadouts, ...lantern];
}

/** What a farmer must not sell or bank: kit, consumables and gifts, and its loadout and combat gear (level-aware). */
function keepSteps(context: Context, result: JsonRecord): Step[] {
  if (context.character.ctype === 'merchant') {
    return [];
  }
  const seller = section(context, 'seller');
  const name = context.character.name;
  const extras = ['kit', 'consumables', 'gifts'].flatMap((key) => ruleItems(field(seller, key), name));
  const items = reservedGear(context);
  const unique = items.filter((entry, index) => items.findIndex((other) => other.item === entry.item && other.minLevel === entry.minLevel) === index);
  const kept = list(result['KEEP_ITEMS']);
  return [
    ...(items.length > 0 ? [['LOADOUT_ITEMS', unique, 'force'] as const] : []),
    ...(extras.length > 0 ? [['KEEP_ITEMS', [...new Set([...kept, ...extras])], 'force'] as const] : []),
  ];
}

/** The event duo (warrior + priest) drops hunts, rare visits and the cave while the merchant runs the expedition. */
function expeditionSteps(context: Context, result: JsonRecord): Step[] {
  if (!context.expedition || !COMBAT_PAIR.has(context.character.ctype)) {
    return [];
  }
  const hunts = result['hunts'];
  return [
    ...(isRecord(hunts) ? [['hunts', { ...hunts, enabled: false }, 'force'] as const] : []),
    ['RARE_VISITS', false, 'force'],
    ['DAILY_DUNGEON', false, 'force'],
    ['PARTY_GUESTS', [], 'force'],
  ];
}

/** A copy with the steps applied: existing keys keep their place, new ones go last (the JSON order matters). */
function apply(result: JsonRecord, steps: readonly Step[]): JsonRecord {
  const next = { ...result };
  for (const [key, value, mode] of steps) {
    if (mode === 'force' || key in next) {
      next[key] = value;
    }
  }
  return next;
}

export function effectiveConfig(profile: Profile, character: ProfileCharacter, script: ScriptInfo): JsonRecord {
  const base: JsonRecord = { ...script.config, ...character.overrides };
  if (script.id === 'stand-sell') {
    return base;
  }
  const context: Context = {
    profile, character, script,
    active: profile.characters.filter((entry) => entry.enabled),
    expedition: truthy(field(field(profile['events'], 'expedition'), 'enabled')),
  };
  const named = apply(apply(base, partySteps(context, base)), supervisorSteps(context));
  const target = farmTarget(context, named);
  const farmed = apply(apply(apply(named, farmSteps(context, named, target)), loadoutSteps(context, target)), sellerSteps(context));
  const armed = apply(farmed, weaponSteps(context, farmed, target));
  const kept = apply(armed, keepSteps(context, armed));
  return apply(kept, expeditionSteps(context, kept));
}
