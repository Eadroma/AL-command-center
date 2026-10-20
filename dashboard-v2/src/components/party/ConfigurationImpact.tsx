import type { Profile, Catalog, DeploymentsResponse } from '../../types';
import { configurationImpact } from '../../models/config-impact';
import { EquipmentReservations } from '../inventory/EquipmentReservations';
import { Badge, Card } from '../ui';
import styles from './ConfigurationImpact.module.scss';

export function ConfigurationImpact({ saved, draft, deployments, catalog, conflict }: { saved?: Profile; draft?: Profile; deployments?: DeploymentsResponse; catalog?: Catalog; conflict: boolean }) {
  if (!saved || !draft) return null;
  const impact = configurationImpact(saved, draft);
  return <Card title="Unsaved configuration impact" headerActions={<Badge variant="warning">Draft only</Badge>}>
    <p>Saving stores the profile. Deployment applies it to game CODE; it does not automatically stop excluded characters.</p>
    {conflict ? <p role="alert">A newer saved revision exists. This comparison uses your original editing baseline; resolve the conflict before saving.</p> : null}
    {impact.groups.length ? <p>Shared settings changed: {impact.groups.join(', ')}. Review deployment for: {impact.rebuildCandidates.join(', ') || 'no enabled characters'}.</p> : null}
    <details><summary>Inspect exact draft changes</summary>
      {impact.groups.map(group => <details key={group}><summary>{group}</summary><div className={styles.diff}><div><strong>Saved baseline</strong><pre>{JSON.stringify(saved[group], null, 2)}</pre></div><div><strong>Draft</strong><pre>{JSON.stringify(draft[group], null, 2)}</pre></div></div></details>)}
      {impact.characters.map(character => <details key={character.name}><summary>{character.name}</summary>{character.changes.map(key => {
        const before = saved.characters.find(row => row.name === character.name);
        const after = draft.characters.find(row => row.name === character.name);
        return <p className={styles.value} key={key}>{key}: {JSON.stringify(before?.[key as keyof typeof before]) ?? 'Absent'} → {JSON.stringify(after?.[key as keyof typeof after]) ?? 'Absent'}</p>;
      })}</details>)}
    </details>
    {impact.characters.length ? <ul>{impact.characters.map(character => <li key={character.name}><strong>{character.name}</strong> · {character.changes.join(', ')}{character.wasEnabled && !character.enabled ? ' · excluded: stop its running CODE from Party' : !character.wasEnabled && character.enabled ? ' · newly enabled: deploy to apply' : ''}</li>)}</ul> : null}
    <details><summary>Configuration checks · {impact.issues.length} issues</summary>
      {impact.issues.length ? <ul>{impact.issues.map(issue => <li key={issue.id}><Badge variant={issue.severity === 'error' ? 'danger' : 'warning'}>{issue.severity}</Badge> {issue.scope} · {issue.message}</li>)}</ul> : <p>No cross-board conflict detected.</p>}
    </details>
    <details><summary>Equipment availability and reservations</summary><EquipmentReservations profile={draft} deployments={deployments} catalog={catalog} /></details>
    <p>Missing gear is not an automatic purchase request. Availability uses live inventory and the latest bank snapshot; builds are alternatives, not a guarantee that every simultaneous slot has a distinct copy.</p>
  </Card>;
}
