import './TextField.css';

import { type InputHTMLAttributes, type Ref, useState } from 'react';

import IconEyeOffOutline from '~icons/ion/eye-off-outline';
import IconEyeOutline from '~icons/ion/eye-outline';
import IconSearch from '~icons/ion/search';

type TextFieldType =
  'text' | 'email' | 'password' | 'search' | 'number' | 'date' | 'datetime-local';

interface TextFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'className' | 'style' | 'type' | 'size' | 'aria-invalid'
> {
  ref?: Ref<HTMLInputElement>;
  /** `search` draws the pill filter frame with its leading search icon. */
  type?: TextFieldType;
  /** Marks the value as rejected: `aria-invalid` and the error border. */
  invalid?: boolean;
  /** Centers short values (page numbers). */
  align?: 'start' | 'center';
  /** `type="password"` only: a trailing key that shows and hides the password. */
  reveal?: boolean;
}

/**
 * The app's single-line text field: native `<input>` with the theme's field skin. Its look comes
 * only from `type`, `invalid` and `align`; it fills its container's width and callers place it.
 */
export function TextField({
  type = 'text',
  invalid = false,
  align = 'start',
  reveal = false,
  ...rest
}: TextFieldProps) {
  const [isRevealed, setIsRevealed] = useState(false);
  const input = (
    <input
      {...rest}
      type={reveal && isRevealed ? 'text' : type}
      className="text-field"
      data-align={align}
      data-reveal={reveal || undefined}
      aria-invalid={invalid || undefined}
    />
  );
  if (type === 'search') {
    return (
      <label className="text-field-search">
        <IconSearch aria-hidden />
        {input}
      </label>
    );
  }
  if (reveal) {
    return (
      <span className="text-field-reveal">
        {input}
        <button
          type="button"
          className="text-field-reveal-toggle"
          aria-label="显示密码"
          aria-pressed={isRevealed}
          onClick={() => setIsRevealed((current) => !current)}
        >
          {isRevealed ? <IconEyeOffOutline aria-hidden /> : <IconEyeOutline aria-hidden />}
        </button>
      </span>
    );
  }
  return input;
}
