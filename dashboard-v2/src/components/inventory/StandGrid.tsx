import type { Catalog, StandItem } from '../../types';
import { InventoryItemSlot } from './InventoryItemSlot';
import styles from './StandGrid.module.scss';

export interface StandGridProps {
  stand: StandItem[];
  catalog?: Catalog;
}

export function StandGrid({ stand, catalog }: StandGridProps) {
  if (!stand || stand.length === 0) return null;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h4 className={styles.title}>Stand Listings ({stand.length} slots)</h4>
      </div>
      <div className={styles.grid}>
        {stand.map(item => {
          const displayName = catalog?.items.find(entry => entry.id === item.name)?.name ?? item.name;
          return (
            <div key={item.slot} className={`${styles.standSlot} ${item.buy ? styles.buySlot : ''}`}>
              <InventoryItemSlot item={item} slotIndex={item.slot} catalog={catalog} size={44} />
              <div className={styles.meta}>
                <span className={styles.itemName}>{displayName}{item.level > 0 ? ` +${item.level}` : ''}</span>
                <span className={styles.price}>💰 {item.price.toLocaleString()} gold</span>
                <span className={`${styles.badge} ${item.buy ? styles.buy : styles.sell}`}>
                  {item.buy ? 'Buy Wishlist' : 'For Sale'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
