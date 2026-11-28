import './Button.css';

import type { ButtonHTMLAttributes, Ref } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'soft';

/** Paints a filled button in a faction's color (role cards, encyclopedia detail). */
export type ButtonTone = 'wolf' | 'god' | 'villager' | 'third' | 'neutral';

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'style'> {
  ref?: Ref<HTMLButtonElement>;
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  tone?: ButtonTone;
  /** Fills the width of its container. */
  fullWidth?: boolean;
  /** Shows the busy state and blocks presses. */
  loading?: boolean;
}

/**
 * The app's text button; native `<button>` with token-based variants. Its look comes only from
 * `variant`, `size`, `tone` and `fullWidth`: callers place it, the button styles itself.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  tone,
  fullWidth = false,
  loading = false,
  disabled,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      className="button"
      data-variant={variant}
      data-size={size}
      data-tone={tone}
      data-full-width={fullWidth || undefined}
      disabled={disabled === true || loading}
      aria-busy={loading}
    >
      {children}
    </button>
  );
}
