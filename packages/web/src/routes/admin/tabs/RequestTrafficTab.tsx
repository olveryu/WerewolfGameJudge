/** Admin Worker request and realtime traffic monitor with explicit user-driven refreshes. */
import './AdminTabs.css';

import { useCallback, useEffect, useRef, useState } from 'react';

import { IconButton } from '@/components/IconButton';
import { Spinner } from '@/components/Spinner';
import type { AdminRequestTraffic, TimePreset } from '@/features/admin/model/adminContracts';
import { fetchRequestTraffic } from '@/features/admin/services/adminApi';
import { handleError } from '@/utils/errorPipeline';
import { log } from '@/utils/logger';
import IconAlertCircle from '~icons/ion/alert-circle';
import IconAlertCircleOutline from '~icons/ion/alert-circle-outline';
import IconAnalyticsOutline from '~icons/ion/analytics-outline';
import IconCheckmarkCircle from '~icons/ion/checkmark-circle';
import IconCloseCircleOutline from '~icons/ion/close-circle-outline';
import IconCloudOutline from '~icons/ion/cloud-outline';
import IconDownloadOutline from '~icons/ion/download-outline';
import IconGitBranchOutline from '~icons/ion/git-branch-outline';
import IconLayersOutline from '~icons/ion/layers-outline';
import IconPaperPlaneOutline from '~icons/ion/paper-plane-outline';
import IconRadioOutline from '~icons/ion/radio-outline';
import IconRefresh from '~icons/ion/refresh';
import IconSwapHorizontalOutline from '~icons/ion/swap-horizontal-outline';
import IconSyncCircle from '~icons/ion/sync-circle';
import IconSyncOutline from '~icons/ion/sync-outline';
import IconUnlinkOutline from '~icons/ion/unlink-outline';
import IconWarningOutline from '~icons/ion/warning-outline';

import { AdminEmptyState } from '../components/AdminEmptyState';
import { MetricCard } from '../components/MetricCard';
import { RequestTrafficTrendChart } from '../components/RequestTrafficTrendChart';
import { TimeRangeSelector } from '../components/TimeRangeSelector';

type TrafficRange = Readonly<{ from: string; to: string }>;
type RouteMetric = AdminRequestTraffic['http']['routes'][number];

const REQUEST_TIME_PRESETS: readonly TimePreset[] = ['1h', '24h', '7d', '30d'] as const;
const BYTES_PER_KILOBYTE = 1024;
const BYTES_PER_MEGABYTE = BYTES_PER_KILOBYTE * 1024;
const BYTES_PER_GIGABYTE = BYTES_PER_MEGABYTE * 1024;
const BYTES_PER_TERABYTE = BYTES_PER_GIGABYTE * 1024;
const requestTrafficTabLog = log.extend('RequestTrafficTab');

function formatSignedCount(value: number): string {
  return value > 0 ? `+${value.toLocaleString()}` : value.toLocaleString();
}

function formatStateSyncRatio(stateSyncRequests: number, successfulConnections: number): string {
  if (successfulConnections === 0) {
    return `${stateSyncRequests.toLocaleString()} / 0（无成功连接，无法计算）`;
  }
  return `${(stateSyncRequests / successfulConnections).toFixed(2)} 次/连接`;
}

function formatByteCount(bytes: number): string {
  if (bytes < BYTES_PER_KILOBYTE) return `${bytes.toLocaleString()} B`;
  if (bytes < BYTES_PER_MEGABYTE) return `${(bytes / BYTES_PER_KILOBYTE).toFixed(1)} KB`;
  if (bytes < BYTES_PER_GIGABYTE) return `${(bytes / BYTES_PER_MEGABYTE).toFixed(1)} MB`;
  if (bytes < BYTES_PER_TERABYTE) return `${(bytes / BYTES_PER_GIGABYTE).toFixed(1)} GB`;
  return `${(bytes / BYTES_PER_TERABYTE).toFixed(1)} TB`;
}

function RouteMetricRow({ route }: { route: RouteMetric }) {
  return (
    <li className="admin-route-row">
      <div className="admin-route-header">
        <span className="admin-route-method">{route.method}</span>
        <div className="admin-route-values">
          <span className="admin-route-count">
            {route.count.toLocaleString()} · {route.sharePercent.toFixed(1)}%
          </span>
          <span className="admin-route-detail">
            {route.avgDurationMs.toLocaleString()} ms · {route.errorCount.toLocaleString()} 错误
          </span>
        </div>
      </div>
      <div className="admin-route-path">{route.route}</div>
      <div className="admin-route-statuses">
        {route.statusCounts.map(({ status, count }) => `${status}: ${count}`).join('  ·  ')}
      </div>
    </li>
  );
}

function TrafficStatus({ data }: { data: AdminRequestTraffic }) {
  const hasInvalidMessages = data.realtime.invalidClientMessages > 0;
  return (
    <section className="admin-status-section">
      <h2 className="admin-tab-section-title">架构守卫</h2>
      <div className="admin-status-row">
        <span
          className="admin-status-icon"
          data-tone={hasInvalidMessages ? 'warning' : 'success'}
          aria-hidden
        >
          {hasInvalidMessages ? <IconAlertCircle /> : <IconCheckmarkCircle />}
        </span>
        <span className="admin-status-label">非法 WebSocket 消息</span>
        <span className="admin-status-value" data-tone={hasInvalidMessages ? 'warning' : undefined}>
          {data.realtime.invalidClientMessages.toLocaleString()}
        </span>
      </div>
      <div className="admin-status-row">
        <span className="admin-status-icon" data-tone="info" aria-hidden>
          <IconSyncCircle />
        </span>
        <span className="admin-status-label">状态同步 / 成功连接</span>
        <span className="admin-status-value" data-tone="info">
          {formatStateSyncRatio(
            data.realtime.stateSyncRequests,
            data.http.successfulWebSocketConnections,
          )}
        </span>
      </div>
    </section>
  );
}

interface TrafficRefreshControlProps {
  readonly generatedAt: string | null;
  readonly isLoading: boolean;
  readonly onRefresh: () => void;
}

function TrafficRefreshControl({ generatedAt, isLoading, onRefresh }: TrafficRefreshControlProps) {
  return (
    <div className="admin-refresh-row">
      <span className="admin-generated-at">
        {generatedAt === null
          ? '尚未加载'
          : `更新于 ${new Date(generatedAt).toLocaleString('zh-CN')}`}
      </span>
      <IconButton
        label="刷新请求数据"
        aria-busy={isLoading}
        onClick={onRefresh}
        icon={isLoading ? <Spinner label="正在刷新" /> : <IconRefresh aria-hidden />}
      />
    </div>
  );
}

function TrafficOverview({ data }: { data: AdminRequestTraffic }) {
  return (
    <>
      <div className="admin-metrics-row">
        <MetricCard
          value={data.platform.requests.toLocaleString()}
          label="平台请求"
          icon={<IconCloudOutline />}
        />
        <MetricCard
          value={data.http.totalRequests.toLocaleString()}
          label="已记录 HTTP"
          icon={<IconAnalyticsOutline />}
        />
      </div>
      <div className="admin-metrics-row">
        <MetricCard
          value={data.platform.errors.toLocaleString()}
          label="Worker 错误"
          icon={<IconAlertCircleOutline />}
        />
        <MetricCard
          value={data.platform.subrequests.toLocaleString()}
          label="子请求"
          icon={<IconGitBranchOutline />}
        />
      </div>
      <div className="admin-metrics-row">
        <MetricCard
          value={data.http.clientErrorRequests.toLocaleString()}
          label="HTTP 4xx"
          icon={<IconWarningOutline />}
        />
        <MetricCard
          value={data.http.serverErrorRequests.toLocaleString()}
          label="HTTP 5xx"
          icon={<IconCloseCircleOutline />}
        />
      </div>
      <div className="admin-delta-row">
        <span className="admin-delta-label">平台与应用口径差</span>
        <span className="admin-delta-value">{formatSignedCount(data.requestCountDelta)}</span>
      </div>
      <RequestTrafficTrendChart points={data.http.series} />
      <TrafficStatus data={data} />
      <h2 className="admin-tab-section-title">WebSocket</h2>
      <div className="admin-metrics-row">
        <MetricCard
          value={data.http.successfulWebSocketConnections.toLocaleString()}
          label="连接成功"
          icon={<IconSwapHorizontalOutline />}
        />
        <MetricCard
          value={data.http.failedWebSocketConnections.toLocaleString()}
          label="握手失败"
          icon={<IconUnlinkOutline />}
        />
      </div>
      <div className="admin-metrics-row">
        <MetricCard
          value={data.realtime.stateSyncRequests.toLocaleString()}
          label="状态恢复"
          icon={<IconSyncOutline />}
        />
      </div>
      <h2 className="admin-tab-section-title">WebSocket 下行</h2>
      <div className="admin-metrics-row">
        <MetricCard
          value={data.realtime.stateUpdateBroadcasts.toLocaleString()}
          label="状态广播"
          icon={<IconRadioOutline />}
        />
        <MetricCard
          value={data.realtime.stateUpdateDeliveries.toLocaleString()}
          label="状态推送帧"
          icon={<IconPaperPlaneOutline />}
        />
      </div>
      <div className="admin-metrics-row">
        <MetricCard
          value={formatByteCount(data.realtime.stateUpdateBytes)}
          label="状态下行流量"
          icon={<IconDownloadOutline />}
        />
        <MetricCard
          value={data.realtime.downlinkDeliveries.toLocaleString()}
          label="全部下行帧"
          icon={<IconLayersOutline />}
        />
      </div>
      <div className="admin-delta-row">
        <span className="admin-delta-label">下行总流量</span>
        <span className="admin-delta-value">{formatByteCount(data.realtime.downlinkBytes)}</span>
      </div>
      <h2 className="admin-tab-section-title">HTTP 路由</h2>
      {data.http.routes.length === 0 ? (
        <p className="admin-hint">所选范围无 HTTP 路由记录</p>
      ) : (
        <ul className="admin-list">
          {data.http.routes.map((route) => (
            <RouteMetricRow key={`${route.method}:${route.route}`} route={route} />
          ))}
        </ul>
      )}
    </>
  );
}

/** Admin request-traffic tab; loads on range selection and on explicit refresh, never polls. */
export function RequestTrafficTab() {
  const [data, setData] = useState<AdminRequestTraffic | null>(null);
  const [selectedRange, setSelectedRange] = useState<TrafficRange | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestSequence = useRef(0);

  useEffect(
    () => () => {
      requestSequence.current += 1;
    },
    [],
  );

  const loadTraffic = useCallback(async (range: TrafficRange) => {
    const sequence = requestSequence.current + 1;
    requestSequence.current = sequence;
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchRequestTraffic(range.from, range.to);
      if (requestSequence.current === sequence) setData(result);
    } catch (cause: unknown) {
      if (requestSequence.current !== sequence) return;
      handleError(cause, {
        label: '加载请求监控',
        logger: requestTrafficTabLog,
        feedback: false,
      });
      setError('请求监控加载失败，请重试');
    } finally {
      if (requestSequence.current === sequence) setIsLoading(false);
    }
  }, []);

  const handleRangeChange = useCallback(
    async (range: TrafficRange) => {
      setSelectedRange(range);
      await loadTraffic(range);
    },
    [loadTraffic],
  );

  const handleRefresh = () => {
    if (selectedRange === null) return;
    void loadTraffic(selectedRange);
  };

  return (
    <div className="admin-tab">
      <TimeRangeSelector
        onRangeChange={handleRangeChange}
        presets={REQUEST_TIME_PRESETS}
        initialPreset="24h"
      />
      <TrafficRefreshControl
        generatedAt={data?.generatedAt ?? null}
        isLoading={isLoading}
        onRefresh={handleRefresh}
      />
      {isLoading && data === null ? (
        <AdminEmptyState loading error={null} empty={false} />
      ) : error !== null || data === null ? (
        <AdminEmptyState loading={false} error={error} empty={data === null} />
      ) : (
        <TrafficOverview data={data} />
      )}
    </div>
  );
}
