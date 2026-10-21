import fs from 'node:fs';
import { throttledJsonWriter } from './json-file';

export interface PerformanceSample {
  sessionId: string; character: string; at: number;
  stats: { gold: number; xp: number; level: number; map?: string; server?: string };
  loot?: { gold: number };
  economy?: { consumablesGold: number; consumed: number; unpriced: number; npcSalesGold?: number };
  farmContext?: { activity?: string; monster: string; participants: string[]; build?: string; effects?: string[]; goldMultiplier?: number };
  combat?: { damageDealt: number; healing: number; kills: number; deaths: number; attacks: number; movingMs: number; combatMs: number };
}
export interface PerformanceBucket {
  lootGold?: number; lootElapsedMs?: number;
  npcSalesGold?: number; npcSalesElapsedMs?: number; netLootGold?: number; consumablesGold?: number; consumed?: number; unpriced?: number; economyElapsedMs?: number;
  map?: string; server?: string;
  farmContext?: { activity?: string; monster: string; participants: string[]; build?: string; effects?: string[]; goldMultiplier?: number };
  character: string; at: number; elapsedMs: number; damage: number; healing: number; kills: number; deaths: number; attacks: number; movingMs: number; combatMs: number; xp: number; gold: number;
}
interface State { last: Record<string, PerformanceSample>; buckets: PerformanceBucket[]; }
const BUCKET_MS = 5 * 60 * 1000;
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
// Match the telemetry liveness window. Beyond it the interval is unobserved.
const MAX_SAMPLE_GAP_MS = 20_000;
const bucketKey = (row: Pick<PerformanceBucket, 'character' | 'at' | 'map' | 'server' | 'farmContext'>) =>
  `${row.character}|${row.at}|${row.map}|${row.server}|${JSON.stringify(row.farmContext)}`;
const delta =(current: number, previous: number) => current >= previous ? current - previous : 0;

/** Persist compact five-minute deltas and reset baselines across CODE sessions. */
export class PerformanceHistory {
  private state: State = { last: {}, buckets: [] };
  private index?: Map<string, PerformanceBucket>;
  private persist: () => void;
  constructor(file?: string, private now = Date.now) {
    this.persist = throttledJsonWriter(file, () => this.state);
    if (file && fs.existsSync(file)) try { this.state = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
  }
  record(sample: PerformanceSample) {
    const previous = this.state.last[sample.character];
    // A late/replayed sample must never replace the newer baseline.
    if (previous && sample.at <= previous.at) return false;
    this.state.last[sample.character] = sample;
    if (!previous || previous.sessionId !== sample.sessionId || !sample.combat || !previous.combat
      || sample.at - previous.at >= MAX_SAMPLE_GAP_MS) { this.persist(); return false; }
    const elapsedMs = sample.at - previous.at;
    const at = Math.floor(sample.at / BUCKET_MS) * BUCKET_MS;
    const map = sample.stats.map === previous.stats.map ? sample.stats.map : 'transition';
    const server = sample.stats.server === previous.stats.server ? sample.stats.server : 'transition';
    const farmContext = (sample.farmContext?.monster || sample.farmContext?.activity) && JSON.stringify(sample.farmContext) === JSON.stringify(previous.farmContext) ? sample.farmContext : undefined;
    this.index ??= new Map(this.state.buckets.map(row => [bucketKey(row), row]));
    let bucket = this.index.get(bucketKey({ character: sample.character, at, map, server, farmContext }));
    if (!bucket) {
      bucket = { character: sample.character, at, map, server, farmContext, elapsedMs: 0, damage: 0, healing: 0, kills: 0, deaths: 0, attacks: 0, movingMs: 0, combatMs: 0, xp: 0, gold: 0 };
      // Prune when a bucket opens (once per character per 5 min), not on every sample.
      this.state.buckets = this.state.buckets.filter(row => row.at >= this.now() - RETENTION_MS).sort((a, b) => a.at - b.at);
      this.state.buckets.push(bucket);
      this.index = new Map(this.state.buckets.map(row => [bucketKey(row), row]));
    }
    bucket.elapsedMs += elapsedMs;
    bucket.damage += delta(sample.combat.damageDealt, previous.combat.damageDealt);
    bucket.healing += delta(sample.combat.healing, previous.combat.healing);
    bucket.kills += delta(sample.combat.kills, previous.combat.kills);
    bucket.deaths += delta(sample.combat.deaths, previous.combat.deaths);
    bucket.attacks += delta(sample.combat.attacks, previous.combat.attacks);
    bucket.movingMs += delta(sample.combat.movingMs, previous.combat.movingMs);
    bucket.combatMs += delta(sample.combat.combatMs, previous.combat.combatMs);
    bucket.xp += sample.stats.level === previous.stats.level ? delta(sample.stats.xp, previous.stats.xp) : 0;
    bucket.gold += Math.max(0, sample.stats.gold - previous.stats.gold);
    // Separate coverage prevents historical balance samples from diluting loot rates.
    if (sample.loot && previous.loot && sample.loot.gold >= previous.loot.gold) {
      bucket.lootGold = (bucket.lootGold ?? 0) + sample.loot.gold - previous.loot.gold;
      bucket.lootElapsedMs = (bucket.lootElapsedMs ?? 0) + elapsedMs;
    }
    if (sample.loot && previous.loot && sample.economy && previous.economy
      && sample.loot.gold >= previous.loot.gold && sample.economy.consumablesGold >= previous.economy.consumablesGold
      && sample.economy.consumed >= previous.economy.consumed && sample.economy.unpriced >= previous.economy.unpriced) {
      bucket.netLootGold = (bucket.netLootGold ?? 0) + sample.loot.gold - previous.loot.gold;
      bucket.consumablesGold = (bucket.consumablesGold ?? 0) + sample.economy.consumablesGold - previous.economy.consumablesGold;
      bucket.consumed = (bucket.consumed ?? 0) + sample.economy.consumed - previous.economy.consumed;
      bucket.unpriced = (bucket.unpriced ?? 0) + sample.economy.unpriced - previous.economy.unpriced;
      bucket.economyElapsedMs = (bucket.economyElapsedMs ?? 0) + elapsedMs;
    }
    if (sample.economy?.npcSalesGold !== undefined && previous.economy?.npcSalesGold !== undefined && sample.economy.npcSalesGold >= previous.economy.npcSalesGold) {
      bucket.npcSalesGold = (bucket.npcSalesGold ?? 0) + sample.economy.npcSalesGold - previous.economy.npcSalesGold;
      bucket.npcSalesElapsedMs = (bucket.npcSalesElapsedMs ?? 0) + elapsedMs;
    }
    this.persist(); return true;
  }
  view(hours = 24) {
    const normalizedHours = Math.min(168, Math.max(1, hours));
    const since = this.now() - normalizedHours * 60 * 60 * 1000;
    return { hours: normalizedHours, bucketMinutes: BUCKET_MS / 60000, buckets: this.state.buckets.filter(row => row.at >= since) };
  }
}
