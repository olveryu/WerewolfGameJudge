/** Account-level D1 usage and sampled query insights. */
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';

import { TabList, TabPanel, Tabs } from '@/components/Tabs';
import type {
  AdminD1Insights,
  AdminD1Range,
  AdminD1Sort,
  AdminD1Usage,
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
  const rawView = parameters.get('view');
  const hasAnalysisLink = ['range', 'sort', 'bucket'].some((key) => parameters.has(key));
  const view =
    rawView === 'analysis' || (rawView === null && hasAnalysisLink) ? 'analysis' : 'quota';
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
  const usage = useQuery({
    ...adminQueryOptions('d1-usage', null, fetchD1Usage),
    enabled: view === 'quota',
  });
  const insights = useQuery({
    ...adminQueryOptions('d1-insights', { range, sort, bucket }, (signal) =>
      fetchD1Insights(range, sort, bucket, signal),
    ),
    enabled: view === 'analysis' && valid,
  });
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
        query={view === 'quota' ? usage : insights}
      />
      <Tabs value={view} onValueChange={(value) => update('view', value)} lazy manualActivation>
        <div className="admin-section-tabs">
          <TabList
            label="D1 用量视图"
            variant="underline"
            items={[
              { value: 'quota', label: '今日额度' },
              { value: 'analysis', label: '用量分析' },
            ]}
          />
        </div>
        <TabPanel value="quota">
          <div className="admin-content admin-grid">
            <AsyncBoundary query={usage}>{(data) => <DailyQuota data={data} />}</AsyncBoundary>
          </div>
        </TabPanel>
        <TabPanel value="analysis">
          <div className="admin-content admin-grid">
            <div className="admin-report-range admin-span-12">
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
            {!valid ? (
              <p role="alert" className="admin-error">
                无效的时间范围或排序方式。
              </p>
            ) : (
              <AsyncBoundary query={insights}>
                {(data) => (
                  <D1Analysis
                    data={data}
                    range={range}
                    sort={sort}
                    bucket={bucket}
                    onUpdate={update}
                  />
                )}
              </AsyncBoundary>
            )}
          </div>
        </TabPanel>
      </Tabs>
    </>
  );
}

function DailyQuota({ data }: { data: AdminD1Usage }) {
  return (
    <Panel
      title="今日读写用量"
      description="账号级 · UTC 日 · 00:00 UTC 重置（北京时间 08:00）"
      className="admin-span-12"
    >
      <div className="admin-stats-grid">
        <StatTile label="今日读取行数" value={data.rowsRead} />
        <StatTile label="今日写入行数" value={data.rowsWritten} />
      </div>
      <Meter label="读取行数" value={data.rowsRead} limit={data.rowsReadLimit} />
      <Meter label="写入行数" value={data.rowsWritten} limit={data.rowsWrittenLimit} />
      <p className="admin-muted">
        免费计划每日额度参考；付费计划额度不同。历史累计请切换至「用量分析」。
      </p>
    </Panel>
  );
}

function D1Analysis({
  data,
  range,
  sort,
  bucket,
  onUpdate,
}: {
  data: AdminD1Insights;
  range: AdminD1Range;
  sort: AdminD1Sort;
  bucket: string | null;
  onUpdate: (key: string, value: string) => void;
}) {
  const selectedLabel = ranges.find((item) => item.value === range)?.label;
  return (
    <>
      <Panel
        title={`${selectedLabel}累计 · 采样估算`}
        description="汇总所选时段的全部趋势样本，不是前 20 条排行之和；不受单个时段选择或排序影响。"
        className="admin-span-12"
      >
        {data.series.length === 0 ? (
          <p className="admin-empty">所选时段没有查询样本，无法估算累计读写，不代表没有用量。</p>
        ) : (
          <div className="admin-stats-grid">
            <StatTile
              label="读取累计 · 估算"
              value={data.series.reduce((sum, point) => sum + point.reads, 0)}
            />
            <StatTile
              label="写入累计 · 估算"
              value={data.series.reduce((sum, point) => sum + point.writes, 0)}
            />
          </div>
        )}
        <p className="admin-muted">
          UTC 时间 · 查询采样口径，与账号级今日额度不同，不能当作精确账单。
        </p>
      </Panel>
      <D1Trend
        series={data.series}
        metric="reads"
        onSelect={(timestamp) => onUpdate('bucket', timestamp)}
      />
      <D1Trend
        series={data.series}
        metric="writes"
        onSelect={(timestamp) => onUpdate('bucket', timestamp)}
      />
      <Panel
        title="高消耗查询 · 估算"
        description={`${data.from} 至 ${data.to} · 最多显示 20 条`}
        className="admin-span-12"
        action={
          <div className="admin-segmented" role="group" aria-label="排行排序">
            <button
              type="button"
              aria-pressed={sort === 'reads'}
              onClick={() => onUpdate('sort', 'reads')}
            >
              按读取
            </button>
            <button
              type="button"
              aria-pressed={sort === 'writes'}
              onClick={() => onUpdate('sort', 'writes')}
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
  );
}

function D1Trend({
  series,
  metric,
  onSelect,
}: {
  series: AdminD1Insights['series'];
  metric: 'reads' | 'writes';
  onSelect: (timestamp: string) => void;
}) {
  const label = metric === 'reads' ? '读取' : '写入';
  const singlePoint = series.length === 1 ? series[0] : undefined;
  return (
    <Panel
      title={`${label}趋势 · 估算`}
      description="只显示有样本的时段，间隔不按时间比例绘制。展开趋势数据可查看时段查询。"
      className="admin-span-6"
    >
      {series.length === 0 ? (
        <p className="admin-empty">该时段没有查询样本，不代表没有读写。</p>
      ) : singlePoint !== undefined ? (
        <div className="admin-chart-single">
          <p className="admin-muted">仅有 1 个采样时段，暂时无法形成趋势。</p>
          <button type="button" onClick={() => onSelect(singlePoint.timestamp)}>
            {new Date(singlePoint.timestamp).toLocaleString('zh-CN', { timeZone: 'UTC' })} UTC
            {' · '}
            {formatNumber(singlePoint[metric])} 行 · 查看该时段查询
          </button>
        </div>
      ) : (
        <AreaChart
          points={series.map((point) => ({ timestamp: point.timestamp, count: point[metric] }))}
          label={`${label}趋势估算`}
          unit="行"
          timeZone="UTC"
          onSelectPoint={onSelect}
        />
      )}
    </Panel>
  );
}
