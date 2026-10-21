import { useEffect, useId, useRef, type ReactNode } from 'react';
import { DIALOG_USAGE } from '../../models/usage';
import { recordUsage } from '../../models/usage-store';
import { X } from 'lucide-react';
import styles from './TaskDialog.module.scss';
/** Native focus trap; children mount only while the task is open. */
export function TaskDialog({ title, open, onClose, children }: { title: string; open: boolean; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const last = useRef<string | undefined>(undefined);
  const usage = DIALOG_USAGE[title];
  useEffect(() => { if (!open) { last.current=undefined; return; } if(usage && last.current!==usage) {last.current=usage;recordUsage(usage);} }, [open,usage]);
  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    dialog.showModal();
    return () => { dialog.close(); if (previous?.isConnected) previous.focus(); };
  }, [open]);
  return <dialog ref={ref} className={styles.dialog} data-usage-scope={usage} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose(); }}>
    <header className={styles.header}><h2 id={titleId}>{title}</h2><button type="button" onClick={onClose} aria-label={`Close ${title}`}><X size={22} /></button></header>
    {open && <div className={styles.body}>{children}</div>}
  </dialog>;
}
