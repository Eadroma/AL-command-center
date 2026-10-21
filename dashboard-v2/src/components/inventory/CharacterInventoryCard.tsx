import type { Catalog, PartyMember } from '../../types';
import { Badge, Sprite } from '../ui';
import { EquipmentGrid } from './EquipmentGrid';
import { BagGrid } from './BagGrid';
import { StandGrid } from './StandGrid';
import styles from './CharacterInventoryCard.module.scss';

export interface CharacterInventoryCardProps {
  member: PartyMember;
  catalog?: Catalog;
}

export function CharacterInventoryCard({ member, catalog }: CharacterInventoryCardProps) {
  const { name, class: cls, skin, status, gold, level, map, inventory, equipment, stand } = member;
  const exactSkin = skin ? `skin:${skin}` : '';
  const spriteId = exactSkin && catalog?.assets[exactSkin] ? exactSkin : cls;

  const isLive = status !== 'offline' && status !== 'disabled';

  return (
    <article className={styles.card} aria-label={`${name} inventory`}>
      <header className={styles.header}>
        <div className={styles.identity}>
          <div className={styles.portrait}>
            <Sprite id={spriteId} catalog={catalog} label={`${name} sprite`} size={40} />
          </div>
          <div className={styles.nameGroup}>
            <span className={styles.name}>{name}</span>
            <span className={styles.subtitle}>
              <span>{cls.charAt(0).toUpperCase() + cls.slice(1)}</span>
              {level !== null && <span>Level {level}</span>}
              {map && <span>· {map}</span>}
            </span>
          </div>
        </div>

        <div className={styles.statsBar}>
          {gold !== null && (
            <div className={styles.goldBadge} title="Gold held by character">
              <span>🪙</span>
              <span>{gold.toLocaleString()}</span>
            </div>
          )}
          <Badge variant={status === 'online' || status === 'farming' || status === 'support' ? 'success' : status === 'dead' ? 'danger' : 'neutral'}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
        </div>
      </header>

      {!isLive && inventory.length === 0 && equipment.length === 0 ? (
        <p style={{ color: 'var(--text-muted, #71717a)', fontSize: '13px', margin: '8px 0' }}>
          No live inventory telemetry for {name}. Ensure the character is deployed and running CODE.
        </p>
      ) : (
        <div className={styles.content}>
          <div className={styles.sections}>
            <BagGrid inventory={inventory} catalog={catalog} />
            <EquipmentGrid equipment={equipment} catalog={catalog} />
          </div>

          {stand && stand.length > 0 && (
            <StandGrid stand={stand} catalog={catalog} />
          )}
        </div>
      )}
    </article>
  );
}
