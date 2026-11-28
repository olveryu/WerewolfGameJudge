import './Switch.css';

import type { InputHTMLAttributes } from 'react';

/**
 * Native checkbox styled as a switch (`role="switch"`). `tone="warning"` paints the on state in
 * the warning color for risky options.
 */
export function Switch({
  tone = 'primary',
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'role' | 'className' | 'style'> & {
  tone?: 'primary' | 'warning';
}) {
  return <input {...rest} type="checkbox" role="switch" className="switch" data-tone={tone} />;
}
