/**
 * GamesTab — admin word-supply dashboard.
 *
 * Segmented per-game view (fibking / undercover): supply stats, per-query
 * leaderboard, and manual supply triggers (normal + force).
 */

import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AlertModal } from '@/components/AlertModal';
import type { GameWordGame, GameWordsStats } from '@/features/admin/model/adminContracts';
import { fetchGameWordsStats, triggerGameWordSupply } from '@/features/admin/services/adminApi';
import { UNDERCOVER_CATEGORY_NAMES } from '@/games/undercover/room/undercoverRoomAdapter';
import { borderRadius, colors, spacing, typography } from '@/theme';

import { AdminEmptyState, BarChart, MetricCard, Pagination } from '../components';

const GAMES: Array<{ id: GameWordGame; label: string }> = [
  { id: 'fibking', label: '瞎掰王' },
  { id: 'undercover', label: '谁是卧底' },
];

/** Rows per page for the fibking query leaderboard list. */
const LEADERBOARD_PAGE_SIZE = 15;

/** Fibking word categories shown in admin; API returns the raw enum values. */
const FIBKING_CATEGORY_NAMES: Readonly<Record<string, string>> = {
  literary: '书面词',
  internet: '网络词',
  compound: '复合词',
  niche: '生僻概念',
};

/** Fibking v11 review check names shown in admin; API returns the raw field names. */
const FIBKING_REVIEW_CHECK_LABELS: Readonly<Record<string, string>> = {
  isEstablishedTerm: '真实词项',
  isDefinitionAccurate: '释义准确',
  isMeaningUnfamiliarToMostPlayers: '真义陌生',
  isMeaningDistinctFromLiteralReading: '字面不泄底',
  hasMultiplePlausibleWrongDefinitions: '假释义空间',
  hasRevealValue: '揭晓价值',
};

function localizeCategory(game: GameWordGame, category: string): string {
  if (game === 'fibking') return FIBKING_CATEGORY_NAMES[category] ?? category;
  const names: Readonly<Record<string, string>> = UNDERCOVER_CATEGORY_NAMES;
  return names[category] ?? category;
}

export const GamesTab: React.FC = () => {
  const [game, setGame] = useState<GameWordGame>('fibking');
  const [data, setData] = useState<GameWordsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);
  // Pending confirm dialog: null = hidden, otherwise whether it is a force trigger.
  // AlertModal replaces Alert.alert because react-native-web's Alert.alert is a no-op.
  const [confirmForce, setConfirmForce] = useState<boolean | null>(null);
  // Current page of the fibking query leaderboard; resets when switching games.
  const [leaderboardPage, setLeaderboardPage] = useState(1);

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

  const confirmMessage = useMemo(() => {
    if (confirmForce === null) return '';
    const gameLabel = game === 'fibking' ? '瞎掰王' : '谁是卧底';
    // Model supply runs on dedicated free projects; force only breaks the budget cap.
    const forceDetail =
      game === 'fibking'
        ? `突破本月 ${data?.monthlySupply?.batchLimit ?? '—'} 次配额`
        : '突破每日批次上限';
    return confirmForce
      ? `将为「${gameLabel}」强制触发一次补词，${forceDetail}，确定吗？`
      : `为「${gameLabel}」立即触发一次补词，确定吗？`;
  }, [confirmForce, data?.monthlySupply?.batchLimit, game]);

  const doTrigger = useCallback(() => {
    if (confirmForce === null) return;
    const force = confirmForce;
    setTriggering(true);
    triggerGameWordSupply(game, force)
      .then(() => load(game))
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Unknown error');
      })
      .finally(() => {
        setTriggering(false);
      });
  }, [confirmForce, game, load]);

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
    () =>
      data?.wordsByCategory.map((c) => ({
        label: localizeCategory(game, c.category),
        value: c.active,
      })) ?? [],
    [data, game],
  );
  const leaderboardItems = useMemo(
    () =>
      (data?.queryLeaderboard ?? []).map((q) => {
        // Undercover leaderboard rows are per-category; localize them too.
        const baseLabel = game === 'fibking' ? q.label : localizeCategory(game, q.label);
        return {
          label: q.detail ? `${baseLabel}（${q.detail}）` : baseLabel,
          value: q.publishedWords,
          displayValue: `${q.publishedWords}/${q.packs}批`,
        };
      }),
    [data, game],
  );
  const leaderboardTotalPages = useMemo(
    () => Math.max(1, Math.ceil(leaderboardItems.length / LEADERBOARD_PAGE_SIZE)),
    [leaderboardItems.length],
  );
  // Clamp: a reload may shrink the list while the user sits on a later page.
  const safeLeaderboardPage = Math.min(leaderboardPage, leaderboardTotalPages);
  const pagedLeaderboardItems = useMemo(
    () =>
      leaderboardItems.slice(
        (safeLeaderboardPage - 1) * LEADERBOARD_PAGE_SIZE,
        safeLeaderboardPage * LEADERBOARD_PAGE_SIZE,
      ),
    [leaderboardItems, safeLeaderboardPage],
  );

  const checkStatItems = useMemo(
    () =>
      (data?.reviewCheckStats ?? []).map((s) => ({
        label: FIBKING_REVIEW_CHECK_LABELS[s.check] ?? s.check,
        value: s.failCount,
      })),
    [data],
  );

  const remaining =
    data?.monthlySupply === null || data?.monthlySupply === undefined
      ? null
      : Math.max(0, data.monthlySupply.batchLimit - data.monthlySupply.reserved);
  const tavilyUsage =
    data?.tavilyRequestsUsed === null ||
    data?.tavilyRequestsUsed === undefined ||
    data?.tavilyMonthlyQuota === null ||
    data?.tavilyMonthlyQuota === undefined
      ? null
      : `Tavily 本月已用 ${data.tavilyRequestsUsed}/${data.tavilyMonthlyQuota}`;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.segmented}>
        {GAMES.map((g) => {
          const selected = g.id === game;
          return (
            <Pressable
              key={g.id}
              accessibilityRole="button"
              onPress={() => {
                setGame(g.id);
                setLeaderboardPage(1);
              }}
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
          {game === 'fibking' && checkStatItems.length > 0 && (
            <View style={styles.listCard}>
              <Text style={styles.listTitle}>审核拒因分布（近 30 天）</Text>
              {checkStatItems.map((item) => (
                <View key={item.label} style={styles.listRow}>
                  <Text style={styles.listLabel} numberOfLines={2}>
                    {item.label} 不通过
                  </Text>
                  <Text style={styles.listValue}>{item.value}</Text>
                </View>
              ))}
            </View>
          )}
          {game === 'fibking' ? (
            <View style={styles.listCard}>
              <Text style={styles.listTitle}>
                各查询产出榜（全部 {leaderboardItems.length} 条）
              </Text>
              {pagedLeaderboardItems.map((item) => (
                <View key={item.label} style={styles.listRow}>
                  <Text style={styles.listLabel} numberOfLines={2}>
                    {item.label}
                  </Text>
                  <Text style={styles.listValue}>{item.displayValue}</Text>
                </View>
              ))}
              <Pagination
                page={safeLeaderboardPage}
                totalPages={leaderboardTotalPages}
                onPageChange={setLeaderboardPage}
              />
            </View>
          ) : (
            <BarChart title="各分类词对数" items={leaderboardItems} labelWidth={120} />
          )}

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={triggering || !data.supplyEnabled}
              onPress={() => setConfirmForce(false)}
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
              onPress={() => setConfirmForce(true)}
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
                : `本月剩余 ${remaining} 次（配额 ${data.monthlySupply?.batchLimit}）${
                    tavilyUsage === null ? '' : ` · ${tavilyUsage}`
                  }`
              : '词库供给未启用'}
          </Text>
          <AlertModal
            visible={confirmForce !== null}
            title="确认补词"
            message={confirmMessage}
            buttons={[
              { text: '取消', style: 'cancel' },
              {
                text: '确定',
                style: confirmForce === true ? 'destructive' : 'default',
                onPress: doTrigger,
              },
            ]}
            onClose={() => setConfirmForce(null)}
          />
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
  listCard: {
    marginTop: spacing.medium,
  },
  listTitle: {
    fontSize: typography.body,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing.tight,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.small,
    paddingVertical: spacing.tight,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  listLabel: {
    flex: 1,
    fontSize: typography.secondary,
    color: colors.text,
  },
  listValue: {
    fontSize: typography.secondary,
    color: colors.textSecondary,
    fontWeight: typography.weights.semibold,
  },
});
