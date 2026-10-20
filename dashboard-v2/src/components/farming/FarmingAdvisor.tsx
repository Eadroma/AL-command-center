import { useState } from 'react';
import type { Catalog, Profile } from '../../types';
import { usePerformanceHistory } from '../../hooks/usePerformanceHistory';
import { farmingRecommendations } from '../../models/farming-advisor';
import { setDefaultMonster } from '../../models/farming';
import { Badge, Button, Card, SelectInput, Sprite, Toggle } from '../ui';
import styles from './Preparation.module.scss';
import { farmingTeam } from '../../models/farming-team';

export function FarmingAdvisor({ profile, catalog, disabled, onChange }: { profile: Profile; catalog: Catalog; disabled: boolean; onChange: (profile: Profile) => void }) {
  const [hours, setHours] = useState(24);
  const [chosen, setChosen] = useState<string[] | null>(null);
  const farmers = profile.characters.filter(character => character.ctype !== 'merchant');
  const team = chosen ?? farmingTeam(profile).map(character => character.name);
  const history = usePerformanceHistory(hours);
  const rows = farmingRecommendations(history.data?.buckets ?? [], team, catalog, profile);
  return <Card title="Measured farming advisor">
    <p>Rank regular mobs by tracked net gold per observed character-hour, for the exact selected team. Only attributed measurements count. Missing zones have no evidence; this is not a universal ranking.</p>
    <SelectInput aria-label="Advisor history window" value={String(hours)} onChange={value => setHours(Number(value))} options={[24, 168].map(value => ({ value: String(value), label: value === 168 ? 'Last 7 days' : 'Last 24 hours' }))} />
    <div className={styles.controls}>{farmers.map(character => <Toggle key={character.name} label={character.name} value={team.includes(character.name)} onChange={enabled => setChosen(enabled ? [...team, character.name] : team.filter(name => name !== character.name))} />)}</div>
    {history.error ? <p role="alert">{history.error.message}</p> : null}
    {!rows.length ? <p>{history.isFetching ? 'Loading observations…' : 'No attributed observations for this composition. Collect a farming session with the current telemetry bundle.'}</p> : null}
    <div className={styles.rows}>{rows.map(row => <article key={row.key}>
      <div className={styles.head}><Sprite id={row.monster} catalog={catalog} label={row.monster} size={32} /><strong>{row.monster}</strong><Badge variant={row.measurement.deaths ? 'warning' : 'info'}>{row.measurement.deaths} observed deaths</Badge></div>
      <p>{row.map || 'Unknown map'} · {row.server || 'Unknown server'} · {row.confidence}{row.incompleteTeam ? ' · Incomplete team reporting' : ''}</p>
      <p>Net gold/h: {row.measurement.netPerHour === null ? 'Unknown' : Math.round(row.measurement.netPerHour).toLocaleString()} · XP/h: {Math.round(row.measurement.xpPerHour ?? 0).toLocaleString()} · Costs/h: {row.measurement.costPerHour === null ? 'Unknown' : Math.round(row.measurement.costPerHour).toLocaleString()}</p>
      <p>{Math.round(row.measurement.elapsedMs / 60000)} character-minutes · economy coverage {Math.round(row.measurement.coverage * 100)}%. Observed deaths are evidence, not a prediction of safety.</p>
      <Button disabled={disabled || history.isFetching || !!history.error} onClick={() => onChange(setDefaultMonster(profile, row.monster, catalog))}>Stage fallback target</Button>
    </article>)}</div>
    <p>Staging changes only the fallback target. Character target overrides, activity builds and event participation remain configured separately. Save and deploy to apply.</p>
  </Card>;
}
