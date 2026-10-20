import { ChevronDown } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import styles from './CollapsiblePanel.module.scss';

interface Props {
  id: string;
  eyebrow: string;
  title: string;
  actions?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}

/** Merchant section with a persistent per-browser expanded state. */
export function CollapsiblePanel({ id, eyebrow, title, actions, children, defaultOpen = false }: Props) {
  const storageKey = `alcc:merchant-panel:${id}`;
  const [open, setOpen] = useState(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored === null ? defaultOpen : stored === 'open';
    } catch { return defaultOpen; }
  });
  const toggle = () => setOpen(value => {
    const next = !value;
    try { localStorage.setItem(storageKey, next ? 'open' : 'closed'); } catch {}
    return next;
  });
  useEffect(() => {
    const reveal = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== id) return;
      setOpen(true);
      try { localStorage.setItem(storageKey, 'open'); } catch {}
    };
    window.addEventListener('alcc:open-rule', reveal);
    return () => window.removeEventListener('alcc:open-rule', reveal);
  }, [id, storageKey]);
  return (
    <section className={styles.panel} aria-labelledby={`${id}-title`}>
      <div className={styles.head}>
        <button type="button" className={styles.trigger} aria-expanded={open} aria-controls={`${id}-content`} onClick={toggle}>
          <ChevronDown size={18} className={open ? styles.chevronOpen : styles.chevron} />
          <span><small>{eyebrow}</small><strong id={`${id}-title`}>{title}</strong></span>
        </button>
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </div>
      {open ? <div id={`${id}-content`} className={styles.content}>{children}</div> : null}
    </section>
  );
}
