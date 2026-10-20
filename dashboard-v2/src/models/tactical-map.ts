import type { PartyMember } from '../types';

/** Prefer the active watchdog route; offline snapshots must never imply live navigation. */
export function tacticalNavigation(member?: PartyMember) {
  if (!member || member.status === 'offline' || member.status === 'disabled') return null;
  const movement = member.movement;
  const destination = movement?.moving && movement.destination ? movement.destination : member.intent?.destination;
  return { destination: destination ?? null, blocked: !!member.intent?.blockedBy || !!movement && ['stalled', 'recovering', 'blocked'].includes(movement.state),
    reason: member.intent?.blockedBy || movement?.lastAction || '', attempts: movement?.attempts ?? 0, stalledForMs: movement?.stalledForMs ?? 0 };
}
