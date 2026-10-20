import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styles from './Tooltip.module.scss';

export interface TooltipProps {
  children: ReactNode;
  content: ReactNode;
}

/** Keyboard-accessible contextual help shown on hover or focus. */
export function Tooltip({ children, content }: TooltipProps) {
  const id = useId();
  const root = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0, below: false });

  const place = useCallback(() => {
    const anchor = root.current;
    if (!anchor) return;
    const bounds = anchor.getBoundingClientRect();
    const tooltipWidth = Math.min(280, window.innerWidth * 0.8);
    const half = tooltipWidth / 2;
    setPosition({
      left: Math.min(window.innerWidth - half - 8, Math.max(half + 8, bounds.left + bounds.width / 2)),
      top: bounds.top >= 90 ? bounds.top - 8 : bounds.bottom + 8,
      below: bounds.top < 90,
    });
  }, []);

  const show = () => { place(); setOpen(true); };
  useEffect(() => {
    if (!open) return;
    const update = () => place();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, place]);

  return (
    <span ref={root} className={styles.root} tabIndex={0} aria-describedby={open ? id : undefined} onMouseEnter={show} onMouseLeave={() => setOpen(false)} onFocus={show} onBlur={() => setOpen(false)}>
      {children}
      {open && createPortal(
        <span id={id} role="tooltip" className={`${styles.content} ${position.below ? styles.below : ''}`} style={{ left: position.left, top: position.top }}>{content}</span>,
        document.body,
      )}
    </span>
  );
}
