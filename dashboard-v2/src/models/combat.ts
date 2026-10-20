import type { Character, Profile } from '../../shared/schema';
import type { CharacterDeployment, CombatFailure, CombatMetrics, DeploymentsResponse, NetworkMetrics } from '../types';

export interface CombatRow {
  character: Character;
  live: boolean;
  combat?: CombatMetrics;
  network?: NetworkMetrics;
  elapsedSeconds: number;
  damagePerSecond: number;
  damageTaken: number;
  movementPercent: number;
  coveragePercent: number;
}

export interface ClassifiedFailure extends CombatFailure {
  character: string;
}

const percent = (part: number, total: number) => total > 0 ? Math.min(100, Math.max(0, Math.round((part / total) * 100))) : 0;

/** Derive stable display metrics from cumulative telemetry without changing API data. */
export function combatRows(profile: Profile, deployments?: DeploymentsResponse, now = Date.now()): CombatRow[] {
  return profile.characters.filter(character => character.enabled && character.ctype !== 'merchant').map(character => {
    const telemetry = deployments?.characters[character.name]?.telemetry ?? undefined;
    const combat = telemetry?.combat;
    const elapsedSeconds = combat ? Math.max(1, (now - combat.startedAt) / 1000) : 0;
    return {
      character,
      live: telemetry?.live === true,
      combat,
      network: telemetry?.network,
      elapsedSeconds,
      damagePerSecond: combat ? combat.damageDealt / elapsedSeconds : 0,
      damageTaken: combat ? combat.damageTakenPhysical + combat.damageTakenMagical : 0,
      movementPercent: combat ? percent(combat.movingMs, combat.combatMs) : 0,
      coveragePercent: combat ? percent(combat.healerCoverageMs, combat.combatMs) : 0,
    };
  });
}

/** Merge and sort the latest classified failures across all configured characters. */
export function classifiedFailures(rows: CombatRow[], deployments?: DeploymentsResponse): ClassifiedFailure[] {
  return rows.flatMap(row => {
    const deployment: CharacterDeployment | undefined = deployments?.characters[row.character.name];
    return (deployment?.telemetry?.failures ?? []).map(failure => ({ ...failure, character: row.character.name }));
  }).sort((a, b) => b.at - a.at);
}

export function compactMetric(value: number) {
  return Math.round(value || 0).toLocaleString();
}
