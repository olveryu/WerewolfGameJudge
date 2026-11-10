import './AdminComponents.css';

interface BarChartItem {
  label: string;
  value: number;
  /** Text for the value column (e.g. "123 ms"); defaults to `String(value)`. */
  displayValue?: string;
}

interface BarChartProps {
  title: string;
  /** Items sorted by value, largest first: the first item sets the full-width scale. */
  items: readonly BarChartItem[];
  /** Width of the label column in px. */
  labelWidth?: number;
}

/** Bars at least this full show their value inside the bar; narrower bars show it to the right. */
const INLINE_THRESHOLD = 0.4;

/** Horizontal bar chart for distribution data. */
export function BarChart({ title, items, labelWidth = 36 }: BarChartProps) {
  const [largest] = items;
  if (largest === undefined) return null;

  return (
    <section className="admin-bar-chart">
      <h2 className="admin-section-title">{title}</h2>
      <ul className="admin-bar-list">
        {items.map((item) => {
          const ratio = item.value / largest.value;
          if (!Number.isFinite(ratio)) {
            throw new Error(`BarChart cannot render a non-finite value for "${item.label}"`);
          }
          const showInline = ratio >= INLINE_THRESHOLD;
          const display = item.displayValue ?? String(item.value);
          return (
            <li key={item.label} className="admin-bar-row">
              <span className="admin-bar-label" style={{ width: labelWidth }}>
                {item.label}
              </span>
              <span className="admin-bar-track">
                <span className="admin-bar-fill" style={{ width: `${(ratio * 100).toFixed(0)}%` }}>
                  {showInline && <span className="admin-bar-value-inline">{display}</span>}
                </span>
              </span>
              {!showInline && <span className="admin-bar-value-external">{display}</span>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
