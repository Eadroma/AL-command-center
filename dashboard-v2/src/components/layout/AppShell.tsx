/**
 * @file AppShell.tsx
 * Top-level page wrapper that provides the overall layout structure.
 *
 * AppShell is responsible for:
 *   - Constraining content width and centring it on wide screens.
 *   - Providing the main scrollable content area.
 *   - Rendering the global page header (PageHeader) at the top.
 *
 * It does NOT own any application state — it is purely structural.
 * Feature panels are composed inside it via `children`.
 */

import styles from './AppShell.module.scss';

export interface AppShellProps {
  /** The header node rendered above the content area (typically a PageHeader). */
  header: React.ReactNode;
  /** Main page content — feature panels, grids, etc. */
  children: React.ReactNode;
}

/**
 * AppShell
 *
 * Wraps the entire application in a centred, max-width constrained column.
 * Renders `header` pinned above a scrollable `children` region.
 */
export function AppShell({ header, children }: AppShellProps) {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>{header}</header>
      <main className={styles.main}>{children}</main>
      <footer className={styles.footer}>Independent tools for <a href="https://adventure.land" target="_blank" rel="noreferrer">Adventure Land</a>. Game assets belong to their respective authors.</footer>
    </div>
  );
}
