/** Dependency-free, accessible admin visualizations. */
import { useId } from 'react';
import { Link } from 'react-router';

import { showAlert } from '@/utils/alert';

export const formatNumber = (value: number) => value.toLocaleString('zh-CN');

/** Use the site's Chinese units for large counts while keeping small values exact. */
export function formatCompactNumber(value: number): string {
  const magnitude = Math.abs(value);
  for (const [threshold, unit] of [
    [1e12, '万亿'],
    [1e8, '亿'],
    [1e4, '万'],
  ] as const) {
    if (magnitude >= threshold) {
      return `${(value / threshold).toLocaleString('zh-CN', { maximumFractionDigits: 1 })}${unit}`;
    }
  }
  return formatNumber(value);
}

/** Quota thresholds are shared by the linear and circular views. */
function quotaTone(value: number, limit: number) {
  const ratio = limit === 0 ? 0 : value / limit;
  return ratio >= 0.95 ? 'danger' : ratio >= 0.8 ? 'warning' : 'success';
}

/** Native progress semantics plus an untruncated textual numerator and denominator. */
export function Meter({ label, value, limit }: { label: string; value: number; limit: number }) {
  return (
    <div className="admin-meter" data-tone={quotaTone(value, limit)}>
      <div>
        <span>{label}</span>
        <button
          type="button"
          className="admin-numeric-detail"
          aria-label={`${label}：${formatNumber(value)} / ${formatNumber(limit)}，查看完整数值`}
          onClick={() =>
            showAlert(label, `${formatNumber(value)} / ${formatNumber(limit)}`, [
              { text: '知道了' },
            ])
          }
        >
          {formatCompactNumber(value)} / {formatCompactNumber(limit)}
        </button>
      </div>
      <progress aria-label={label} value={value} max={Math.max(1, limit)} />
    </div>
  );
}

/** Circular account quota; the text remains meaningful if SVG is unavailable. */
export function QuotaRing({ value, limit }: { value: number; limit: number }) {
  const percent = limit === 0 ? 0 : (value / limit) * 100;
  return (
    <div className="admin-quota-ring" data-tone={quotaTone(value, limit)}>
      <svg viewBox="0 0 120 120" aria-hidden>
        <circle className="admin-ring-track" cx="60" cy="60" r="50" />
        <circle
          className="admin-ring-value"
          cx="60"
          cy="60"
          r="50"
          pathLength="100"
          strokeDasharray={`${Math.min(100, percent)} 100`}
          transform="rotate(-90 60 60)"
        />
      </svg>
      <div>
        <strong>{percent.toFixed(1)}%</strong>
        <span>免费日额度</span>
      </div>
    </div>
  );
}

/** Bar lengths encode numeric counts; labels can expose another measurement alongside them. */
export function BarList({
  items,
  unit = '',
}: {
  items: { label: string; value: number; detail?: string }[];
  unit?: string;
}) {
  const max = Math.max(1, ...items.map((item) => item.value));
  return items.length === 0 ? (
    <p className="admin-empty">所选范围暂无记录</p>
  ) : (
    <ul className="admin-bar-list">
      {items.map((item, index) => (
        <li key={`${item.label}:${index}`}>
          <div>
            <span title={item.label}>{item.label}</span>
            <strong title={item.detail ?? `${formatNumber(item.value)}${unit}`}>
              {item.detail ?? `${formatCompactNumber(item.value)}${unit}`}
            </strong>
          </div>
          <progress aria-label={item.label} value={item.value} max={max} />
        </li>
      ))}
    </ul>
  );
}

/** Smoothed area series, with exact count/time values exposed in a native disclosure. */
export function AreaChart({ points }: { points: { timestamp: string; count: number }[] }) {
  const id = useId();
  if (points.length === 0) return <p className="admin-empty">所选范围暂无趋势记录</p>;
  const max = Math.max(1, ...points.map((point) => point.count));
  const coordinates = points.map((point, index) => ({
    x: points.length === 1 ? 300 : (index / (points.length - 1)) * 600,
    y: 160 - (point.count / max) * 145,
  }));
  const first = coordinates[0];
  const last = coordinates.at(-1);
  if (first === undefined || last === undefined) throw new Error('Chart points must not be empty');
  let path = `M ${first.x} ${first.y}`;
  for (let index = 1; index < coordinates.length; index += 1) {
    const previous = coordinates[index - 1];
    const current = coordinates[index];
    if (previous === undefined || current === undefined)
      throw new Error('Missing chart coordinate');
    const middle = (previous.x + current.x) / 2;
    path += ` C ${middle} ${previous.y} ${middle} ${current.y} ${current.x} ${current.y}`;
  }
  return (
    <div className="admin-area-chart">
      <svg
        viewBox="0 0 600 180"
        role="img"
        aria-label={`请求趋势，共 ${points.length} 个采样时段，最高 ${formatNumber(max)} 次`}
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--admin-accent)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--admin-accent)" stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {[15, 87.5, 160].map((y) => (
          <line key={y} x1="0" y1={y} x2="600" y2={y} className="admin-chart-grid" />
        ))}
        <path d={`${path} L ${last.x} 160 L ${first.x} 160 Z`} fill={`url(#${id})`} />
        <path d={path} fill="none" stroke="var(--admin-accent)" strokeWidth="2" />
        {coordinates.length === 1 && (
          <circle cx={first.x} cy={first.y} r="4" fill="var(--admin-accent)" />
        )}
      </svg>
      <div className="admin-chart-labels">
        <span>{new Date(points[0]?.timestamp ?? '').toLocaleString('zh-CN')}</span>
        <span>{new Date(points.at(-1)?.timestamp ?? '').toLocaleString('zh-CN')}</span>
      </div>
      <details>
        <summary>查看趋势数据</summary>
        <ul className="admin-chart-data">
          {points.map((point) => (
            <li key={point.timestamp}>
              {new Date(point.timestamp).toLocaleString('zh-CN')} · {formatNumber(point.count)} 次
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

/** Keyboard-focusable heat cells link directly to the corresponding category detail. */
export function HeatGrid({ items }: { items: { id: string; name: string; active: number }[] }) {
  const max = Math.max(1, ...items.map((item) => item.active));
  return (
    <div className="admin-heat-grid">
      {items.map((item) => (
        <Link
          key={item.id}
          to={{ search: '?view=all', hash: `#category-${item.id}` }}
          replace
          data-level={
            item.active === 0
              ? 'empty'
              : item.active / max > 0.66
                ? 'high'
                : item.active / max > 0.33
                  ? 'medium'
                  : 'low'
          }
          title={`${item.name} · ${item.active} 词`}
          aria-label={`${item.name}，在库 ${item.active} 词，查看明细`}
        >
          <span>{item.name}</span>
          <strong>{formatCompactNumber(item.active)}</strong>
        </Link>
      ))}
    </div>
  );
}
