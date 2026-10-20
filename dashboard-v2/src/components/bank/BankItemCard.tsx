import type { BankItem, Catalog } from '../../types';
import { Badge, Sprite } from '../ui';
import styles from './BankItemCard.module.scss';

export interface BankItemCardProps {
  item: BankItem;
  catalog: Catalog;
}

/** One occupied bank slot with its catalog name and exact storage location. */
export function BankItemCard({ item, catalog }: BankItemCardProps) {
  const displayName = catalog.items.find(entry => entry.id === item.name)?.name ?? item.name;
  return (
    <article className={styles.card} title={`${item.pack} · slot ${item.slot}`}>
      <Sprite id={`item:${item.name}`} catalog={catalog} label={displayName} size={42} />
      <div className={styles.identity}>
        <strong>{displayName}{item.level > 0 ? ` +${item.level}` : ''}</strong>
        <small>{item.name} · {item.pack} / {item.slot}</small>
      </div>
      <Badge>×{item.quantity.toLocaleString()}</Badge>
    </article>
  );
}
