import './TextField.css';

import type { Ref, TextareaHTMLAttributes } from 'react';

interface TextAreaProps extends Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  'className' | 'style' | 'aria-invalid'
> {
  ref?: Ref<HTMLTextAreaElement>;
  /** Marks the value as rejected: `aria-invalid` and the error border. */
  invalid?: boolean;
  /**
   * `rows`: as tall as `rows` lines, the user can drag it taller. `auto`: grows with its content
   * up to a few lines (chat, notes). `fill`: fills its container's height (a writing task).
   */
  height?: 'rows' | 'auto' | 'fill';
}

/**
 * The app's multi-line text field: native `<textarea>` with the same skin as `TextField`. Its look
 * comes only from `invalid` and `height`; callers place it.
 */
export function TextArea({ invalid = false, height = 'rows', ...rest }: TextAreaProps) {
  return (
    <textarea
      {...rest}
      className="text-field"
      data-height={height}
      aria-invalid={invalid || undefined}
    />
  );
}
