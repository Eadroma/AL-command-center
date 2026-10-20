import { BuildComparison } from '../automation/BuildComparison';
import { WorkspaceSections } from '../layout/WorkspaceSections';
import { Activity, HeartPulse, ShieldAlert, Swords } from 'lucide-react';
import type { Profile } from '../../../shared/schema';
import type { Catalog, DeploymentsResponse } from '../../types';
import { classifiedFailures, combatRows, compactMetric } from '../../models/combat';
import { loadoutCompliance, type LoadoutGearStatus } from '../../models/loadout-compliance';
import { Badge, Card, EmptyState, SectionHead, Sprite, Tooltip } from '../ui';
import styles from './CombatPage.module.scss';
import { CombatDiagnostics } from '../automation/CombatDiagnostics';

export interface CombatPageProps {
  profile?: Profile;
  deployments?: DeploymentsResponse;
  catalog?: Catalog;
  loading: boolean;
}

const complianceVariant: Record<LoadoutGearStatus, 'success' | 'info' | 'warning' | 'danger' | 'neutral'> = {
  equipped: 'success', available: 'info', 'wrong-slot': 'warning', 'low-level': 'warning', missing: 'danger', offline: 'neutral',
};

/** Read-only combat metrics accumulated since each character's current CODE start. */
export function CombatPage({ profile, deployments, catalog, loading }: CombatPageProps) {
  const rows = profile ? combatRows(profile, deployments) : [];
  const failures = classifiedFailures(rows, deployments).slice(0, 12);
  const reporting = rows.filter(row => row.combat).length;
  const compliance = profile ? loadoutCompliance(profile, deployments) : [];
  const ready = compliance.filter(check => check.status === 'equipped' || check.status === 'available' || check.status === 'wrong-slot').length;

  return (
    <section aria-label="Combat insights">
      <SectionHead eyebrow="Live combat" title="Combat telemetry">
        <Tooltip content="Metrics reset whenever that character's CODE restarts.">
          <Badge variant={reporting ? 'info' : 'neutral'}>{reporting}/{rows.length} sessions</Badge>
        </Tooltip>
      </SectionHead>
      <p className={styles.description}>Cumulative combat diagnostics from the current CODE session of each enabled character.</p>
      {loading && <EmptyState title="Loading combat telemetry…" />}
      {!loading && !profile && <EmptyState title="Profile unavailable" description="Use Refresh to retry the server connection." />}
      {!loading && profile && rows.length === 0 && <EmptyState title="No enabled characters" />}
      {!loading && profile && rows.length > 0 && (
        <>
          <WorkspaceSections label="Combat views" sections={[
            { id: 'metrics', label: 'Session metrics', description: 'Compare damage, support and movement for the current CODE sessions.', content: <>
          <div className={styles.cards}>
            {rows.map(row => {
              const metric = row.combat;
              const pingWarning = (row.network?.pingMs ?? 0) > 300 || row.network?.socketConnected === false;
              return (
                <Card
                  key={row.character.name}
                  title={row.character.name}
                  variant={metric && row.live ? 'active' : 'default'}
                  headerActions={<>
                    <Badge>{row.character.ctype}</Badge>
                    {row.network && <Badge variant={pingWarning ? 'warning' : 'success'}>{Math.round(row.network.pingMs)} ms</Badge>}
                    <Badge variant={row.live ? 'success' : 'neutral'}>{row.live ? 'Live' : 'Stale'}</Badge>
                  </>}
                >
                  {!metric ? <EmptyState title="No combat metrics" description="Rebuild this character to enable telemetry." /> : (
                    <dl className={styles.metrics}>
                      <div><dt><Swords size={14} /> Damage</dt><dd>{compactMetric(metric.damageDealt)}</dd><small>{compactMetric(row.damagePerSecond)} / sec · {compactMetric(metric.attacks)} attacks</small></div>
                      <div><dt><ShieldAlert size={14} /> Taken</dt><dd>{compactMetric(row.damageTaken)}</dd><small>{compactMetric(metric.damageTakenPhysical)} physical · {compactMetric(metric.damageTakenMagical)} magical</small></div>
                      <div><dt><HeartPulse size={14} /> Support</dt><dd>{compactMetric(metric.healing)}</dd><small>{compactMetric(metric.manaRestored)} mana restored</small></div>
                      <div><dt><Activity size={14} /> Movement</dt><dd>{row.movementPercent}%</dd><small>{compactMetric(metric.kiteMoves)} kite moves · {compactMetric(metric.potions)} potions</small></div>
                      <div><dt>Kills</dt><dd>{compactMetric(metric.kills)}</dd><small>{compactMetric(metric.deaths)} deaths</small></div>
                      <div><dt>Healer coverage</dt><dd>{row.coveragePercent}%</dd><small>Time inside healer range during combat</small></div>
                    </dl>
                  )}
                </Card>
              );
            })}
          </div>

            </> },
            { id: 'live', label: 'Live diagnostic', description: 'Inspect current actions, blocked skills and combat decisions.', content: <>
          <CombatDiagnostics profile={profile} deployments={deployments} />
            </> },
            { id: 'comparison', label: 'Build comparison', description: 'Compare configured gear and skill choices before deployment.', content: <BuildComparison profile={profile} deployments={deployments} catalog={catalog} /> },
            { id: 'gear', label: 'Gear compliance', description: 'Compare configured equipment overrides with current equipment.', content: <>
          <section className={styles.compliance} aria-label="Loadout compliance">
            <SectionHead eyebrow="Desired gear vs live equipment" title="Loadout compliance">
              <Badge variant={compliance.length && ready === compliance.length ? 'success' : 'warning'}>{ready}/{compliance.length} ready</Badge>
            </SectionHead>
            {compliance.length === 0 ? <EmptyState title="No explicit gear overrides" description="Configured loadouts using script defaults have nothing to compare." /> : (
              <div className={styles.complianceList}>{compliance.map(check => {
                const displayName = catalog?.items.find(item => item.id === check.item)?.name ?? check.item;
                return <article key={`${check.character}:${check.style}:${check.slot}`}>
                  <Sprite id={`item:${check.item}`} catalog={catalog} label={displayName} size={38} />
                  <div><strong>{displayName} +{check.minLevel}</strong><span>{check.character} · {check.style.toUpperCase()} · {check.slot}</span><small>{check.detail}</small></div>
                  <Badge variant={complianceVariant[check.status]}>{check.status.replace('-', ' ')}</Badge>
                </article>;
              })}</div>
            )}
          </section>

            </> },
            { id: 'failures', label: 'Failure analysis', description: 'Review classified deaths and their reported causes.', content: <>
          <section className={styles.failures} aria-label="Classified failures">
            <SectionHead eyebrow="Automatic review" title="Failure analysis" />
            {failures.length === 0 ? <EmptyState title="No classified failures" description="No deaths were classified during the current CODE sessions." /> : (
              <div className={styles.failureList}>{failures.map((failure, index) => (
                <article key={`${failure.character}:${failure.at}:${index}`}>
                  <div><strong>{failure.reason}</strong><span>{failure.character} · {new Date(failure.at).toLocaleString()}</span></div>
                  <p>{failure.details}</p>
                </article>
              ))}</div>
            )}
          </section>

            </> },
          ]} />
        </>
      )}
    </section>
  );
}
