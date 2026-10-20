import type { Profile } from '../../shared/schema';
import type { CharacterTelemetry } from '../types/deployments';

export interface CircuitStop { id: string; label: string; candidates: number | null; detail: string; }

/** Inventory candidates are not scheduled operations: runtime checks still decide eligibility. */
export function merchantCircuit(profile: Profile, telemetry?: CharacterTelemetry) {
  if (!telemetry?.live) return null;
  const inventory = telemetry.inventory;
  const count = (predicate: (item: NonNullable<typeof inventory>[number]) => boolean) => inventory ? inventory.filter(item => !item.locked && !item.bound && predicate(item)).length : null;
  const seller = profile.seller;
  const finished = (item: NonNullable<typeof inventory>[number]) => seller.upgrade.enabled && item.upgradeable && seller.upgrade.rules.some(rule => rule.item === item.name && rule.maxLevel > 0 && item.level >= rule.maxLevel);
  const compoundDeposit = (item: NonNullable<typeof inventory>[number]) => seller.compound.enabled && seller.compound.rules.some(rule => rule.item === item.name && (item.level >= rule.maxLevel || item.level > 0 && (inventory?.filter(part => part.name === item.name && part.level === item.level && !part.locked && !part.bound).length ?? 0) < 3));
  const stops: CircuitStop[] = [
    { id: 'bank', label: 'Bank', candidates: count(item => compoundDeposit(item) || finished(item) || seller.bankDeposit.enabled && seller.bankDeposit.items.includes(item.name)), detail: 'Configured deposits, intermediate compounds and finished upgrade pieces. A current Xyn batch drains first.' },
    { id: 'sell', label: 'NPC sales · remote', candidates: seller.npcEnabled ? count(item => item.sellable && seller.npcItems.includes(item.name) && !finished(item) && !seller.upgrade.rules.some(rule => seller.upgrade.enabled && rule.item === item.name && item.level < rule.maxLevel)) : 0, detail: 'No travel or stand closure. Other reservations may exclude candidates.' },
    { id: 'exchange', label: 'Exchanges', candidates: seller.exchange.enabled ? count(item => seller.exchange.items.includes(item.name) && item.quantity >= (seller.exchange.minimum[item.name] ?? 1)) : 0, detail: 'Stacks meeting the configured minimum; recipe eligibility is checked by the runtime.' },
    { id: 'compound', label: 'Compound · stand', candidates: seller.compound.enabled && inventory ? seller.compound.rules.reduce((total, rule) => total + Array.from({ length: rule.maxLevel }, (_, level) => Math.floor(inventory.filter(item => item.name === rule.item && item.level === level && !item.locked && !item.bound).length / 3)).reduce((n, count) => n + count, 0), 0) : 0, detail: 'Equal-level trios below the target; scrolls and gold reserve still apply.' },
    { id: 'upgrade', label: 'Carried upgrades · stand', candidates: seller.upgrade.enabled ? count(item => seller.upgrade.rules.some(rule => rule.item === item.name && item.level < rule.maxLevel)) : 0, detail: 'According to task priorities, before base purchases. Scrolls and production limits apply.' },
    { id: 'purchase', label: 'Base purchases · remote', candidates: seller.upgrade.enabled && inventory ? seller.upgrade.rules.filter(rule => rule.buyNpc && rule.maxLevel > 0 && !inventory.some(item => item.name === rule.item)).length : null, detail: 'Only when carried upgrade work has drained; budget and quantity limits apply.' },
    { id: 'stand', label: 'Player stand', candidates: null, detail: telemetry.standOpen === true ? 'Stand is open.' : telemetry.standOpen === false ? 'Stand is closed.' : 'Stand state is unavailable on this bundle.' },
  ];
  const rank = (id: string) => { const lane = id === 'purchase' ? 'upgrade' : id; const index = seller.workOrder.findIndex(task => task === lane); return index < 0 ? 99 : index + (id === 'purchase' ? 0.1 : 0); };
  stops.sort((a, b) => rank(a.id) - rank(b.id));
  const transaction = telemetry.merchantTransactions?.current;
  const destination = telemetry.intent?.destination;
  const observedAt = telemetry.lastSeen ?? Date.now();
  const held = telemetry.upgradeProduction?.find(row => row.pending && (!row.action || observedAt - row.action.at >= 15000) || !row.unbounded && (row.produced >= row.quantity || row.spent >= row.budget));
  const blockedBy = telemetry.intent?.blockedBy || (held ? `${held.item}: ${held.pending ? 'production confirmation delayed' : held.produced >= held.quantity ? 'quantity reached' : 'material budget reached'}` : undefined);
  const next = stops.find(stop => stop.candidates !== null && stop.candidates > 0);
  return { stops, next: next?.label ?? (inventory ? 'Player stand / idle' : 'Unknown · inventory unavailable'), action: transaction?.state === 'running' ? `${transaction.kind}: ${transaction.detail}` : telemetry.intent?.state ?? 'No intent reported', destination, blockedBy, transaction, recent: (telemetry.merchantTransactions?.journal ?? []).filter(entry => entry.state !== 'running').slice(-5).reverse() };
}
