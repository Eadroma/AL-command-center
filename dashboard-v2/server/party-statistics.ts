import fs from 'node:fs';
import { throttledJsonWriter } from './json-file';
import type { LootCount, PartyStatistics } from '../shared/party-statistics';
import { statisticsActivity } from '../shared/statistics-activity';

interface Sample { sessionId: string; character: string; at: number; stats: { gold: number; map?: string }; farmContext?: { monster?: string; activity?: string }; loot?: { items?: LootCount[] } }
type Receipt = NonNullable<PartyStatistics['receipts']>[number];
type Balance = PartyStatistics['balances'][number];
const receiptKey = (row: Pick<Receipt, 'at' | 'character' | 'name' | 'level' | 'activity'>) => `${row.at}|${row.character}|${row.name}|${row.level}|${row.activity}`;
const balanceKey = (row: Pick<Balance, 'at' | 'character'>) => `${row.at}|${row.character}`;
/** Cumulative loot counters are scoped to CODE sessions; inventory transfers are never loot. */
export class PartyStatisticsHistory {
  private state: PartyStatistics & { last: Record<string, Sample> } = { startedAt: 0, balances: [], items: [], last: {} };
  // Lookup indexes over the persisted arrays; rebuilt lazily after each prune.
  private receiptIndex?: Map<string, Receipt>;
  private balanceIndex?: Map<string, Balance>;
  private persist: () => void;
  constructor(file?: string) {
    this.persist = throttledJsonWriter(file, () => this.state);
    if (file && fs.existsSync(file)) try { this.state = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* Start a new history if the file is corrupt. */ }
  }
  record(sample: Sample) {
    const previous = this.state.last[sample.character];
    if (previous && sample.at <= previous.at) return;
    this.state.startedAt ||= sample.at;
    const at = Math.floor(sample.at / 3600000) * 3600000;
    this.state.receipts ??= [];
    this.balanceIndex ??= new Map(this.state.balances.map(row => [balanceKey(row), row]));
    this.receiptIndex ??= new Map(this.state.receipts.map(row => [receiptKey(row), row]));
    let grew = false;
    const balance = this.balanceIndex.get(balanceKey({ at, character: sample.character }));
    if (balance) { balance.gold = sample.stats.gold; balance.observedAt = sample.at; }
    else { const row = { at, observedAt: sample.at, character: sample.character, gold: sample.stats.gold }; this.state.balances.push(row); this.balanceIndex.set(balanceKey(row), row); grew = true; }
    const month = new Date(sample.at).toISOString().slice(0, 7);
    const activity = statisticsActivity({ map: sample.stats.map, farmContext: sample.farmContext });
    const receiptAt = Math.floor(sample.at / 300000) * 300000;
    for (const item of sample.loot?.items ?? []) {
      const old = previous?.sessionId === sample.sessionId ? previous.loot?.items?.find(row => row.name === item.name && row.level === item.level)?.quantity ?? 0 : 0;
      const quantity = Math.max(0, item.quantity - old);
      if (!quantity) continue;
      const receipt = this.receiptIndex.get(receiptKey({ at: receiptAt, character: sample.character, name: item.name, level: item.level, activity }));
      if (receipt) receipt.quantity += quantity;
      else { const row = { ...item, quantity, at: receiptAt, character: sample.character, activity }; this.state.receipts.push(row); this.receiptIndex.set(receiptKey(row), row); grew = true; }
      // Monthly rows stay small (one per character, item and month), so a scan is fine here.
      const row = this.state.items.find(row => row.month === month && row.character === sample.character && row.name === item.name && row.level === item.level);
      if (row) row.quantity += quantity;
      else this.state.items.push({ ...item, quantity, month, character: sample.character });
    }
    this.state.last[sample.character] = sample;
    // Retention only changes when rows are added (new 5-minute or hourly bucket), so prune then instead of on every packet.
    if (grew) {
      this.state.receipts = this.state.receipts.filter(row => row.at >= sample.at - 7 * 86400000).slice(-30000);
      this.state.balances = this.state.balances.filter(row => row.at >= sample.at - 366 * 86400000).slice(-30000);
      this.state.items = this.state.items.filter(row => row.month >= new Date(sample.at - 366 * 86400000).toISOString().slice(0, 7)).slice(-10000);
      this.receiptIndex = this.balanceIndex = undefined;
    }
    this.persist();
  }
  view(): PartyStatistics { return { startedAt: this.state.startedAt, balances: this.state.balances, items: this.state.items, receipts: this.state.receipts ?? [] }; }
}
