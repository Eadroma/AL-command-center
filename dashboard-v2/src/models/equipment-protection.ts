import type { InventoryItem, Profile } from '../types';
export function equipmentProtection(profile: Profile, character: string, item: InventoryItem) {
  const matches = Object.entries(profile.farming.loadouts[character] ?? {}).flatMap(([style, loadout]) => loadout.gear.filter(rule => rule.item === item.name && item.level >= rule.minLevel).map(rule => `${style} · ${rule.slot} ≥ +${rule.minLevel}`));
  const runtime = item.transferAllowed === undefined ? 'Unknown · deploy inspector telemetry' : item.transferAllowed ? 'Transfer eligible' : 'Retained by running script';
  const reason = item.locked ? 'Locked item' : item.bound ? 'Bound item' : matches.length ? `Saved loadout matches: ${matches.join(', ')}` : item.transferAllowed === false ? 'Runtime retention policy (equipment quota, supplies or default build)' : 'No matching saved loadout override';
  return { runtime, reason: item.transferReason ? `${item.transferReason}. ${reason}` : reason };
}
