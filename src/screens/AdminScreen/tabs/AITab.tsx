/**
 * AITab — Admin AI 使用量遥测
 *
 * TimeRangeSelector + MetricCards (总请求/平均TTFR/错误率) + BarCharts (Provider/Model/Country/TopUsers/Status)。
 */

import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';

import { type AdminAIUsage, fetchAIUsage } from '../adminApi';
import { AdminEmptyState, BarChart, MetricCard, TimeRangeSelector } from '../components';

export const AITab: React.FC = () => {
  const [data, setData] = useState<AdminAIUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleRangeChange = useCallback(async (range: { from: string; to: string }) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchAIUsage(range.from, range.to);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  const toBarItems = useCallback(
    (items: Array<{ label: string; count: number }>) =>
      items.map((i) => ({ label: i.label, value: i.count })),
    [],
  );

  const providerItems = useMemo(
    () => toBarItems(data?.providers ?? []),
    [data?.providers, toBarItems],
  );

  const modelItems = useMemo(() => toBarItems(data?.models ?? []), [data?.models, toBarItems]);

  const countryItems = useMemo(
    () => toBarItems(data?.countries ?? []),
    [data?.countries, toBarItems],
  );

  const statusItems = useMemo(() => toBarItems(data?.statuses ?? []), [data?.statuses, toBarItems]);

  const topUserItems = useMemo(
    () =>
      data?.topUsers.map((u) => ({
        label: u.displayName ?? u.userId.slice(0, 8),
        value: u.count,
      })) ?? [],
    [data?.topUsers],
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <TimeRangeSelector onRangeChange={handleRangeChange} />

      {loading || error || !data ? (
        <AdminEmptyState loading={loading} error={error} empty={!data && !loading && !error} />
      ) : (
        <>
          <View style={styles.metricsRow}>
            <MetricCard
              value={data.totalRequests.toLocaleString()}
              label="总请求"
              icon="chatbubble-outline"
            />
            <MetricCard
              value={`${data.avgTtfrMs.toLocaleString()} ms`}
              label="平均 TTFR"
              icon="timer-outline"
            />
            <MetricCard value={`${data.errorRate}%`} label="错误率" icon="alert-circle-outline" />
          </View>

          <BarChart title="按 Provider" items={providerItems} />
          <BarChart title="按模型" items={modelItems} labelWidth={120} />
          <BarChart title="按国家" items={countryItems} />
          <BarChart title="Top 用户" items={topUserItems} />
          <BarChart title="按状态" items={statusItems} />
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: spacing.medium, paddingBottom: spacing.xlarge },
  metricsRow: {
    flexDirection: 'row',
    gap: spacing.small,
    marginBottom: spacing.medium,
  },
});
