import { describe, expect, it } from 'vitest';
import { recordIncidentReplay } from '../server/incident-replay';
import { Telemetry } from '../server/telemetry';
const stats = { hp: 100, max_hp: 100, mp: 50, max_mp: 100, map: 'main', x: 10, y: 20, target: 'crab' };
describe('incident replay', () => {
  it('captures navigation transitions once and starts a new capture after progress resumes', () => {
    const movement = { state: 'stalled' as const, moving: true, lastProgressAt: 0, stalledForMs: 10000, attempts: 1, recoveries: 0, lastAction: 'Retry route', updatedAt: 10000 };
    let state = recordIncidentReplay(undefined, { stats, movement }, 10000);
    state = recordIncidentReplay(state, { stats, movement: { ...movement, updatedAt: 15000 } }, 15000);
    expect(state.captures).toHaveLength(1);
    state = recordIncidentReplay(state, { stats, movement: { ...movement, state: 'monitoring', updatedAt: 20000 } }, 20000);
    state = recordIncidentReplay(state, { stats, movement: { ...movement, updatedAt: 25000 } }, 25000);
    expect(state.captures).toHaveLength(2);
  });
  it('exposes captures through authenticated telemetry ingestion and rejects duplicate sequences', () => {
    let now = 10000;
    const telemetry = new Telemetry(undefined, () => now);
    const session = telemetry.create('Droma', 'hash');
    const report = { character: 'Droma', ticket: session.ticket, sequence: 1, stats: { ...stats, gold: 0, xp: 0, level: 70 }, failures: [], logs: [] };
    telemetry.ingest(report); now += 5000;
    const death = { ...report, sequence: 2, failures: [{ at: now, reason: 'Death', details: 'crab' }] };
    expect(telemetry.ingest(death)).toBe(true);
    expect(telemetry.ingest(death)).toBe(false);
    expect(telemetry.view(session.id)?.incidentReplays).toHaveLength(1);
    expect(telemetry.view(session.id)?.incidentReplays[0].frames).toHaveLength(2);
  });
  it('freezes preceding reports and does not duplicate repeated death evidence', () => {
    let state = recordIncidentReplay(undefined, { stats }, 10000);
    state = recordIncidentReplay(state, { stats: { ...stats, hp: 0 }, failures: [{ at: 15000, reason: 'Death', details: 'crab' }] }, 16000);
    expect(state.captures[0].frames.map(frame => frame.hp)).toEqual([100, 0]);
    state = recordIncidentReplay(state, { stats, failures: [{ at: 15000, reason: 'Death', details: 'crab' }] }, 21000);
    expect(state.captures).toHaveLength(1);
    expect(state.captures[0].frames).toHaveLength(2);
  });
  it('bounds retention and exposes empty context for incidents older than the collected window', () => {
    let state = recordIncidentReplay(undefined, { stats }, 1000);
    state = recordIncidentReplay(state, { stats }, 200000);
    expect(state.recent).toHaveLength(1);
    state = recordIncidentReplay(state, { failures: [{ at: 500, reason: 'Old death', details: '' }] }, 201000);
    expect(state.captures[0].frames).toHaveLength(0);
  });
});

it('captures transaction holds and errors once with equipment and blocker evidence', () => {
  const report = { stats, equipment: [{ slot: 'mainhand', name: 'bow', level: 7, quantity: 1 }], loopGuard: { task: 'bank', holds: [{ task: 'bank', at: 10000, reason: 'Repeated transitions' }] } };
  let state = recordIncidentReplay(undefined, report, 10000, ['ERROR: route failed']);
  state = recordIncidentReplay(state, report, 15000, ['ERROR: route failed']);
  expect(state.captures.map(row=>row.kind)).toEqual(['commerce','runtime']);
  expect(state.captures[0].frames[0].equipment).toEqual([{slot:'mainhand',name:'bow',level:7}]);
});
