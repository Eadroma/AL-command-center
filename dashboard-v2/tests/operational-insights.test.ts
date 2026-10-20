import { describe, expect, it } from 'vitest';
import vm from 'node:vm';
import { initialProfile, scripts } from '../server/scripts';
import { PerformanceHistory } from '../server/performance-history';
import { farmingProfit } from '../src/models/farming-profit';
import { resolveBuild } from '../src/models/build-comparison';
import { explainDecision } from '../src/models/decision-explanation';
import { analysisTelemetry } from '../server/analysis-telemetry';
import { Telemetry } from '../server/telemetry';
import type { CharacterTelemetry } from '../src/types/deployments';

describe('operational insights', () => {
  it('explains connection loss without reusing an old combat decision', () => {
    expect(explainDecision(true, { live: true, network: { socketConnected: false, pingMs: 80 } })).toMatchObject({ action: 'Game connection lost', warning: true, source: 'reported' });
  });
  it('shows bank sort progress ahead of generic merchant intent', () => {
    expect(explainDecision(true, { live: true, bankSort: { state: 'running', phase: 'Merge', message: 'Processing pack', moved: 2, merged: 1, total: 20, updatedAt: 1 } })).toMatchObject({ action: 'Sorting bank', warning: false });
  });
  it('explains movement blockers with progress and destination rather than a generic hold', () => {
    const explanation = explainDecision(true, { live: true, intent: { state: 'Moving', since: 0, updatedAt: 1, map: 'main', blockedBy: 'movement stalled' }, movement: { state: 'stalled', moving: true, lastProgressAt: 0, stalledForMs: 12000, attempts: 2, recoveries: 0, lastAction: 'Retry route', updatedAt: 1, destination: { map: 'cave', x: 10, y: 20 } } });
    expect(explanation.action).toBe('Route recovery');
    expect(explanation.reason).toContain('12s');
    expect(explanation.reason).toContain('cave (10, 20)');
    expect(explanation.next).toContain('attempt 2');
  });
  it('does not invent a release condition for an unknown runtime blocker', () => {
    expect(explainDecision(true, { live: true, intent: { state: 'Waiting', since: 0, updatedAt: 1, map: 'main', blockedBy: 'custom hold' } }).next).toContain('does not expose its release condition');
  });
  it('retains analysis fields and forwards costs to persistent performance history', () => {
    const samples: any[] = [];
    const telemetry = new Telemetry(undefined, () => 10000, sample => samples.push(sample));
    const session = telemetry.create('Droma', 'hash');
    const economy = { consumablesGold: 100, consumed: 1, unpriced: 0 };
    const buildItems = [{ name: 'bow', level: 1, slot: 'mainhand', location: 'equipment', properties: { attack: 10 } }];
    telemetry.ingest({ character: 'Droma', ticket: session.ticket, sequence: 1, logs: [], economy, buildItems, stats: { hp: 100, max_hp: 100, mp: 100, max_mp: 100, gold: 0, xp: 0, level: 70, map: 'main', target: '' } });
    expect(telemetry.view(session.id)).toMatchObject({ economy, buildItems });
    expect(samples[0].economy).toEqual(economy);
  });
  it('never presents stale blockers as a current decision', () => {
    expect(explainDecision(true, { live: false, intent: { state: 'Attack', since: 0, updatedAt: 0, map: 'main', blockedBy: 'dead' } }).action).toBe('No live decision');
    expect(explainDecision(false, { live: true }).action).toBe('Disabled');
  });
  it('explains team clearance before reporting generic intent', () => {
    expect(explainDecision(true, { live: true, coordination: { role: 'leader', mission: null, ready: ['Droma'], canEngage: false, updatedAt: 1 } })).toMatchObject({ action: 'Waiting for team readiness', warning: true, source: 'reported' });
  });
  it('pairs revenue and costs without adding transfers or old loot coverage', () => {
    const history = new PerformanceHistory(undefined, () => 600000);
    const point = (at: number, gold: number, loot: number, cost?: number) => ({ sessionId: 'one', character: 'Droma', at, stats: { gold, xp: 0, level: 70 }, loot: { gold: loot }, economy: cost === undefined ? undefined : { consumablesGold: cost, consumed: cost / 20, unpriced: 0 }, combat: { damageDealt: 0, healing: 0, kills: 0, deaths: 0, attacks: 0, movingMs: 0, combatMs: 0 } });
    history.record(point(500000, 0, 0)); history.record(point(505000, 999999, 100, 0));
    history.record(point(510000, 0, 200, 20));
    const [row] = farmingProfit(history.view(1).buckets);
    expect(row).toMatchObject({ elapsedMs: 5000, lootGold: 100, cost: 20, netPerHour: 57600 });
    history.record({ ...point(515000, 10, 0, 0), sessionId: 'two' });
    expect(farmingProfit(history.view(1).buckets)[0].elapsedMs).toBe(5000);
  });
  it('allows negative net and suppresses a falsely complete total when prices are unknown', () => {
    const bucket = { character: 'Droma', at: 0, elapsedMs: 1000, damage: 0, healing: 0, kills: 0, deaths: 0, attacks: 0, movingMs: 0, combatMs: 0, xp: 0, gold: 0, economyElapsedMs: 1000, netLootGold: 1, consumablesGold: 2 };
    expect(farmingProfit([bucket])[0].netPerHour).toBe(-3600);
    expect(farmingProfit([{ ...bucket, unpriced: 1 }])[0].netPerHour).toBeNull();
    expect(farmingProfit([{ ...bucket, economyElapsedMs: undefined }])[0].netPerHour).toBeNull();
  });
  it('does not reuse an inherited ring for a second slot', () => {
    const profile = structuredClone(initialProfile(scripts()));
    profile.farming.loadouts.Droma = { aoe: { gear: [{ slot: 'ring2', item: 'ring', minLevel: 0 }], skills: [] }, mono: { gear: [], skills: [] }, tank: { gear: [], skills: [] } };
    const telemetry: CharacterTelemetry = { live: true, equipment: [{ slot: 'ring1', name: 'ring', level: 1, quantity: 1 }], buildItems: [{ location: 'equipment', slot: 'ring1', name: 'ring', level: 1, properties: { armor: 5 } }] };
    expect(resolveBuild(profile, 'Droma', 'aoe', telemetry).complete).toBe(false);
    telemetry.buildItems!.push({ location: 'bag', slot: '1', name: 'ring', level: 2, properties: { armor: 7 } });
    expect(resolveBuild(profile, 'Droma', 'aoe', telemetry).totals.armor).toBe(12);
    telemetry.live = false;
    expect(resolveBuild(profile, 'Droma', 'aoe', telemetry).totals.armor).toBeNull();
  });
  it('values only confirmed consumed items and obtains properties without equipping', () => {
    const handlers: Record<string, (data: unknown) => void> = {};
    const context = vm.createContext({ parent: { socket: { on: (event: string, fn: (data: unknown) => void) => { handlers[event] = fn; } }, calculate_item_properties: () => ({ armor: 10, speed: -2 }) }, G: { items: { hpot1: { type: 'pot', gives: [['hp', 400]], g: 100 }, blade: { type: 'weapon' } } }, character: { ctype: 'ranger', map: 'main', items: [{ name: 'blade', level: 2 }], slots: {} }, combat: { potions: 0 } });
    vm.runInContext(analysisTelemetry, context);
    handlers.game_response({ place: 'equip', used: 'hpot1', failed: true });
    handlers.game_response({ place: 'use', used: 'hp' });
    handlers.game_response({ place: 'equip', used: 'blade' });
    handlers.game_response({ place: 'equip', used: 'hpot1' });
    expect(vm.runInContext('economy', context)).toMatchObject({ consumablesGold: 100, consumed: 1, unpriced: 0 });
    expect(vm.runInContext('analysisItems()', context)[0]).toMatchObject({ name: 'blade', level: 2, properties: { armor: 10, speed: -2 } });
  });
});

