import './Button.css';

import type { ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';

interface IconLinkProps extends Omit<LinkProps, 'children' | 'aria-label'> {
  /** Accessible name; the icon itself is decorative. */
  label: string;
  icon: ReactNode;
}

/** A square icon-only navigation link sized and styled like the shared icon button. */
export function IconLink({ label, icon, className, ...rest }: IconLinkProps) {
  return (
    <Link
      {...rest}
      className={['icon-button', className].filter(Boolean).join(' ')}
      aria-label={label}
    >
      {icon}
    </Link>
  );
}
