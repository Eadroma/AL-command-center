import styles from './EmptyState.module.scss';

export interface EmptyStateProps { title: string; description?: string; }

/** Visible placeholder for empty results or unavailable data. */
export function EmptyState({ title, description }: EmptyStateProps) {
  return <div className={styles.empty} role="status"><p>{title}</p>{description && <p>{description}</p>}</div>;
}
