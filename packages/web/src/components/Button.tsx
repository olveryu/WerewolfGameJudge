import './Button.css';

import type { ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  /** Shows the busy state and blocks presses. */
  loading?: boolean;
}

/** The app's text button; native `<button>` with token-based variants. */
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      className={['button', className].filter(Boolean).join(' ')}
      data-variant={variant}
      data-size={size}
      disabled={disabled === true || loading}
      aria-busy={loading}
    >
      {children}
    </button>
  );
}
