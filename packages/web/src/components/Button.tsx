import './Button.css';

import type { ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Shows the busy state and blocks presses. */
  loading?: boolean;
}

/** The app's text button; native `<button>` with token-based variants. */
export function Button({
  variant = 'primary',
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
      disabled={disabled === true || loading}
      aria-busy={loading}
    >
      {children}
    </button>
  );
}
