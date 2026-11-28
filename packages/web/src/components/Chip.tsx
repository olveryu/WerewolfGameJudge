import './Chip.css';

import type { ReactNode } from 'react';

import type { ButtonTone } from './Button';

export type ChipTone = ButtonTone | 'success';

interface ChipProps {
  readonly children: ReactNode;
  readonly onClick: () => void;
  /**
   * A filter or selection chip when set (announced as a toggle, filled when on); a plain action
   * chip when omitted.
   */
  readonly pressed?: boolean;
  /** Accent for the text and the filled state: a faction, or `success` for a done state; primary when omitted. */
  readonly tone?: ChipTone;
  readonly disabled?: boolean;
  /** Accessible name when the visible label alone is not enough. */
  readonly 'aria-label'?: string;
  readonly 'data-testid'?: string;
}

/**
 * A pill-shaped filter, selection or small action key; styled only by its props. Callers lay
 * chips out from their own row (a wrapping flex row, or a grid that shares the row).
 */
export function Chip({
  children,
  onClick,
  pressed,
  tone,
  disabled,
  'aria-label': ariaLabel,
  'data-testid': testId,
}: ChipProps) {
  return (
    <button
      type="button"
      className="chip"
      aria-pressed={pressed}
      aria-label={ariaLabel}
      data-tone={tone}
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
