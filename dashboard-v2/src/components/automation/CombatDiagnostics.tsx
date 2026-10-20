import type { Profile, DeploymentsResponse } from '../../types';
import { Badge, Card } from '../ui';
import styles from './AutomationPanels.module.scss';

export function CombatDiagnostics({ profile, deployments }: { profile?: Profile; deployments?: DeploymentsResponse }) {
  return <Card title="Live combat diagnostic" className={styles.panel}>
    <p className={styles.help}>Observed state explains common blockers; action results are responses from the game. Attack and heal share a cooldown. Duration counters and recent actions reset when CODE restarts. <a href="#farming">Configure combat-only gloves</a>.</p>
    <div className={styles.rules}>{profile?.characters.filter(c => c.enabled && c.ctype !== 'merchant').map(c => {
      const telemetry = deployments?.characters[c.name]?.telemetry, diagnostic = telemetry?.runtimePolicy?.diagnostic;
      return <article className={styles.rule} key={c.name}>
        <div className={styles.metric}><strong>{c.name}</strong><Badge variant={telemetry?.live ? 'info' : 'neutral'}>{telemetry?.live ? 'Live' : 'Offline'}</Badge></div>
        {telemetry?.runtimePolicy?.combatGear?.enabled && <p>Gloves: {telemetry.runtimePolicy.combatGear.phase} · {telemetry.runtimePolicy.combatGear.status}</p>}
        {!diagnostic ? <p>Rebuild this v2 character to collect diagnostic decisions.</p> : <>
          <p>{diagnostic.reason} · {Math.max(0, Math.round(((telemetry?.lastSeen || diagnostic.updatedAt) - diagnostic.since) / 1000))}s · {diagnostic.source === 'action' ? 'Game response' : 'Observed state'}{diagnostic.target && ` · target ${diagnostic.target}`}</p>
          <details><summary>Time by state and recent actions</summary>
            <ul className={styles.log}>{Object.entries(diagnostic.durations).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([reason, ms]) => <li key={reason}>{reason}: {Math.round(ms / 1000)}s</li>)}</ul>
            <ul className={styles.log}>{diagnostic.actions.slice(-8).reverse().map((action, index) => <li key={`${action.at}:${index}`}><time>{new Date(action.at).toLocaleTimeString()}</time><strong>{action.action}</strong><Badge variant={action.result === 'success' ? 'success' : 'warning'}>{action.result}</Badge></li>)}</ul>
          </details>
        </>}
      </article>;
    })}</div>
  </Card>;
}
