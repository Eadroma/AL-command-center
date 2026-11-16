/**
 * Profile draft (pure, tested without a browser): edits stay local until saved, and the draft keeps the revision
 * it started from, so a save from an outdated window is refused by the server instead of overwriting.
 */
import type { Profile, ProfileCharacter, SavedProfile } from '../../shared/profile.ts';
import type { BaseStyle, GearSlot } from '../../shared/loadouts.ts';
import { MAX_MIN_LEVEL } from '../../shared/loadouts.ts';
import type { JsonRecord } from '../../shared/raw.ts';
import { field, list, record } from '../../shared/raw.ts';

export interface Draft {
  readonly revision: number;
  readonly profile: Profile;
}

export type CharacterPatch = Partial<Pick<ProfileCharacter, 'enabled' | 'events' | 'follow' | 'runtime' | 'farmMonster'>>;

export function draftOf(saved: SavedProfile): Draft {
  return { revision: saved.revision, profile: saved.profile };
}

/** A new draft with one character changed; the original is never mutated. */
export function patchCharacter(draft: Draft, name: string, patch: CharacterPatch): Draft {
  return {
    ...draft,
    profile: { ...draft.profile, characters: draft.profile.characters.map((character) => (character.name === name ? { ...character, ...patch } : character)) },
  };
}

export function isDirty(draft: Draft, saved: SavedProfile): boolean {
  return draft.revision !== saved.revision || JSON.stringify(draft.profile) !== JSON.stringify(saved.profile);
}

/**
 * A target without a combat style gets one, as dashboard-v2 does: Mono for the warrior's single-target picks,
 * AOE otherwise. An existing choice is never overwritten.
 */
function withStyleFor(farming: JsonRecord, monster: string, monoTargets: readonly string[]): JsonRecord {
  const styles = record(farming['style']);
  if (monster === '' || Object.hasOwn(styles, monster)) {
    return farming;
  }
  return { ...farming, style: { ...styles, [monster]: monoTargets.includes(monster) ? 'mono' : 'aoe' } };
}

export interface FarmingPatch {
  /** Team target, used by every character without its own. */
  readonly defaultMonster?: string;
  /** Opportunistic rare visits (Phoenix…). */
  readonly rareVisits?: boolean;
}

/** Changes the farming section in place of its keys: the other farming settings keep their values and order. */
export function patchFarming(draft: Draft, patch: FarmingPatch, monoTargets: readonly string[]): Draft {
  const farming = { ...record(draft.profile['farming']), ...patch };
  return { ...draft, profile: { ...draft.profile, farming: withStyleFor(farming, patch.defaultMonster ?? '', monoTargets) } };
}

/** The character's own target ('' = the team target). */
export function setCharacterTarget(draft: Draft, target: { readonly name: string; readonly monster: string }, monoTargets: readonly string[]): Draft {
  const { name, monster } = target;
  const changed = patchCharacter(draft, name, { farmMonster: monster });
  return { ...changed, profile: { ...changed.profile, farming: withStyleFor(record(changed.profile['farming']), monster, monoTargets) } };
}

/** One loadout: a character's gear and skills for one style (aoe, mono, tank, or a custom one). */
export interface LoadoutTarget {
  readonly character: string;
  readonly style: string;
}

/** Replaces one loadout through `change`; every other loadout, character and farming key stays as it was. */
function updateLoadout(draft: Draft, target: LoadoutTarget, change: (loadout: JsonRecord) => JsonRecord): Draft {
  const farming = record(draft.profile['farming']);
  const loadouts = record(farming['loadouts']);
  const board = record(loadouts[target.character]);
  const loadout = change(record(board[target.style]));
  return {
    ...draft,
    profile: { ...draft.profile, farming: { ...farming, loadouts: { ...loadouts, [target.character]: { ...board, [target.style]: loadout } } } },
  };
}

/** Wears `gear` in a slot (replacing what was there, in place), or empties the slot with null. Levels stay 0 to 15. */
export function setGear(draft: Draft, target: LoadoutTarget & { readonly slot: GearSlot }, gear: { readonly item: string; readonly minLevel: number } | null): Draft {
  return updateLoadout(draft, target, (loadout) => {
    const rules = list(loadout['gear']).filter((rule) => gear !== null || field(rule, 'slot') !== target.slot);
    if (gear === null) {
      return { ...loadout, gear: rules };
    }
    const rule = { slot: target.slot, item: gear.item, minLevel: Math.min(MAX_MIN_LEVEL, Math.max(0, Math.round(gear.minLevel))) };
    const index = rules.findIndex((entry) => field(entry, 'slot') === target.slot);
    return { ...loadout, gear: index < 0 ? [...rules, rule] : rules.map((entry, position) => (position === index ? rule : entry)) };
  });
}

export function setSkills(draft: Draft, target: LoadoutTarget, skills: readonly string[]): Draft {
  return updateLoadout(draft, target, (loadout) => ({ ...loadout, skills: [...skills] }));
}

/** Which of AOE / Mono / Tank a loadout counts as (the warrior's weapon choice follows it). */
export function setBase(draft: Draft, target: LoadoutTarget, base: BaseStyle): Draft {
  return updateLoadout(draft, target, (loadout) => ({ ...loadout, base }));
}
