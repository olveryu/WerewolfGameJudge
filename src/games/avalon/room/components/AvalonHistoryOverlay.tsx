/**
 * 阿瓦隆对局记录：任务轨道与分轮 tab 在前，结论横幅居中，提案与表决
 * 时间线在后，湖仙节在每轮末。只用座位号，不显示玩家名。
 *
 * 公投记个人票，暗投只记数量；任务出牌人不揭晓；未结算提案只露进度
 * 与本人的一票；湖仙只写“查验了谁”，结果不进记录。浮层手动开关，
 * 不自动消失，终局保留。轨道 / 轮次 / 提案 / 湖仙四件是共享件，
 * 本文件只留浮层壳（头、tab、滚动、关闭）与数据投影。
 */

import {
  AVALON_QUEST_SIZES,
  type AvalonViewModel,
  isAvalonPlayerCount,
} from '@game-judge/game-engine/games/avalon/public';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Modal } from '@/components/AppModal';
import { Button } from '@/components/Button';
import { borderRadius, colors, fixed, shadows, spacing, textStyles, typography } from '@/theme';

import { formatAvalonQuestLabel } from '../policy/avalonInteractionPolicy';
import { AvalonRecordRound } from './AvalonRecordRound';
import { AvalonRecordTrack } from './AvalonRecordTrack';

/** 对局记录浮层：tab 只含已开始轮次，默认当前轮；只渲染权威记录投影。 */
export function AvalonHistoryOverlay({
  visible,
  viewModel,
  onClose,
}: {
  readonly visible: boolean;
  readonly viewModel: AvalonViewModel;
  readonly onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const rounds = viewModel.roundHistory;
  const ended = viewModel.phase === 'ended';
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  // 每次打开回到默认 tab（当前轮）。
  useEffect(() => {
    if (visible) setSelectedRound(null);
  }, [visible]);
  const active =
    rounds.find((record) => record.round === selectedRound) ?? rounds[rounds.length - 1];
  const latestRecord = rounds[rounds.length - 1];
  // 终局后没有“当前轮”：未结算轮是被打断的，不是进行中的。
  const currentRound =
    ended || latestRecord === undefined || latestRecord.quest !== null || latestRecord.vetoEnded
      ? undefined
      : latestRecord.round;
  const successCount = viewModel.questResults.filter((result) => result === 'success').length;
  const failCount = viewModel.questResults.filter((result) => result === 'fail').length;
  const questSizes = isAvalonPlayerCount(viewModel.playerCount)
    ? AVALON_QUEST_SIZES[viewModel.playerCount].join(' / ')
    : null;
  // 湖仙进行中只属于最后已结算轮的下一节：lady 阶段发生在该轮结算后。
  const latestSettledRound = [...rounds].filter((record) => record.quest !== null).at(-1)?.round;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.panel, { paddingBottom: insets.bottom }]}>
          <View style={styles.header}>
            <Text style={styles.title}>对局记录</Text>
            <Text
              style={styles.summary}
              accessibilityLabel={`成功 ${successCount} · 失败 ${failCount}`}
            >
              成功 <Text style={styles.summarySuccess}>{successCount}</Text> · 失败{' '}
              <Text style={styles.summaryFail}>{failCount}</Text>
            </Text>
          </View>
          <Text style={styles.configLine}>
            投票{viewModel.voteMode === 'public' ? '公投' : '暗投'} · 否决上限 {viewModel.vetoLimit}
            {questSizes !== null ? ` · 任务人数 ${questSizes}` : ''}
          </Text>
          <AvalonRecordTrack
            rounds={rounds}
            questResults={viewModel.questResults}
            currentRound={currentRound}
            activeRound={active?.round}
            ended={ended}
          />
          {rounds.length > 0 ? (
            <View style={styles.tabRow}>
              {rounds.map((record) => {
                const isActive = active !== undefined && record.round === active.round;
                return (
                  <TouchableOpacity
                    key={record.round}
                    style={[styles.tab, isActive ? styles.tabActive : null]}
                    activeOpacity={fixed.activeOpacity}
                    accessibilityRole="button"
                    accessibilityLabel={formatAvalonQuestLabel(record.round)}
                    accessibilityState={{ selected: isActive }}
                    testID={`avalon-history-tab-${record.round}`}
                    onPress={() => setSelectedRound(record.round)}
                  >
                    <Text style={[styles.tabText, isActive ? styles.tabTextActive : null]}>
                      {formatAvalonQuestLabel(record.round)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {active === undefined ? (
              <Text style={styles.emptyText}>暂无对局记录。</Text>
            ) : (
              <AvalonRecordRound
                key={active.round}
                record={active}
                completedLadyCheck={
                  viewModel.ladyHistory.find((record) => record.afterRound === active.round) ?? null
                }
                inProgressLadyHolderSeat={
                  viewModel.lady !== null && latestSettledRound === active.round
                    ? viewModel.lady.holderSeat
                    : null
                }
                ended={ended}
              />
            )}
          </ScrollView>
          <Button variant="secondary" size="lg" onPress={onClose} testID="avalon-history-close">
            关闭
          </Button>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  panel: {
    width: '100%',
    maxHeight: '90%',
    gap: spacing.small,
    padding: spacing.medium,
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.xlarge,
    borderTopRightRadius: borderRadius.xlarge,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.small,
  },
  title: {
    ...textStyles.subtitleSemibold,
    color: colors.text,
  },
  summary: {
    ...textStyles.caption,
    color: colors.textSecondary,
  },
  summarySuccess: {
    color: colors.primary,
    fontWeight: typography.weights.bold,
  },
  summaryFail: {
    color: colors.error,
    fontWeight: typography.weights.bold,
  },
  configLine: {
    ...textStyles.caption,
    color: colors.textSecondary,
  },
  tabRow: {
    flexDirection: 'row',
    gap: spacing.tight,
    padding: spacing.tight,
    backgroundColor: colors.surfaceHover,
    borderRadius: borderRadius.full,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.tight,
    paddingHorizontal: spacing.small,
    borderRadius: borderRadius.full,
  },
  tabActive: {
    backgroundColor: colors.surface,
    borderWidth: fixed.borderWidth,
    borderColor: colors.borderLight,
    ...shadows.sm,
  },
  tabText: {
    ...textStyles.secondary,
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.text,
    fontWeight: typography.weights.semibold,
  },
  scroll: {
    minHeight: 0,
  },
  scrollContent: {
    gap: spacing.small,
    paddingBottom: spacing.small,
  },
  emptyText: {
    ...textStyles.secondary,
    color: colors.textSecondary,
    padding: spacing.small,
  },
});
