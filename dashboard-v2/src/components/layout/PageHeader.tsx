import type { ReactNode } from 'react';
import { Compass, RefreshCw } from 'lucide-react';
import { UsageStats } from './UsageStats';
import { ThemeSelector } from './ThemeSelector';
import styles from './PageHeader.module.scss';
export interface PageHeaderProps { connected: boolean; onRefresh?: () => void; search?: ReactNode; nav?: ReactNode; }
export function PageHeader({ connected, onRefresh, search, nav }: PageHeaderProps) {
  return <div className={styles.header}>
    <a href="#team" className={styles.brand} aria-label="Command Center — Team"><span className={styles.mark}><Compass size={20}/></span><div><strong>Command Center</strong><small>Adventure Land</small></div></a>
    {nav && <div className={styles.nav}>{nav}</div>}
    <div className={styles.actions}>{search}<UsageStats/><ThemeSelector/><span className={styles.connection} title={connected ? 'Connected to the local server' : 'Connecting to the local server'}><i data-connected={connected}/><span>{connected ? 'Connected' : 'Connecting'}</span></span><button type="button" className={styles.refresh} onClick={onRefresh} data-usage="action.refresh" aria-label="Refresh dashboard" title="Refresh dashboard"><RefreshCw size={16}/></button></div>
  </div>;
}
