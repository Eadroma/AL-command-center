import type { CharacterTelemetry } from '../src/types/deployments';
import type { ReplayState, IncidentReplay } from '../src/types/incident-replay';

/** Freeze up to two minutes of accepted reports when new incident evidence arrives. */
export function recordIncidentReplay(previous: ReplayState | undefined, report: Omit<CharacterTelemetry, 'live'>, at: number, errors: string[] = []): ReplayState {
  const state: ReplayState = previous ?? { recent: [], captures: [], seen: [], movement: 'idle' };
  const stats = report.stats;
  if (stats) state.recent.push({ at, map: stats.map, x: stats.x ?? 0, y: stats.y ?? 0, hp: stats.hp, maxHp: stats.max_hp, mp: stats.mp, maxMp: stats.max_mp, target: stats.target ?? '', intent: report.intent?.state ?? '', reason: report.runtimePolicy?.diagnostic.reason ?? '', movement: report.movement?.state ?? '', blockedBy: report.intent?.blockedBy ?? '', server: stats.server, transaction: report.merchantTransactions?.current?.detail, equipment: (report.equipment ?? []).map(({slot,name,level}) => ({slot,name,level})), actions: structuredClone(report.runtimePolicy?.diagnostic.actions ?? []) });
  state.recent = state.recent.filter(frame => frame.at >= at - 120000).slice(-60);
  const capture = (id: string, kind: IncidentReplay['kind'], eventAt: number, detail: string) => {
    if (state.seen.includes(id)) return;
    state.seen.push(id);
    state.captures.push({ id, kind, at: eventAt, detail, frames: structuredClone(state.recent.filter(frame => frame.at >= eventAt - 120000 && frame.at <= Math.min(at, eventAt + 20000))) });
  };
  for (const failure of report.failures ?? []) capture(`death:${failure.at}:${failure.reason}`, 'death', failure.at, `${failure.reason}: ${failure.details}`);
  const movement = report.movement;
  if (movement && ['stalled', 'blocked'].includes(movement.state) && state.movement !== movement.state) capture(`movement:${movement.updatedAt}:${movement.state}`, 'movement', movement.updatedAt, movement.lastAction || movement.state);
  for (const row of report.upgradeProduction ?? []) if (row.pending && row.reviewReason) capture(`review:${row.action?.id ?? row.runId}:${row.item}`, 'commerce', (row.reviewAt ?? row.action?.at ?? at - 60000) + 60000, `${row.item}: ${row.reviewReason}`);
  for (const hold of report.loopGuard?.holds ?? []) capture(`loop:${hold.task}:${hold.at}`, 'commerce', hold.at, `${hold.task}: ${hold.reason}`);

  for (const message of errors) if (/^ERROR:/i.test(message)) capture(`runtime:${message.slice(0,180)}`, 'runtime', at, message.slice(0,500));
  state.movement = movement?.state ?? 'idle';
  state.seen = state.seen.slice(-100);
  state.captures = state.captures.slice(-20);
  return state;
}
