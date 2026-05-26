/**
 * AnalyticsTab — Admin load performance telemetry
 *
 * TimeRangeSelector + MetricCard (avgLoad/avgTTFB) + BarChart (country/Colo/ISP).
 */

import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/theme';

import { type AdminAnalytics, fetchAnalytics } from '../adminApi';
import { AdminEmptyState, BarChart, MetricCard, TimeRangeSelector } from '../components';

export const AnalyticsTab: React.FC = () => {
  const [data, setData] = useState<AdminAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleRangeChange = useCallback(async (range: { from: string; to: string }) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchAnalytics(range.from, range.to);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  const countryItems = useMemo(
    () =>
      data?.countries.map((c) => ({
        label: c.country,
        value: c.count,
        displayValue: `${c.avgLoadMs} ms`,
      })) ?? [],
    [data?.countries],
  );

  const coloItems = useMemo(
    () => data?.colos.map((c) => ({ label: c.colo, value: c.count })) ?? [],
    [data?.colos],
  );

  const ispItems = useMemo(
    () => data?.isps.map((isp) => ({ label: isp.isp, value: isp.count })) ?? [],
    [data?.isps],
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
              value={`${data.avgLoadMs.toLocaleString()} ms`}
              label="平均加载"
              icon="timer-outline"
            />
            <MetricCard
              value={`${data.avgTtfbMs.toLocaleString()} ms`}
              label="平均 TTFB"
              icon="flash-outline"
            />
          </View>
          <Text style={styles.totalRequests}>总请求: {data.totalRequests.toLocaleString()}</Text>

          <BarChart title="按国家平均加载时间" items={countryItems} />
          <BarChart title="按 Colo 请求数" items={coloItems} />
          <BarChart title="Top ISP" items={ispItems} labelWidth={100} />
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
    marginBottom: spacing.tight,
  },
  totalRequests: {
    fontSize: typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.medium,
  },
});
