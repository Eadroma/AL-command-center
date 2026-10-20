import type { Catalog, InventoryItem, EquipmentItem, StandItem } from '../../types';
import { Sprite } from '../ui';
import { Tooltip } from '../ui/Tooltip';
import styles from './InventoryItemSlot.module.scss';

export interface InventoryItemSlotProps {
  item?: InventoryItem | EquipmentItem | StandItem | null;
  slotIndex?: number | string;
  catalog?: Catalog;
  slotLabel?: string;
  size?: number;
  variant?: 'default' | 'equipment';
}

export function InventoryItemSlot({ item, slotIndex, catalog, slotLabel, size = 48, variant = 'default' }: InventoryItemSlotProps) {
  const isEquipment = variant === 'equipment';

  if (!item || !item.name) {
    const emptyLabel = slotLabel ? `${slotLabel} (empty)` : typeof slotIndex === 'number' ? `Slot ${slotIndex} (empty)` : 'Empty slot';
    return (
      <Tooltip content={emptyLabel}>
        <div
          className={`${styles.slot} ${styles.empty} ${isEquipment ? styles.equipment : ''}`}
          style={{ width: size, height: size }}
          aria-label={emptyLabel}
        >
          {slotIndex !== undefined && <span className={styles.slotIndex}>{slotIndex}</span>}
        </div>
      </Tooltip>
    );
  }

  const displayName = catalog?.items.find(entry => entry.id === item.name)?.name ?? item.name;
  const level = item.level ?? 0;
  const quantity = item.quantity ?? 1;
  const isLocked = 'locked' in item && !!item.locked;
  const isBound = 'bound' in item && !!item.bound;
  const isShiny = 'shiny' in item && !!item.shiny;
  const price = 'price' in item ? item.price : undefined;
  const isBuyOrder = 'buy' in item && !!item.buy;

  const titleParts = [
    displayName + (level > 0 ? ` +${level}` : ''),
    `id: ${item.name}`,
    slotLabel ? `Slot: ${slotLabel}` : slotIndex !== undefined ? `Slot ${slotIndex}` : undefined,
    quantity > 1 ? `Qty: ${quantity.toLocaleString()}` : undefined,
    price !== undefined ? (isBuyOrder ? `Buying for: ${price.toLocaleString()} gold` : `Selling for: ${price.toLocaleString()} gold`) : undefined,
    isLocked ? '🔒 Locked' : undefined,
    isBound ? '🔗 Bound' : undefined,
    isShiny ? '✦ Shiny' : undefined,
  ].filter(Boolean).join(' · ');

  const slotClasses = [
    styles.slot,
    isEquipment && styles.equipment,
    isLocked && styles.locked,
    isBound && styles.bound,
    isShiny && styles.shiny,
  ].filter(Boolean).join(' ');

  return (
    <Tooltip content={titleParts}>
      <div className={slotClasses} style={{ width: size, height: size }} aria-label={titleParts}>
        {slotIndex !== undefined && <span className={styles.slotIndex}>{slotIndex}</span>}
        <Sprite id={`item:${item.name}`} catalog={catalog} label={displayName} size={Math.round(size * 0.75)} />
        {level > 0 && <span className={styles.levelBadge}>+{level}</span>}
        {quantity > 1 && <span className={styles.quantityBadge}>×{quantity > 9999 ? `${Math.round(quantity / 1000)}k` : quantity}</span>}
        <div className={styles.statusIcons}>
          {isShiny && <span className={styles.shinyStar} title="Shiny item">✦</span>}
          {isLocked && <span className={styles.lockedIcon} title="Locked item">🔒</span>}
          {isBound && <span className={styles.boundIcon} title="Bound item">🔗</span>}
        </div>
      </div>
    </Tooltip>
  );
}
