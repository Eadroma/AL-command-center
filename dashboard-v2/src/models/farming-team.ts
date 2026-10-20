import type { Profile } from '../types';
/** Solo guard is the intended farming composition even if old slots remain enabled. */
export function farmingTeam(profile: Profile) {
  const farmers = profile.characters.filter(character => character.enabled && character.ctype !== 'merchant');
  const supervisor = profile.seller.teamSupervisor;
  return supervisor.soloGuard && supervisor.characters.length === 1 ? farmers.filter(character => supervisor.characters.includes(character.name)) : farmers;
}
