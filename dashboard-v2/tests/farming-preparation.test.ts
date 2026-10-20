import { describe, expect, it } from 'vitest';
import { initialProfile, scripts } from '../server/scripts';
import { sharedEquipment } from '../src/models/shared-equipment';
import { departureChecklist } from '../src/models/departure-checklist';
import { farmingRecommendations } from '../src/models/farming-advisor';
import type { Catalog, DeploymentsResponse, PerformanceBucket } from '../src/types';
const item = (slot: number, name = 'ring', level = 1, locked = false) => ({ slot, name, level, quantity: 1, locked, bound: false, upgradeable: true, sellable: true });
const live = (inventory = [item(0)]) => ({ telemetry: { live: true, inventory, equipment: [], stats: { hp: 100, max_hp: 100, mp: 100, max_mp: 100, map: 'main', target: '', server: 'EU III', x: 0, y: 0 } } });
function profile() {
  const value = initialProfile(scripts());
  value.characters = value.characters.map(character => ({ ...character, enabled: ['Droma', 'Aedroma', 'EadroSell'].includes(character.name) }));
  value.seller.teamSupervisor.soloGuard = false;
  value.farming.style[value.farming.defaultMonster] = 'aoe';
  for (const name of ['Droma', 'Aedroma']) value.farming.loadouts[name] = { aoe: { gear: [{ slot: 'ring1', item: 'ring', minLevel: 1 }], skills: [] }, mono: { gear: [], skills: [] }, tank: { gear: [], skills: [] } };
  value.automation.activeBuilds = {};
  return value;
}
describe('farming preparation', () => {
  it('allocates a shared copy once and excludes locked transfer stock', () => {
    const deployments = { characters: { Droma: live([]), Aedroma: live([]), EadroSell: live([item(0), item(1, 'ring', 1, true)]) } } as unknown as DeploymentsResponse;
    const rows = sharedEquipment(profile(), deployments);
    expect(rows.filter(row => row.state === 'transfer')).toHaveLength(1);
    expect(rows.filter(row => row.state === 'unknown')).toHaveLength(1);
  });
  it('does not reuse an inherited ring for a second overridden slot', () => {
    const p = profile(); p.seller.teamSupervisor = { enabled: true, characters: ['Droma'], soloGuard: true };
    p.farming.loadouts.Droma.aoe.gear = [{ slot: 'ring2', item: 'ring', minLevel: 1 }];
    const deployments = { characters: { Droma: { ...live([]), telemetry: { ...live([]).telemetry, equipment: [{ slot: 'ring1', name: 'ring', level: 2, quantity: 1 }] } } } } as unknown as DeploymentsResponse;
    expect(sharedEquipment(p, deployments)[0].state).toBe('unknown');
  });
  it('does not approve stale telemetry and reports zero mana as a departure blocker', () => {
    const p = profile();
    const deployments = { characters: { Droma: { telemetry: { live: false } }, Aedroma: { telemetry: { ...live([]).telemetry, stats: { ...live([]).telemetry.stats, mp: 0 } } } } } as unknown as DeploymentsResponse;
    const checks = departureChecklist(p, deployments);
    expect(checks.find(row => row.character === 'Droma')?.state).toBe('unknown');
    expect(checks.find(row => row.character === 'Aedroma' && row.label === 'Mana')?.state).toBe('blocked');
  });
  it('ranks measured regular mobs only for the exact composition and excludes unassigned history', () => {
    const p = profile(); p.farming.allowedHunts = ['crab', 'ghost', 'crabxx'];
    const catalog: Catalog = { scripts: [], importedAt: '', sourceDirectory: '', assets: {}, items: [], monsters: ['crab', 'ghost', 'crabxx'].map(id => ({ id, name: id, hp: 100 })) };
    const row: PerformanceBucket = { character: 'Droma', at: 1, elapsedMs: 3600000, economyElapsedMs: 3600000, netLootGold: 100, consumablesGold: 10, unpriced: 0, damage: 0, healing: 0, kills: 1, deaths: 0, attacks: 1, movingMs: 0, combatMs: 0, xp: 0, gold: 0, farmContext: { monster: 'crab', participants: ['Droma'] } };
    const result = farmingRecommendations([row, { ...row, farmContext: { monster: 'ghost', participants: ['Droma'] }, netLootGold: 200 }, { ...row, farmContext: undefined, netLootGold: 100000 }, { ...row, farmContext: { monster: 'crabxx', participants: ['Droma'] } }, { ...row, farmContext: { monster: 'ghost', participants: ['Droma', 'Aedroma'] } }], ['Droma'], catalog, p);
    expect(result.map(entry => entry.monster)).toEqual(['ghost', 'crab']);
    expect(result[0].measurement.netPerHour).toBe(190);
  });
});
