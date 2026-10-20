import type { Catalog, InventoryItem } from '../../types';
import { InventoryItemSlot } from './InventoryItemSlot';
import styles from './BagGrid.module.scss';

export interface BagGridProps {
  inventory: InventoryItem[];
  catalog?: Catalog;
  totalSlots?: number;
}

export function BagGrid({ inventory, catalog, totalSlots = 42 }: BagGridProps) {
  const itemMap = new Map<number, InventoryItem>();
  for (const item of inventory) {
    itemMap.set(item.slot, item);
  }

  const slots = Array.from({ length: totalSlots }, (_, i) => i);
  const occupiedCount = inventory.length;
  const freeCount = Math.max(0, totalSlots - occupiedCount);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h4 className={styles.title}>Inventory Bag</h4>
        <span className={styles.stats}>
          {occupiedCount} / {totalSlots} occupied ({freeCount} free)
        </span>
      </div>
      <div className={styles.grid}>
        {slots.map(slotIndex => {
          const item = itemMap.get(slotIndex);
          return (
            <InventoryItemSlot
              key={slotIndex}
              item={item}
              slotIndex={slotIndex}
              catalog={catalog}
              size={44}
            />
          );
        })}
      </div>
    </div>
  );
}
