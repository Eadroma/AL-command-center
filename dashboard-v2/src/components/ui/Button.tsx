import React from 'react';
import styles from './Button.module.scss';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'small' | 'medium' | 'large';
}

export function Button({
  children,
  variant = 'secondary',
  size = 'medium',
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const buttonClasses = [styles.button, styles[variant], styles[size], className].filter(Boolean).join(' ');
  return (
    <button
      className={buttonClasses}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}