/**
 * Turns one game script into its deployable bundle source: replaces the managed top-level variables (CONFIG,
 * BOARD_CTL, HUNT_ALLOW, BOSS_CHECKS), rewrites the functions the profile controls, then adds the `__ALCC` metadata
 * and the shared runtime modules. A port of dashboard-v2's adaptSource, identical byte for byte (golden tests).
 * The game-code snippets live in ./runtime/*.js; the shared modules are read from the code directory.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { FunctionDeclaration } from 'acorn';
import type { Profile, ProfileCharacter } from '../../shared/profile.ts';
import type { ScriptInfo } from './catalogue.ts';
import { parseScript } from './catalogue.ts';
import { effectiveConfig } from './effective-config.ts';
import { merchantPolicy } from './merchant-policy.ts';
import { activeConsumables, bundleMetadata } from './metadata.ts';
import type { JsonRecord } from '../../shared/raw.ts';
import { field, list, recordOr, strings, truthy } from '../../shared/raw.ts';
import { bundleWarnings } from './warnings.ts';

const RUNTIME = path.join(import.meta.dirname, 'runtime');
const snippet = (name: string): string => readFileSync(path.join(RUNTIME, name), 'utf8');

interface Edit {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

export interface AdaptInput {
  readonly source: string;
  readonly profile: Profile;
  readonly character: ProfileCharacter;
  readonly script: ScriptInfo;
  readonly codeDirectory: string;
}

export interface AdaptedSource {
  readonly code: string;
  readonly warnings: readonly string[];
  readonly config: JsonRecord;
  readonly policy: { readonly warnings: readonly string[]; readonly errors: readonly string[] };
}

const HUNT_FUNCTIONS = new Set(['maybe_daisy', 'daisy_need', 'daisy_need_own', 'daisy_need_ally', 'own_hunt_usable', 'hunt_should_try', 'huntLoop']);
const GEAR_SCRIPTS = ['eadroma-warrior', 'aedroma-priest', 'droma-ranger'];

interface Rules {
  readonly input: AdaptInput;
  readonly board: JsonRecord;
  readonly hunts: boolean;
  readonly rareVisits: boolean;
  readonly bosses: boolean;
  readonly merchant: boolean;
}

function controlBoard(profile: Profile, character: ProfileCharacter): JsonRecord {
  const eventsOn = truthy(field(profile['events'], 'enabled'));
  return {
    leader: character.follow === '' ? character.name : character.follow,
    monster: 'auto',
    roles: Object.fromEntries(profile.characters.map((entry) => [entry.name, entry.follow === '' ? 'Leader' : 'Follow'])),
    events: Object.fromEntries(profile.characters.map((entry) => [entry.name, eventsOn && entry.events])),
  };
}

function bossChecks(profile: Profile): JsonRecord {
  // v2 parses a default board in when the profile has none; an absent board means no scheduled walks here.
  return recordOr(field(profile['farming'], 'bossChecks'), { enabled: false, rules: [] });
}

function pontyEmpty(profile: Profile): boolean {
  const ponty = field(profile['seller'], 'ponty');
  return !(field(ponty, 'enabled') !== false && list(field(ponty, 'items')).length > 0);
}

/** A rule matched: replace the body with `text`, or keep the original when `text` is null. */
interface Matched {
  readonly text: string | null;
}

const keep: Matched = { text: null };
const replace = (text: string): Matched => ({ text });

/** Control functions, rewritten for every bundle. Generated bundles never poll the old control board. */
function fixedBodies(rules: Rules): Readonly<Record<string, Matched>> {
  const { input } = rules;
  return {
    live_control: replace(`return ${JSON.stringify(rules.board)};`),
    poll_board: replace('return;'),
    apply_ctl: replace('return;'),
    maybe_start_team: input.script.id.startsWith('eadrosell-merchant') ? keep : replace('return false;'),
    events_enabled: replace(`return ${String(truthy(field(input.profile['events'], 'enabled')) && input.character.events)};`),
  };
}

/** Farming and control functions; null when no rule concerns this function. */
function controlBody(name: string, rules: Rules): Matched | null {
  const fixed = fixedBodies(rules);
  if (Object.hasOwn(fixed, name)) {
    return fixed[name] ?? keep;
  }
  return disabledBody(name, rules);
}

/** Features the profile turns off answer "nothing to do" (hunts, Phoenix visits, boss walks). */
function disabledBody(name: string, rules: Rules): Matched | null {
  if (!rules.hunts && HUNT_FUNCTIONS.has(name)) {
    return replace('return false;');
  }
  const nullWhen = (!rules.hunts && name === 'pick_party_hunt') || (!rules.rareVisits && name === 'nearby_phoenix')
    || (!rules.bosses && (name === 'scheduled_boss_farm' || name === 'live_boss_check'));
  return nullWhen ? replace('return null;') : null;
}

function merchantBody(name: string, rules: Rules): string | null {
  if (!rules.merchant) {
    return null;
  }
  const bodies: Readonly<Record<string, () => string | null>> = {
    maybe_keep_shop: () => snippet('merchant-stand.js'),
    maybe_dashboard_kit: () => snippet('merchant-kit.js'),
    maybe_dashboard_consumables: () => snippet('merchant-consumables.js'),
    maybe_dashboard_gifts: () => snippet('merchant-gifts.js'),
    maybe_ponty_tour: () => (pontyEmpty(rules.input.profile) ? 'return false;' : null),
    locate_listed_keep: () => snippet('locate-listed-keep.js'),
    should_sell: () => snippet('should-sell.js'),
  };
  return Object.hasOwn(bodies, name) ? bodies[name]?.() ?? null : null;
}

function gearBody(node: FunctionDeclaration, rules: Rules): string | null {
  const { script, source } = rules.input;
  const name = node.id.name;
  const body = source.slice(node.body.start + 1, node.body.end - 1);
  const farmer = GEAR_SCRIPTS.some((prefix) => script.id.startsWith(prefix)) || script.id === 'tonerre-mage';
  if (farmer && name === 'maybe_ensure_gear') {
    return `${body}\n await wear_dashboard_kit();\n await use_dashboard_consumables();`;
  }
  // The warrior equips its kit in maybe_ensure_gear only.
  if (farmer && !script.id.startsWith('eadroma-warrior') && name === 'ensure_gear') {
    return `await wear_dashboard_kit();await use_dashboard_consumables();${body}`;
  }
  return rules.merchant && name === 'should_upgrade' ? snippet('should-upgrade.js') : null;
}

/** v2's else-if chain over one function: the first rule that applies wins. */
function functionEdits(node: FunctionDeclaration, rules: Rules): Edit[] {
  const { character, script, profile } = rules.input;
  const name = node.id.name;
  const edits: Edit[] = [];
  const guarded = name === 'movementLoop' || (name === 'huntLoop' && truthy(field(profile['farming'], 'hunts')));
  if (character.ctype !== 'merchant' && script.id.endsWith('-v2') && guarded) {
    const at = node.body.start + 1;
    edits.push({ start: at, end: at, text: `\nif(typeof RuntimePolicy!=='undefined'&&!RuntimePolicy.allowLoop(${JSON.stringify(name)})){setTimeout(${name},250);return;}\n` });
  }
  const control = controlBody(name, rules);
  const body = control === null ? merchantBody(name, rules) ?? gearBody(node, rules) : control.text;
  return body === null ? edits : [...edits, { start: node.body.start, end: node.body.end, text: `{${body}}` }];
}

function sourceEdits(rules: Rules, replacements: JsonRecord): Edit[] {
  return parseScript(rules.input.source).body.flatMap((node): Edit[] => {
    if (node.type === 'VariableDeclaration') {
      return node.declarations.flatMap((declaration): Edit[] => {
        const init = declaration.init;
        return declaration.id.type === 'Identifier' && Object.hasOwn(replacements, declaration.id.name) && init !== null && init !== undefined
          ? [{ start: init.start, end: init.end, text: JSON.stringify(replacements[declaration.id.name]) }]
          : [];
      });
    }
    return node.type === 'FunctionDeclaration' ? functionEdits(node, rules) : [];
  });
}

function applyEdits(source: string, edits: readonly Edit[]): string {
  return [...edits].sort((a, b) => b.start - a.start).reduce((code, edit) => code.slice(0, edit.start) + edit.text + code.slice(edit.end), source);
}

export function adaptSource(input: AdaptInput): AdaptedSource {
  const { profile, character, script } = input;
  const farming = profile['farming'];
  const bosses = bossChecks(profile);
  const bossesOn = truthy(bosses['enabled']) && list(bosses['rules']).length > 0;
  const rules: Rules = {
    input, board: controlBoard(profile, character), hunts: truthy(field(farming, 'hunts')), rareVisits: truthy(field(farming, 'rareVisits')), bosses: bossesOn,
    merchant: character.ctype === 'merchant' && script.id.startsWith('eadrosell-merchant'),
  };
  const config = effectiveConfig(profile, character, script);
  const replacements: JsonRecord = {
    CONFIG: config,
    BOARD_CTL: rules.board,
    HUNT_ALLOW: Object.fromEntries(strings(field(farming, 'allowedHunts')).map((hunt) => [hunt, 1])),
    BOSS_CHECKS: truthy(bosses['enabled']) ? bosses['rules'] : [],
  };
  const body = applyEdits(input.source, sourceEdits(rules, replacements));
  const policy = script.id.startsWith('eadrosell-merchant') ? merchantPolicy(profile) : { warnings: [], errors: [] };
  if (policy.errors.length > 0) {
    throw new Error(policy.errors[0]);
  }
  const files = filesIn(input.codeDirectory);
  const code = `${prelude(input, files)}${body}${epilogue(input, files)}`;
  return { code, warnings: bundleWarnings({ profile, character, script, config, policyWarnings: policy.warnings, consumables: activeConsumables(profile) }), config, policy };
}

const MERCHANT_GUIS = ['merchant-mission-gui.js', 'merchant-operations-gui.js', 'merchant-party-gui.js', 'merchant-target-gui.js', 'merchant-events-gui.js', 'merchant-enemies-gui.js', 'merchant-combat-gui.js', 'merchant-actions-gui.js'];
const FARM_LIBRARIES = ['action-timing.js', 'event-router.js', 'style-loadout.js', 'cave-dreams.js', 'crypt-run.js', 'world-event-intel.js', 'team-coordinator.js'];

interface Files {
  readonly read: (name: string) => string;
  readonly has: (name: string) => boolean;
}

function filesIn(directory: string): Files {
  return { read: (name) => readFileSync(path.join(directory, name), 'utf8'), has: (name) => existsSync(path.join(directory, name)) };
}

/** Merchant transactions journal, bank hub (v2 only), upgrade and compound production. */
function merchantModules(files: Files, v2: boolean): string {
  const { read } = files;
  const transactions = files.has('merchant-transactions.js') ? `\n${read('merchant-transactions.js')}\n` : '';
  const bank = v2 ? `${read('bank-coordinator.js')}${read('manual-bank-deposit.js')}${files.has('crypt-supply.js') ? read('crypt-supply.js') : ''}` : '';
  return `${transactions}${bank}${read('upgrade-production.js')}${read('compound-production.js')}`;
}

/** Header, `__ALCC`, then the runtime modules the script needs (merchant boards and GUIs, expedition, policy). */
function prelude(input: AdaptInput, files: Files): string {
  const { character, script } = input;
  const { read } = files;
  const merchant = character.ctype === 'merchant';
  const v2 = script.id.endsWith('-v2');
  const expedition = (merchant && v2 ? `${read('merchant-halloween.js')}\n${read('merchant-witch-cipher.js')}\n` : '')
    + (v2 ? `${read('event-expedition.js')}\nEventExpedition.install();\n` : '');
  const policyRuntime = v2 ? `${read('runtime-policy.js')}\nRuntimePolicy.install();\n${merchant ? '' : `${read('combat-gear.js')}\nCombatGear.install();\n`}` : '';
  const header = '// Generated by Adventure Land Command Center. Original source is unchanged.\n'
    + '// Publish/restart explicitly. Closing the dashboard does not stop this script.\n'
    + `var __ALCC = ${JSON.stringify(bundleMetadata(input.profile, character, script))};\nvar SCRIPT_JOB = ${JSON.stringify(character.job)};\n`;
  return `${header}${merchant ? merchantModules(files, v2) : ''}${expedition}${merchant ? MERCHANT_GUIS.map(read).join('') : ''}${policyRuntime}`;
}

/** What follows the script: merchant stand spot and bank sorter, farm kit helpers and libraries, navigation. */
function epilogue(input: AdaptInput, files: Files): string {
  const { character, script } = input;
  const { read, has } = files;
  const merchant = character.ctype === 'merchant';
  const optional = (name: string): string => (has(name) ? `\n${read(name)}` : '');
  const farm = script.kind === 'farm' && !merchant;
  const libraries = farm ? FARM_LIBRARIES.map(optional).join('') + (character.ctype === 'warrior' ? optional('dragold-intel.js') : '') : '';
  const watchdog = (script.kind === 'farm' || merchant) && has('movement-watchdog.js') ? `\n${read('owned-navigation.js')}\n${read('movement-watchdog.js')}` : '';
  const spot = "\nif(__ALCC.standSpot){SHOP_XY.market={map:__ALCC.standSpot.map||'main',x:Number(__ALCC.standSpot.x)||0,y:Number(__ALCC.standSpot.y)||0};}\n";
  const merchantTail = merchant ? `${spot}${has('bank-sorter.js') ? read('bank-sorter.js') : ''}\n` : '';
  return `${merchantTail}${farm ? snippet('farm-wear.js') : ''}${libraries}${watchdog}`;
}
