import fs from 'node:fs';

export interface OperationTransaction {
  id: string; character: string; kind: string; detail: string; state: 'committed' | 'failed'; startedAt: number; finishedAt: number; message: string;
}
export interface CommerceEvent {
  id: string; character: string; side: 'sale' | 'purchase'; item: string; level: number; quantity: number; unitPrice: number; goldDelta: number; at: number;
}
interface RuntimeSample {
  character: string; at: number; stats: { gold: number };
  stand?: Array<{ slot: number; name: string; level: number; quantity: number; price: number; buy: boolean }>;
  merchantTransactions?: { journal: Array<{ id: string; kind: string; detail: string; state: 'running' | 'committed' | 'failed'; startedAt: number; finishedAt: number; message: string }> };
}
interface State {
  transactions: OperationTransaction[];
  commerce: CommerceEvent[];
  seenTransactions: string[];
  previous: Record<string, { at: number; gold: number; stand: RuntimeSample['stand'] }>;
}
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/** Persists confirmed runtime transactions and conservative stand-sale observations. */
export class OperationsHistory {
  private state: State = { transactions: [], commerce: [], seenTransactions: [], previous: {} };
  constructor(private file?: string, private now = Date.now) {
    if (file && fs.existsSync(file)) try { this.state = { ...this.state, ...JSON.parse(fs.readFileSync(file, 'utf8')) }; } catch {}
  }
  private persist() {
    if (!this.file) return;
    fs.writeFileSync(`${this.file}.tmp`, JSON.stringify(this.state));
    fs.renameSync(`${this.file}.tmp`, this.file);
  }
  record(sample: RuntimeSample) {
    let changed = false;
    for (const row of sample.merchantTransactions?.journal ?? []) {
      if (row.state === 'running' || this.state.seenTransactions.includes(row.id)) continue;
      this.state.seenTransactions.push(row.id);
      this.state.transactions.push({ ...row, character: sample.character, state: row.state });
      changed = true;
    }
    const previous = this.state.previous[sample.character];
    if (previous?.stand && sample.stand) {
      const goldDelta = sample.stats.gold - previous.gold;
      for (const listing of previous.stand.filter(row => !row.buy)) {
        const current = sample.stand.find(row => row.slot === listing.slot && row.name === listing.name && row.level === listing.level && !row.buy);
        const quantity = Math.max(0, listing.quantity - (current?.quantity ?? 0));
        const expected = quantity * listing.price;
        // Only claim a sale when the gold increase corroborates the disappearing listing.
        if (!quantity || goldDelta < expected * 0.8) continue;
        this.state.commerce.push({ id: `${sample.character}:${sample.at}:${listing.slot}`, character: sample.character, side: 'sale', item: listing.name, level: listing.level, quantity, unitPrice: listing.price, goldDelta, at: sample.at });
        changed = true;
      }
    }
    this.state.previous[sample.character] = { at: sample.at, gold: sample.stats.gold, stand: sample.stand };
    const since = this.now() - RETENTION_MS;
    this.state.transactions = this.state.transactions.filter(row => row.finishedAt >= since).slice(-1000);
    this.state.commerce = this.state.commerce.filter(row => row.at >= since).slice(-1000);
    this.state.seenTransactions = this.state.seenTransactions.slice(-2000);
    if (changed) this.persist();
    return changed;
  }
  view(hours = 168) {
    const normalized = Math.min(720, Math.max(1, hours));
    const since = this.now() - normalized * 60 * 60 * 1000;
    return {
      hours: normalized,
      transactions: this.state.transactions.filter(row => row.finishedAt >= since).sort((a, b) => b.finishedAt - a.finishedAt),
      commerce: this.state.commerce.filter(row => row.at >= since).sort((a, b) => b.at - a.at),
    };
  }
}
