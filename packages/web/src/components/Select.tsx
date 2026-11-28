import './TextField.css';

import type { Ref, SelectHTMLAttributes } from 'react';

interface SelectProps extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'className' | 'style' | 'multiple' | 'size' | 'aria-invalid'
> {
  ref?: Ref<HTMLSelectElement>;
  /** Marks the value as rejected: `aria-invalid` and the error border. */
  invalid?: boolean;
}

/**
 * The app's single choice drop-down: native `<select>` in the `TextField` skin, with the
 * customizable picker where the browser has it. Its look comes only from `invalid`.
 */
export function Select({ invalid = false, ...rest }: SelectProps) {
  return <select {...rest} className="text-field" aria-invalid={invalid || undefined} />;
}
