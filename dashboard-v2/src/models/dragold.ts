import type { DeploymentsResponse, DragoldObservation } from '../types';

export interface DragoldBoard {
  scanner: string;
  currentShard: string;
  observations: Array<DragoldObservation & { stale: boolean }>;
}

/** Prefer the freshest scanner and collapse duplicate shard observations. */
export function dragoldBoard(deployments?: DeploymentsResponse, now = Date.now()): DragoldBoard | null {
  const reports = Object.values(deployments?.characters ?? {})
    .map(deployment => deployment.telemetry?.dragold)
    .filter(report => report && Array.isArray(report.observations))
    .sort((a, b) => Math.max(0, ...b!.observations.map(row => row.seenAt)) - Math.max(0, ...a!.observations.map(row => row.seenAt)));
  const report = reports[0];
  if (!report) return null;
  const latest = new Map<string, DragoldObservation>();
  for (const observation of report.observations) {
    const current = latest.get(observation.shard);
    if (!current || observation.seenAt > current.seenAt) latest.set(observation.shard, observation);
  }
  return {
    scanner: report.scanner,
    currentShard: report.currentShard,
    observations: [...latest.values()]
      .map(observation => ({ ...observation, stale: now - observation.seenAt > 120_000 }))
      .sort((a, b) => Number(b.live) - Number(a.live) || (a.spawnAt || Number.MAX_SAFE_INTEGER) - (b.spawnAt || Number.MAX_SAFE_INTEGER) || a.shard.localeCompare(b.shard)),
  };
}
