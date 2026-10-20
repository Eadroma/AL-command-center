import React from 'react';
import styles from './SectionHead.module.scss';

export interface SectionHeadProps {
  eyebrow?: string;
  title: string;
  children?: React.ReactNode;
}

export function SectionHead({ eyebrow, title, children }: SectionHeadProps) {
  return (
    <div className={styles.sectionHead}>
      <div className={styles.titleGroup}>
        {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
        <h2 className={styles.title}>{title}</h2>
      </div>
      {children && <div className={styles.actions}>{children}</div>}
    </div>
  );
}