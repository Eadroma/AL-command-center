import type { CharacterTelemetry } from '../types/deployments';

export interface DecisionExplanation { action: string; reason: string; next: string; source: 'reported' | 'inferred' | 'unavailable'; warning: boolean; }

/** Prioritise explicit blockers over inferred activity; stale data never explains a live decision. */
export function explainDecision(enabled: boolean, telemetry?: CharacterTelemetry): DecisionExplanation {
  const result = (action: string, reason: string, next: string, source: DecisionExplanation['source'] = 'reported', warning = false) => ({ action, reason, next, source, warning });
  if (!enabled) return result('Disabled', 'Character is disabled in the saved profile.', 'Enable the character before deploying.', 'unavailable');
  if (!telemetry?.live) return result('No live decision', 'Telemetry is absent or older than the liveness window.', 'Wait for a fresh report or inspect deployment.', 'unavailable', true);
  if (telemetry.network?.socketConnected === false) return result('Game connection lost', 'The latest report says the game socket is disconnected.', 'Wait for reconnection; inspect the runtime if reports stop.', 'reported', true);
  if (telemetry.stats?.hp === 0 || telemetry.intent?.blockedBy === 'dead') return result('Recovering after death', 'The character is reported dead.', 'Wait for revival and readiness checks.', 'reported', true);
  const held = telemetry.upgradeProduction?.find(row => row.pending);
  if (held) return result('Transaction verification', `${held.item}: ${held.reviewReason || 'waiting for exact inventory and material evidence'}`, 'Automatic reconciliation continues. Review the held transaction if the result stays ambiguous.', 'reported', true);
  const suspended = telemetry.loopGuard?.holds[0];
  if (suspended) return result('Task suspended', `${suspended.task}: ${suspended.reason}`, 'Other tasks continue. This task resumes when inventory or its configuration changes; elapsed time alone does not release it.', 'reported', true);
  const policy = telemetry.runtimePolicy;
  if (policy?.danger.active) return result('Safety hold', policy.danger.reason, /Death budget/i.test(policy.danger.reason) ? 'Prepare a new risk run in Danger management, then save and deploy. Revival alone does not release this hold.' : 'Resume when the configured recovery conditions are met.', 'reported', true);
  const paused = policy?.goals.find(goal => goal.paused);
  if (paused) return result('Loot objective pause', `${paused.item}: ${paused.count}/${paused.target} collected.`, 'Disable or reset this objective to resume.', 'reported', true);
  const sort = telemetry.bankSort;
  if (sort && ['queued', 'running'].includes(sort.state)) return result('Sorting bank', `${sort.phase}: ${sort.message}`, `${sort.moved} moves and ${sort.merged} merges confirmed. Wait for completion before normal merchant tasks resume.`);
  if (telemetry.coordination?.canEngage === false) {
    const coordination = telemetry.coordination;
    return result('Waiting for team readiness', `Engagement is blocked. Ready: ${coordination.ready.join(', ') || 'none reported'}.`, `Wait for Ready/Engage clearance${coordination.mission?.monster ? ` on ${coordination.mission.monster}` : ''}.`, 'reported', true);
  }
  const movement = telemetry.movement;
  if (movement && ['stalled', 'recovering', 'blocked'].includes(movement.state)) {
    const destination = movement.destination;
    const route = destination ? ` Towards ${destination.map} (${Math.round(destination.x)}, ${Math.round(destination.y)}).` : '';
    return result('Route recovery', `${movement.lastAction || movement.state}. No progress for ${Math.floor(movement.stalledForMs / 1000)}s.${route}`, `Watchdog attempt ${movement.attempts}; wait for confirmed progress. Inspect Navigation if the same route keeps failing.`, 'reported', true);
  }
  if (telemetry.intent?.blockedBy) return result('Blocked', telemetry.intent.blockedBy, 'The runtime reports this blocker but does not expose its release condition. Inspect runtime diagnostics.', 'reported', true);
  const transaction = telemetry.merchantTransactions?.current;
  if (transaction?.state === 'running') return result(transaction.kind, transaction.detail, 'Wait for the transaction to be confirmed before the next task.');
  const merchant = telemetry.standOpen === true || telemetry.merchantTransactions !== undefined || telemetry.upgradeProduction !== undefined;
  if (merchant && !telemetry.intent?.destination) return result(telemetry.intent?.state || 'Merchant activity', telemetry.loopGuard?.task ? `Runtime selected task: ${telemetry.loopGuard.task}.` : telemetry.standOpen ? 'Player stand is open; no transaction blocker is reported.' : 'Merchant reports no active transaction; stand is closed or unavailable.', 'Evaluate eligible tasks in the configured priority order.', telemetry.loopGuard?.task ? 'reported' : 'inferred');
  const diagnostic = policy?.diagnostic;
  if (diagnostic && /cooldown/i.test(diagnostic.reason) && diagnostic.actions.some(row => /attack|shot|cleave|heal/i.test(row.action) && row.result === 'success' && (telemetry.lastSeen ?? Date.now()) - row.at <= 5000)) return result('Combat active', `${diagnostic.reason}. Recent combat action acknowledged.`, 'Continue when the shared action cooldown expires.', 'inferred');
  if (diagnostic && (diagnostic.target || telemetry.stats?.target || /cooldown|mana|range|no target/i.test(diagnostic.reason))) return result(telemetry.intent?.destination ? 'Moving with combat decisions' : 'Combat decision', diagnostic.reason, /cooldown/i.test(diagnostic.reason) ? 'Wait for the shared attack / heal cooldown to expire.' : /mana|mp /i.test(diagnostic.reason) ? 'Recover enough mana for the next action.' : /range/i.test(diagnostic.reason) ? 'Move into action range; inspect the route if no progress is reported.' : diagnostic.target ? `Continue evaluating target ${diagnostic.target}.` : 'Wait for the next target or action.', diagnostic.source === 'action' ? 'reported' : 'inferred', /mana|cooldown|range|no target/i.test(diagnostic.reason));
  const destination = telemetry.intent?.destination;
  if (destination) return result('Travelling', `Destination: ${destination.map} (${Math.round(destination.x)}, ${Math.round(destination.y)}).`, 'Reach the destination, then evaluate the next task.');
  if (telemetry.intent) return result(telemetry.intent.state, 'State reported by the character script.', 'The script has not reported its next condition.');
  return result('Awaiting explanation', 'This deployment does not report detailed runtime intent.', 'Preview and deploy the current bundle to collect intent.', 'unavailable');
}
