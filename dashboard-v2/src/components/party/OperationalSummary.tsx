import type { DeploymentsResponse, Profile } from '../../types';
import { incidentBoard } from '../../models/incidents';
import { Badge, Card } from '../ui';
import styles from './OperationalSummary.module.scss';

const destinations: Record<string, string> = { stock: 'merchant', inventory: 'inventory', availability: 'party', commerce: 'merchant', drift: 'deployments', movement: 'operations', solo: 'merchant', runtime: 'incidents', deployment: 'deployments', death: 'combat' };

export function OperationalSummary({ profile, deployments }: { profile?: Profile; deployments?: DeploymentsResponse }) {
  const incidents = incidentBoard(deployments, {}, profile);
  return <Card className={styles.summary} title="Operational summary" headerActions={<Badge variant={incidents.length ? 'warning' : 'success'}>{incidents.length} signals</Badge>}>
    <div className={styles.signals}>
    {!deployments ? <p>Waiting for telemetry.</p> : !incidents.length ? <p>No operational issue detected.</p> : incidents.slice(0, 6).map(incident => <p key={incident.id}>
      <Badge variant={incident.severity === 'error' ? 'danger' : 'warning'}>{incident.character}</Badge> {incident.title} · <a href={`#${destinations[incident.kind]}`}>Inspect</a>
    </p>)}
    </div>
    {incidents.length > 6 && <a href="#incidents">View all {incidents.length} signals</a>}
  </Card>;
}
