import { useEffect, useRef, useState } from 'react';
import type { DeploymentsResponse, Profile } from '../../types';
import { explainDecision } from '../../models/decision-explanation';
import { decisionDestination } from '../../models/decision-navigation';
import { openMerchantRule } from '../../models/rule-navigation';
import { IncidentReplay } from './IncidentReplay';
import { Badge, Button } from '../ui';
import styles from '../inventory/ItemDetailsDrawer.module.scss';

/** A single native modal preserves focus, Escape dismissal and fresh report semantics. */
export function DecisionEvidenceDrawer({ deployments, profile }: { deployments?: DeploymentsResponse; profile?: Profile }) {
  const [character, setCharacter] = useState('');
  const dialog = useRef<HTMLDialogElement>(null), previousFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const open = (event: Event) => {
      const name = (event as CustomEvent<unknown>).detail;
      if (typeof name !== 'string' || !name || name.length > 40) return;
      previousFocus.current = document.activeElement as HTMLElement;
      setCharacter(name); if (!dialog.current?.open) dialog.current?.showModal();
    };
    window.addEventListener('alcc:decision-evidence', open);
    return () => window.removeEventListener('alcc:decision-evidence', open);
  }, []);
  function close() { dialog.current?.close(); setCharacter(''); previousFocus.current?.focus(); }
  const t = deployments?.characters[character]?.telemetry ?? undefined;
  const enabled = profile?.characters.find(row => row.name === character)?.enabled ?? true;
  const d = explainDecision(enabled, t), destination = decisionDestination(t);
  const actions = t?.runtimePolicy?.diagnostic.actions ?? [];
  return <dialog ref={dialog} className={styles.drawer} aria-labelledby="decision-evidence-title" onCancel={close}>
    <header className={styles.header}><div><h2 id="decision-evidence-title">Decision & evidence · {character}</h2></div><button type="button" aria-label="Close decision and evidence" onClick={close}>×</button></header>
    {character && <div className={styles.body}>
      <Badge variant={t?.live ? 'success' : 'warning'}>{t?.live ? 'Live report' : 'Stale / unavailable'}</Badge>
      <p className={styles.note}>Last received: {t?.lastSeen ? new Date(t.lastSeen).toLocaleString() : 'Unavailable'}. {d.source === 'inferred' ? 'Explanation inferred from observed state.' : d.source === 'reported' ? 'Explanation reported by runtime.' : 'No current decision evidence.'}</p>
      <section><h3>Current activity</h3><p>{d.action}</p></section>
      <section><h3>Reason</h3><p>{d.reason}</p></section>
      <section><h3>Next action / condition</h3><p>{d.next}</p><small>Conditions are guidance; they are not a scheduled action.</small></section>
      <section><h3>Blocker</h3><p>{d.warning ? d.reason : 'None reported in this explanation'}</p>
        <Button onClick={() => { close(); window.location.hash = destination.page; if (destination.panel) window.setTimeout(() => { if (window.location.hash === `#${destination.page}`) openMerchantRule(destination.panel!); }, 150); }}>{destination.label}</Button>
      </section>
      <section><h3>Observed evidence {t?.live ? '' : '(stored)'}</h3>
        <p>{t?.stats ? `${t.stats.map} · ${Math.round(t.stats.x ?? 0)}, ${Math.round(t.stats.y ?? 0)} · HP ${t.stats.hp}/${t.stats.max_hp} · MP ${t.stats.mp}/${t.stats.max_mp}` : 'No position or resource evidence'}</p>
        <p>Target: {t?.stats?.target || 'None reported'} · socket: {t?.network ? t.network.socketConnected ? 'connected' : 'disconnected' : 'unknown'}</p>
        {t?.loopGuard?.holds.map(row => <article key={row.task}><strong>{row.task} suspended</strong><span>{row.reason}</span><small>Since {new Date(row.at).toLocaleString()}; resumes only when relevant stock or rules change.</small></article>)}
        {t?.upgradeProduction?.filter(row => row.pending).map(row => <article key={row.item}><strong>{row.item} · cost held {row.spent.toLocaleString()}</strong><span>{row.reviewReason || 'Automatic verification in progress'}</span></article>)}
        {actions.length ? <ol>{actions.slice().reverse().map((row, i) => <li key={`${row.at}:${i}`}>{new Date(row.at).toLocaleTimeString()} · {row.action} · {row.result}</li>)}</ol> : <p>No action acknowledgements reported.</p>}
      </section>
      <IncidentReplay captures={t?.incidentReplays ?? []} />
    </div>}
  </dialog>;
}
