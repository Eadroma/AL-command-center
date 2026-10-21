import { useEffect, useRef, useState, type ReactNode } from 'react';
import { TaskDialog } from './TaskDialog';
import { Button } from '../ui';
import styles from './TaskWorkspace.module.scss';
interface Section { id: string; label: string; description: string; content: ReactNode; }
/** The current work stays visible; configuration opens only when requested. */
export function TaskWorkspace({ sections, footer }: { sections: Section[]; footer?: ReactNode }) {
  const [selected, setSelected] = useState<string>();
  const pendingRule = useRef<string | undefined>(undefined);
  const active = sections.find(row => row.id === selected);
  useEffect(() => {
    const reveal = (event: Event) => {
      const rule = (event as CustomEvent<string>).detail;
      const id = ['merchant-margin','merchant-planner'].includes(rule) ? 'tools' : 'settings';
      if (selected === id) return;
      pendingRule.current = rule; setSelected(id);
    };
    window.addEventListener('alcc:open-rule', reveal);
    return () => window.removeEventListener('alcc:open-rule', reveal);
  }, [selected]);
  useEffect(() => {
    if (!selected || !pendingRule.current) return;
    const frame = requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent('alcc:open-rule', { detail: pendingRule.current }));
      pendingRule.current = undefined;
    });
    return () => cancelAnimationFrame(frame);
  }, [selected]);
  return <>
    <div className={styles.tools}>{sections.slice(1).map(row => <Button key={row.id} variant="secondary" onClick={() => setSelected(row.id)}>{row.label === 'Settings' ? 'Configure merchant' : row.label}</Button>)}</div>
    {sections[0]?.content}
    <TaskDialog title={active?.label === 'Settings' ? 'Merchant settings' : active?.label ?? 'Merchant tools'} open={!!active} onClose={() => setSelected(undefined)}>
      {active?.content}{footer && <div className={styles.footer}>{footer}</div>}
    </TaskDialog>
  </>;
}
