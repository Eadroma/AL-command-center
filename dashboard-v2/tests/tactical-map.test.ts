import { describe, expect, it } from 'vitest';
import { tacticalNavigation } from '../src/models/tactical-map';
import type { PartyMember } from '../src/types';
const member = { status: 'online', intent: { state: 'Travel', since: 1, updatedAt: 1, map: 'main', destination: { map: 'cave', x: 20, y: 30 } } } as PartyMember;
describe('tactical navigation', () => {
  it('never shows stale navigation as current', () => {
    expect(tacticalNavigation({ ...member, status: 'offline' })).toBeNull();
    expect(tacticalNavigation({ ...member, status: 'disabled' })).toBeNull();
  });
  it('uses an active watchdog destination rather than older intent', () => {
    const movement = { state: 'stalled' as const, moving: true, lastProgressAt: 0, stalledForMs: 12000, attempts: 2, recoveries: 0, lastAction: 'Retry route', updatedAt: 1, destination: { map: 'spookytown', x: 50, y: 60 } };
    expect(tacticalNavigation({ ...member, movement })).toMatchObject({ destination: movement.destination, blocked: true, attempts: 2 });
    expect(tacticalNavigation({ ...member, movement: { ...movement, state: 'idle', moving: false } })?.destination).toEqual(member.intent?.destination);
  });
});
