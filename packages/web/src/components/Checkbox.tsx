import './Checkbox.css';

import type { InputHTMLAttributes, Ref } from 'react';

/**
 * The app's check box: native checkbox drawn as a rounded square with a check mark (and a dash
 * when the input is `indeterminate`). Styled only by its own sheet; callers place it.
 */
export function Checkbox(
  props: Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'className' | 'style'> & {
    ref?: Ref<HTMLInputElement>;
  },
) {
  return <input {...props} type="checkbox" className="checkbox" />;
}
