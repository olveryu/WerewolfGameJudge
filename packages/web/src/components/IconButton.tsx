import './Button.css';

import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Accessible name; the icon itself is decorative. */
  label: string;
  icon: ReactNode;
}

/** A square icon-only button sized to the minimum touch target. */
export function IconButton({ label, icon, className, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      className={['icon-button', className].filter(Boolean).join(' ')}
      aria-label={label}
    >
      {icon}
    </button>
  );
}
