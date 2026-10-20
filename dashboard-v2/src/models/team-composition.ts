import { profileSchema, type Profile } from '../../shared/schema';

export type TeamMode = 'solo' | 'team' | 'cave';

/** Stage a composition; merchant remains separate from farmer follow/party membership. */
export function applyTeamComposition(profile: Profile, mode: TeamMode, soloName: string): Profile {
  const next = structuredClone(profile);
  next.automation.activeActivity = '';
  next.automation.activeBuilds = {};
  next.automation.activeConsumables = [];
  const farmers = next.characters.filter(character => character.ctype !== 'merchant');
  const damageDealer = farmers.find(character => character.enabled && ['ranger', 'rogue'].includes(character.ctype))
    ?? farmers.find(character => ['ranger', 'rogue'].includes(character.ctype));
  const chosen = mode === 'solo'
    ? farmers.filter(character => character.name === soloName)
    : mode === 'cave'
      ? ['warrior', 'priest', 'ranger'].flatMap(type => farmers.filter(character => character.ctype === type).slice(0, 1))
      : farmers.filter(character => ['warrior', 'priest'].includes(character.ctype) || character.name === damageDealer?.name);
  if (!chosen.length) throw Error('Select at least one farmer.');
  if (mode === 'cave' && chosen.length !== 3) throw Error('Cave Dreams requires a warrior, priest and ranger.');
  const names = chosen.map(character => character.name);
  const leader = chosen.find(character => character.ctype === 'warrior')?.name ?? chosen[0].name;
  next.characters = next.characters.map(character => character.ctype === 'merchant' ? { ...character, follow: '' } : {
    ...character, enabled: names.includes(character.name),
    follow: names.includes(character.name) && character.name !== leader ? leader : '',
    events: mode !== 'solo',
  });
  next.seller.teamSupervisor = { enabled: true, characters: names, soloGuard: mode === 'solo' };
  next.farming.dailyDungeon = mode === 'cave';
  if (mode === 'solo') {
    next.events.enabled = false;
    next.farming.hunts = false;
    next.farming.rareVisits = false;
    next.farming.bossChecks.enabled = false;
  }
  if (mode === 'team') { next.events.enabled = true; next.farming.hunts = true; next.farming.bossChecks.enabled = true; }
  return profileSchema.parse(next);
}
