/**
 * GamesTab — admin word-supply dashboard.
 *
 * Segmented per-game view (fibking / undercover): supply stats, per-query
 * leaderboard, and manual supply triggers (normal + force).
 */

import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { GameWordGame, GameWordsStats } from '@/features/admin/model/adminContracts';
import { fetchGameWordsStats, triggerGameWordSupply } from '@/features/admin/services/adminApi';
import { borderRadius, colors, spacing, typography } from '@/theme';

import { AdminEmptyState, BarChart, MetricCard } from '../components';

const GAMES: Array<{ id: GameWordGame; label: string }> = [
  { id: 'fibking', label: '瞎掰王' },
  { id: 'undercover', label: '谁是卧底' },
];

export const GamesTab: React.FC = () => {
  const [game, setGame] = useState<GameWordGame>('fibking');
  const [data, setData] = useState<GameWordsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);

  const load = useCallback(async (g: GameWordGame) => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchGameWordsStats(g));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(game);
  }, [game, load]);

  const handleTrigger = useCallback(
    (force: boolean) => {
      const gameLabel = game === 'fibking' ? '瞎掰王' : '谁是卧底';
      const forceDetail =
        game === 'fibking'
          ? '突破本月 60 次配额并产生额外 Tavily/Gemini 费用'
          : '突破每日批次上限并产生额外 Gemini 费用';
      const message = force
        ? `将为「${gameLabel}」强制触发一次补词，${forceDetail}，确定吗？`
        : `为「${gameLabel}」立即触发一次补词，确定吗？`;
      Alert.alert('确认补词', message, [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          style: force ? 'destructive' : 'default',
          onPress: () => {
            setTriggering(true);
            triggerGameWordSupply(game, force)
              .then(() => load(game))
              .catch((e: unknown) => {
                setError(e instanceof Error ? e.message : 'Unknown error');
              })
              .finally(() => {
                setTriggering(false);
              });
          },
        },
      ]);
    },
    [game, load],
  );

  const totalActive = useMemo(
    () => data?.wordsByCategory.reduce((sum, c) => sum + c.active, 0) ?? 0,
    [data],
  );
  const reviewRate = useMemo(() => {
    const accepted = data?.reviewDecisions.find((d) => d.decision === 'accepted')?.count ?? 0;
    const rejected = data?.reviewDecisions.find((d) => d.decision === 'rejected')?.count ?? 0;
    const total = accepted + rejected;
    return total === 0 ? '—' : `${Math.round((accepted / total) * 100)}%`;
  }, [data]);

  const categoryItems = useMemo(
    () => data?.wordsByCategory.map((c) => ({ label: c.category, value: c.active })) ?? [],
    [data],
  );
  const leaderboardItems = useMemo(
    () =>
      (data?.queryLeaderboard ?? []).slice(0, 12).map((q) => ({
        label: q.detail ? `${q.label}（${q.detail}）` : q.label,
        value: q.publishedWords,
        displayValue: `${q.publishedWords}/${q.packs}批`,
      })),
    [data],
  );

  const remaining =
    data?.monthlySupply === null || data?.monthlySupply === undefined
      ? null
      : Math.max(0, data.monthlySupply.batchLimit - data.monthlySupply.reserved);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.segmented}>
        {GAMES.map((g) => {
          const selected = g.id === game;
          return (
            <Pressable
              key={g.id}
              accessibilityRole="button"
              onPress={() => setGame(g.id)}
              style={[styles.segment, selected && styles.segmentSelected]}
            >
              <Text style={[styles.segmentLabel, selected && styles.segmentLabelSelected]}>
                {g.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading || error || !data ? (
        <AdminEmptyState loading={loading} error={error} empty={!data && !loading && !error} />
      ) : (
        <>
          <View style={styles.metricsRow}>
            <MetricCard value={String(totalActive)} label="在库词数" icon="library-outline" />
            {data.monthlySupply ? (
              <MetricCard
                value={`${data.monthlySupply.published}/${data.monthlySupply.wordTarget}`}
                label={`${data.monthlySupply.month} 已发布`}
                icon="cloud-upload-outline"
              />
            ) : (
              <MetricCard value="—" label="无月配额" icon="infinite-outline" />
            )}
            <MetricCard value={reviewRate} label="审核通过率" icon="checkmark-circle-outline" />
          </View>

          <BarChart title="各分类在库词数" items={categoryItems} />
          <BarChart
            title={game === 'fibking' ? '各查询产出榜（Top 12）' : '各分类词对数'}
            items={leaderboardItems}
            labelWidth={120}
          />

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={triggering || !data.supplyEnabled}
              onPress={() => handleTrigger(false)}
              style={[
                styles.button,
                styles.buttonPrimary,
                (triggering || !data.supplyEnabled) && styles.buttonDisabled,
              ]}
            >
              <Text style={styles.buttonLabel}>{triggering ? '触发中…' : '补词'}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={triggering || !data.supplyEnabled}
              onPress={() => handleTrigger(true)}
              style={[
                styles.button,
                styles.buttonDanger,
                (triggering || !data.supplyEnabled) && styles.buttonDisabled,
              ]}
            >
              <Text style={styles.buttonLabel}>强制补词</Text>
            </Pressable>
          </View>
          <Text style={styles.hint}>
            {data.supplyEnabled
              ? remaining === null
                ? '谁是卧底无月配额限制'
                : `本月剩余 ${remaining} 次（配额 ${data.monthlySupply?.batchLimit}）`
              : '词库供给未启用'}
          </Text>
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: spacing.medium, paddingBottom: spacing.xlarge },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.small,
    padding: spacing.tight,
    marginBottom: spacing.medium,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.small,
    borderRadius: borderRadius.small,
    alignItems: 'center',
  },
  segmentSelected: {
    backgroundColor: colors.primary,
  },
  segmentLabel: {
    fontSize: typography.secondary,
    color: colors.textSecondary,
  },
  segmentLabelSelected: {
    color: colors.textInverse,
    fontWeight: typography.weights.semibold,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: spacing.small,
    marginBottom: spacing.medium,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.small,
    marginTop: spacing.medium,
  },
  button: {
    flex: 1,
    paddingVertical: spacing.medium,
    borderRadius: borderRadius.small,
    alignItems: 'center',
  },
  buttonPrimary: {
    backgroundColor: colors.primary,
  },
  buttonDanger: {
    backgroundColor: colors.error,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonLabel: {
    color: colors.textInverse,
    fontSize: typography.body,
    fontWeight: typography.weights.semibold,
  },
  hint: {
    marginTop: spacing.small,
    fontSize: typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
