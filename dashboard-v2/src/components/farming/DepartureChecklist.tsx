import type { DeploymentsResponse, Profile } from '../../types';
import { departureChecklist } from '../../models/departure-checklist';
import { Badge, Card } from '../ui';
import styles from './Preparation.module.scss';
export function DepartureChecklist({ profile, deployments }: { profile: Profile; deployments?: DeploymentsResponse }) {
  const rows = departureChecklist(profile, deployments);
  const attention = rows.filter(row => row.state !== 'ready');
  return <Card title="Before departure" headerActions={<Badge variant={attention.length ? 'warning' : 'success'}>{attention.length} checks need review</Badge>}>
    <p>Read-only checklist for enabled farmers and the current configuration. This does not authorize deployment or guarantee survival. Stale data and unknown script defaults remain unknown.</p>
    <div className={styles.rows}>{[...new Set(rows.map(row => row.character))].map(name => <article key={name}><strong>{name}</strong>{rows.filter(row => row.character === name).map((row, index) => <p key={`${row.label}:${index}`}><Badge variant={row.state === 'ready' ? 'success' : row.state === 'blocked' ? 'danger' : 'warning'}>{row.state}</Badge> {row.label} · {row.detail}</p>)}</article>)}</div>
  </Card>;
}
