/**
 * @file Card.tsx
 * Generic surface container used throughout the dashboard.
 *
 * A Card wraps any content in a styled panel. The optional `title` prop
 * renders a header bar, and `headerActions` lets callers slot in badges,
 * buttons, or any node alongside that title without coupling layout to content.
 *
 * Variants:
 *   - `default`  — Standard bordered surface.
 *   - `active`   — Accent border + subtle glow (e.g. "currently farming").
 *   - `alert`    — Red border + glow (e.g. RIP / error state).
 */

import React from 'react';
import styles from './Card.module.scss';

export interface CardProps {
  children: React.ReactNode;
  /** Displayed in the card header bar. */
  title?: string;
  /** Nodes rendered to the right of the title (badges, icon buttons…). */
  headerActions?: React.ReactNode;
  /** Visual emphasis variant. Defaults to `'default'`. */
  variant?: 'default' | 'active' | 'alert';
  /** Extra classes forwarded to the root element. */
  className?: string;
}

/**
 * Card
 *
 * Base surface primitive. All feature panels are built on top of this.
 */
export function Card({
  children,
  title,
  headerActions,
  variant = 'default',
  className = '',
}: CardProps) {
  const rootClass = [styles.card, styles[variant], className].filter(Boolean).join(' ');
  const hasHeader = title || headerActions;

  return (
    <div className={rootClass}>
      {hasHeader && (
        <div className={styles.header}>
          {title && <h3 className={styles.title}>{title}</h3>}
          {headerActions && <div className={styles.actions}>{headerActions}</div>}
        </div>
      )}
      <div className={styles.content}>{children}</div>
    </div>
  );
}