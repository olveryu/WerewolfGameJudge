import './IndeterminateProgressBar.css';

/**
 * Looping progress track with no completion percentage, hidden from assistive technology: a
 * sibling text says what is loading. It fills its container's width; the container places it.
 * `tone="error"` is the quiet bar along a failing connection's edge.
 */
export function IndeterminateProgressBar({
  tone = 'primary',
}: {
  readonly tone?: 'primary' | 'error';
}) {
  return (
    <span className="indeterminate-progress" data-tone={tone} aria-hidden>
      <span className="indeterminate-progress-bar" />
    </span>
  );
}
