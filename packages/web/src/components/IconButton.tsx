import './Button.css';

import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children' | 'className' | 'style'
> {
  /** Accessible name; the icon itself is decorative. */
  label: string;
  icon: ReactNode;
  /** `sm` and `md` share the touch target; they differ in the icon size, `lg` a larger icon. */
  size?: 'sm' | 'md' | 'lg';
  /**
   * `surface`: the raised round key. `plain`: no border, fill or shadow, the icon in the
   * surrounding text color. `on-media`: over photos and drawings (overlay fill, inverse icon).
   */
  variant?: 'surface' | 'plain' | 'on-media';
  /** Marks a header action whose mode is on (a filter applied, music playing). */
  active?: boolean;
}

/** A square icon-only button sized to the minimum touch target; styled only by its props. */
export function IconButton({
  label,
  icon,
  size = 'md',
  variant = 'surface',
  active = false,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      className="icon-button"
      data-size={size}
      data-variant={variant}
      data-active={active || undefined}
      aria-label={label}
    >
      {icon}
    </button>
  );
}
