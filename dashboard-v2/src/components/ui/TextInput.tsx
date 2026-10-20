import type { InputHTMLAttributes } from 'react';
import styles from './Input.module.scss';

export interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string;
  onChange: (value: string) => void;
}

/** Controlled string input; native accessibility and input attributes are forwarded. */
export function TextInput({ value, onChange, className = '', ...attributes }: TextInputProps) {
  return <input {...attributes} className={`${styles.input} ${className}`} value={value} onChange={event => onChange(event.target.value)} />;
}
