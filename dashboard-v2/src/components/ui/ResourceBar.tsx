import styles from './ResourceBar.module.scss';

export interface ResourceBarProps {
  value: number | null;
  max: number | null;
  variant: 'hp' | 'mp';
}

/** Accessible resource meter; an unknown reading is never shown as a full bar. */
export function ResourceBar({ value, max, variant }: ResourceBarProps) {
  if (value === null || max === null) return <span>{variant.toUpperCase()}: —</span>;
  const maximum = Math.max(1, max);
  const current = Math.max(0, Math.min(value, max));
  const percentage = Math.round((current / maximum) * 100);
  return (
    <div
      className={`${styles.bar} ${styles[variant]}`}
      role="meter"
      aria-label={variant.toUpperCase()}
      aria-valuemin={0}
      aria-valuemax={maximum}
      aria-valuenow={current}
      title={`${value} / ${max}`}
    >
      <div className={styles.fill} style={{ transform: `scaleX(${percentage / 100})` }} />
    </div>
  );
}
