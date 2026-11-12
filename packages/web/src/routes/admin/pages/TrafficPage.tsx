/** Request trends, realtime diagnostics and sortable HTTP routes. */
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';

import type { AdminRequestTraffic } from '@/features/admin/model/adminContracts';
import { adminQueryOptions } from '@/features/admin/queries/adminQueryOptions';
import { fetchRequestTraffic } from '@/features/admin/services/adminApi';

import { AreaChart, formatNumber } from '../components/Charts';
import {
  AsyncBoundary,
  DataTable,
  PageHeading,
  Panel,
  StatTile,
  StatusBadge,
} from '../components/Primitives';
import { ReportRange, useReportRange } from '../components/ReportRange';

function bytes(value: number) {
  if (value < 1024) return `${formatNumber(value)} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${(value / 1024 ** 3).toFixed(1)} GB`;
}

/** User-driven report reads share the same 24-hour key as the overview. */
export function TrafficPage() {
  const range = useReportRange(true);
  const query = useQuery({
    ...adminQueryOptions('traffic', range.key, (signal) => {
      const { from, to } = range.resolve();
      return fetchRequestTraffic(from, to, signal);
    }),
    enabled: range.valid,
  });
  return (
    <>
      <PageHeading
        title="请求"
        description="平台调用量、HTTP 流量与房间实时通信。"
        query={query}
        controls={<ReportRange traffic />}
      />
      <div className="admin-content">
        {!range.valid ? (
          <p role="alert" className="admin-error">
            无效的请求时间范围
          </p>
        ) : (
          <AsyncBoundary query={query}>{(data) => <TrafficReport data={data} />}</AsyncBoundary>
        )}
      </div>
    </>
  );
}

function TrafficReport({ data }: { data: AdminRequestTraffic }) {
  const [parameters, setParameters] = useSearchParams();
  const errorSort = parameters.get('sort') === 'errors';
  const ascending = parameters.get('order') === 'asc';
  const routes = [...data.http.routes].sort(
    (a, b) => (ascending ? 1 : -1) * (errorSort ? a.errorCount - b.errorCount : a.count - b.count),
  );
  function sort(value: string) {
    const next = new URLSearchParams(parameters);
    next.set('sort', value);
    next.set('order', parameters.get('sort') === value ? (ascending ? 'desc' : 'asc') : 'asc');
    setParameters(next);
  }
  const connections = data.http.successfulWebSocketConnections;
  const diagnostics = `非法消息 ${data.realtime.invalidClientMessages}；状态同步/连接 ${connections === 0 ? '无成功连接，无法计算' : (data.realtime.stateSyncRequests / connections).toFixed(2)}；命令/连接 ${connections === 0 ? '无成功连接，无法计算' : (data.realtime.commandRequests / connections).toFixed(2)}`;
  return (
    <div className="admin-grid">
      <Panel className="admin-span-12">
        <div className="admin-stats-grid">
          <StatTile
            label="平台请求"
            value={formatNumber(data.platform.requests)}
            hint={`子请求 ${formatNumber(data.platform.subrequests)}`}
          />
          <StatTile
            label="已记录 HTTP"
            value={formatNumber(data.http.totalRequests)}
            hint={`与平台口径差 ${formatNumber(data.requestCountDelta)}`}
          />
          <StatTile label="Worker 错误" value={formatNumber(data.platform.errors)} />
          <StatTile label="HTTP 4xx" value={formatNumber(data.http.clientErrorRequests)} />
          <StatTile label="HTTP 5xx" value={formatNumber(data.http.serverErrorRequests)} />
        </div>
      </Panel>
      <Panel
        title="请求趋势"
        className="admin-span-8"
        action={
          <StatusBadge
            title={diagnostics}
            tone={data.realtime.invalidClientMessages > 0 ? 'warning' : 'success'}
          >
            {data.realtime.invalidClientMessages > 0 ? '发现非法消息' : '通信正常'}
          </StatusBadge>
        }
      >
        <AreaChart points={data.http.series} />
        <details className="admin-diagnostics">
          <summary>通信诊断</summary>
          <p>{diagnostics}</p>
        </details>
      </Panel>
      <Panel title="WebSocket" className="admin-span-4">
        <div className="admin-stats-grid">
          <StatTile label="连接成功" value={formatNumber(connections)} />
          <StatTile label="握手失败" value={formatNumber(data.http.failedWebSocketConnections)} />
          <StatTile label="状态恢复" value={formatNumber(data.realtime.stateSyncRequests)} />
          <StatTile label="状态广播" value={formatNumber(data.realtime.stateUpdateBroadcasts)} />
        </div>
      </Panel>
      <Panel
        title="WebSocket 下行"
        description="业务帧扇出后的 UTF-8 负载，不含协议开销。"
        className="admin-span-12"
      >
        <div className="admin-stats-grid">
          <StatTile label="状态推送帧" value={formatNumber(data.realtime.stateUpdateDeliveries)} />
          <StatTile label="状态下行流量" value={bytes(data.realtime.stateUpdateBytes)} />
          <StatTile label="全部下行帧" value={formatNumber(data.realtime.downlinkDeliveries)} />
          <StatTile label="下行总流量" value={bytes(data.realtime.downlinkBytes)} />
        </div>
      </Panel>
      <Panel title="HTTP 路由" className="admin-span-12" flush>
        <DataTable
          caption="HTTP 路由流量"
          rows={routes}
          rowKey={(row) => `${row.method}:${row.route}`}
          columns={[
            {
              key: 'route',
              label: '路由',
              render: (row) => (
                <span className="admin-route-path">
                  <StatusBadge>{row.method}</StatusBadge>
                  <code>{row.route}</code>
                </span>
              ),
            },
            {
              key: 'requests',
              label: '请求数',
              numeric: true,
              sort: !errorSort ? (ascending ? 'ascending' : 'descending') : 'none',
              onSort: () => sort('requests'),
              render: (row) => formatNumber(row.count),
            },
            {
              key: 'errors',
              label: '错误数',
              numeric: true,
              sort: errorSort ? (ascending ? 'ascending' : 'descending') : 'none',
              onSort: () => sort('errors'),
              render: (row) => (
                <span
                  className={
                    row.statusCounts.some((status) => status.status >= 500 && status.count > 0)
                      ? 'admin-error'
                      : ''
                  }
                >
                  {formatNumber(row.errorCount)}
                </span>
              ),
            },
            {
              key: 'duration',
              label: '平均耗时',
              numeric: true,
              secondary: true,
              render: (row) => `${formatNumber(row.avgDurationMs)} ms`,
            },
            {
              key: 'share',
              label: '占比',
              numeric: true,
              secondary: true,
              render: (row) => `${row.sharePercent.toFixed(1)}%`,
            },
            {
              key: 'status',
              label: '状态码',
              secondary: true,
              render: (row) =>
                row.statusCounts
                  .map((status) => `${status.status}: ${formatNumber(status.count)}`)
                  .join(' · '),
            },
          ]}
        />
      </Panel>
    </div>
  );
}
