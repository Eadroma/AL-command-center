/** Puts an Explanation into words in the current language: a short action, the reason and what comes next. */
import { formatAgo } from '../../../i18n/format.ts';
import { locale, t } from '../../../i18n/i18n.ts';
import type { Explanation } from './explain.ts';

export interface ExplanationText {
  readonly action: string;
  readonly reason: string;
  readonly next: string;
}

const place = (point: { readonly map: string; readonly x: number; readonly y: number }): { map: string; x: number; y: number } =>
  ({ map: point.map, x: Math.round(point.x), y: Math.round(point.y) });

type Kind<K extends Explanation['kind']> = Extract<Explanation, { readonly kind: K }>;
type Plain = Kind<'never' | 'disconnected' | 'dead' | 'reported' | 'unknown'>;
type Quoted = Kind<'safetyHold' | 'blocked' | 'combat'>;
type Detailed = Exclude<Explanation, Plain | Quoted>;

const PLAIN: ReadonlySet<Explanation['kind']> = new Set(['never', 'disconnected', 'dead', 'reported', 'unknown']);
const QUOTED: ReadonlySet<Explanation['kind']> = new Set(['safetyHold', 'blocked', 'combat']);

const isPlain = (explanation: Explanation): explanation is Plain => PLAIN.has(explanation.kind);
const isQuoted = (explanation: Explanation): explanation is Quoted => QUOTED.has(explanation.kind);

function detailedReason(explanation: Detailed, now: number): string {
  switch (explanation.kind) {
    case 'stale':
      return t('panel.reason.stale', { ago: formatAgo((now - explanation.lastSeen) / 1000, locale()) });
    case 'suspended':
      return t('panel.reason.suspended', { task: explanation.task, reason: explanation.reason });
    case 'waitingTeam':
      return t('panel.reason.waitingTeam', { ready: explanation.ready.length === 0 ? t('panel.reason.nobody') : explanation.ready.join(', ') });
    case 'routeRecovery':
      return t('panel.reason.routeRecovery', { seconds: explanation.seconds, attempts: explanation.attempts });
    case 'mission':
      return t(explanation.leader ? 'panel.reason.missionLeader' : 'panel.reason.missionFollower', { monster: explanation.monster, phase: explanation.phase });
    case 'travelling':
      return t('panel.reason.travelling', place(explanation.destination));
    default: {
      const exhaustive: never = explanation;
      return exhaustive;
    }
  }
}

function reasonOf(explanation: Explanation, now: number): string {
  if (isPlain(explanation)) {
    return t(`panel.reason.${explanation.kind}`);
  }
  return isQuoted(explanation) ? t(`panel.reason.${explanation.kind}`, { reason: explanation.reason }) : detailedReason(explanation, now);
}

function actionOf(explanation: Explanation): string {
  if (explanation.kind === 'mission') {
    return t('panel.action.mission', { monster: explanation.monster });
  }
  if (explanation.kind === 'reported') {
    return t('panel.action.reported', { state: explanation.state });
  }
  return t(`panel.action.${explanation.kind}`);
}

export function explanationText(explanation: Explanation, now: number): ExplanationText {
  return { action: actionOf(explanation), reason: reasonOf(explanation, now), next: t(`panel.nextStep.${explanation.kind}`) };
}
