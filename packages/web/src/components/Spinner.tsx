import './Spinner.css';

/** Indeterminate busy indicator; `label` is announced to assistive technology. */
export function Spinner({ label, size = 'md' }: { label: string; size?: 'md' | 'lg' }) {
  return <span className="spinner" data-size={size} role="status" aria-label={label} />;
}
