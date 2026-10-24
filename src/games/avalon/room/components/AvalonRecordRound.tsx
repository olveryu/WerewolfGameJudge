/**
 * 阿瓦隆记录共享件：一轮记录（结论横幅 + 提案时间线 + 湖仙节）。
 *
 * 从 AvalonHistoryOverlay 整段搬出，记录浮层与本局复盘共用同一份实现。
 * 横幅状态由本件统一推导：已结算轮给成功 / 失败；否决终局轮给组队失败；
 * 终局时仍在记录里的未结算轮给“未完成（提前刺杀打断）”，不许再写成
 * “组队投票中”——6532 的任务三就是被这句误导成“进行中”。
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import type {
  AvalonBallot,
  AvalonLadyCheckRecordView,
  AvalonRoundRecordView,
} from '@game-judge/game-engine/games/avalon/public';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  borderRadius,
  colors,
  componentSizes,
  fixed,
  spacing,
  textStyles,
  typography,
  withAlpha,
} from '@/theme';

import { formatAvalonQuestLabel } from '../policy/avalonInteractionPolicy';
import { AvalonRecordLakeSection } from './AvalonRecordLakeSection';
import { AvalonRecordProposal } from './AvalonRecordProposal';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

function ballotLabel(ballot: AvalonBallot): string {
  return ballot === 'approve' ? '赞成' : '反对';
}

function QuestCard({
  label,
  count,
  kind,
}: {
  readonly label: string;
  readonly count: number;
  readonly kind: 'success' | 'fail';
}) {
  const isSuccess = kind === 'success';
  return (
    <View
      style={[
        styles.questCard,
        isSuccess ? styles.questCardSuccess : styles.questCardFail,
        count === 0 ? styles.questCardEmpty : null,
      ]}
      accessibilityLabel={`${label} ${count} 张`}
    >
      <Text
        style={[
          styles.questCardCount,
          isSuccess ? styles.questCardSuccessCount : styles.questCardFailCount,
          count === 0 ? styles.questCardEmptyCount : null,
        ]}
      >
        ×{count}
      </Text>
      <Text style={styles.questCardLabel}>{label}</Text>
    </View>
  );
}

function AvalonQuestBanner({
  record,
  ended,
  testIDPrefix,
}: {
  readonly record: AvalonRoundRecordView;
  readonly ended: boolean;
  readonly testIDPrefix: string;
}) {
  const questLabel = formatAvalonQuestLabel(record.round);
  let icon: IoniconName = 'people-outline';
  let title = `${questLabel} · 组队投票中`;
  let subtitle =
    record.currentProposal !== null
      ? `第${record.proposals.length + 1}次提案进行中`
      : `第${record.proposals.length + 1}次提案组队中`;
  let toneStyle = styles.bannerActive;
  let medalStyle = styles.bannerActiveMedal;

  if (record.quest !== null) {
    const isSuccess = record.quest.result === 'success';
    icon = isSuccess ? 'checkmark' : 'close';
    title = `${questLabel} · ${isSuccess ? '成功' : '失败'}`;
    subtitle = '任务出牌结果（出牌人不公开）';
    toneStyle = isSuccess ? styles.bannerSuccess : styles.bannerFail;
    medalStyle = isSuccess ? styles.bannerSuccessMedal : styles.bannerFailMedal;
  } else if (record.vetoEnded) {
    icon = 'close';
    title = '组队失败';
    subtitle = `${record.proposals.length} 次否决达上限，本轮无任务`;
    toneStyle = styles.bannerFail;
    medalStyle = styles.bannerFailMedal;
  } else if (ended) {
    // 否决终局轮已在上一分支处理；走到这里的终局未结算轮只能是被刺杀打断。
    icon = 'close';
    title = `${questLabel} · 未完成`;
    subtitle = '提前刺杀打断，无结算结果';
    toneStyle = styles.bannerActive;
    medalStyle = styles.bannerActiveMedal;
  } else if (record.questProgress !== null) {
    icon = 'hourglass-outline';
    title = `${questLabel} · 任务执行中`;
    subtitle = `已出牌 ${record.questProgress.playedCount}/${record.questProgress.teamSize}`;
    toneStyle = styles.bannerActive;
    medalStyle = styles.bannerActiveMedal;
  }

  return (
    <View
      style={[styles.banner, toneStyle]}
      testID={`${testIDPrefix}-banner-${record.round}`}
      accessibilityLabel={`${title}。${subtitle}`}
    >
      <View style={[styles.bannerMedal, medalStyle]}>
        <Ionicons name={icon} size={componentSizes.icon.md} color={colors.textInverse} />
      </View>
      <View style={styles.bannerCopy}>
        <Text style={styles.bannerTitle}>{title}</Text>
        <Text style={styles.bannerSubtitle}>{subtitle}</Text>
      </View>
      {record.quest !== null ? (
        <View style={styles.questCards}>
          <QuestCard label="成功牌" count={record.quest.successCount} kind="success" />
          <QuestCard label="失败牌" count={record.quest.failCount} kind="fail" />
        </View>
      ) : null}
    </View>
  );
}

/** 一轮记录：结论横幅在前，提案与表决时间线在后，湖仙节在末。 */
export function AvalonRecordRound({
  record,
  completedLadyCheck,
  inProgressLadyHolderSeat,
  ended,
  testIDPrefix,
}: {
  readonly record: AvalonRoundRecordView;
  readonly completedLadyCheck: AvalonLadyCheckRecordView | null;
  readonly inProgressLadyHolderSeat: number | null;
  readonly ended: boolean;
  readonly testIDPrefix?: string;
}) {
  const prefix = testIDPrefix ?? 'avalon-history';
  const currentProposal = record.currentProposal;
  return (
    <View style={styles.round} testID={`${prefix}-round-${record.round}`}>
      <AvalonQuestBanner record={record} ended={ended} testIDPrefix={prefix} />
      {record.proposals.length > 0 || currentProposal !== null ? (
        <Text style={styles.sectionTitle}>提案与表决</Text>
      ) : null}
      <View style={styles.timeline}>
        {record.proposals.map((proposal, index) => (
          <AvalonRecordProposal
            key={`${record.round}-${index}`}
            round={record.round}
            proposal={proposal}
            index={index}
            testIDPrefix={`${prefix}-proposal-${record.round}-${index + 1}`}
          />
        ))}
        {currentProposal !== null ? (
          <View
            style={styles.currentProposal}
            testID={`${prefix}-current-proposal-${record.round}`}
          >
            <View style={styles.currentProposalHeader}>
              <Ionicons
                name="hourglass-outline"
                size={componentSizes.icon.sm}
                color={colors.primary}
              />
              <Text style={styles.currentProposalText}>
                第{record.proposals.length + 1}次提案 · 进行中（已投 {currentProposal.castCount}/
                {currentProposal.totalCount}）
              </Text>
            </View>
            {currentProposal.myBallot !== null ? (
              <Text style={styles.currentProposalBallot}>
                你投了：{ballotLabel(currentProposal.myBallot)}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
      <AvalonRecordLakeSection
        afterRound={record.round}
        record={record}
        completed={completedLadyCheck}
        inProgressHolderSeat={inProgressLadyHolderSeat}
        ended={ended}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  round: {
    gap: spacing.small,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
    padding: spacing.small,
    borderRadius: borderRadius.medium,
  },
  bannerSuccess: {
    backgroundColor: withAlpha(colors.primary, 0.12),
  },
  bannerFail: {
    backgroundColor: withAlpha(colors.error, 0.1),
  },
  bannerActive: {
    backgroundColor: withAlpha(colors.primary, 0.08),
  },
  bannerMedal: {
    width: componentSizes.button.md,
    height: componentSizes.button.md,
    borderRadius: borderRadius.medium,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  bannerSuccessMedal: {
    backgroundColor: colors.primary,
  },
  bannerFailMedal: {
    backgroundColor: colors.error,
  },
  bannerActiveMedal: {
    backgroundColor: colors.primary,
  },
  bannerCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.micro,
  },
  bannerTitle: {
    ...textStyles.bodySemibold,
    color: colors.text,
  },
  bannerSubtitle: {
    ...textStyles.caption,
    color: colors.textSecondary,
  },
  questCards: {
    flexDirection: 'row',
    gap: spacing.tight,
    flexShrink: 0,
  },
  questCard: {
    width: componentSizes.button.md,
    minHeight: componentSizes.button.md,
    paddingVertical: spacing.tight,
    paddingHorizontal: spacing.tight,
    borderWidth: fixed.borderWidth,
    borderRadius: borderRadius.small,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  questCardSuccess: {
    borderColor: colors.primary,
  },
  questCardFail: {
    borderColor: colors.error,
  },
  questCardEmpty: {
    borderColor: colors.border,
    opacity: fixed.disabledOpacity,
  },
  questCardCount: {
    ...textStyles.bodySemibold,
    lineHeight: typography.lineHeights.secondary,
  },
  questCardSuccessCount: {
    color: colors.primary,
  },
  questCardFailCount: {
    color: colors.error,
  },
  questCardEmptyCount: {
    color: colors.textMuted,
  },
  questCardLabel: {
    ...textStyles.captionSmall,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  sectionTitle: {
    ...textStyles.caption,
    color: colors.textSecondary,
    fontWeight: typography.weights.semibold,
    letterSpacing: typography.letterSpacing.wide,
    marginTop: spacing.tight,
    paddingHorizontal: spacing.tight,
  },
  timeline: {
    gap: spacing.small,
  },
  currentProposal: {
    gap: spacing.tight,
    padding: spacing.small,
    borderWidth: fixed.borderWidth,
    borderColor: withAlpha(colors.primary, 0.4),
    borderRadius: borderRadius.medium,
    backgroundColor: withAlpha(colors.primary, 0.06),
  },
  currentProposalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
  },
  currentProposalText: {
    flex: 1,
    ...textStyles.secondary,
    color: colors.text,
  },
  currentProposalBallot: {
    ...textStyles.caption,
    color: colors.textSecondary,
    paddingLeft: componentSizes.icon.sm + spacing.small,
  },
});
