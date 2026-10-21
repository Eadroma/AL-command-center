import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { recordUsage } from '../../models/usage-store';
import styles from './WorkspaceSections.module.scss';

interface WorkspaceSection {
  id: string;
  label: string;
  description: string;
  content: ReactNode;
}

/** Local task navigation. Hidden panels stay mounted to preserve editor drafts. */
export function WorkspaceSections({ label, sections }: { label: string; sections: WorkspaceSection[] }) {
  const prefix = useId();
  const recorded = useRef<string | undefined>(undefined);
  const [selected, setSelected] = useState(sections[0]?.id);
  const active = sections.find(section => section.id === selected) ?? sections[0];
  useEffect(() => {
    if(label==='Merchant settings' && active && recorded.current!==active.id) {recorded.current=active.id;recordUsage(`merchant.${active.id}`);}
  }, [label,active]);
  useEffect(() => {
    const reveal = (event: Event) => {
      const target = document.getElementById(`${(event as CustomEvent<string>).detail}-title`);
      const section = sections.find(row => document.getElementById(`${prefix}-${row.id}`)?.contains(target));
      if (section) setSelected(section.id);
    };
    window.addEventListener('alcc:open-rule', reveal);
    return () => window.removeEventListener('alcc:open-rule', reveal);
  }, [prefix, sections]);
  return <div className={styles.workspace}>
    <nav className={styles.navigation} aria-label={label}>
      {sections.map(section => <button key={section.id} type="button"
        id={`${prefix}-${section.id}-button`} aria-pressed={active?.id === section.id}
        aria-controls={`${prefix}-${section.id}`} onClick={() => setSelected(section.id)}>
        {section.label}
      </button>)}
    </nav>
    {sections.map(section => <section key={section.id} id={`${prefix}-${section.id}`}
      data-usage-scope={label==='Merchant settings' ? `merchant.${section.id}` : undefined} hidden={active?.id !== section.id} aria-labelledby={`${prefix}-${section.id}-button`}>
      <p className={styles.description}>{section.description}</p>
      {section.content}
    </section>)}
  </div>;
}
