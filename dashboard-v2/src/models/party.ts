import type { Profile } from '../../shared/schema';
import type { CharacterDeployment } from '../types/deployments';
import type { BootstrapResponse } from '../hooks/useBootstrap';
import type { PartyMember } from '../types/party';
import type { LogEntry } from '../types/activity';

/** Only fresh telemetry proves a character is running; missing resources stay unknown. */
export function mapParty(profile: Profile, deployments: Record<string, CharacterDeployment>): PartyMember[] {
  return profile.characters.map(character => {
    const telemetry = deployments[character.name]?.telemetry;
    const stats = telemetry?.live ? telemetry.stats : undefined;
    const inventory = telemetry?.inventory ?? [];
    const equipment = telemetry?.equipment ?? [];
    const stand = telemetry?.stand ?? [];
    const occupiedSlots = inventory.length;
    const freeSlots = telemetry?.live && telemetry.inventory ? Math.max(0, 42 - occupiedSlots) : null;
    return {
      name: character.name,
      class: character.ctype,
      skin: stats?.skin || null,
      status: !character.enabled ? 'disabled' : !telemetry?.live ? 'offline' : stats && stats.hp <= 0 ? 'dead' : 'online',
      hp: stats?.hp ?? null,
      maxHp: stats?.max_hp ?? null,
      mp: stats?.mp ?? null,
      maxMp: stats?.max_mp ?? null,
      gold: stats?.gold ?? null,
      xp: stats?.xp ?? null,
      goldMultiplier: stats?.goldMultiplier ?? null,
      luckMultiplier: stats?.luckMultiplier ?? null,
      xpMultiplier: stats?.xpMultiplier ?? null,
      activeEffects: telemetry?.live ? telemetry.activeEffects ?? [] : [],
      positionHistory: telemetry?.positionHistory ?? [],
      freeSlots,
      inventory,
      equipment,
      stand,
      hunt: telemetry?.hunt ?? null,
      map: stats?.map ?? null,
      x: stats?.x ?? null,
      y: stats?.y ?? null,
      level: stats?.level ?? null,
      target: stats?.target || null,
      runtime: character.runtime,
      script: character.script,
      deploymentStage: deployments[character.name]?.stage ?? null,
      intent: telemetry?.intent ?? null,
      movement: telemetry?.movement ?? null,
    };
  });
}

/** The API returns newest first; the console renders chronological entries. */
export function mapActivity(activity: BootstrapResponse['activity']): LogEntry[] {
  return activity.map((entry): LogEntry => ({
    id: entry.id,
    timestamp: entry.time,
    source: entry.character || 'System',
    level: entry.level === 'warn' || entry.level === 'error' || entry.level === 'debug' ? entry.level : 'info',
    message: entry.message,
  })).sort((a, b) => a.id - b.id);
}
