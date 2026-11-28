import './Spinner.css';

/**
 * Indeterminate busy indicator, the app's only one; `label` is announced to assistive technology.
 * `size="sm"` sits inside a button's text line; `tone="inverse"` turns on a filled primary key;
 * `tone="report"` draws in the review document's fixed light palette.
 */
export function Spinner({
  label,
  size = 'md',
  tone = 'default',
}: {
  label: string;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'default' | 'inverse' | 'report';
}) {
  return (
    <span className="spinner" data-size={size} data-tone={tone} role="status" aria-label={label} />
  );
}
