/**
 * The `__ALCC` object each bundle starts with: the profile parts the game scripts read at run time (merchant boards,
 * events, automation…). Sections are copied as stored, in v2's key order, so the code stays identical to v2's.
 */
import type { Profile, ProfileCharacter } from '../../shared/profile.ts';
import type { ScriptInfo } from './catalogue.ts';
import type { JsonRecord } from '../../shared/raw.ts';
import { field, list, record, strings, truthy } from '../../shared/raw.ts';

/** `value || fallback` for a board: the stored board when present, the fallback otherwise. */
function boardOr(value: unknown, fallback: JsonRecord): JsonRecord {
  return truthy(value) ? record(value) : fallback;
}

/** Consumables delivered while an activity restricts them to its own list. */
export function activeConsumables(profile: Profile): JsonRecord {
  const active = strings(field(profile['automation'], 'activeConsumables'));
  const board = field(profile['seller'], 'consumables');
  if (active.length > 0) {
    return { ...record(board), rules: list(field(board, 'rules')).filter((rule) => active.includes(String(field(rule, 'item')))) };
  }
  return boardOr(board, { enabled: true, rules: [] });
}

function eventFields(profile: Profile, character: ProfileCharacter): JsonRecord {
  const events = profile['events'];
  const expedition = field(events, 'expedition');
  const first = (type: string): string => profile.characters.find((entry) => entry.enabled && entry.ctype === type)?.name ?? '';
  const duo = truthy(field(expedition, 'enabled')) ? ['warrior', 'priest'].includes(character.ctype) : character.events;
  return {
    events: field(events, 'allowed'),
    eventsEnabledMaster: field(events, 'enabled'),
    eventsEnabled: truthy(field(events, 'enabled')) && duo,
    eventExpedition: { ...record(expedition), merchant: first('merchant'), warrior: first('warrior'), priest: first('priest') },
  };
}

function sellerFields(profile: Profile, consumables: JsonRecord): JsonRecord {
  const seller = profile['seller'];
  return {
    buy: field(seller, 'buy'),
    standEnabled: field(seller, 'standEnabled'),
    trickOrTreat: boardOr(field(seller, 'trickOrTreat'), { enabled: false }),
    witchCipher: boardOr(field(seller, 'witchCipher'), { enabled: false }),
    listings: field(seller, 'listings'),
    standSpot: field(seller, 'standSpot'),
    npcEnabled: field(seller, 'npcEnabled'),
    exchange: field(seller, 'exchange'),
    upgrade: field(seller, 'upgrade'),
    compound: boardOr(field(seller, 'compound'), { enabled: false, checkBankOnDeposit: false, rules: [] }),
    craft: field(seller, 'craft'),
    workOrder: field(seller, 'workOrder'),
    ponty: boardOr(field(seller, 'ponty'), { enabled: true, items: [] }),
    kit: boardOr(field(seller, 'kit'), { enabled: true, rules: [] }),
    consumables,
    gifts: boardOr(field(seller, 'gifts'), { enabled: true, rules: [] }),
    bankDeposit: field(seller, 'bankDeposit'),
  };
}

export function bundleMetadata(profile: Profile, character: ProfileCharacter, script: ScriptInfo): JsonRecord {
  return {
    character: character.name,
    script: character.script,
    runtime: character.runtime,
    ...eventFields(profile, character),
    dailyDungeon: truthy(field(profile['farming'], 'dailyDungeon')),
    profile: profile.name,
    homeServer: profile.server,
    sourceHash: script.hash,
    ...sellerFields(profile, activeConsumables(profile)),
    automation: profile['automation'],
    farmers: profile.characters.filter((entry) => entry.enabled && entry.ctype !== 'merchant').map((entry) => entry.name),
    priests: profile.characters.filter((entry) => entry.enabled && entry.ctype === 'priest').map((entry) => entry.name),
  };
}
