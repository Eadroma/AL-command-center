import { openDecisionEvidence } from '../../models/decision-navigation';
import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, CircleAlert, Footprints, GitCompareArrows, HeartPulse, Package, ShieldAlert, ShoppingBasket, Skull, Store, Terminal } from 'lucide-react';
import type { DeploymentsResponse, IncidentKind, Profile } from '../../types';
import { useIncidentResolutions } from '../../hooks/useIncidents';
import { incidentBoard } from '../../models/incidents';
import { Badge, Button, EmptyState, SectionHead } from '../ui';
import styles from './IncidentsPage.module.scss';
import { IncidentReplay } from '../party/IncidentReplay';

const labels: Record<IncidentKind, string> = { death: 'Death', movement: 'Movement', runtime: 'Runtime', deployment: 'Deployment', stock: 'Stock', inventory: 'Inventory', availability: 'Availability', commerce: 'Commerce', drift: 'Drift', solo: 'Solo guard' };
const icons = { death: Skull, movement: Footprints, runtime: Terminal, deployment: CircleAlert, stock: ShoppingBasket, inventory: Package, availability: HeartPulse, commerce: Store, drift: GitCompareArrows, solo: ShieldAlert };

export function IncidentsPage({ deployments, profile, loading }: { deployments?: DeploymentsResponse; profile?: Profile; loading: boolean }) {
  const resolution = useIncidentResolutions();
  const [showResolved, setShowResolved] = useState(false);
  const incidents = useMemo(() => incidentBoard(deployments, resolution.resolutions, profile), [deployments, resolution.resolutions, profile]);
  const visible = incidents.filter(incident => showResolved || !incident.resolved);
  const open = incidents.filter(incident => !incident.resolved);
  const errors = open.filter(incident => incident.severity === 'error').length;

  return (
    <section aria-label="Incident center">
      <SectionHead eyebrow="Operational review" title="Incident Center">
        <Button size="small" variant="ghost" onClick={() => setShowResolved(value => !value)}>{showResolved ? 'Hide resolved' : 'Show resolved'}</Button>
      </SectionHead>
      <p className={styles.description}>Runtime failures and live operational risks are grouped by character and cause. A resolved group reopens automatically when newer evidence arrives.</p>
      <div className={styles.summary}>
        <div><strong>{open.length}</strong><span>Open groups</span></div>
        <div><strong className={errors ? styles.danger : ''}>{errors}</strong><span>Errors</span></div>
        <div><strong>{incidents.reduce((total, incident) => total + incident.occurrences, 0)}</strong><span>Occurrences</span></div>
        <div><strong>{incidents.filter(incident => incident.resolved).length}</strong><span>Resolved</span></div>
      </div>
      {(loading || resolution.loading) && <EmptyState title="Loading incidents…" />}
      {resolution.error ? <p role="alert" className={styles.error}>{resolution.error}</p> : null}
      {!loading && !resolution.loading && visible.length === 0 && <EmptyState title={showResolved ? 'No incidents recorded' : 'No open incidents'} description="New runtime evidence appears here automatically." />}
      <div className={styles.list}>
        {visible.map(incident => {
          const Icon = icons[incident.kind];
          return (
            <article key={incident.id} className={`${styles.incident} ${incident.resolved ? styles.resolved : ''}`}>
              <div className={styles.icon}><Icon size={20} /></div>
              <div className={styles.body}>
                <div className={styles.head}>
                  <div><strong>{incident.title}</strong><span>{incident.character} · {incident.lastAt ? new Date(incident.lastAt).toLocaleString() : 'time unavailable'}</span></div>
                  <div className={styles.badges}>
                    <Badge variant={incident.severity === 'error' ? 'danger' : 'warning'}>{labels[incident.kind]}</Badge>
                    <Badge variant={incident.resolved ? 'success' : 'neutral'}>{incident.resolved ? 'Resolved' : 'Open'}</Badge>
                  </div>
                </div>
                <p>{incident.details}</p>
                {['death', 'movement', 'commerce', 'runtime'].includes(incident.kind) ? <IncidentReplay captures={(deployments?.characters[incident.character]?.telemetry?.incidentReplays ?? []).filter(capture => capture.kind === incident.kind)} /> : null}
                {incident.character.split(',').map(name => name.trim()).filter(Boolean).map(name => <Button key={name} size="small" variant="ghost" onClick={() => openDecisionEvidence(name)}>Decision & evidence · {name}</Button>)}
                <div className={styles.footer}>
                  <span>{incident.occurrences} occurrence{incident.occurrences === 1 ? '' : 's'}{incident.resolvedAt ? ` · resolved ${new Date(incident.resolvedAt).toLocaleString()}` : ''}</span>
                  <Button size="small" variant={incident.resolved ? 'ghost' : 'secondary'} disabled={resolution.pendingId === incident.id} onClick={() => resolution.setResolved(incident.id, !incident.resolved)}>
                    {incident.resolved ? <AlertTriangle size={13} /> : <CheckCircle2 size={13} />} {incident.resolved ? 'Reopen' : 'Resolve'}
                  </Button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
