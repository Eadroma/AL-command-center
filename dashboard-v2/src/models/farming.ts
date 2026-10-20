import {
  bossCheckIntervals,
  emptyCharacterLoadouts,
  type FarmStyle,
  type Profile,
} from '../../shared/schema';
import type { Catalog } from '../types';

type FarmingFlag = 'hunts' | 'rareVisits' | 'dailyDungeon';
type GearRule = Profile['farming']['loadouts'][string][FarmStyle]['gear'][number];

/** Item ids follow the same stable key format as the persisted profile schema. */
export function isValidItemId(value: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(value) && value.length <= 80;
}

/** Resolve the source script's weapon-pack convention for a newly selected monster. */
export function defaultFarmStyle(id: string, catalog?: Catalog): FarmStyle {
  const warrior = catalog?.scripts.find(script => script.ctype === 'warrior');
  const weapons = warrior?.config.WEAPONS as { pack?: Record<string, string> } | undefined;
  return weapons?.pack?.[id] === 'fireblade' ? 'mono' : 'aoe';
}

export function farmStyle(profile: Profile, id: string, catalog?: Catalog): FarmStyle {
  return profile.farming.style[id] ?? defaultFarmStyle(id, catalog);
}

export function setFarmingFlag(profile: Profile, key: FarmingFlag, value: boolean): Profile {
  return { ...profile, farming: { ...profile.farming, [key]: value } };
}

export function setDefaultMonster(profile: Profile, id: string, catalog?: Catalog): Profile {
  const style = profile.farming.style[id] === undefined
    ? { ...profile.farming.style, [id]: defaultFarmStyle(id, catalog) }
    : profile.farming.style;
  return { ...profile, farming: { ...profile.farming, defaultMonster: id, style } };
}

export function setCharacterFarmMonster(profile: Profile, name: string, id: string, catalog?: Catalog): Profile {
  const style = id && profile.farming.style[id] === undefined
    ? { ...profile.farming.style, [id]: defaultFarmStyle(id, catalog) }
    : profile.farming.style;
  return {
    ...profile,
    characters: profile.characters.map(character => character.name === name ? { ...character, farmMonster: id } : character),
    farming: style === profile.farming.style ? profile.farming : { ...profile.farming, style },
  };
}

export function setHuntAllowed(profile: Profile, id: string, allowed: boolean, catalog?: Catalog): Profile {
  const allowedHunts = allowed
    ? [...new Set([...profile.farming.allowedHunts, id])]
    : profile.farming.allowedHunts.filter(monster => monster !== id);
  const style = allowed && profile.farming.style[id] === undefined
    ? { ...profile.farming.style, [id]: defaultFarmStyle(id, catalog) }
    : profile.farming.style;
  return { ...profile, farming: { ...profile.farming, allowedHunts, style } };
}

export function setFarmStyle(profile: Profile, id: string, style: FarmStyle): Profile {
  return { ...profile, farming: { ...profile.farming, style: { ...profile.farming.style, [id]: style } } };
}

export function nearestBossInterval(respawnSeconds: number): number {
  return bossCheckIntervals.reduce((best, minutes) =>
    Math.abs(minutes * 60 - respawnSeconds) < Math.abs(best * 60 - respawnSeconds) ? minutes : best,
  bossCheckIntervals[0]);
}

export function setBossChecksEnabled(profile: Profile, enabled: boolean): Profile {
  return { ...profile, farming: { ...profile.farming, bossChecks: { ...profile.farming.bossChecks, enabled } } };
}

export function setBossRule(profile: Profile, boss: string, everyMinutes: number | null): Profile {
  const rules = everyMinutes === null
    ? profile.farming.bossChecks.rules.filter(rule => rule.boss !== boss)
    : [...profile.farming.bossChecks.rules.filter(rule => rule.boss !== boss), { boss, everyMinutes }];
  return { ...profile, farming: { ...profile.farming, bossChecks: { ...profile.farming.bossChecks, rules } } };
}

function loadout(profile: Profile, name: string) {
  return profile.farming.loadouts[name] ?? emptyCharacterLoadouts();
}

export function setLoadoutGear(profile: Profile, name: string, style: FarmStyle, rule: GearRule | null, slot: GearRule['slot']): Profile {
  const board = loadout(profile, name);
  const current = board[style] ?? emptyCharacterLoadouts().aoe;
  const gear = rule
    ? [...current.gear.filter(entry => entry.slot !== slot), rule]
    : current.gear.filter(entry => entry.slot !== slot);
  return {
    ...profile,
    farming: {
      ...profile.farming,
      loadouts: { ...profile.farming.loadouts, [name]: { ...board, [style]: { ...current, gear } } },
    },
  };
}

export function toggleLoadoutSkill(profile: Profile, name: string, style: FarmStyle, skill: string): Profile {
  const board = loadout(profile, name);
  const current = board[style] ?? emptyCharacterLoadouts().aoe;
  const skills = current.skills.includes(skill)
    ? current.skills.filter(entry => entry !== skill)
    : [...current.skills, skill];
  return {
    ...profile,
    farming: {
      ...profile.farming,
      loadouts: { ...profile.farming.loadouts, [name]: { ...board, [style]: { ...current, skills } } },
    },
  };
}
