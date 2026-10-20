import type { ReactNode } from 'react';
import styles from './Field.module.scss';

export interface FieldProps {
  label: string;
  htmlFor: string;
  children: ReactNode;
}

/** Label and layout wrapper; the child control must use the supplied htmlFor as its id. */
export function Field({ label, htmlFor, children }: FieldProps) {
  return <div className={styles.field}><label htmlFor={htmlFor}>{label}</label>{children}</div>;
}
