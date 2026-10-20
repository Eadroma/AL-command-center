import { Clock3 } from 'lucide-react';
import type { Profile } from '../../../shared/schema';
import type { PartyMember } from '../../types';
import { merchantPlan, type MerchantTaskState } from '../../models/merchant-planner';
import { Badge } from '../ui';
import { CollapsiblePanel } from './CollapsiblePanel';
import styles from './MerchantPlanner.module.scss';
import { merchantCircuit } from '../../models/merchant-circuit';
import type { DeploymentsResponse } from '../../types';

const variants: Record<MerchantTaskState, 'success' | 'info' | 'warning' | 'neutral'> = { active: 'success', ready: 'info', blocked: 'warning', disabled: 'neutral', idle: 'neutral' };
const cadence = (milliseconds: number) => milliseconds < 1000 ? `${milliseconds}ms` : `${milliseconds / 1000}s`;

export function MerchantPlanner({ profile, members, deployments }: { profile: Profile; members?: PartyMember[] | null; deployments?: DeploymentsResponse }) {
  const tasks = merchantPlan(profile, members);
  const merchant = profile.characters.find(character => character.ctype === 'merchant' && character.enabled);
  const circuit = merchantCircuit(profile, merchant ? deployments?.characters[merchant.name]?.telemetry ?? undefined : undefined);
  return (
    <CollapsiblePanel id="merchant-planner" eyebrow="Concurrent runtime queues" title="Detailed runtime planner" actions={<Badge variant="info">{tasks.filter(task => task.state !== 'disabled').length} active lanes</Badge>}>
      <section className={styles.circuit} aria-label="Merchant circuit">
        <div className={styles.grid}>
          <article><strong>Current activity</strong><span>{circuit?.action ?? 'No fresh merchant telemetry'}</span></article>
          <article><strong>Next candidate task</strong><span>{circuit?.next ?? 'Unknown'}</span></article>
          <article><strong>Blocker / production limit</strong><span>{circuit?.blockedBy ?? (circuit ? 'None reported' : 'Merchant offline or telemetry stale')}</span></article>
        </div>
        {circuit?.destination ? <p>Travelling to {circuit.destination.map} · {Math.round(circuit.destination.x)}, {Math.round(circuit.destination.y)}</p> : null}
        {circuit?.blockedBy ? <p>Blocked by: {circuit.blockedBy}</p> : null}
        <p>Inventory overview against the current editor configuration, including unsaved edits. This is not a fixed itinerary. Counts are candidate stacks / pieces, not guaranteed operations; the deployed runtime decides eligibility and batch order.</p>
        {circuit ? <div className={styles.grid}>{circuit.stops.map(stop => <article key={stop.id}><strong>{stop.label}</strong><span>{stop.candidates === null ? '—' : stop.candidates} candidates</span><span>{stop.detail}</span></article>)}</div> : <p>Wait for fresh telemetry. Old inventory is not used to describe the current trip.</p>}
        {circuit?.recent.length ? <details><summary>Last confirmed / failed transactions</summary><ol>{circuit.recent.map(entry => <li key={entry.id}>{entry.kind} · {entry.detail} · {entry.state}{entry.message ? ` · ${entry.message}` : ''}</li>)}</ol></details> : null}
      </section>
      <details><summary>Runtime lanes and cadence</summary><p>Runtime lanes below are inferred from intent and configuration. Ready indicates an enabled lane, not a confirmed queued task. Check cadence is approximate.</p>
      <div className={styles.grid}>{tasks.map(task => (
        <article key={task.id} className={task.state === 'active' ? styles.active : undefined}>
          <div><strong>{task.label}</strong><Badge variant={variants[task.state]}>{task.state}</Badge></div>
          <span>{task.detail}</span>
          <small><Clock3 size={12} /> checks every {cadence(task.cadenceMs)}</small>
          {task.blocker ? <p>{task.blocker}</p> : null}
        </article>
      ))}</div></details>
    </CollapsiblePanel>
  );
}
