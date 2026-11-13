/** Small semantic building blocks for the admin workspace. */
import type { UseQueryResult } from '@tanstack/react-query';
import { Fragment, type ReactNode, useEffect, useState } from 'react';

import { showAlert } from '@/utils/alert';
import { handleError } from '@/utils/errorPipeline';
import { log } from '@/utils/logger';

import { formatCompactNumber } from './Charts';

const adminLog = log.extend('AdminRead');
type ReadStatus = Pick<UseQueryResult, 'dataUpdatedAt' | 'isFetching'>;

/** Page-local context below the shared header and navigation. */
export function PageHeading({
  title,
  description,
  query,
  controls,
  action,
}: {
  title: string;
  description: string;
  query?: ReadStatus;
  controls?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="admin-page-top">
      <div className="admin-page-title-row">
        <h2 className="admin-page-title">{title}</h2>
        {action}
      </div>
      <div className="admin-page-meta">
        <p>{description}</p>
        {query !== undefined && (
          <span className="admin-updated" role="status">
            {query.isFetching
              ? '正在更新…'
              : query.dataUpdatedAt === 0
                ? '尚未更新'
                : `更新于 ${new Date(query.dataUpdatedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`}
          </span>
        )}
      </div>
      {controls !== undefined && <div className="admin-page-tools">{controls}</div>}
    </div>
  );
}

/** Fine-bordered data panel; spans are layout classes, not hardcoded inline styles. */
export function Panel({
  title,
  description,
  action,
  className = '',
  flush = false,
  children,
  footer,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  flush?: boolean;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className={`admin-panel ${className}`}>
      {title !== undefined && (
        <header className="admin-panel-heading">
          <div>
            <h2>{title}</h2>
            {description !== undefined && <p>{description}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={`admin-panel-body${flush ? ' admin-panel-body-flush' : ''}`}>{children}</div>
      {footer}
    </section>
  );
}

function compactMetric(value: string | number): string {
  if (typeof value === 'number') return formatCompactNumber(value);
  return value.replace(/[\d,]+(?:\.\d+)?/g, (measurement) => {
    const number = Number(measurement.replaceAll(',', ''));
    return number >= 10000 ? formatCompactNumber(number) : measurement;
  });
}

/** Compact large measurements without losing access to the exact, unit-bearing value. */
export function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="admin-stat">
      <span>{label}</span>
      <button
        type="button"
        className="admin-stat-value"
        aria-label={`${label}：${value}，查看完整数值`}
        onClick={() => showAlert(label, `${value}`, [{ text: '知道了' }])}
      >
        <strong>{compactMetric(value)}</strong>
      </button>
      {hint && <small>{hint}</small>}
    </div>
  );
}

/** Status always has a textual label, never color alone. */
export function StatusBadge({
  children,
  tone = 'neutral',
  title,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
  title?: string;
}) {
  return (
    <span className="admin-badge" data-tone={tone} title={title}>
      <span aria-hidden />
      {children}
    </span>
  );
}

/** Preserve stale data during refresh; errors remain explicit and retryable. */
export function AsyncBoundary<T>({
  query,
  children,
  empty = false,
}: {
  query: Pick<UseQueryResult<T>, 'data' | 'error' | 'isPending' | 'isFetching' | 'refetch'>;
  children: (data: T) => ReactNode;
  empty?: boolean;
}) {
  useEffect(() => {
    if (query.error !== null)
      handleError(query.error, { label: '读取后台数据', logger: adminLog, feedback: false });
  }, [query.error]);
  return (
    <>
      {query.error !== null && (
        <div role="alert" className="admin-error-box">
          <div>
            <strong>数据加载失败</strong>
            <p>{query.error.message}</p>
          </div>
          <button type="button" disabled={query.isFetching} onClick={() => void query.refetch()}>
            重试
          </button>
        </div>
      )}
      {query.data === undefined ? (
        query.isPending && (
          <div className="admin-skeleton" role="status" aria-label="正在加载数据">
            <span />
            <span />
            <span />
            <span />
          </div>
        )
      ) : empty ? (
        <p className="admin-empty">所选条件下暂无数据</p>
      ) : (
        children(query.data)
      )}
    </>
  );
}

export interface TableColumn<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  numeric?: boolean;
  secondary?: boolean;
  sort?: 'ascending' | 'descending' | 'none';
  onSort?: () => void;
}

/** Native table semantics, accessible sortable headings, and compact responsive rows. */
export function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  rowId,
  highlightedRow,
  expandedRow,
  onRowClick,
}: {
  caption: string;
  columns: TableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  rowId?: (row: T) => string;
  highlightedRow?: string;
  expandedRow?: (row: T) => ReactNode;
  onRowClick?: (row: T) => void;
}) {
  return (
    <div className="admin-table-scroll">
      <table className="admin-table">
        <caption className="admin-sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                aria-sort={column.sort}
                className={`${column.numeric ? 'admin-number' : ''} ${column.secondary ? 'admin-secondary-column' : ''}`}
              >
                {column.onSort ? (
                  <button type="button" onClick={column.onSort}>
                    {column.label}
                    <span aria-hidden>
                      {column.sort === 'ascending'
                        ? ' ↑'
                        : column.sort === 'descending'
                          ? ' ↓'
                          : ' ↕'}
                    </span>
                  </button>
                ) : (
                  column.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const details = expandedRow?.(row);
            return (
              <Fragment key={rowKey(row)}>
                <tr
                  id={rowId?.(row)}
                  data-clickable={onRowClick !== undefined || undefined}
                  data-highlighted={
                    (highlightedRow !== undefined && rowId?.(row) === highlightedRow) || undefined
                  }
                  onClick={(event) => {
                    if (
                      onRowClick !== undefined &&
                      event.target instanceof Element &&
                      !event.target.closest('button, a, input, select, textarea, [role="button"]')
                    ) {
                      onRowClick(row);
                    }
                  }}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`${column.numeric ? 'admin-number' : ''} ${column.secondary ? 'admin-secondary-column' : ''}`}
                    >
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
                {details != null && (
                  <tr>
                    <td colSpan={columns.length}>{details}</td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      {rows.length === 0 && <p className="admin-empty">暂无记录</p>}
    </div>
  );
}

/** Controlled paging; cursor stacks and room page counts stay with their respective owner. */
export function CursorPager({
  page,
  hasNext,
  onPrevious,
  onNext,
  disabled,
  hint,
}: {
  page: number;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <footer className="admin-pagination">
      <span className="admin-muted">{hint}</span>
      <div>
        <button type="button" disabled={page === 1 || disabled} onClick={onPrevious}>
          上一页
        </button>
        <span aria-live="polite">第 {page} 页</span>
        <button type="button" disabled={!hasNext || disabled} onClick={onNext}>
          下一页
        </button>
      </div>
    </footer>
  );
}

/** Render a local date while exposing its full timestamp to mouse and assistive users. */
export function DateLabel({ value }: { value: string | null }) {
  const [now] = useState(() => Date.now());
  if (value === null) return <span className="admin-muted">从未</span>;
  const date = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);
  const elapsed = now - date.getTime();
  const label =
    elapsed >= 0 && elapsed < 86400000
      ? elapsed < 60000
        ? '刚刚'
        : elapsed < 3600000
          ? `${Math.floor(elapsed / 60000)} 分钟前`
          : `${Math.floor(elapsed / 3600000)} 小时前`
      : date.toLocaleDateString('zh-CN');
  return (
    <time dateTime={date.toISOString()} title={date.toLocaleString('zh-CN')}>
      {label}
    </time>
  );
}
