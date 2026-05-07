/**
 * StatsTab — Admin 活跃统计
 *
 * 时间快捷选择 + metric 卡片 + 国家/Colo 条形图。
 */

import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { PressableScale } from '@/components/PressableScale';
import { borderRadius, colors, shadows, spacing, typography } from '@/theme';

import { type AdminStats, fetchStats } from '../adminApi';

type TimePreset = 'today' | '7d' | '30d' | 'custom';

function getTimeRange(preset: TimePreset): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString();
  if (preset === 'today') {
    const start = new Date(now);
    start.setUTCHours(0, 0, 0, 0);
    return { from: start.toISOString(), to };
  }
  if (preset === '7d') {
    const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { from: start.toISOString(), to };
  }
  // 30d
  const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { from: start.toISOString(), to };
}

export const StatsTab: React.FC = () => {
  const [preset, setPreset] = useState<TimePreset>('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [data, setData] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const range =
        preset === 'custom'
          ? { from: `${customFrom}T00:00:00Z`, to: `${customTo}T23:59:59Z` }
          : getTimeRange(preset);
      const result = await fetchStats(range.from, range.to);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [preset, customFrom, customTo]);

  useEffect(() => {
    if (preset !== 'custom') {
      void loadData();
    }
  }, [preset, loadData]);

  const handleCustomSearch = useCallback(() => {
    if (customFrom && customTo) {
      void loadData();
    }
  }, [customFrom, customTo, loadData]);

  const styles = useMemo(() => createStyles(), []);

  const maxCountryCount = data?.countries?.[0]?.count ?? 1;
  const maxColoCount = data?.colos?.[0]?.count ?? 1;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Time selector */}
      <View style={styles.pillRow}>
        {(['today', '7d', '30d', 'custom'] as TimePreset[]).map((p) => (
          <PressableScale
            key={p}
            style={[styles.pill, preset === p && styles.pillActive]}
            onPress={() => setPreset(p)}
          >
            <Text style={[styles.pillText, preset === p && styles.pillTextActive]}>
              {p === 'today' ? '今天' : p === '7d' ? '近7天' : p === '30d' ? '近30天' : '自定义'}
            </Text>
          </PressableScale>
        ))}
      </View>

      {preset === 'custom' && (
        <View style={styles.customRow}>
          <TextInput
            style={styles.customInput}
            placeholder="开始日期 (YYYY-MM-DD)"
            placeholderTextColor={colors.textMuted}
            value={customFrom}
            onChangeText={setCustomFrom}
          />
          <Text style={styles.customSep}>~</Text>
          <TextInput
            style={styles.customInput}
            placeholder="结束日期 (YYYY-MM-DD)"
            placeholderTextColor={colors.textMuted}
            value={customTo}
            onChangeText={setCustomTo}
          />
          <PressableScale style={styles.customBtn} onPress={handleCustomSearch}>
            <Text style={styles.customBtnText}>查</Text>
          </PressableScale>
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
      ) : data ? (
        <>
          {/* Metric cards */}
          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{data.registered}</Text>
              <Text style={styles.metricLabel}>新注册</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{data.active}</Text>
              <Text style={styles.metricLabel}>活跃数</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{data.totalGames}</Text>
              <Text style={styles.metricLabel}>总局数</Text>
            </View>
          </View>

          {/* Country distribution */}
          <Text style={styles.sectionTitle}>国家分布</Text>
          {data.countries.map((c) => (
            <View key={c.country} style={styles.barRow}>
              <Text style={styles.barLabel}>{c.country}</Text>
              <View style={styles.barTrack}>
                <View
                  style={[styles.barFill, { width: `${(c.count / maxCountryCount) * 100}%` }]}
                />
              </View>
              <Text style={styles.barValue}>{c.count}</Text>
            </View>
          ))}

          {/* Colo distribution */}
          <Text style={styles.sectionTitle}>Colo 分布</Text>
          {data.colos.map((c) => (
            <View key={c.colo} style={styles.barRow}>
              <Text style={styles.barLabel}>{c.colo}</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${(c.count / maxColoCount) * 100}%` }]} />
              </View>
              <Text style={styles.barValue}>{c.count}</Text>
            </View>
          ))}
        </>
      ) : null}
    </ScrollView>
  );
};

function createStyles() {
  return StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { padding: spacing.medium, paddingBottom: spacing.xlarge },
    pillRow: { flexDirection: 'row', gap: spacing.tight, marginBottom: spacing.small },
    pill: {
      paddingHorizontal: spacing.small,
      paddingVertical: spacing.tight,
      borderRadius: borderRadius.full,
      backgroundColor: colors.surface,
    },
    pillActive: { backgroundColor: colors.primary },
    pillText: { fontSize: typography.caption, color: colors.textSecondary },
    pillTextActive: { color: colors.textInverse },
    customRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.tight,
      marginBottom: spacing.small,
    },
    customInput: {
      flex: 1,
      height: 36,
      borderRadius: borderRadius.medium,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.tight,
      fontSize: typography.captionSmall,
      color: colors.text,
    },
    customSep: { color: colors.textMuted },
    customBtn: {
      paddingHorizontal: spacing.small,
      paddingVertical: spacing.tight,
      borderRadius: borderRadius.medium,
      backgroundColor: colors.primary,
    },
    customBtnText: {
      color: colors.textInverse,
      fontSize: typography.caption,
      fontWeight: typography.weights.semibold,
    },
    error: { color: colors.error, fontSize: typography.caption, marginBottom: spacing.tight },
    loader: { marginTop: spacing.xlarge },
    metricsRow: {
      flexDirection: 'row',
      gap: spacing.small,
      marginBottom: spacing.medium,
    },
    metricCard: {
      flex: 1,
      alignItems: 'center',
      padding: spacing.medium,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.large,
      ...shadows.sm,
    },
    metricValue: {
      fontSize: typography.heading,
      fontWeight: typography.weights.bold,
      color: colors.primary,
    },
    metricLabel: {
      fontSize: typography.caption,
      color: colors.textSecondary,
      marginTop: spacing.micro,
    },
    sectionTitle: {
      fontSize: typography.body,
      fontWeight: typography.weights.semibold,
      color: colors.text,
      marginBottom: spacing.tight,
      marginTop: spacing.medium,
    },
    barRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.tight,
      gap: spacing.tight,
    },
    barLabel: {
      width: 36,
      fontSize: typography.captionSmall,
      color: colors.textSecondary,
      fontWeight: typography.weights.medium,
    },
    barTrack: {
      flex: 1,
      height: 16,
      borderRadius: borderRadius.small,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    barFill: { height: '100%', backgroundColor: colors.primary, borderRadius: borderRadius.small },
    barValue: {
      width: 30,
      fontSize: typography.captionSmall,
      color: colors.textMuted,
      textAlign: 'right',
    },
  });
}
