import React from 'react';
import styles from './Badge.module.scss';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  pulse?: boolean;
}

export function Badge({ children, variant = 'neutral', pulse = false }: BadgeProps) {
  const badgeClasses = [styles.badge, styles[variant]].filter(Boolean).join(' ');
  return (
    <span className={badgeClasses}>
      {pulse && <span className={styles.dot} />}
      {children}
    </span>
  );
}