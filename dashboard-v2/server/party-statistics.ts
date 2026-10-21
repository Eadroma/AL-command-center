import fs from 'node:fs';
import { throttledJsonWriter } from './json-file';
import type { LootCount, PartyStatistics } from '../shared/party-statistics';
import { statisticsActivity } from '../shared/statistics-activity';

interface Sample { sessionId: string; character: string; at: number; stats: { gold: number; map?: string }; farmContext?: { monster?: string; activity?: string }; loot?: { items?: LootCount[] } }
/** Cumulative loot counters are scoped to CODE sessions; inventory transfers are never loot. */
export class PartyStatisticsHistory {
  private state: PartyStatistics & { last: Record<string, Sample> } = { startedAt: 0, balances: [], items: [], last: {} };
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
    const balance = this.state.balances.find(row => row.at === at && row.character === sample.character);
    if (balance) { balance.gold = sample.stats.gold; balance.observedAt = sample.at; }
    else this.state.balances.push({ at, observedAt: sample.at, character: sample.character, gold: sample.stats.gold });
    const month = new Date(sample.at).toISOString().slice(0, 7);
    const activity = statisticsActivity({ map: sample.stats.map, farmContext: sample.farmContext });
    const receiptAt = Math.floor(sample.at / 300000) * 300000;
    this.state.receipts ??= [];
    for (const item of sample.loot?.items ?? []) {
      const old = previous?.sessionId === sample.sessionId ? previous.loot?.items?.find(row => row.name === item.name && row.level === item.level)?.quantity ?? 0 : 0;
      const quantity = Math.max(0, item.quantity - old);
      if (!quantity) continue;
      const receipt = this.state.receipts.find(row => row.at === receiptAt && row.character === sample.character && row.name === item.name && row.level === item.level && row.activity === activity);
      if (receipt) receipt.quantity += quantity;
      else this.state.receipts.push({ ...item, quantity, at: receiptAt, character: sample.character, activity });
      const row = this.state.items.find(row => row.month === month && row.character === sample.character && row.name === item.name && row.level === item.level);
      if (row) row.quantity += quantity;
      else this.state.items.push({ ...item, quantity, month, character: sample.character });
    }
    this.state.last[sample.character] = sample;
    this.state.receipts = this.state.receipts.filter(row => row.at >= sample.at - 7 * 86400000).slice(-30000);
    this.state.balances = this.state.balances.filter(row => row.at >= sample.at - 366 * 86400000).slice(-30000);
    this.state.items = this.state.items.filter(row => row.month >= new Date(sample.at - 366 * 86400000).toISOString().slice(0, 7)).slice(-10000);
    this.persist();
  }
  view(): PartyStatistics { return { startedAt: this.state.startedAt, balances: this.state.balances, items: this.state.items, receipts: this.state.receipts ?? [] }; }
}
