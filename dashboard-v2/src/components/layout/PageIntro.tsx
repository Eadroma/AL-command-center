import type { ReactNode } from 'react';
import styles from './PageIntro.module.scss';
export function PageIntro({title,eyebrow,description,children}: {title:string;eyebrow:string;description:string;children?:ReactNode}) {
  return <header className={styles.intro}><div><span>{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{children && <div className={styles.actions}>{children}</div>}</header>;
}
