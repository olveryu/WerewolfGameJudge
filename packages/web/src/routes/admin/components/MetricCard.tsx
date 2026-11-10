import './AdminComponents.css';

import type { ReactNode } from 'react';

interface MetricCardProps {
  value: string;
  label: string;
  /** Decorative icon shown above the value. */
  icon?: ReactNode;
}

/** A single numeric metric: value over label, with an optional icon. */
export function MetricCard({ value, label, icon }: MetricCardProps) {
  return (
    <div className="admin-metric-card">
      {icon !== undefined && (
        <span className="admin-metric-icon" aria-hidden>
          {icon}
        </span>
      )}
      <span className="admin-metric-value">{value}</span>
      <span className="admin-metric-label">{label}</span>
    </div>
  );
}
