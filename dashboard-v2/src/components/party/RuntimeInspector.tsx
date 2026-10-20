import type { PartyMember } from '../../types';
import { Badge, Card } from '../ui';
import styles from './RuntimeInspector.module.scss';

const age = (since: number) => {
  const seconds = Math.max(0, Math.floor((Date.now() - since) / 1000));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
};

const EFFECT_LABELS: Record<string, string> = {
  encouragement_lonewolf: 'Lone Wolf',
  encouragement_new: 'New player encouragement',
  mluck: 'Merchant Luck',
  newcomersblessing: "Newcomer's Blessing",
};
const effectLabel = (id: string) => EFFECT_LABELS[id] ?? id.replace(/[_-]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
const remaining = (ms?: number) => {
  if (ms == null) return '';
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return seconds >= 60 ? ` · ${Math.floor(seconds / 60)}m ${seconds % 60}s` : ` · ${seconds}s`;
};

export function RuntimeInspector({ members }: { members: PartyMember[] | null }) {
  return (
    <Card title="Runtime Inspector" headerActions={<Badge variant="info">Live intent</Badge>} className={styles.card}>
      <div className={styles.list}>
        {(members ?? []).map(member => {
          const intent = member.intent;
          const movement = member.movement;
          const movementWarning = movement && ['stalled', 'recovering', 'blocked'].includes(movement.state);
          return (
            <article key={member.name} className={styles.row}>
              <div className={styles.head}><strong>{member.name}</strong><Badge variant={intent?.blockedBy || movementWarning ? 'warning' : member.status === 'offline' ? 'neutral' : 'success'}>{intent?.blockedBy ? 'Blocked' : member.status}</Badge></div>
              <span className={styles.state}>{intent?.state ?? (member.status === 'offline' ? 'No live telemetry' : 'Waiting for intent')}</span>
              <dl>
                <div><dt>Map</dt><dd>{intent?.map || member.map || '—'}</dd></div>
                <div><dt>Since</dt><dd>{intent ? age(intent.since) : '—'}</dd></div>
                <div><dt>Target</dt><dd>{intent?.target || member.target || '—'}</dd></div>
                <div><dt>Destination</dt><dd>{intent?.destination ? `${intent.destination.map} · ${Math.round(intent.destination.x)}, ${Math.round(intent.destination.y)}` : '—'}</dd></div>
              </dl>
              {member.activeEffects.length ? <div className={styles.effects} aria-label={`${member.name} active effects`}>
                {member.activeEffects.map(effect => <Badge key={effect.id} variant={effect.id.toLowerCase().includes('lone') ? 'success' : 'info'}>{effectLabel(effect.id)}{remaining(effect.ms)}</Badge>)}
              </div> : null}
              {movement ? (
                <div className={`${styles.watchdog} ${movementWarning ? styles.watchdogWarning : ''}`}>
                  <span>Watchdog · {movement.state}</span>
                  <span>{movement.attempts} attempt{movement.attempts === 1 ? '' : 's'} · {movement.recoveries} recover{movement.recoveries === 1 ? 'y' : 'ies'}</span>
                  {movement.lastAction ? <small>{movement.lastAction}</small> : null}
                </div>
              ) : null}
              {intent?.blockedBy ? <p className={styles.blocked}>Blocked by: {intent.blockedBy}</p> : null}
            </article>
          );
        })}
      </div>
    </Card>
  );
}
