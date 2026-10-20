import { useState } from 'react';
import type { Catalog, DeploymentsResponse, Profile } from '../../types';
import { loadoutOptions } from '../../../shared/schema';
import { sharedEquipment } from '../../models/shared-equipment';
import { bankSnapshots } from '../../models/bank';
import { Badge, Card, Field, SelectInput, Sprite } from '../ui';
import styles from '../farming/Preparation.module.scss';
import { farmingTeam } from '../../models/farming-team';
export function SharedEquipmentPlanner({ profile, deployments, catalog }: { profile?: Profile; deployments?: DeploymentsResponse; catalog?: Catalog }) {
  const [stylesByCharacter, setStyles] = useState<Record<string, string>>({});
  if (!profile) return null;
  const rows = sharedEquipment(profile, deployments, stylesByCharacter);
  const bank = bankSnapshots(deployments)[0];
  return <Card title="Shared equipment plan">
    <p>Select one simultaneous build per farmer. Each equipment/bag/bank position is assigned once. Unspecified equipped slots stay reserved; another character's equipped gear and locked/bound bag gear are not offered for transfer.</p>
    <div className={styles.controls}>{farmingTeam(profile).map(character => <Field key={character.name} label={`${character.name} build`} htmlFor={`shared-build-${character.name}`}><SelectInput id={`shared-build-${character.name}`} value={stylesByCharacter[character.name] ?? profile.automation.activeBuilds[character.name]?.style ?? profile.farming.style[character.farmMonster || profile.farming.defaultMonster] ?? 'aoe'} options={loadoutOptions(profile)} onChange={style => setStyles({ ...stylesByCharacter, [character.name]: style })} /></Field>)}</div>
    <p>Bank evidence: {bank?.capturedAt ? new Date(bank.capturedAt).toLocaleString() : 'No timestamped snapshot'}. Bank copies require on-site confirmation; location data does not include all item modifiers.</p>
    <div className={styles.rows}>{rows.map(row => <article key={`${row.character}:${row.slot}`}><div className={styles.head}><Sprite id={`item:${row.item}`} catalog={catalog} label={row.item} size={28} /><strong>{row.character} · {row.slot}</strong><Badge variant={row.state === 'owned' ? 'success' : 'warning'}>{row.state}</Badge></div><p>{row.item} +{row.minLevel} · {row.style}</p><p>{row.source ?? (row.state === 'unknown' ? 'Incomplete ownership evidence.' : 'No unallocated eligible copy in reported sources.')}</p>{row.state === 'bank' || row.state === 'transfer' ? <p>Prepare handoff → {row.character}. Verify availability and capacity before moving this copy.</p> : null}</article>)}</div>
    {!rows.length ? <p>No explicit gear requirements for the selected builds.</p> : null}
    <p>This is a planning view: it does not equip, withdraw or send items. Changing these selectors does not change the saved loadouts.</p>
  </Card>;
}
