/** Growth, performance and AI reports share a range policy, not a one-size-fits-all layout. */
import { useQuery } from '@tanstack/react-query';

import { adminQueryOptions } from '@/features/admin/queries/adminQueryOptions';
import { fetchAIUsage, fetchAnalytics, fetchStats } from '@/features/admin/services/adminApi';

import { BarList, formatNumber } from '../components/Charts';
import { AsyncBoundary, PageHeading, Panel, StatTile } from '../components/Primitives';
import { ReportRange, useReportRange } from '../components/ReportRange';

function useReport<T>(
  name: string,
  fetcher: (from: string, to: string, signal: AbortSignal) => Promise<T>,
) {
  const range = useReportRange();
  const query = useQuery({
    ...adminQueryOptions(name, range.key, (signal) => {
      const { from, to } = range.resolve();
      return fetcher(from, to, signal);
    }),
    enabled: range.valid,
  });
  return { query, valid: range.valid };
}

function RangeError() {
  return (
    <p role="alert" className="admin-error">
      请选择有效的时间范围（最多 31 天）。
    </p>
  );
}

/** Growth aggregates retain their historical-games meaning and label it explicitly. */
export function GrowthPage() {
  const { query, valid } = useReport('growth', fetchStats);
  return (
    <>
      <PageHeading
        title="增长"
        description="注册、活跃与用户分布，按 UTC 时间统计。"
        query={query}
        controls={<ReportRange />}
      />
      <div className="admin-content">
        {!valid ? (
          <RangeError />
        ) : (
          <AsyncBoundary query={query}>
            {(data) => (
              <div className="admin-grid">
                <Panel className="admin-span-12">
                  <div className="admin-stats-grid">
                    <StatTile label="新注册" value={formatNumber(data.registered)} />
                    <StatTile label="活跃用户" value={formatNumber(data.active)} />
                    <StatTile
                      label="活跃用户累计局数"
                      value={formatNumber(data.totalGames)}
                      hint="这些用户的历史总局数，并非区间内局数"
                    />
                  </div>
                </Panel>
                <Panel title="国家分布" description="范围内活跃用户" className="admin-span-6">
                  <BarList
                    unit=" 人"
                    items={data.countries.map((row) => ({ label: row.country, value: row.count }))}
                  />
                </Panel>
                <Panel title="接入节点" description="范围内活跃用户" className="admin-span-6">
                  <BarList
                    unit=" 人"
                    items={data.colos.map((row) => ({ label: row.colo, value: row.count }))}
                  />
                </Panel>
              </div>
            )}
          </AsyncBoundary>
        )}
      </div>
    </>
  );
}

/** Performance emphasizes latency while retaining sample counts alongside distributions. */
export function PerformancePage() {
  const { query, valid } = useReport('performance', fetchAnalytics);
  return (
    <>
      <PageHeading
        title="性能"
        description="页面加载耗时与网络接入质量。"
        query={query}
        controls={<ReportRange />}
      />
      <div className="admin-content">
        {!valid ? (
          <RangeError />
        ) : (
          <AsyncBoundary query={query}>
            {(data) => (
              <div className="admin-grid">
                <Panel className="admin-span-12">
                  <div className="admin-stats-grid">
                    <StatTile label="平均加载" value={`${formatNumber(data.avgLoadMs)} ms`} />
                    <StatTile
                      label="平均首字节"
                      value={`${formatNumber(data.avgTtfbMs)} ms`}
                      hint="TTFB · 从请求到首字节"
                    />
                    <StatTile label="样本数" value={formatNumber(data.totalRequests)} />
                  </div>
                </Panel>
                <Panel
                  title="各国平均加载时间"
                  description="条长表示样本数，右侧为平均毫秒数。"
                  className="admin-span-6"
                >
                  <BarList
                    items={data.countries.map((row) => ({
                      label: `${row.country} · ${formatNumber(row.count)} 个样本`,
                      value: row.count,
                      detail: `${formatNumber(row.avgLoadMs)} ms`,
                    }))}
                  />
                </Panel>
                <Panel title="运营商" className="admin-span-6">
                  <BarList items={data.isps.map((row) => ({ label: row.isp, value: row.count }))} />
                </Panel>
                <Panel title="接入节点请求数" className="admin-span-12">
                  <BarList
                    items={data.colos.map((row) => ({ label: row.colo, value: row.count }))}
                  />
                </Panel>
              </div>
            )}
          </AsyncBoundary>
        )}
      </div>
    </>
  );
}

/** AI visibility includes provider, model, recipient and outcome dimensions. */
export function AiPage() {
  const { query, valid } = useReport('ai', fetchAIUsage);
  return (
    <>
      <PageHeading
        title="AI"
        description="模型使用情况、响应耗时与请求结果。"
        query={query}
        controls={<ReportRange />}
      />
      <div className="admin-content">
        {!valid ? (
          <RangeError />
        ) : (
          <AsyncBoundary query={query}>
            {(data) => (
              <div className="admin-grid">
                <Panel className="admin-span-12">
                  <div className="admin-stats-grid">
                    <StatTile label="总请求" value={formatNumber(data.totalRequests)} />
                    <StatTile
                      label="平均首包"
                      value={`${formatNumber(data.avgTtfrMs)} ms`}
                      hint="TTFR · 第一个回复片段的耗时"
                    />
                    <StatTile label="错误率" value={`${data.errorRate.toFixed(1)}%`} />
                  </div>
                </Panel>
                <Panel
                  title="模型"
                  description={
                    data.providers.length === 1
                      ? `Provider · ${data.providers[0]?.label}`
                      : undefined
                  }
                  className="admin-span-6"
                >
                  <BarList
                    items={data.models.map((row) => ({ label: row.label, value: row.count }))}
                  />
                  {data.providers.length > 1 && (
                    <>
                      <h3>Provider</h3>
                      <BarList
                        items={data.providers.map((row) => ({
                          label: row.label,
                          value: row.count,
                        }))}
                      />
                    </>
                  )}
                </Panel>
                <Panel title="使用最多的用户" className="admin-span-6">
                  <BarList
                    items={data.topUsers.map((row) => ({
                      label: row.displayName ?? row.userId,
                      value: row.count,
                    }))}
                  />
                </Panel>
                <Panel title="国家" className="admin-span-6">
                  <BarList
                    items={data.countries.map((row) => ({ label: row.label, value: row.count }))}
                  />
                </Panel>
                <Panel title="请求结果" className="admin-span-6">
                  <BarList
                    items={data.statuses.map((row) => ({
                      label:
                        row.label === 'ok' || row.label === 'success'
                          ? '成功'
                          : row.label === 'error'
                            ? '出错'
                            : row.label,
                      value: row.count,
                    }))}
                  />
                </Panel>
              </div>
            )}
          </AsyncBoundary>
        )}
      </div>
    </>
  );
}
