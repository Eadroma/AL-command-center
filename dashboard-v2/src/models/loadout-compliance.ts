import { canonicalItemId, type FarmStyle, type Profile } from '../../shared/schema';
import type { DeploymentsResponse } from '../types';

export type LoadoutGearStatus = 'equipped' | 'available' | 'wrong-slot' | 'low-level' | 'missing' | 'offline';

export interface LoadoutGearCheck {
  character: string;
  style: FarmStyle;
  slot: string;
  item: string;
  minLevel: number;
  actualLevel: number | null;
  actualSlot: string | null;
  status: LoadoutGearStatus;
  detail: string;
}

/** Compare every explicit gear override with fresh equipment and bag telemetry. */
export function loadoutCompliance(profile: Profile, deployments?: DeploymentsResponse): LoadoutGearCheck[] {
  const checks: LoadoutGearCheck[] = [];
  for (const character of profile.characters.filter(entry => entry.enabled && entry.ctype !== 'merchant')) {
    const telemetry = deployments?.characters[character.name]?.telemetry;
    const equipment = telemetry?.equipment ?? [];
    const inventory = telemetry?.inventory ?? [];
    const board = profile.farming.loadouts[character.name];
    if (!board) continue;
    for (const style of Object.keys(board)) {
      for (const rule of board[style].gear) {
        const wanted = canonicalItemId(rule.item);
        const equippedInSlot = equipment.find(item => item.slot === rule.slot);
        const matchingEquipment = equipment.filter(item => canonicalItemId(item.name) === wanted).sort((a, b) => b.level - a.level);
        const matchingBag = inventory.filter(item => canonicalItemId(item.name) === wanted).sort((a, b) => b.level - a.level);
        let result: Omit<LoadoutGearCheck, 'character' | 'style' | 'slot' | 'item' | 'minLevel'>;

        if (!telemetry?.live) result = { status: 'offline', actualLevel: null, actualSlot: null, detail: 'No fresh equipment telemetry.' };
        else if (equippedInSlot && canonicalItemId(equippedInSlot.name) === wanted && equippedInSlot.level >= rule.minLevel) {
          result = { status: 'equipped', actualLevel: equippedInSlot.level, actualSlot: rule.slot, detail: `Equipped in ${rule.slot}.` };
        } else if (matchingEquipment.some(item => item.level >= rule.minLevel)) {
          const match = matchingEquipment.find(item => item.level >= rule.minLevel)!;
          result = { status: 'wrong-slot', actualLevel: match.level, actualSlot: match.slot, detail: `Equipped in ${match.slot}; expected ${rule.slot}.` };
        } else if (matchingBag.some(item => item.level >= rule.minLevel)) {
          const match = matchingBag.find(item => item.level >= rule.minLevel)!;
          result = { status: 'available', actualLevel: match.level, actualSlot: `bag ${match.slot}`, detail: `Available in bag slot ${match.slot}; waiting to equip.` };
        } else if (matchingEquipment.length || matchingBag.length) {
          const bestEquipment = matchingEquipment[0];
          const bestBag = matchingBag[0];
          const best = !bestBag || (bestEquipment?.level ?? -1) >= bestBag.level ? bestEquipment : bestBag;
          result = { status: 'low-level', actualLevel: best?.level ?? 0, actualSlot: best && 'slot' in best ? String(best.slot) : null, detail: `Best available is +${best?.level ?? 0}; requires +${rule.minLevel}.` };
        } else result = { status: 'missing', actualLevel: null, actualSlot: null, detail: 'Item is absent from equipment and bag.' };

        checks.push({ character: character.name, style, slot: rule.slot, item: wanted, minLevel: rule.minLevel, ...result });
      }
    }
  }
  return checks;
}
