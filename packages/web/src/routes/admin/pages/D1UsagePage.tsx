/** Account-level D1 usage and sampled query insights. */
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';

import type {
  AdminD1Insights,
  AdminD1Range,
  AdminD1Sort,
} from '@/features/admin/model/adminContracts';
import { adminQueryOptions } from '@/features/admin/queries/adminQueryOptions';
import { fetchD1Insights, fetchD1Usage } from '@/features/admin/services/adminApi';

import { AreaChart, formatNumber, Meter } from '../components/Charts';
import {
  AsyncBoundary,
  DataTable,
  PageHeading,
  Panel,
  StatTile,
  type TableColumn,
} from '../components/Primitives';

const ranges: ReadonlyArray<{ value: AdminD1Range; label: string }> = [
  { value: 'today', label: '今日 UTC' },
  { value: '24h', label: '24 小时' },
  { value: '7d', label: '7 天' },
];

type QueryRow = AdminD1Insights['queries'][number];

function QueryDetails({ row }: { row: QueryRow }) {
  return (
    <details>
      <summary>{row.label}</summary>
      <p className="admin-muted">查询标识：{row.id.slice(0, 12)}</p>
      <p className="admin-muted">
        {row.count > 0
          ? `估算单次平均：读取 ${formatNumber(Math.round(row.reads / row.count))} 行，写入 ${formatNumber(Math.round(row.writes / row.count))} 行`
          : '暂无单次平均数据'}
      </p>
      <p className="admin-muted">名称仅按涉及的表推测，不能确定调用来源。SQL 文本不展示。</p>
    </details>
  );
}

const columns: TableColumn<QueryRow>[] = [
  { key: 'query', label: '查询 / 可能涉及', render: (row) => <QueryDetails row={row} /> },
  { key: 'reads', label: '估算读取行数', numeric: true, render: (row) => formatNumber(row.reads) },
  {
    key: 'writes',
    label: '估算写入行数',
    numeric: true,
    render: (row) => formatNumber(row.writes),
  },
  { key: 'count', label: '估算次数', numeric: true, render: (row) => formatNumber(row.count) },
];

/** Reuse the admin shell, quota meters, range controls, charts and data table. */
export function D1UsagePage() {
  const [parameters, setParameters] = useSearchParams();
  const rawRange = parameters.get('range');
  const rawSort = parameters.get('sort');
  const bucket = parameters.get('bucket');
  const selectedRange = ranges.find((item) => item.value === rawRange)?.value;
  const range = selectedRange ?? 'today';
  const sort: AdminD1Sort = rawSort === 'writes' ? 'writes' : 'reads';
  const valid =
    (rawRange === null || selectedRange !== undefined) &&
    (rawSort === null || rawSort === 'reads' || rawSort === 'writes') &&
    (bucket === null || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(bucket));
  const usage = useQuery(adminQueryOptions('d1-usage', null, fetchD1Usage));
  const insights = useQuery({
    ...adminQueryOptions('d1-insights', { range, sort, bucket }, (signal) =>
      fetchD1Insights(range, sort, bucket, signal),
    ),
    enabled: valid,
  });
  const updates = [usage.dataUpdatedAt, insights.dataUpdatedAt].filter((value) => value > 0);
  function update(key: string, value: string) {
    const next = new URLSearchParams(parameters);
    next.set(key, value);
    if (key === 'range') next.delete('bucket');
    setParameters(next, { replace: true });
  }
  function clearBucket() {
    const next = new URLSearchParams(parameters);
    next.delete('bucket');
    setParameters(next, { replace: true });
  }
  return (
    <>
      <PageHeading
        title="D1 用量"
        description="账号级读写用量与高消耗查询。数据来自 Cloudflare，可能延迟。"
        query={{
          dataUpdatedAt: updates.length === 0 ? 0 : Math.min(...updates),
          isFetching: usage.isFetching || insights.isFetching,
        }}
        controls={
          <div className="admin-report-range">
            <div className="admin-segmented" role="group" aria-label="分析时间范围">
              {ranges.map((item) => (
                <button
                  type="button"
                  key={item.value}
                  aria-pressed={range === item.value}
                  onClick={() => update('range', item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <span className="admin-range-timezone">UTC 时间</span>
            {bucket !== null && (
              <button type="button" onClick={clearBucket}>
                查看完整时间范围
              </button>
            )}
          </div>
        }
      />
      <div className="admin-content admin-grid">
        <Panel
          title="今日额度"
          description="账号级 · UTC 日 · 00:00 UTC 重置（北京时间 08:00）"
          className="admin-span-12"
        >
          <AsyncBoundary query={usage}>
            {(data) => (
              <>
                <div className="admin-stats-grid">
                  <StatTile label="今日读取行数" value={data.rowsRead} />
                  <StatTile label="今日写入行数" value={data.rowsWritten} />
                </div>
                <Meter label="读取行数" value={data.rowsRead} limit={data.rowsReadLimit} />
                <Meter label="写入行数" value={data.rowsWritten} limit={data.rowsWrittenLimit} />
                <p className="admin-muted">免费计划额度参考；付费计划额度不同。</p>
              </>
            )}
          </AsyncBoundary>
        </Panel>
        {!valid ? (
          <p role="alert" className="admin-error">
            无效的时间范围或排序方式。
          </p>
        ) : (
          <AsyncBoundary query={insights}>
            {(data) => (
              <>
                <Panel
                  title="读取趋势 · 估算"
                  description="查询采样汇总；只显示有样本的时段，间隔不按时间比例绘制。展开趋势数据可查看时段查询。"
                  className="admin-span-6"
                >
                  {data.series.length === 0 ? (
                    <p className="admin-empty">该时段没有查询样本，不代表没有读写。</p>
                  ) : (
                    <AreaChart
                      points={data.series.map((point) => ({
                        timestamp: point.timestamp,
                        count: point.reads,
                      }))}
                      label="读取趋势估算"
                      unit="行"
                      onSelectPoint={(timestamp) => update('bucket', timestamp)}
                    />
                  )}
                </Panel>
                <Panel
                  title="写入趋势 · 估算"
                  description="查询采样汇总；与账号总量口径不同。"
                  className="admin-span-6"
                >
                  {data.series.length === 0 ? (
                    <p className="admin-empty">该时段没有查询样本，不代表没有读写。</p>
                  ) : (
                    <AreaChart
                      points={data.series.map((point) => ({
                        timestamp: point.timestamp,
                        count: point.writes,
                      }))}
                      label="写入趋势估算"
                      unit="行"
                      onSelectPoint={(timestamp) => update('bucket', timestamp)}
                    />
                  )}
                </Panel>
                <Panel
                  title="高消耗查询 · 估算"
                  description={`${data.from} 至 ${data.to} · 最多显示 20 条`}
                  className="admin-span-12"
                  action={
                    <div className="admin-segmented" role="group" aria-label="排行排序">
                      <button
                        type="button"
                        aria-pressed={sort === 'reads'}
                        onClick={() => update('sort', 'reads')}
                      >
                        按读取
                      </button>
                      <button
                        type="button"
                        aria-pressed={sort === 'writes'}
                        onClick={() => update('sort', 'writes')}
                      >
                        按写入
                      </button>
                    </div>
                  }
                >
                  <p className="admin-muted">
                    Query Insights 为采样估算，不是精确账单；未列出的查询不代表没有消耗。
                    不能用账号总量减去排行来计算其他来源。
                  </p>
                  {bucket !== null && <p className="admin-muted">已选择趋势中的单个时段。</p>}
                  <DataTable
                    caption="D1 高消耗查询采样估算"
                    columns={columns}
                    rows={data.queries}
                    rowKey={(row) => row.id}
                  />
                </Panel>
              </>
            )}
          </AsyncBoundary>
        )}
      </div>
    </>
  );
}
