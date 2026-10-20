import type { DeploymentsResponse, Profile } from '../types';
import { bankSnapshots } from './bank';
import { canonicalItemId } from '../../shared/schema';
import { farmingTeam } from './farming-team';

export interface GearAllocation { character: string; style: string; slot: string; item: string; minLevel: number; state: 'owned' | 'transfer' | 'bank' | 'missing' | 'unknown'; source?: string; }
/** Plan one simultaneous build per farmer. Each observed physical position is allocated once. */
export function sharedEquipment(profile: Profile, deployments?: DeploymentsResponse, styles: Record<string, string> = {}): GearAllocation[] {
  const farmers = farmingTeam(profile);
  const copies: Array<{ id: string; owner: string; item: string; level: number; place: string; transferable: boolean; bank: boolean }> = [];
  for (const [owner, deployment] of Object.entries(deployments?.characters ?? {})) {
    if (!deployment.telemetry?.live) continue;
    for (const item of deployment.telemetry.equipment ?? []) copies.push({ id: `${owner}:equipment:${item.slot}`, owner, item: canonicalItemId(item.name), level: item.level, place: `${owner} · equipped ${item.slot}`, transferable: false, bank: false });
    for (const item of deployment.telemetry.inventory ?? []) copies.push({ id: `${owner}:bag:${item.slot}`, owner, item: canonicalItemId(item.name), level: item.level, place: `${owner} · bag ${item.slot}`, transferable: !item.locked && !item.bound, bank: false });
  }
  const bank = bankSnapshots(deployments)[0];
  for (const item of bank?.items ?? []) copies.push({ id: `bank:${item.pack}:${item.slot}`, owner: '', item: canonicalItemId(item.name), level: item.level, place: `${item.pack} · slot ${item.slot}`, transferable: true, bank: true });
  const used = new Set<string>();
  const requests = farmers.flatMap(character => {
    const monster = character.farmMonster || profile.farming.defaultMonster;
    const style = styles[character.name] ?? profile.automation.activeBuilds[character.name]?.style ?? profile.farming.style[monster] ?? 'aoe';
    const gear = profile.farming.loadouts[character.name]?.[style]?.gear ?? [];
    // Existing gear in unspecified slots is not a free copy for another override.
    for (const copy of copies.filter(copy => copy.owner === character.name && copy.id.includes(':equipment:') && !gear.some(rule => copy.id.endsWith(`:equipment:${rule.slot}`)))) used.add(copy.id);
    return gear.map(rule => ({ character: character.name, style, slot: rule.slot, item: canonicalItemId(rule.item), minLevel: rule.minLevel }));
  }).sort((a, b) => b.minLevel - a.minLevel || a.character.localeCompare(b.character) || a.slot.localeCompare(b.slot));
  return requests.map(request => {
    if (!deployments?.characters[request.character]?.telemetry?.live) return { ...request, state: 'unknown' };
    const candidates = copies.filter(copy => !used.has(copy.id) && copy.item === request.item && copy.level >= request.minLevel && (copy.owner === request.character || copy.transferable));
    const match = candidates.sort((a, b) => Number(b.owner === request.character) - Number(a.owner === request.character) || Number(a.bank) - Number(b.bank) || a.level - b.level)[0];
    if (!match) return { ...request, state: bank ? 'missing' : 'unknown' };
    used.add(match.id);
    return { ...request, state: match.bank ? 'bank' : match.owner === request.character ? 'owned' : 'transfer', source: `${match.place} · +${match.level}` };
  });
}
