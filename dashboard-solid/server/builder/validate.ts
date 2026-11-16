/**
 * Checks a profile before any bundle is built: scripts exist and suit their character, overrides only touch
 * the script's own unmanaged settings with the right shape, automation and merchant rules make sense for the game.
 * Port of dashboard-v2's validateProfile (same messages); game facts come from G instead of v2's catalog.json.
 * New here: the builder sections must be present (a cautious profile has none until the farming and merchant
 * screens exist).
 */
import type { Profile, ProfileCharacter } from '../../shared/profile.ts';
import type { ScriptInfo } from './catalogue.ts';
import { merchantPolicy } from './merchant-policy.ts';
import { field, isRecord, list, strings, text, truthy } from '../../shared/raw.ts';

/** Keys the builder fills from the profile; a character override cannot set them. */
export const MANAGED_KEYS: ReadonlySet<string> = new Set([
  'NAME', 'PARTNER', 'WARRIOR', 'PRIEST', 'MAGE', 'RANGER', 'MERCHANT', 'PARTY', 'FARMERS', 'TEAM_SLOTS', 'TEAM_SUPERVISOR_ENABLED',
  'HOME', 'PONTY_HOME', 'DEFAULT_FARM', 'GABRIEL_SELL', 'EXCHANGE_ITEMS', 'EXCHANGE_MIN', 'UPGRADE_MAX', 'UPGRADE_GOLD_MIN', 'PONTY_ITEMS', 'PONTY_GOLD_KEEP',
]);

/** What the validation needs to know about game items (from G.items and G.craft). */
export interface GameFacts {
  readonly upgradeable: (item: string) => boolean;
  readonly compoundable: (item: string) => boolean;
  readonly hasRecipe: (item: string) => boolean;
}

export const BUILDER_SECTIONS = ['automation', 'farming', 'events', 'seller'] as const;

const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** An override must have the same shape as the script's default value (arrays of the same kind, known keys…). */
function shapeError(base: unknown, value: unknown, key: string): string | null {
  if (base === null) {
    return value === null || typeof value === 'number' || typeof value === 'string' ? null : `Invalid ${key}`;
  }
  if (Array.isArray(base)) {
    return arrayShapeError(base, value, key);
  }
  if (typeof base !== typeof value) {
    return `${key} must be ${typeof base}.`;
  }
  return isRecord(base) ? objectShapeError(base, value, key) : numberError(value, key);
}

function arrayShapeError(base: readonly unknown[], value: unknown, key: string): string | null {
  if (!Array.isArray(value)) {
    return `${key} must be an array.`;
  }
  const [model] = base;
  return base.length > 0 ? value.map((entry) => shapeError(model, entry, `${key}[]`)).find((error) => error !== null) ?? null : null;
}

/** Numbers are finite and non-negative; a *RATIO* setting stays between 0 and 1. */
function numberError(value: unknown, key: string): string | null {
  if (typeof value !== 'number') {
    return null;
  }
  if (!Number.isFinite(value) || value < 0) {
    return `${key} must be a non-negative number.`;
  }
  return key.includes('RATIO') && value > 1 ? `${key} must be between 0 and 1.` : null;
}

function objectShapeError(base: Record<string, unknown>, value: unknown, key: string): string | null {
  if (!isRecord(value)) {
    return `${key} must be an object.`;
  }
  for (const [name, entry] of Object.entries(value)) {
    if (UNSAFE_KEYS.has(name)) {
      return `Invalid setting key ${name}`;
    }
    const error = Object.hasOwn(base, name) ? shapeError(base[name], entry, `${key}.${name}`) : null;
    if (error !== null) {
      return error;
    }
  }
  return null;
}

function characterError(character: ProfileCharacter, scripts: readonly ScriptInfo[]): string | null {
  const script = scripts.find((entry) => entry.id === character.script);
  if (script === undefined) {
    return `Missing script: ${character.script}`;
  }
  if (script.ctype !== character.ctype && script.id !== 'stand-sell') {
    return `${script.label} is not compatible with ${character.name}.`;
  }
  if (script.kind === 'crypt' && character.job !== 'hunt') {
    return 'Crypt scripts do not support upgrade/combine jobs.';
  }
  return overridesError(character, script);
}

function overridesError(character: ProfileCharacter, script: ScriptInfo): string | null {
  for (const [key, value] of Object.entries(character.overrides)) {
    if (!Object.hasOwn(script.config, key)) {
      return `Unknown setting ${key} in ${script.filename}.`;
    }
    if (script.id !== 'stand-sell' && MANAGED_KEYS.has(key)) {
      return `${key} is managed by the party controls.`;
    }
    const error = shapeError(script.config[key], value, key);
    if (error !== null) {
      return error;
    }
  }
  return null;
}

function automationError(profile: Profile): string | null {
  const automation = profile['automation'];
  const enabled = (rules: unknown): boolean => list(rules).some((rule) => truthy(field(rule, 'enabled')));
  const needsPolicy = truthy(field(field(automation, 'dangers'), 'enabled')) || enabled(field(automation, 'lootGoals')) || enabled(field(automation, 'combatGear'));
  const unsupported = profile.characters.find((character) => character.enabled && character.ctype !== 'merchant' && needsPolicy && !character.script.endsWith('-v2'));
  if (unsupported !== undefined) {
    return `Automation requires a v2 farmer script for ${unsupported.name}.`;
  }
  const seller = profile.characters.find((character) => character.enabled && character.ctype === 'merchant');
  if (enabled(field(automation, 'commercialGoals')) && seller?.script !== 'eadrosell-merchant-v2') {
    return 'Commercial objectives require an enabled v2 merchant.';
  }
  return null;
}

function goalConflicts(seller: unknown, item: string): boolean {
  const exchange = field(seller, 'exchange');
  const upgrade = field(seller, 'upgrade');
  const deposit = field(seller, 'bankDeposit');
  return (truthy(field(exchange, 'enabled')) && strings(field(exchange, 'items')).includes(item))
    || (truthy(field(upgrade, 'enabled')) && list(field(upgrade, 'rules')).some((rule) => field(rule, 'item') === item))
    || (truthy(field(seller, 'standEnabled')) && list(field(seller, 'listings')).some((rule) => field(rule, 'item') === item && field(rule, 'level') === 0))
    || (truthy(field(deposit, 'enabled')) && strings(field(deposit, 'items')).includes(item));
}

/** A production goal must be craftable and its output must not be exchanged, upgraded, listed or banked meanwhile. */
function commercialGoalError(profile: Profile, facts: GameFacts): string | null {
  const seller = profile['seller'];
  const goals = list(field(profile['automation'], 'commercialGoals')).filter((goal) => truthy(field(goal, 'enabled'))).map((goal) => text(field(goal, 'item')));
  for (const item of goals) {
    if (!facts.hasRecipe(item)) {
      return `No craft recipe for ${item}.`;
    }
    if (goalConflicts(seller, item)) {
      return `Commercial goal ${item} conflicts with exchange, upgrade, listing or deposit rules. Keep production outputs until completion.`;
    }
  }
  return null;
}

function itemRulesError(profile: Profile, facts: GameFacts): string | null {
  const seller = profile['seller'];
  const notUpgradeable = list(field(field(seller, 'upgrade'), 'rules')).map((rule) => text(field(rule, 'item'))).find((item) => !facts.upgradeable(item));
  if (notUpgradeable !== undefined) {
    return `${notUpgradeable} cannot be upgraded (not an upgradeable item type).`;
  }
  const notCompoundable = list(field(field(seller, 'compound'), 'rules')).map((rule) => text(field(rule, 'item'))).find((item) => !facts.compoundable(item));
  return notCompoundable === undefined ? null : `${notCompoundable} cannot be compounded.`;
}

/** The first problem that blocks building this profile, or null. */
export function validateProfile(profile: Profile, scripts: readonly ScriptInfo[], facts: GameFacts): string | null {
  const missing = BUILDER_SECTIONS.find((name) => !isRecord(profile[name]));
  if (missing !== undefined) {
    return `The profile has no ${missing} section yet: import it from dashboard v2.`;
  }
  for (const character of profile.characters) {
    const error = characterError(character, scripts);
    if (error !== null) {
      return error;
    }
  }
  const merchantScript = scripts.some((script) => script.id.startsWith('eadrosell-merchant'));
  return automationError(profile) ?? commercialGoalError(profile, facts) ?? itemRulesError(profile, facts)
    ?? (merchantScript ? merchantPolicy(profile).errors[0] ?? null : null);
}
