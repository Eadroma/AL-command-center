import type { SelectHTMLAttributes } from 'react';
import styles from './Input.module.scss';

export interface SelectInputProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'> {
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
}

/** Native select with shared input styling and a string-only change callback. */
export function SelectInput({ value, onChange, options, className = '', ...attributes }: SelectInputProps) {
  return (
    <select {...attributes} className={`${styles.input} ${className}`} value={value} onChange={event => onChange(event.target.value)}>
      {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  );
}
