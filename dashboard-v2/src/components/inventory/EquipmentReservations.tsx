import type { Catalog, DeploymentsResponse, Profile } from '../../types';
import { loadoutCompliance } from '../../models/loadout-compliance';
import { bankSnapshots } from '../../models/bank';
import { Badge, Card, Sprite } from '../ui';
import styles from './EquipmentReservations.module.scss';

export function EquipmentReservations({ profile, deployments, catalog }: { profile?: Profile; deployments?: DeploymentsResponse; catalog?: Catalog }) {
  if (!profile) return null;
  const rows = loadoutCompliance(profile, deployments);
  const bank = bankSnapshots(deployments)[0];
  return <Card title="Equipment reservations" headerActions={<Badge>{rows.length} build requirements</Badge>}>
    <p>Explicit loadout overrides stay protected on their owner. Styles may share the same piece. Bank matches come from the latest snapshot and need retrieval.</p>
    {!rows.length && <p>No explicit equipment overrides configured.</p>}
    {[...new Set(rows.map(row => row.character))].map(character => <details key={character} className={styles.group}>
      <summary>{character} · {rows.filter(row => row.character === character).length} requirements</summary>
      <div className={styles.rows}>{rows.filter(row => row.character === character).map(row => {
      const bankMatch = bank?.items.find(item => item.name === row.item && item.level >= row.minLevel);
      const elsewhere = Object.entries(deployments?.characters ?? {}).find(([name, deployment]) => name !== row.character && deployment.telemetry?.live && [...(deployment.telemetry.inventory ?? []), ...(deployment.telemetry.equipment ?? [])].some(item => item.name === row.item && item.level >= row.minLevel));
      const detail = ['missing', 'low-level'].includes(row.status) ? bankMatch ? `Bank · ${bankMatch.pack} / ${bankMatch.slot}` : elsewhere ? `Held by ${elsewhere[0]}` : row.detail : row.detail;
      return <div className={styles.row} key={`${row.character}:${row.style}:${row.slot}`}>
        <Sprite id={`item:${row.item}`} catalog={catalog} label={row.item} size={28} />
        <span>{row.style} · {row.slot}<br />{row.item} +{row.minLevel}</span>
        <Badge variant={['equipped', 'available', 'wrong-slot'].includes(row.status) ? 'success' : 'warning'}>{detail}</Badge>
      </div>;
    })}</div></details>)}
  </Card>;
}
