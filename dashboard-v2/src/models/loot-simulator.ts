import { bossIds } from '../../shared/schema';
import type { Catalog, Profile } from '../types';
import { EVENT_DEFINITIONS } from './events';

export interface LootSimulationInput {
  monster: Catalog['monsters'][number];
  teamDps: number;
  efficiencyPercent: number;
  spawnCount: number;
  luckPercent: number;
  goldMultiplierPercent: number;
  homeServer: boolean;
  dynamicSpawnsPerHour?: number;
  catalog: Catalog;
}

export interface SimulatedDrop {
  item: string;
  name: string;
  chancePercent: number;
  unitsPerHour: number;
  npcGoldPerHour: number;
  homeServer: boolean;
}

export interface LootSimulation {
  effectiveDps: number;
  killSeconds: number;
  killsPerHour: number;
  dpsLimitedKills: number;
  spawnLimitedKills: number | null;
  xpPerHour: number;
  directGoldPerHour: number;
  npcGoldPerHour: number;
  totalGoldPerHour: number;
  drops: SimulatedDrop[];
}

export interface SurvivalInput {
  monster: LootSimulationInput['monster'];
  killSeconds: number;
  tank?: { name: string; maxHp: number; armor: number; resistance: number };
  healingPerSecond: number;
}

export interface SurvivalAssessment {
  warning: boolean;
  unknown: boolean;
  incomingHit: number;
  incomingDps: number;
  healingPerSecond: number;
  survivalSeconds: number | null;
  reason: string;
}

const finitePositive = (value: number) => Number.isFinite(value) && value > 0 ? value : 0;

/**
 * Keep only regular farming targets understood by the v2 farmer route.
 * Event and recurring-boss IDs are excluded even when older HUNT_ALLOW data
 * still contains them (Phoenix and Jr. are common examples).
 */
export function farmableLootMonsters(catalog: Catalog, profile?: Profile): Catalog['monsters'] {
  const warrior = catalog.scripts.find(script => script.ctype === 'warrior' && script.id.includes('v2'))
    ?? catalog.scripts.find(script => script.ctype === 'warrior');
  const scriptAllow = warrior?.variables?.HUNT_ALLOW;
  const ids = scriptAllow && typeof scriptAllow === 'object' && !Array.isArray(scriptAllow)
    ? Object.keys(scriptAllow)
    : [...new Set([...(profile?.farming.allowedHunts ?? []), profile?.farming.defaultMonster ?? '', ...(profile?.characters.map(character => character.farmMonster).filter(Boolean) ?? [])])];
  const excluded = new Set([...bossIds, ...EVENT_DEFINITIONS.map(event => event.id)]);
  const allowed = new Set(ids.filter(id => id && !excluded.has(id)));
  return catalog.monsters.filter(monster => allowed.has(monster.id) && (monster.hp ?? 0) > 0);
}

/** Expected cash multiplier for the server's independent x10 and x50 chest rolls. */
export function expectedGoldPerKill(monster: LootSimulationInput['monster'], catalog: Catalog) {
  const rules = catalog.goldDrops;
  if (!rules || !monster.baseGold) return 0;
  const ordinary = 1 + monster.baseGold * (rules.base + rules.random / 2);
  return ordinary * (1 + 9 * rules.x10) * (1 + 49 * rules.x50);
}

/** Adventure Land's piecewise armor/resistance multiplier, mirrored from game data. */
export function damageMultiplier(defense: number) {
  const band = (start: number, width: number, rate: number) => Math.max(0, Math.min(width, defense - start)) * rate;
  const reduction = band(0, 100, .001) + band(100, 100, .001) + band(200, 100, .00095)
    + band(300, 100, .0009) + band(400, 100, .00082) + band(500, 100, .0007)
    + band(600, 100, .0006) + band(700, 100, .0005) + Math.max(0, defense - 800) * .0004;
  const vulnerability = Math.max(0, Math.min(50, -defense)) * .001
    + Math.max(0, Math.min(50, -50 - defense)) * .00075
    + Math.max(0, Math.min(50, -100 - defense)) * .0005
    + Math.max(0, -150 - defense) * .00025;
  return Math.min(1.32, Math.max(.05, 1 - reduction + vulnerability));
}

/** Conservative one-target sustain check; the UI labels it as an estimate. */
export function assessSurvival({ monster, killSeconds, tank, healingPerSecond }: SurvivalInput): SurvivalAssessment {
  if (!tank || tank.maxHp <= 0) return { warning: false, unknown: true, incomingHit: 0, incomingDps: 0, healingPerSecond, survivalSeconds: null, reason: 'Live tank defenses unavailable' };
  const type = monster.damageType ?? 'physical';
  const defense = type === 'magical'
    ? tank.resistance - (monster.resistancePiercing ?? 0)
    : tank.armor - (monster.armorPiercing ?? 0);
  const incomingHit = Math.max(0, monster.attack ?? 0) * (type === 'pure' ? 1 : damageMultiplier(defense));
  const incomingDps = incomingHit * Math.max(0, monster.frequency ?? 0);
  const netDps = Math.max(0, incomingDps - Math.max(0, healingPerSecond));
  const survivalSeconds = netDps > 0 ? tank.maxHp / netDps : null;
  const oneShotRisk = incomingHit >= tank.maxHp * .65;
  const sustainRisk = survivalSeconds !== null && survivalSeconds < Math.max(3, killSeconds * 1.5);
  const warning = oneShotRisk || sustainRisk;
  const reason = oneShotRisk
    ? `${Math.round(incomingHit).toLocaleString()} estimated damage per hit vs ${Math.round(tank.maxHp).toLocaleString()} HP`
    : sustainRisk
      ? `Estimated survival ${survivalSeconds.toFixed(1)}s vs ${killSeconds.toFixed(1)}s kill time`
      : `Estimated incoming ${Math.round(incomingDps).toLocaleString()} DPS, healing ${Math.round(healingPerSecond).toLocaleString()} HPS`;
  return { warning, unknown: false, incomingHit, incomingDps, healingPerSecond, survivalSeconds, reason };
}

/** Pure theoretical projection. Callers supply measured or manually adjusted team DPS. */
export function simulateLoot(input: LootSimulationInput): LootSimulation {
  const hp = finitePositive(input.monster.hp ?? 0);
  const effectiveDps = finitePositive(input.teamDps) * Math.min(1, Math.max(0, input.efficiencyPercent / 100));
  const dpsLimitedKills = hp && effectiveDps ? effectiveDps * 3600 / hp : 0;
  const respawn = finitePositive(input.monster.respawn ?? 0);
  const spawnLimitedKills = respawn
    ? Math.max(1, Math.floor(input.spawnCount)) * 3600 / respawn
    : input.dynamicSpawnsPerHour === undefined ? null : Math.max(0, input.dynamicSpawnsPerHour) * Math.max(1, Math.floor(input.spawnCount));
  const killsPerHour = spawnLimitedKills === null ? dpsLimitedKills : Math.min(dpsLimitedKills, spawnLimitedKills);
  const luckMultiplier = Math.max(0, input.luckPercent / 100);
  const items = new Map(input.catalog.items.map(item => [item.id, item]));
  const drops = (input.monster.drops ?? [])
    .filter(drop => input.homeServer || !drop.homeServer)
    .map(drop => {
      const item = items.get(drop.item);
      const chance = Math.min(1, Math.max(0, drop.rate * luckMultiplier));
      const quantity = item && (item.stackSize ?? 1) > 1 ? Math.max(1, drop.argument ?? 1) : 1;
      const unitsPerHour = killsPerHour * chance * quantity;
      return {
        item: drop.item,
        name: item?.name ?? drop.item,
        chancePercent: chance * 100,
        unitsPerHour,
        npcGoldPerHour: unitsPerHour * (item?.goldValue ?? 0) * 0.6,
        homeServer: drop.homeServer === true,
      };
    })
    .sort((a, b) => b.npcGoldPerHour - a.npcGoldPerHour || b.unitsPerHour - a.unitsPerHour);
  const goldMultiplier = Math.max(0, input.goldMultiplierPercent / 100);
  const directGoldPerHour = killsPerHour * expectedGoldPerKill(input.monster, input.catalog) * goldMultiplier;
  const npcGoldPerHour = drops.reduce((sum, drop) => sum + drop.npcGoldPerHour, 0);
  return {
    effectiveDps,
    killSeconds: hp && effectiveDps ? hp / effectiveDps : 0,
    killsPerHour,
    dpsLimitedKills,
    spawnLimitedKills,
    xpPerHour: killsPerHour * finitePositive(input.monster.xp ?? 0),
    directGoldPerHour,
    npcGoldPerHour,
    totalGoldPerHour: directGoldPerHour + npcGoldPerHour,
    drops,
  };
}
