import { groupForPage, NAV_GROUPS } from '../../models/navigation';
import type { PageId } from '../../models/navigation';
import styles from './NavBar.module.scss';
import { Users, Sprout, Store, SlidersHorizontal } from 'lucide-react';
const icons = { team: Users, farm: Sprout, trade: Store, system: SlidersHorizontal };

export interface NavBarProps { page: PageId; dirty: boolean; }

/** Hash links support keyboard navigation, deep links and browser back/forward. */
export function NavBar({ page, dirty }: NavBarProps) {
  const activeGroup = groupForPage(page);
  return (
    <nav className={styles.nav} aria-label="Dashboard pages">
      <div className={styles.primary} aria-label="Main sections">
        {NAV_GROUPS.map(group => { const Icon = icons[group.id]; return <a key={group.id} href={`#${group.pages[0].id}`} aria-current={group.id === activeGroup.id ? 'true' : undefined}><Icon size={17} aria-hidden="true" />{group.label}</a>; })}
      </div>
      <div className={styles.secondary} aria-label={`${activeGroup.label} pages`}>
        {activeGroup.pages.map(item => <a key={item.id} href={`#${item.id}`} aria-current={page === item.id ? 'page' : undefined}>
          {item.label}{item.id === page && dirty ? ' · Unsaved' : ''}
        </a>)}
      </div>
    </nav>
  );
}
