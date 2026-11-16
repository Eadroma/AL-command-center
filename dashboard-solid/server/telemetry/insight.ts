/**
 * Decision details sent by the v2 instrumented scripts (intent, movement watchdog, network, runtime policy, loop guard,
 * coordination), read the same way from our telemetry packets and from the v2 relay.
 * Each section is optional and validated on its own: a malformed or newer section is ignored instead of
 * rejecting the whole packet.
 */
import { z } from 'zod';
import type { Insight } from '../../shared/telemetry.ts';

const point = z.looseObject({ map: z.string().max(80), x: z.number(), y: z.number() });
const text = z.string().max(240);

export const runtimeSections = {
  intent: z.looseObject({
    state: z.string().max(120),
    since: z.number().optional(),
    destination: point.nullable().optional(),
    blockedBy: text.nullable().optional(),
  }).optional().catch(undefined),
  movement: z.looseObject({
    state: z.string().max(40), stalledForMs: z.number(), attempts: z.number(), lastAction: text.default(''),
  }).optional().catch(undefined),
  network: z.looseObject({ socketConnected: z.boolean() }).optional().catch(undefined),
  runtimePolicy: z.looseObject({
    danger: z.looseObject({ active: z.boolean(), reason: text }).optional(),
    diagnostic: z.looseObject({ reason: text }).optional(),
  }).optional().catch(undefined),
  loopGuard: z.looseObject({ holds: z.array(z.looseObject({ task: z.string().max(80), reason: text })) }).optional().catch(undefined),
  coordination: z.looseObject({
    role: z.enum(['leader', 'follower']),
    mission: z.looseObject({ monster: z.string().max(80), phase: z.string().max(40) }).nullable(),
    ready: z.array(z.string().max(40)).max(10),
    canEngage: z.boolean(),
  }).optional().catch(undefined),
};

export type RuntimeSections = { readonly [K in keyof typeof runtimeSections]: z.infer<(typeof runtimeSections)[K]> };

const blank = (value: string | null | undefined): string | null => (value === undefined || value === null || value === '' ? null : value);

function coordinationOf(coordination: RuntimeSections['coordination']): Insight['coordination'] {
  if (coordination === undefined) {
    return null;
  }
  const { role, mission, ready, canEngage } = coordination;
  return { role, monster: mission?.monster ?? null, phase: mission?.phase ?? null, ready, canEngage };
}

function intentOf(intent: RuntimeSections['intent']): Pick<Insight, 'since' | 'destination' | 'blockedBy'> {
  const destination = intent?.destination ?? null;
  return {
    since: intent?.since ?? null,
    destination: destination === null ? null : { map: destination.map, x: destination.x, y: destination.y },
    blockedBy: blank(intent?.blockedBy),
  };
}

function policyOf(policy: RuntimeSections['runtimePolicy']): Pick<Insight, 'danger' | 'combat'> {
  return { danger: policy?.danger?.active === true ? policy.danger.reason : null, combat: blank(policy?.diagnostic?.reason) };
}

function movementOf(movement: RuntimeSections['movement']): Insight['movement'] {
  return movement === undefined ? null : { state: movement.state, stalledForMs: movement.stalledForMs, attempts: movement.attempts, lastAction: movement.lastAction };
}

export function insightOf(sections: Partial<RuntimeSections>, script: string | null): Insight {
  const hold = sections.loopGuard?.holds[0];
  return {
    ...intentOf(sections.intent),
    ...policyOf(sections.runtimePolicy),
    movement: movementOf(sections.movement),
    connected: sections.network?.socketConnected ?? null,
    hold: hold === undefined ? null : { task: hold.task, reason: hold.reason },
    coordination: coordinationOf(sections.coordination),
    script,
  };
}

export const EMPTY_INSIGHT: Insight = insightOf({}, null);
