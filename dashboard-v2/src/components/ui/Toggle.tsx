import * as SwitchPrimitive from '@radix-ui/react-switch';
import styles from './Toggle.module.scss';
import { useSwitchSpring } from '../../hooks/useSwitchSpring';

export interface ToggleProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  /** Keep the accessible name, displaying the label only as a hover tooltip. */
  hideLabel?: boolean;
}

export function Toggle({ label, value, onChange, disabled = false, hideLabel = false }: ToggleProps) {
  const thumb = useSwitchSpring(value);
  const labelClasses = [styles.label, value ? styles.active : ''].filter(Boolean).join(' ');
  return (
    <div className={styles.wrapper}>
      <SwitchPrimitive.Root
        className={styles.root}
        checked={value}
        onCheckedChange={onChange}
        disabled={disabled}
        aria-label={label}
        title={hideLabel ? label : undefined}
      >
        <SwitchPrimitive.Thumb ref={thumb} className={styles.thumb} />
      </SwitchPrimitive.Root>
      {!hideLabel && <span className={labelClasses}>{label}</span>}
    </div>
  );
}
