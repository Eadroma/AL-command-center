import type { DeploymentsResponse, Profile } from '../types';
import { sharedEquipment } from './shared-equipment';
import { validateDashboardConfig } from './config-validation';
import { farmingTeam } from './farming-team';

export interface DepartureCheck { character: string; label: string; state: 'ready' | 'warning' | 'blocked' | 'unknown'; detail: string; }
/** Read-only preparation checks; freshness/unknown data must not produce a green clearance. */
export function departureChecklist(profile: Profile, deployments?: DeploymentsResponse): DepartureCheck[] {
  const rows: DepartureCheck[] = [];
  const gear = sharedEquipment(profile, deployments);
  for (const character of farmingTeam(profile)) {
    const telemetry = deployments?.characters[character.name]?.telemetry;
    const add = (label: string, state: DepartureCheck['state'], detail: string) => rows.push({ character: character.name, label, state, detail });
    if (!telemetry?.live || !telemetry.stats) { add('Runtime', 'unknown', 'Fresh telemetry is required.'); continue; }
    add('Health', telemetry.stats.hp <= 0 ? 'blocked' : telemetry.stats.hp < telemetry.stats.max_hp * .7 ? 'warning' : 'ready', `${telemetry.stats.hp}/${telemetry.stats.max_hp} HP`);
    add('Mana', telemetry.stats.mp <= 0 ? 'blocked' : 'ready', `${telemetry.stats.mp}/${telemetry.stats.max_mp} MP; individual skill costs are not assessed.`);
    if (!telemetry.inventory) add('Bag and potions', 'unknown', 'Inventory was not reported.');
    else {
      for (const [label, prefix] of [['HP potions', 'hpot'], ['Mana potions', 'mpot']]) {
        const count = telemetry.inventory.filter(item => item.name.startsWith(prefix)).reduce((sum, item) => sum + item.quantity, 0);
        add(label, count ? 'ready' : 'warning', `${count} carried; presence check, not a full-session supply estimate.`);
      }
      const free = Math.max(0, 42 - telemetry.inventory.length);
      add('Bag space', free >= 4 ? 'ready' : 'warning', `${free} free slots.`);
      for (const rule of profile.seller.consumables.enabled ? profile.seller.consumables.rules.filter(rule => rule.character === character.name && (!profile.automation.activeConsumables.length || profile.automation.activeConsumables.includes(rule.item))) : []) {
        const held = telemetry.inventory.filter(item => item.name === rule.item).reduce((sum, item) => sum + item.quantity, 0);
        const equipped = telemetry.equipment?.some(item => item.name === rule.item);
        add(`Consumable ${rule.item}`, held >= rule.minQty || equipped ? 'ready' : 'warning', `${held} carried${equipped ? ' · currently equipped' : ''}; configured minimum ${rule.minQty}.`);
      }
    }
    const checks = gear.filter(row => row.character === character.name);
    add('Build overrides', checks.some(row => row.state === 'missing') ? 'blocked' : checks.some(row => row.state === 'unknown') ? 'unknown' : checks.some(row => row.state !== 'owned') ? 'warning' : checks.length ? 'ready' : 'unknown', checks.length ? `${checks.filter(row => row.state === 'owned').length}/${checks.length} requirements on owner; see shared equipment plan.` : 'No explicit overrides; script-default equipment is not reconstructed.');
    const danger = telemetry.runtimePolicy?.danger;
    if (danger?.active) add('Safety policy', 'blocked', danger.reason);
    const priest = profile.characters.find(row => row.enabled && row.ctype === 'priest');
    if (profile.automation.dangers.requirePriest && character.ctype !== 'priest') {
      const healer = priest ? deployments?.characters[priest.name]?.telemetry : undefined;
      const near = healer?.live && healer.stats && healer.stats.hp > 0 && healer.stats.map === telemetry.stats.map && healer.stats.server === telemetry.stats.server && Math.hypot((healer.stats.x ?? 0) - (telemetry.stats.x ?? 0), (healer.stats.y ?? 0) - (telemetry.stats.y ?? 0)) <= profile.automation.dangers.healerRange;
      add('Priest nearby', near ? 'ready' : 'warning', near ? `${priest?.name} is alive and nearby.` : 'Required priest is missing, dead or outside the configured range.');
    }
  }
  for (const issue of validateDashboardConfig(profile).filter(issue => issue.severity === 'error')) rows.push({ character: 'Profile', label: issue.scope, state: 'blocked', detail: issue.message });
  if (!rows.length) rows.push({ character: 'Profile', label: 'Team', state: 'unknown', detail: 'No farmers are selected for this composition.' });
  return rows;
}
