/**
 * @file DashboardGrid.tsx
 * Responsive panel grid for the main dashboard view.
 *
 * Handles only layout — it knows nothing about what's inside each panel.
 * Uses CSS grid with auto-fill columns so panels reflow naturally from 3
 * columns on wide screens down to 1 on mobile, without any media query
 * breakpoints in JS.
 *
 * To rearrange panels, edit the grid-template-areas in the SCSS module.
 */

import styles from './DashboardGrid.module.scss';

export interface DashboardGridProps {
  /** Panel content nodes, rendered in source order inside the grid. */
  children: React.ReactNode;
}

/**
 * DashboardGrid
 *
 * Simple responsive grid wrapper. Children are placed into cells
 * by the browser's auto-placement algorithm (left to right, top to bottom).
 * Override with `grid-column`/`grid-row` CSS on individual children
 * to pin specific panels to specific positions.
 */
export function DashboardGrid({ children }: DashboardGridProps) {
  return <div className={styles.grid}>{children}</div>;
}
