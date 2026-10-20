import { WorkspaceSections } from '../layout/WorkspaceSections';
import { AlertTriangle, CheckCircle2, Coins, MapPinned, RadioTower, ReceiptText } from 'lucide-react';
import type { Profile } from '../../../shared/schema';
import { useOperationsHistory } from '../../hooks/useOperationsHistory';
import { validateDashboardConfig } from '../../models/config-validation';
import type { DeploymentsResponse } from '../../types';
import { Badge, EmptyState, SectionHead } from '../ui';
import styles from './OperationsPage.module.scss';

interface Props { profile?: Profile; deployments?: DeploymentsResponse; loading: boolean; }
const age = (at?: number) => !at ? 'never' : `${Math.max(0, Math.round((Date.now() - at) / 1000))}s ago`;
const gold = (value: number) => Math.round(value).toLocaleString();

/** One read-only console for team coordination, merchant outcomes and navigation traces. */
export function OperationsPage({ profile, deployments, loading }: Props) {
  const history = useOperationsHistory();
  if (loading && !deployments) return <section aria-label="Operations"><SectionHead eyebrow="Runtime control" title="Operations" /><EmptyState title="Loading runtime state…" /></section>;
  const characters = profile?.characters.filter(character => character.enabled) ?? [];
  const validation = profile ? validateDashboardConfig(profile) : [];
  const transactions = history.data?.transactions ?? [];
  const commerce = history.data?.commerce ?? [];
  return (
    <section aria-label="Operations">
      <SectionHead eyebrow="Runtime control" title="Operations center">
        <Badge variant={validation.some(issue => issue.severity === 'error') ? 'danger' : 'success'}>{validation.filter(issue => issue.severity === 'error').length} config errors</Badge>
      </SectionHead>
      <p className={styles.description}>Live Ready/Engage coordination, merchant transaction outcomes and route traces. Commercial and bank events remain available across dashboard restarts.</p>

      <WorkspaceSections label="Operations views" sections={[
        { id: 'coordination', label: 'Team & movement', description: 'Inspect readiness, active missions and recent navigation traces.', content: <>
      <div className={styles.sectionHead}><RadioTower size={16} /><h3>Team coordinator</h3></div>
      <div className={styles.cards}>{characters.filter(character => character.ctype !== 'merchant').map(character => {
        const telemetry = deployments?.characters[character.name]?.telemetry;
        const coordination = telemetry?.coordination;
        const mission = coordination?.mission;
        return <article key={character.name}>
          <div className={styles.cardHead}><strong>{character.name}</strong><Badge variant={!telemetry?.live ? 'warning' : coordination?.canEngage === false ? 'danger' : 'success'}>{!telemetry?.live ? 'offline' : coordination?.canEngage === false ? 'waiting' : coordination?.role ?? 'collecting'}</Badge></div>
          <p>{mission ? `${mission.monster || 'travel'} → ${mission.map} (${Math.round(mission.x)}, ${Math.round(mission.y)})` : 'No active mission reported.'}</p>
          <small>{coordination?.role === 'leader' ? `Ready: ${coordination.ready.join(', ') || 'none'}` : `Mission update ${age(mission?.at)}`}</small>
        </article>;
      })}</div>

      <div className={styles.sectionHead}><MapPinned size={16} /><h3>Navigation debugger</h3></div>
      <div className={styles.cards}>{characters.map(character => {
        const movement = deployments?.characters[character.name]?.telemetry?.movement;
        const points = movement?.history?.slice(-6).reverse() ?? [];
        return <article key={character.name}>
          <div className={styles.cardHead}><strong>{character.name}</strong><Badge variant={movement?.state === 'blocked' || movement?.state === 'stalled' ? 'danger' : movement?.state === 'recovering' ? 'warning' : 'neutral'}>{movement?.state ?? 'no data'}</Badge></div>
          <p>{movement?.lastAction || (movement?.destination ? `Moving to ${movement.destination.map}` : 'No recovery action.')}</p>
          <ol className={styles.trace}>{points.map(point => <li key={`${point.at}:${point.map}:${point.x}:${point.y}`}><span>{point.map}</span> {Math.round(point.x)}, {Math.round(point.y)} <small>{point.state} · {age(point.at)}</small></li>)}</ol>
        </article>;
      })}</div>


        </> },
        { id: 'journal', label: 'Transactions', description: 'Review confirmed banking and commercial outcomes.', content: <>
      <div className={styles.split}>
        <div>
          <div className={styles.sectionHead}><ReceiptText size={16} /><h3>Merchant & bank journal</h3></div>
          <div className={styles.timeline}>{transactions.length ? transactions.slice(0, 30).map(row => <article key={row.id}>
            {row.state === 'committed' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
            <div><strong>{row.kind}</strong><span>{row.detail}</span><small>{row.message || row.state} · {new Date(row.finishedAt).toLocaleString()}</small></div>
          </article>) : <EmptyState title="No completed transaction yet" description="The next bank deposit will appear here with its verified outcome." />}</div>
        </div>
        <div>
          <div className={styles.sectionHead}><Coins size={16} /><h3>Commercial history</h3></div>
          <div className={styles.timeline}>{commerce.length ? commerce.slice(0, 30).map(row => <article key={row.id}>
            <Coins size={15} /><div><strong>{row.side} · {row.item} +{row.level}</strong><span>{row.quantity} × 🪙 {gold(row.unitPrice)}</span><small>Gold delta {gold(row.goldDelta)} · {new Date(row.at).toLocaleString()}</small></div>
          </article>) : <EmptyState title="No confirmed stand sale yet" description="A sale is recorded only when both listing quantity and merchant gold confirm it." />}</div>
        </div>
      </div>


        </> },
        { id: 'validation', label: 'Configuration', description: 'Review saved configuration errors and warnings.', content: <>
      <div className={styles.sectionHead}><CheckCircle2 size={16} /><h3>Configuration validator</h3></div>
      <div className={styles.validation}>{validation.map(issue => <article key={issue.id} className={styles[issue.severity]}><Badge variant={issue.severity === 'error' ? 'danger' : issue.severity === 'warning' ? 'warning' : 'success'}>{issue.severity}</Badge><div><strong>{issue.scope}</strong><p>{issue.message}</p></div></article>)}</div>

        </> },
      ]} />
      {history.error ? <p role="alert" className={styles.error}>{history.error.message}</p> : null}
    </section>
  );
}
