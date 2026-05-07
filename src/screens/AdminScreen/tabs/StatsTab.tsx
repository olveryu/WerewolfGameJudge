/**
 * StatsTab — Admin 活跃统计
 *
 * TimeRangeSelector + MetricCard + BarChart (国家/Colo)。
 */

import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';

import { type AdminStats, fetchStats } from '../adminApi';
import { AdminEmptyState, BarChart, MetricCard, TimeRangeSelector } from '../components';

export const StatsTab: React.FC = () => {
  const [data, setData] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleRangeChange = useCallback(async (range: { from: string; to: string }) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchStats(range.from, range.to);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  const countryItems = useMemo(
    () => data?.countries.map((c) => ({ label: c.country, value: c.count })) ?? [],
    [data?.countries],
  );

  const coloItems = useMemo(
    () => data?.colos.map((c) => ({ label: c.colo, value: c.count })) ?? [],
    [data?.colos],
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <TimeRangeSelector onRangeChange={handleRangeChange} />

      {loading || error || !data ? (
        <AdminEmptyState loading={loading} error={error} empty={!data && !loading && !error} />
      ) : (
        <>
          <View style={styles.metricsRow}>
            <MetricCard value={String(data.registered)} label="新注册" icon="person-add-outline" />
            <MetricCard value={String(data.active)} label="活跃数" icon="pulse-outline" />
            <MetricCard
              value={String(data.totalGames)}
              label="总局数"
              icon="game-controller-outline"
            />
          </View>

          <BarChart title="国家分布" items={countryItems} />
          <BarChart title="Colo 分布" items={coloItems} />
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
