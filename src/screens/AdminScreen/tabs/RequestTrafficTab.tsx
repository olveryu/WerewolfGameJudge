/** Admin Worker request and realtime traffic monitor with explicit user-driven refreshes. */

import Ionicons from '@expo/vector-icons/Ionicons';
import type React from 'react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import { PressableScale } from '@/components/PressableScale';
import type { AdminRequestTraffic, TimePreset } from '@/features/admin/model/adminContracts';
import { fetchRequestTraffic } from '@/features/admin/services/adminApi';
import { borderRadius, colors, componentSizes, fixed, spacing, typography } from '@/theme';
import { handleError } from '@/utils/errorPipeline';
import { log } from '@/utils/logger';

import {
  AdminEmptyState,
  MetricCard,
  RequestTrafficTrendChart,
  TimeRangeSelector,
} from '../components';

type TrafficRange = Readonly<{ from: string; to: string }>;
type RouteMetric = AdminRequestTraffic['http']['routes'][number];

const REQUEST_TIME_PRESETS: readonly TimePreset[] = ['1h', '24h', '7d', '30d'] as const;

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

const RouteMetricRow = memo(function RouteMetricRow({ route }: { route: RouteMetric }) {
  return (
    <View style={styles.routeRow}>
      <View style={styles.routeHeader}>
        <Text style={styles.routeMethod}>{route.method}</Text>
        <View style={styles.routeValues}>
          <Text style={styles.routeCount}>
            {route.count.toLocaleString()} · {route.sharePercent.toFixed(1)}%
          </Text>
          <Text style={styles.routeDetail}>
            {route.avgDurationMs.toLocaleString()} ms · {route.errorCount.toLocaleString()} 错误
          </Text>
        </View>
      </View>
      <Text style={styles.routePath}>{route.route}</Text>
      <Text style={styles.routeStatuses}>
        {route.statusCounts.map(({ status, count }) => `${status}: ${count}`).join('  ·  ')}
      </Text>
    </View>
  );
});

function renderRouteMetric({ item }: { item: RouteMetric }): React.JSX.Element {
  return <RouteMetricRow route={item} />;
}

function routeMetricKey(route: RouteMetric): string {
  return `${route.method}:${route.route}`;
}

const TrafficStatus = memo(function TrafficStatus({ data }: { data: AdminRequestTraffic }) {
  const hasInvalidMessages = data.realtime.invalidClientMessages > 0;
  return (
    <View style={styles.statusSection}>
      <Text style={styles.sectionTitle}>架构守卫</Text>
      <View style={styles.statusRow}>
        <Ionicons
          name={hasInvalidMessages ? 'alert-circle' : 'checkmark-circle'}
          size={componentSizes.icon.md}
          color={hasInvalidMessages ? colors.warning : colors.success}
        />
        <Text style={styles.statusLabel}>非法 WebSocket 消息</Text>
        <Text style={[styles.statusValue, hasInvalidMessages && styles.statusValueWarning]}>
          {data.realtime.invalidClientMessages.toLocaleString()}
        </Text>
      </View>
      <View style={styles.statusRow}>
        <Ionicons name="sync-circle" size={componentSizes.icon.md} color={colors.info} />
        <Text style={styles.statusLabel}>状态同步 / 成功连接</Text>
        <Text style={[styles.statusValue, styles.statusValueInfo]}>
          {formatStateSyncRatio(
            data.realtime.stateSyncRequests,
            data.http.successfulWebSocketConnections,
          )}
        </Text>
      </View>
    </View>
  );
});

interface TrafficRefreshControlProps {
  readonly generatedAt: string | null;
  readonly isLoading: boolean;
  readonly onRefresh: () => void;
}

const TrafficRefreshControl = memo(function TrafficRefreshControl({
  generatedAt,
  isLoading,
  onRefresh,
}: TrafficRefreshControlProps) {
  return (
    <View style={styles.refreshRow}>
      <Text style={styles.generatedAt}>
        {generatedAt === null
          ? '尚未加载'
          : `更新于 ${new Date(generatedAt).toLocaleString('zh-CN')}`}
      </Text>
      <PressableScale
        style={styles.refreshButton}
        onPress={onRefresh}
        accessibilityRole="button"
        accessibilityLabel="刷新请求数据"
        accessibilityState={{ busy: isLoading }}
        haptic
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Ionicons name="refresh" size={componentSizes.icon.md} color={colors.primary} />
        )}
      </PressableScale>
    </View>
  );
});

const TrafficOverview = memo(function TrafficOverview({ data }: { data: AdminRequestTraffic }) {
  return (
    <>
      <View style={styles.metricsRow}>
        <MetricCard
          value={data.platform.requests.toLocaleString()}
          label="平台请求"
          icon="cloud-outline"
        />
        <MetricCard
          value={data.http.totalRequests.toLocaleString()}
          label="已记录 HTTP"
          icon="analytics-outline"
        />
      </View>
      <View style={styles.metricsRow}>
        <MetricCard
          value={data.platform.errors.toLocaleString()}
          label="Worker 错误"
          icon="alert-circle-outline"
        />
        <MetricCard
          value={data.platform.subrequests.toLocaleString()}
          label="子请求"
          icon="git-branch-outline"
        />
      </View>
      <View style={styles.metricsRow}>
        <MetricCard
          value={data.http.clientErrorRequests.toLocaleString()}
          label="HTTP 4xx"
          icon="warning-outline"
        />
        <MetricCard
          value={data.http.serverErrorRequests.toLocaleString()}
          label="HTTP 5xx"
          icon="close-circle-outline"
        />
      </View>

      <View style={styles.deltaRow}>
        <Text style={styles.deltaLabel}>平台与应用口径差</Text>
        <Text style={styles.deltaValue}>{formatSignedCount(data.requestCountDelta)}</Text>
      </View>

      <RequestTrafficTrendChart points={data.http.series} />
      <TrafficStatus data={data} />

      <Text style={styles.sectionTitle}>WebSocket</Text>
      <View style={styles.metricsRow}>
        <MetricCard
          value={data.http.successfulWebSocketConnections.toLocaleString()}
          label="连接成功"
          icon="swap-horizontal-outline"
        />
        <MetricCard
          value={data.http.failedWebSocketConnections.toLocaleString()}
          label="握手失败"
          icon="unlink-outline"
        />
      </View>
      <View style={styles.metricsRow}>
        <MetricCard
          value={data.realtime.stateSyncRequests.toLocaleString()}
          label="状态恢复"
          icon="sync-outline"
        />
        <MetricCard
          value={data.realtime.userEventAcks.toLocaleString()}
          label="事件确认"
          icon="checkmark-done-outline"
        />
      </View>
      <Text style={styles.sectionTitle}>HTTP 路由</Text>
    </>
  );
});

/** Admin request-traffic tab. */
export const RequestTrafficTab: React.FC = () => {
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

  const handleRefresh = useCallback(() => {
    if (selectedRange === null) return;
    void loadTraffic(selectedRange);
  }, [loadTraffic, selectedRange]);

  const routes = data?.http.routes ?? [];
  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      data={routes}
      renderItem={renderRouteMetric}
      keyExtractor={routeMetricKey}
      ListHeaderComponent={
        <View>
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
        </View>
      }
      ListEmptyComponent={
        data === null ? null : <Text style={styles.emptyRoutes}>所选范围无 HTTP 路由记录</Text>
      }
    />
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    padding: spacing.medium,
    paddingBottom: spacing.xlarge,
  },
  refreshRow: {
    minHeight: fixed.minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.small,
  },
  generatedAt: {
    flex: 1,
    fontSize: typography.caption,
    color: colors.textMuted,
  },
  refreshButton: {
    width: fixed.minTouchTarget,
    height: fixed.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.full,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: spacing.small,
    marginBottom: spacing.small,
  },
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.small,
    borderBottomWidth: fixed.divider,
    borderBottomColor: colors.borderLight,
  },
  deltaLabel: {
    fontSize: typography.caption,
    color: colors.textSecondary,
  },
  deltaValue: {
    fontSize: typography.secondary,
    fontWeight: typography.weights.semibold,
    color: colors.info,
  },
  statusSection: {
    marginTop: spacing.large,
  },
  sectionTitle: {
    fontSize: typography.body,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginTop: spacing.large,
    marginBottom: spacing.small,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: componentSizes.button.sm,
    gap: spacing.small,
    borderBottomWidth: fixed.divider,
    borderBottomColor: colors.borderLight,
  },
  statusLabel: {
    flex: 1,
    fontSize: typography.caption,
    color: colors.textSecondary,
  },
  statusValue: {
    fontSize: typography.secondary,
    fontWeight: typography.weights.semibold,
    color: colors.success,
  },
  statusValueWarning: {
    color: colors.warning,
  },
  statusValueInfo: {
    flexShrink: 1,
    color: colors.info,
    textAlign: 'right',
  },
  routeRow: {
    minHeight: componentSizes.button.lg,
    paddingVertical: spacing.small,
    borderBottomWidth: fixed.divider,
    borderBottomColor: colors.borderLight,
  },
  routeHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.small,
  },
  routeMethod: {
    fontSize: typography.captionSmall,
    fontWeight: typography.weights.bold,
    color: colors.info,
  },
  routePath: {
    fontSize: typography.caption,
    color: colors.text,
    marginTop: spacing.micro,
  },
  routeValues: {
    alignItems: 'flex-end',
  },
  routeCount: {
    fontSize: typography.secondary,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  routeDetail: {
    fontSize: typography.captionSmall,
    color: colors.textMuted,
    marginTop: spacing.micro,
  },
  routeStatuses: {
    width: '100%',
    marginTop: spacing.tight,
    fontSize: typography.captionSmall,
    color: colors.textSecondary,
  },
  emptyRoutes: {
    paddingVertical: spacing.large,
    textAlign: 'center',
    fontSize: typography.caption,
    color: colors.textMuted,
  },
});
