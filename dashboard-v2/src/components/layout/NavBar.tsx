import { NAV_GROUPS, type PageId } from '../../models/navigation';
import { Users, Store, Landmark } from 'lucide-react';
import styles from './NavBar.module.scss';
const icons = { team: Users, merchant: Store, bank: Landmark };
export interface NavBarProps { page: PageId; dirty: boolean; }
export function NavBar({ page, dirty }: NavBarProps) {
  return <nav className={styles.nav} aria-label="Dashboard pages">
    <div className={styles.primary}>{NAV_GROUPS.map(item => {
      const Icon = icons[item.id];
      return <a key={item.id} href={`#${item.id}`} aria-current={page === item.id ? 'page' : undefined}><Icon size={17} aria-hidden="true" />{item.label}</a>;
    })}</div>
    {dirty && <span className={styles.draft} role="status" title="Unsaved changes"><span>Unsaved changes</span></span>}
  </nav>;
}
