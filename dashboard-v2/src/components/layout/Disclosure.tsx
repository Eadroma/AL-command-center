import { useEffect, useRef, useState, type ReactNode } from 'react';
import { DISCLOSURE_USAGE } from '../../models/usage';
import { recordUsage } from '../../models/usage-store';
import styles from './Disclosure.module.scss';
/** Mount on demand, then retain local edits while the parent workspace is open. */
export function Disclosure({ title, description, children, reveal = false }: { title: string; description?: string; children: ReactNode; reveal?: boolean }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const usage=DISCLOSURE_USAGE[title];
  const [visited, setVisited] = useState(reveal);
  useEffect(() => { if (reveal && ref.current) { ref.current.open = true; setVisited(true); } }, [reveal]);
  return <details ref={ref} className={styles.disclosure} data-usage-scope={usage} onToggle={event => { if (event.currentTarget.open) {setVisited(true);if(usage)recordUsage(usage);} }}>
    <summary><span>{title}</span>{description && <small>{description}</small>}</summary>
    {visited && <div className={styles.content}>{children}</div>}
  </details>;
}
