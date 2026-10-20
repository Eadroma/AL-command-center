import type { InputHTMLAttributes } from 'react';
import styles from './Input.module.scss';

export interface NumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  value: number | null;
  onChange: (value: number | null) => void;
}

/** Numeric field that preserves an empty editing state and rejects non-finite values. */
export function NumberInput({ value, onChange, ...props }: NumberInputProps) {
  return (
    <input
      {...props}
      className={[styles.input, props.className].filter(Boolean).join(' ')}
      type="number"
      value={value ?? ''}
      onChange={event => {
        if (event.currentTarget.value === '') return onChange(null);
        const next = event.currentTarget.valueAsNumber;
        onChange(Number.isFinite(next) ? next : null);
      }}
    />
  );
}
