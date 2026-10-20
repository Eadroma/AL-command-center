export interface UpgradeStep { probability: number; scrollCost: number }
/** Independent attempts, destruction on failure, restart at base level. No pity/offering model. */
export function simulateUpgrade(baseCost: number, steps: UpgradeStep[]) {
  if (!steps.length || !Number.isFinite(baseCost) || baseCost < 0 || steps.some(s => !Number.isFinite(s.probability) || s.probability <= 0 || s.probability > 1 || !Number.isFinite(s.scrollCost) || s.scrollCost < 0)) return null;
  let reach = 1, cycleCost = baseCost, cycleScrolls = 0;
  for (const step of steps) { cycleCost += reach * step.scrollCost; cycleScrolls += reach; reach *= step.probability; }
  return { chancePerBase: reach, expectedBases: 1 / reach, expectedDestroyed: 1 / reach - 1, expectedScrolls: cycleScrolls / reach, expectedCost: cycleCost / reach };
}
