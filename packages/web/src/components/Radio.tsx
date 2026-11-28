import './Radio.css';

import type { InputHTMLAttributes, Ref } from 'react';

interface RadioProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'className' | 'style' | 'size'
> {
  ref?: Ref<HTMLInputElement>;
  /** `md`: beside body text (list rows). `sm`: beside caption text inside an option chip. */
  size?: 'sm' | 'md';
}

/**
 * The app's radio button: native radio drawn as a ring with a primary dot when chosen. Styled
 * only by its own sheet; callers place it, usually inside the option's `<label>`.
 */
export function Radio({ size = 'md', ...rest }: RadioProps) {
  return <input {...rest} type="radio" className="radio" data-size={size} />;
}
