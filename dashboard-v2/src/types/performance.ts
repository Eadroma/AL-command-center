export interface PerformanceBucket {
  character: string; at: number; elapsedMs: number; damage: number; healing: number;
  kills: number; deaths: number; attacks: number; movingMs: number; combatMs: number;
  xp: number; gold: number;
  npcSalesGold?: number; npcSalesElapsedMs?: number; netLootGold?: number; consumablesGold?: number; consumed?: number; unpriced?: number; economyElapsedMs?: number;
  lootGold?: number; lootElapsedMs?: number;
  map?: string; server?: string;
  farmContext?: { activity?: string; monster: string; participants: string[]; build?: string; effects?: string[]; goldMultiplier?: number };
}
export interface PerformanceHistoryResponse { hours: number; bucketMinutes: number; buckets: PerformanceBucket[]; }
