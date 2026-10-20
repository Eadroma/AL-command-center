import { useState } from 'react';
import { loadoutOptions, type FarmStyle } from '../../../shared/schema';
import type { Catalog, DeploymentsResponse, Profile } from '../../types';
import { BUILD_METRICS, resolveBuild } from '../../models/build-comparison';
import { Badge, Card, EmptyState, Field, SelectInput, Sprite } from '../ui';
import styles from './BuildComparison.module.scss';

export function BuildComparison({ profile, deployments, catalog }: { profile?: Profile; deployments?: DeploymentsResponse; catalog?: Catalog }) {
  const farmers = profile?.characters.filter(character => character.ctype !== 'merchant') ?? [];
  const [name, setName] = useState('');
  const [left, setLeft] = useState<FarmStyle>('aoe');
  const [right, setRight] = useState<FarmStyle>('tank');
  const character = farmers.find(character => character.name === name) ?? farmers.find(character => deployments?.characters[character.name]?.telemetry?.live) ?? farmers[0];
  if (!profile || !character) return <EmptyState title="No farming character available" />;
  const telemetry = deployments?.characters[character.name]?.telemetry ?? undefined;
  const a = resolveBuild(profile, character.name, left, telemetry), b = resolveBuild(profile, character.name, right, telemetry);
  const options = loadoutOptions(profile);
  const elapsed = telemetry?.combat && telemetry.lastSeen ? Math.max(1, telemetry.lastSeen - telemetry.combat.startedAt) : 0;
  return <Card title="Build comparison">
    <p className={styles.help}>Compare explicit overrides using item properties calculated by the game for this character and terrain. Unspecified slots inherit current gear. These are equipment contributions, not final character stats or predicted skill DPS; attributes, weapon rules, sets and buffs can change the final result.</p>
    <div className={styles.controls}>
      <Field label="Character" htmlFor="compare-character"><SelectInput id="compare-character" value={character.name} onChange={setName} options={farmers.map(character => ({ value: character.name, label: character.name }))} /></Field>
      <Field label="Build A" htmlFor="compare-left"><SelectInput id="compare-left" value={left} onChange={value => setLeft(value as FarmStyle)} options={options} /></Field>
      <Field label="Build B" htmlFor="compare-right"><SelectInput id="compare-right" value={right} onChange={value => setRight(value as FarmStyle)} options={options} /></Field>
    </div>
    <p className={styles.help}>Current measured DPS: {telemetry?.live && elapsed ? Math.round((telemetry.combat?.damageDealt ?? 0) * 1000 / elapsed).toLocaleString() : '—'} · Terrain: {telemetry?.stats?.map ?? 'unknown'}</p>
    <p className={styles.help}>Live character: armor {telemetry?.live ? telemetry.stats?.armor ?? '—' : '—'} · resistance {telemetry?.live ? telemetry.stats?.resistance ?? '—' : '—'} · HP {telemetry?.live ? telemetry.stats?.max_hp ?? '—' : '—'} · MP {telemetry?.live ? telemetry.stats?.max_mp ?? '—' : '—'}</p>
    {!telemetry?.buildItems && <EmptyState title="Item properties not collected yet" description="Deploy the updated character bundle to collect game-calculated properties. Owned-item checks remain available below." />}
    <div className={styles.builds}>{[a, b].map((build, index) => <div key={index}>
      <h3>{index ? 'B' : 'A'} · {build.style.toUpperCase()}</h3>
      <Badge variant={build.complete ? 'success' : 'warning'}>{build.complete ? 'Copies available' : 'Incomplete / stale'}</Badge>
      <p className={styles.help}>Skills: {build.skills.join(', ') || 'Script defaults'}</p>
      {build.slots.map(slot => {
        const rule = profile.farming.loadouts[character.name]?.[build.style]?.gear.find(rule => rule.slot === slot);
        const resolved = build.selected.get(slot);
        const equipped = telemetry?.equipment?.find(item => item.slot === slot);
        const itemId = rule?.item ?? equipped?.name ?? '';
        const level = resolved?.level ?? rule?.minLevel ?? equipped?.level ?? 0;
        const available = [...(telemetry?.equipment ?? []), ...(telemetry?.inventory ?? [])].some(item => item.name === itemId && item.level >= (rule?.minLevel ?? 0));
        return <div className={styles.item} key={slot}><Sprite id={`item:${itemId}`} catalog={catalog} label={itemId} size={32} /><span>{slot} · {catalog?.items.find(item => item.id === itemId)?.name ?? itemId} +{level}</span>
          <Badge variant={rule ? 'info' : 'neutral'}>{rule ? 'Override' : 'Current gear'}</Badge>
          {rule && <Badge variant={resolved ? 'success' : available && !telemetry?.buildItems ? 'info' : 'warning'}>{resolved ? 'Resolved' : available && !telemetry?.buildItems ? 'Owned · unverified' : 'Missing copy / properties'}</Badge>}
        </div>;
      })}
    </div>)}</div>
    <div className={styles.tableWrap}><table><caption>Equipment contributions · B minus A</caption><thead><tr><th>Stat</th><th>A</th><th>B</th><th>Delta</th></tr></thead><tbody>{BUILD_METRICS.map(metric => {
      const av = a.totals[metric], bv = b.totals[metric];
      const format = (value: number | null) => value === null ? '—' : Number(value.toFixed(2)).toLocaleString();
      return <tr key={metric}><th scope="row">{metric}</th><td>{format(av)}</td><td>{format(bv)}</td><td>{av == null || bv == null ? '—' : `${bv - av > 0 ? '+' : ''}${format(bv - av)}`}</td></tr>;
    })}</tbody></table></div>
  </Card>;
}
