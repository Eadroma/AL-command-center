export interface LootCount { name: string; level: number; quantity: number }
export interface TrackerSnapshot { monsters: Record<string, number>; exchanges: Record<string, number> }
export interface PartyStatistics {
  startedAt: number;
  balances: Array<{ at: number; observedAt?: number; character: string; gold: number }>;
  items: Array<LootCount & { month: string; character: string }>;
  receipts?: Array<LootCount & { at: number; character: string; activity: string }>;
}
