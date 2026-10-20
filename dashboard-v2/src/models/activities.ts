import { profileSchema, type Profile } from '../../shared/schema';

/** Stage an activity without changing commerce, servers, scripts, or stored loadout contents. */
export function applyActivity(profile: Profile, activityId: string): Profile {
  const activity = profile.automation.activities.find(row => row.id === activityId);
  if (!activity) throw Error('Activity not found.');
  const next = structuredClone(profile);
  const chosen = next.characters.filter(c => activity.characters.includes(c.name) && c.ctype !== 'merchant');
  const leader = chosen.find(c => c.ctype === 'warrior') ?? chosen[0];
  if (!leader) throw Error('Choose at least one farmer.');
  // The dedicated crab script pins its route. Switch only this known specialization.
  next.characters = next.characters.map(c => c.ctype === 'merchant' ? { ...c, follow: '' } : {
    ...c, enabled: activity.characters.includes(c.name), follow: activity.characters.includes(c.name) && c.name !== leader.name ? leader.name : '',
    farmMonster: '', events: activity.events,
    script: c.script === 'droma-ranger-crab-aoe-v2' && (activity.monster !== 'crab' || activity.kind !== 'farm') ? 'droma-ranger-v2' : c.script,
  });
  next.farming.defaultMonster = activity.monster;
  next.farming.style[activity.monster] = activity.style;
  next.automation.activeBuilds = {};
  next.automation.activeActivity = activity.id;
  next.automation.activeConsumables = activity.consumables;
  for (const character of chosen) {
    const build = activity.builds[character.name] ?? activity.style;
    // Empty builds retain script defaults while still applying their selected style.
    next.automation.activeBuilds[character.name] = { monster: activity.kind === 'cave' ? '*' : activity.monster, style: build };
  }
  next.farming.dailyDungeon = activity.kind === 'cave';
  next.farming.hunts = activity.hunts;
  next.farming.rareVisits = false;
  next.farming.bossChecks.enabled = activity.kind === 'boss';
  if (activity.kind === 'boss') next.farming.bossChecks.rules = [{ boss: activity.monster, everyMinutes: 15 }];
  next.events.enabled = activity.events;
  next.seller.teamSupervisor = { enabled: true, characters: activity.characters, soloGuard: activity.characters.length === 1 };
  next.automation.dangers = structuredClone(activity.dangers);
  next.automation.dangers.runId = crypto.randomUUID();
  // Activity-owned objectives are replaced with fresh run IDs; standalone goals survive.
  next.automation.lootGoals = next.automation.lootGoals.filter(goal => !goal.activityId);
  if (activity.contract) {
    next.automation.lootGoals.push(...activity.contract.items.map(item => ({
      id: crypto.randomUUID(), activityId: activity.id, enabled: true, item,
      quantity: activity.contract!.quantity, characters: chosen.map(character => character.name), action: activity.contract!.action,
    })));
  }
  return profileSchema.parse(next);
}
