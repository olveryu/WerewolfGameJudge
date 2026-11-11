import './IndeterminateProgressBar.css';

/**
 * Looping progress track with no completion percentage, hidden from assistive technology: a
 * sibling text says what is loading. The caller sizes and places it through `className` and
 * colours it with `--progress-track` / `--progress-bar`.
 */
export function IndeterminateProgressBar({ className }: { readonly className: string }) {
  return (
    <span className={`indeterminate-progress ${className}`} aria-hidden>
      <span className="indeterminate-progress-bar" />
    </span>
  );
}
