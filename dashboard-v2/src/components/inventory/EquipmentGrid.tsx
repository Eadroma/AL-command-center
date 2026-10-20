import type { Catalog, EquipmentItem } from '../../types';
import { EQUIPMENT_SLOTS } from '../../models/inventory';
import { InventoryItemSlot } from './InventoryItemSlot';
import styles from './EquipmentGrid.module.scss';

export interface EquipmentGridProps {
  equipment: EquipmentItem[];
  catalog?: Catalog;
}

export function EquipmentGrid({ equipment, catalog }: EquipmentGridProps) {
  const equipMap = new Map<string, EquipmentItem>();
  for (const item of equipment) {
    equipMap.set(item.slot, item);
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h4 className={styles.title}>Equipment</h4>
        <span className={styles.count}>{equipment.length} / {EQUIPMENT_SLOTS.length}</span>
      </div>
      <div className={styles.frame}>
        <div className={styles.grid} aria-label="Equipped items">
          {EQUIPMENT_SLOTS.map(({ id, label }) => {
            const item = equipMap.get(id);

            return (
              <InventoryItemSlot
                key={id}
                item={item}
                slotLabel={label}
                catalog={catalog}
                size={50}
                variant="equipment"
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
