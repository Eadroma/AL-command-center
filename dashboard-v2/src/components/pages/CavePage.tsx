import { useState } from 'react';
import { Clock3, Coins, Gem, LogOut, RotateCcw } from 'lucide-react';
import type { Profile } from '../../../shared/schema';
import type { DeploymentsResponse } from '../../types';
import { api } from '../../api/client';
import { Badge, Button, EmptyState, SectionHead } from '../ui';
import styles from './CavePage.module.scss';

const duration = (milliseconds?: number) => {
  if (milliseconds == null) return '—';
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
};

export function CavePage({ profile, deployments, loading }: { profile?: Profile; deployments?: DeploymentsResponse; loading: boolean }) {
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const farmers = (profile?.characters ?? []).filter(character => character.enabled && character.ctype !== 'merchant');
  const rows = farmers.map(character => ({ character, deployment: deployments?.characters[character.name], cave: deployments?.characters[character.name]?.telemetry?.cave }));
  const inside = rows.filter(row => row.cave?.inside).length;
  const enabled = rows.filter(row => row.cave?.enabled).length;

  async function exitGroup() {
    setPending(true); setNotice(''); setError('');
    try {
      const result = await api<{ ok: boolean; queued: string[]; failures: Array<{ character: string; error: string }> }>('/api/cave/exit', {});
      setNotice(`Exit queued for ${result.queued.join(', ')}${result.failures.length ? ` · unavailable: ${result.failures.map(item => item.character).join(', ')}` : ''}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to queue Cave Dreams exit.'); }
    finally { setPending(false); }
  }

  return (
    <section aria-label="Cave Dreams operations">
      <SectionHead eyebrow="Daily three-player instance" title="Cave Dreams">
        <Badge variant={inside ? 'warning' : enabled ? 'info' : 'neutral'}>{inside ? `${inside}/3 inside` : enabled ? 'Armed' : 'Disabled'}</Badge>
        <Button variant="danger" size="small" disabled={pending || inside === 0} onClick={exitGroup}><LogOut size={14} /> {pending ? 'Queueing…' : 'Exit group'}</Button>
      </SectionHead>
      <p className={styles.description}>The merchant is excluded. Exit requests reach each farmer independently and wait for active combat to end before leaving the generated instance.</p>
      {loading && <EmptyState title="Loading Cave Dreams status…" />}
      {!loading && rows.length === 0 && <EmptyState title="No enabled farming trio" />}
      <div className={styles.grid}>
        {rows.map(({ character, deployment, cave }) => (
          <article key={character.name} className={cave?.inside ? styles.inside : undefined}>
            <div className={styles.head}><div><strong>{character.name}</strong><span>{character.ctype}</span></div><Badge variant={!deployment?.telemetry?.live ? 'neutral' : cave?.inside ? 'success' : 'info'}>{!deployment?.telemetry?.live ? 'Stale' : cave?.inside ? 'Inside' : 'Outside'}</Badge></div>
            <dl>
              <div><dt>Floor</dt><dd>{cave?.floor ?? '—'}</dd></div>
              <div><dt><Clock3 size={13} /> Remaining</dt><dd>{duration(cave?.remainingMs)}</dd></div>
              <div><dt><Gem size={13} /> Amber</dt><dd>{cave?.amber ?? '—'}</dd></div>
              <div><dt><Coins size={13} /> Gold</dt><dd>{cave?.gold?.toLocaleString() ?? '—'}</dd></div>
              <div><dt><RotateCcw size={13} /> Resets</dt><dd>{cave?.resets ?? '—'}</dd></div>
              <div><dt>Vote</dt><dd>{cave?.paused ? 'Paused' : 'Running'}</dd></div>
            </dl>
            <p>{cave?.last || (deployment?.telemetry?.live ? 'Waiting for cave activity.' : 'No fresh telemetry.')}</p>
          </article>
        ))}
      </div>
      {notice ? <p role="status" className={styles.notice}>{notice}</p> : null}
      {error ? <p role="alert" className={styles.error}>{error}</p> : null}
    </section>
  );
}
