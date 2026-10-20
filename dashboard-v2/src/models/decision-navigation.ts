import type { CharacterTelemetry } from '../types/deployments';
export function openDecisionEvidence(character: string) {
  window.dispatchEvent(new CustomEvent('alcc:decision-evidence', { detail: character }));
}
/** Select a related workspace from explicit evidence, without editing any rules. */
export function decisionDestination(t?: CharacterTelemetry): { page: string; panel?: string; label: string } {
  if (!t?.live) return { page: 'deployments', label: 'Inspect deployment' };
  if (t.upgradeProduction?.some(row => row.pending)) return { page: 'merchant', panel: 'upgrade-resolution', label: 'Review held transaction' };
  if (t.loopGuard?.holds.length) return { page: 'merchant', panel: 'merchant-planner', label: 'Inspect merchant priorities' };
  if (t.runtimePolicy?.danger.active || t.runtimePolicy?.goals.some(row => row.paused)) return { page: 'operations', label: 'Inspect automation rules' };
  if (t.eventExpedition && t.eventExpedition.phase !== 'idle') return { page: 'events', label: 'Inspect expedition settings' };
  if (t.movement && ['blocked', 'stalled', 'recovering'].includes(t.movement.state)) return { page: 'party', label: 'Inspect map and navigation' };
  return { page: 'combat', label: 'Inspect combat settings' };
}
