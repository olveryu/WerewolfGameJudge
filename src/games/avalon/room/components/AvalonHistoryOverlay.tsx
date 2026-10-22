/**
 * 阿瓦隆对局记录：任务轨道与分轮 tab 在前，结论横幅居中，提案与表决
 * 时间线在后。只用座位号，不显示玩家名。
 *
 * 公投记个人票，暗投只记数量；任务出牌人不揭晓；未结算提案只露进度
 * 与本人的一票。浮层手动开关，不自动消失，终局保留。
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import {
  type AvalonBallot,
  type AvalonProposalRecordView,
  type AvalonRoundRecordView,
  type AvalonViewModel,
} from '@game-judge/game-engine/games/avalon/public';
import { type ComponentProps, Fragment, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Modal } from '@/components/AppModal';
import { Button } from '@/components/Button';
import {
  borderRadius,
  colors,
  componentSizes,
  fixed,
  shadows,
  spacing,
  textStyles,
  typography,
  withAlpha,
} from '@/theme';

import { formatAvalonQuestLabel } from '../policy/avalonInteractionPolicy';

const QUEST_TRACK_ROUNDS = [1, 2, 3, 4, 5] as const;

type IoniconName = ComponentProps<typeof Ionicons>['name'];
type QuestTrackState = 'success' | 'fail' | 'current' | 'upcoming';
type SeatBadgeVariant = 'leader' | 'team' | 'plain' | 'mini' | 'ballot';

function ballotLabel(ballot: AvalonBallot): string {
  return ballot === 'approve' ? '赞成' : '反对';
}

function SeatBadge({
  seat,
  variant = 'plain',
  testID,
}: {
  readonly seat: number;
  readonly variant?: SeatBadgeVariant;
  readonly testID?: string;
}) {
  const isLeader = variant === 'leader';
  return (
    <View
      style={[
        styles.seatBadge,
        variant === 'leader' ? styles.leaderSeatBadge : null,
        variant === 'team' ? styles.teamSeatBadge : null,
        variant === 'mini' || variant === 'ballot' ? styles.smallSeatBadge : null,
      ]}
      testID={testID}
      accessibilityLabel={isLeader ? `${seat + 1}号，组队者` : `${seat + 1}号`}
    >
      <Text
        style={[
          styles.seatBadgeText,
          variant === 'leader' ? styles.leaderSeatBadgeText : null,
          variant === 'team' ? styles.teamSeatBadgeText : null,
          variant === 'mini' || variant === 'ballot' ? styles.smallSeatBadgeText : null,
        ]}
      >
        {seat + 1}
      </Text>
      {isLeader ? (
        <View style={styles.leaderMarker}>
          <Ionicons name="flag" size={componentSizes.icon.xs} color={colors.warning} />
        </View>
      ) : null}
    </View>
  );
}

function BallotChips({
  ballots,
  testIDPrefix,
}: {
  readonly ballots: Readonly<Record<number, AvalonBallot>>;
  readonly testIDPrefix: string;
}) {
  const entries = Object.entries(ballots)
    .map(([seatText, ballot]) => ({ seat: Number(seatText), ballot }))
    .sort((left, right) => left.seat - right.seat);
  return (
    <View style={styles.ballotChips} accessibilityLabel="逐人投票">
      {entries.map(({ seat, ballot }) => (
        <View
          key={seat}
          style={styles.ballotChip}
          testID={`${testIDPrefix}-ballot-seat-${seat + 1}`}
          accessibilityLabel={`${seat + 1}号，${ballotLabel(ballot)}`}
        >
          <SeatBadge seat={seat} variant="ballot" />
          <Ionicons
            name={ballot === 'approve' ? 'checkmark' : 'close'}
            size={componentSizes.icon.xs}
            color={ballot === 'approve' ? colors.primary : colors.error}
          />
        </View>
      ))}
    </View>
  );
}

function VoteRatioBar({ proposal }: { readonly proposal: AvalonProposalRecordView }) {
  const totalCount = proposal.approveCount + proposal.rejectCount + proposal.abstainCount;
  return (
    <>
      <View style={styles.voteBar} accessibilityLabel="表决比例">
        {proposal.approveCount > 0 ? (
          <View
            style={[
              styles.voteBarSegment,
              styles.voteBarApproveSegment,
              { flexGrow: proposal.approveCount },
            ]}
          />
        ) : null}
        {proposal.rejectCount > 0 ? (
          <View
            style={[
              styles.voteBarSegment,
              styles.voteBarRejectSegment,
              { flexGrow: proposal.rejectCount },
            ]}
          />
        ) : null}
        {proposal.abstainCount > 0 ? (
          <View
            style={[
              styles.voteBarSegment,
              styles.voteBarAbstainSegment,
              { flexGrow: proposal.abstainCount },
            ]}
          />
        ) : null}
        {totalCount === 0 ? <View style={styles.voteBarSegment} /> : null}
      </View>
      <View style={styles.voteCountRow}>
        <Text style={styles.voteCount}>
          赞成 <Text style={styles.voteCountValue}>{proposal.approveCount}</Text>
        </Text>
        {proposal.abstainCount > 0 ? (
          <Text style={styles.voteCount}>
            弃权 <Text style={styles.voteCountValue}>{proposal.abstainCount}</Text>
          </Text>
        ) : null}
        <Text style={styles.voteCount}>
          反对 <Text style={styles.voteCountValue}>{proposal.rejectCount}</Text>
        </Text>
      </View>
    </>
  );
}

function ProposerRow({
  proposal,
  index,
  badge,
  testIDPrefix,
}: {
  readonly proposal: AvalonProposalRecordView;
  readonly index: number;
  readonly badge: string;
  readonly testIDPrefix: string;
}) {
  return (
    <View style={styles.proposerRow}>
      <SeatBadge
        seat={proposal.leaderSeat}
        variant="leader"
        testID={`${testIDPrefix}-leader-seat-${proposal.leaderSeat + 1}`}
      />
      <Text style={styles.proposerText}>
        <Text style={styles.proposerSeat}>{proposal.leaderSeat + 1} 号</Text>
        <Text style={styles.proposerMeta}> · 组队者 · 第 {index + 1} 次提议</Text>
      </Text>
      <View style={styles.adoptedBadge}>
        <Text style={styles.adoptedBadgeText}>{badge}</Text>
      </View>
    </View>
  );
}

/** 已结算提案：被采用者完整展开；被否决者默认只保留一行摘要。 */
function AvalonProposalBlock({
  round,
  proposal,
  index,
}: {
  readonly round: number;
  readonly proposal: AvalonProposalRecordView;
  readonly index: number;
}) {
  const [isExpanded, setExpanded] = useState(false);
  const testIDPrefix = `avalon-history-proposal-${round}-${index + 1}`;

  if (proposal.approved) {
    return (
      <View style={styles.adoptedProposal} testID={testIDPrefix}>
        <ProposerRow
          proposal={proposal}
          index={index}
          badge="通过 · 采用"
          testIDPrefix={testIDPrefix}
        />
        <View style={styles.teamRow} testID={`${testIDPrefix}-team`}>
          <Text style={styles.teamLabel}>队伍</Text>
          {proposal.teamSeats.map((seat) => (
            <SeatBadge
              key={seat}
              seat={seat}
              variant="team"
              testID={`${testIDPrefix}-team-seat-${seat + 1}`}
            />
          ))}
        </View>
        <VoteRatioBar proposal={proposal} />
        {proposal.ballots === null ? (
          <Text style={styles.secretNote}>暗投模式不公布逐人票</Text>
        ) : (
          <BallotChips ballots={proposal.ballots} testIDPrefix={testIDPrefix} />
        )}
      </View>
    );
  }

  return (
    <View style={styles.rejectedProposal} testID={testIDPrefix}>
      <TouchableOpacity
        style={styles.rejectedHeader}
        activeOpacity={fixed.activeOpacity}
        accessibilityRole="button"
        accessibilityLabel={`展开第${index + 1}次提案的逐人票`}
        accessibilityState={{ expanded: isExpanded }}
        testID={`${testIDPrefix}-toggle`}
        onPress={() => setExpanded((current) => !current)}
      >
        <SeatBadge
          seat={proposal.leaderSeat}
          variant="leader"
          testID={`${testIDPrefix}-leader-seat-${proposal.leaderSeat + 1}`}
        />
        <View style={styles.rejectedSummary}>
          <Text style={styles.rejectedTitle}>
            {proposal.leaderSeat + 1} 号 · 组队者 · 第 {index + 1} 次提议
          </Text>
          <View style={styles.rejectedMeta}>
            <View style={styles.miniTeam} testID={`${testIDPrefix}-team`}>
              {proposal.teamSeats.map((seat) => (
                <SeatBadge
                  key={seat}
                  seat={seat}
                  variant="mini"
                  testID={`${testIDPrefix}-team-seat-${seat + 1}`}
                />
              ))}
            </View>
            <Text style={styles.voteSummary}>
              赞成 {proposal.approveCount} · 反对 {proposal.rejectCount}
              {proposal.abstainCount > 0 ? ` · 弃权 ${proposal.abstainCount}` : ''}
            </Text>
          </View>
        </View>
        <View style={styles.rejectedBadge}>
          <Text style={styles.rejectedBadgeText}>否决</Text>
        </View>
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={componentSizes.icon.sm}
          color={colors.textSecondary}
        />
      </TouchableOpacity>
      {isExpanded ? (
        <View style={styles.rejectedDetails}>
          {proposal.ballots === null ? (
            <Text style={styles.secretNote}>暗投模式不公布逐人票</Text>
          ) : (
            <BallotChips ballots={proposal.ballots} testIDPrefix={testIDPrefix} />
          )}
        </View>
      ) : null}
    </View>
  );
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

function AvalonQuestBanner({ record }: { readonly record: AvalonRoundRecordView }) {
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
      testID={`avalon-history-banner-${record.round}`}
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

/** 一轮记录：结论横幅在前，提案与表决时间线在后。 */
function AvalonHistoryRound({ record }: { readonly record: AvalonRoundRecordView }) {
  const currentProposal = record.currentProposal;
  return (
    <View style={styles.round} testID={`avalon-history-round-${record.round}`}>
      <AvalonQuestBanner record={record} />
      {record.proposals.length > 0 || currentProposal !== null ? (
        <Text style={styles.sectionTitle}>提案与表决</Text>
      ) : null}
      <View style={styles.timeline}>
        {record.proposals.map((proposal, index) => (
          <AvalonProposalBlock
            key={`${record.round}-${index}`}
            round={record.round}
            proposal={proposal}
            index={index}
          />
        ))}
        {currentProposal !== null ? (
          <View
            style={styles.currentProposal}
            testID={`avalon-history-current-proposal-${record.round}`}
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
    </View>
  );
}

function trackStateLabel(state: QuestTrackState): string {
  switch (state) {
    case 'success':
      return '成功';
    case 'fail':
      return '失败';
    case 'current':
      return '进行中';
    case 'upcoming':
      return '未开始';
  }
}

function AvalonQuestTrack({
  rounds,
  questResults,
  currentRound,
  activeRound,
}: {
  readonly rounds: readonly AvalonRoundRecordView[];
  readonly questResults: AvalonViewModel['questResults'];
  readonly currentRound: number | undefined;
  readonly activeRound: number | undefined;
}) {
  const recordByRound = new Map(rounds.map((record) => [record.round, record]));
  return (
    <View style={styles.track} testID="avalon-history-track">
      {QUEST_TRACK_ROUNDS.map((round, index) => {
        const record = recordByRound.get(round);
        const result = record?.quest?.result ?? questResults[round - 1];
        const state: QuestTrackState =
          result === 'success'
            ? 'success'
            : result === 'fail' || record?.vetoEnded === true
              ? 'fail'
              : round === currentRound
                ? 'current'
                : 'upcoming';
        return (
          <Fragment key={round}>
            <View style={styles.trackNode}>
              <View
                style={[
                  styles.trackDot,
                  state === 'success' ? styles.trackDotSuccess : null,
                  state === 'fail' ? styles.trackDotFail : null,
                  state === 'current' ? styles.trackDotCurrent : null,
                ]}
                testID={`avalon-history-track-round-${round}`}
                accessibilityLabel={`${formatAvalonQuestLabel(round)}，${trackStateLabel(state)}`}
              >
                {state === 'success' || state === 'fail' ? (
                  <Ionicons
                    name={state === 'success' ? 'checkmark' : 'close'}
                    size={componentSizes.icon.sm}
                    color={colors.textInverse}
                  />
                ) : (
                  <Text
                    style={[
                      styles.trackDotText,
                      state === 'current' ? styles.trackDotCurrentText : null,
                    ]}
                  >
                    {round}
                  </Text>
                )}
              </View>
              <Text
                style={[
                  styles.trackLabel,
                  round === activeRound ? styles.trackLabelActive : null,
                  state === 'current' ? styles.trackLabelCurrent : null,
                ]}
              >
                {formatAvalonQuestLabel(round)}
              </Text>
            </View>
            {index < QUEST_TRACK_ROUNDS.length - 1 ? (
              <View
                style={[
                  styles.trackLink,
                  state === 'success' || state === 'fail' ? styles.trackLinkDone : null,
                ]}
              />
            ) : null}
          </Fragment>
        );
      })}
    </View>
  );
}

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
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  // 每次打开回到默认 tab（当前轮）。
  useEffect(() => {
    if (visible) setSelectedRound(null);
  }, [visible]);
  const active =
    rounds.find((record) => record.round === selectedRound) ?? rounds[rounds.length - 1];
  const latestRecord = rounds[rounds.length - 1];
  const currentRound =
    latestRecord !== undefined && latestRecord.quest === null && !latestRecord.vetoEnded
      ? latestRecord.round
      : undefined;
  const successCount = viewModel.questResults.filter((result) => result === 'success').length;
  const failCount = viewModel.questResults.filter((result) => result === 'fail').length;
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
          <AvalonQuestTrack
            rounds={rounds}
            questResults={viewModel.questResults}
            currentRound={currentRound}
            activeRound={active?.round}
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
              <AvalonHistoryRound key={active.round} record={active} />
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
  track: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.tight,
  },
  trackNode: {
    width: componentSizes.avatar.md,
    alignItems: 'center',
    gap: spacing.tight,
  },
  trackDot: {
    width: componentSizes.avatar.sm,
    height: componentSizes.avatar.sm,
    borderRadius: borderRadius.full,
    borderWidth: fixed.borderWidthThick,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackDotSuccess: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  trackDotFail: {
    borderColor: colors.error,
    backgroundColor: colors.error,
  },
  trackDotCurrent: {
    borderColor: colors.primary,
  },
  trackDotText: {
    ...textStyles.secondarySemibold,
    color: colors.textMuted,
  },
  trackDotCurrentText: {
    color: colors.primary,
  },
  trackLabel: {
    ...textStyles.captionSmall,
    color: colors.textMuted,
    textAlign: 'center',
  },
  trackLabelActive: {
    color: colors.text,
    fontWeight: typography.weights.semibold,
  },
  trackLabelCurrent: {
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
  trackLink: {
    flex: 1,
    height: fixed.borderWidthThick,
    borderRadius: borderRadius.full,
    backgroundColor: colors.borderLight,
    marginTop: spacing.medium,
  },
  trackLinkDone: {
    backgroundColor: withAlpha(colors.primary, 0.55),
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
  adoptedProposal: {
    gap: spacing.small,
    padding: spacing.small,
    backgroundColor: colors.surface,
    borderWidth: fixed.borderWidthThick,
    borderColor: colors.primary,
    borderRadius: borderRadius.medium,
    ...shadows.sm,
  },
  proposerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
  },
  proposerText: {
    flex: 1,
    minWidth: 0,
    ...textStyles.secondary,
  },
  proposerSeat: {
    color: colors.text,
    fontWeight: typography.weights.bold,
  },
  proposerMeta: {
    color: colors.textSecondary,
  },
  adoptedBadge: {
    paddingVertical: spacing.tight,
    paddingHorizontal: spacing.small,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    flexShrink: 0,
  },
  adoptedBadgeText: {
    ...textStyles.caption,
    color: colors.textInverse,
    fontWeight: typography.weights.bold,
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.tight,
  },
  teamLabel: {
    width: componentSizes.avatar.sm,
    ...textStyles.caption,
    color: colors.textSecondary,
  },
  seatBadge: {
    width: componentSizes.avatar.xs,
    height: componentSizes.avatar.xs,
    borderRadius: borderRadius.full,
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
    backgroundColor: colors.surfaceHover,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  leaderSeatBadge: {
    width: componentSizes.avatar.sm,
    height: componentSizes.avatar.sm,
    borderColor: colors.primary,
    backgroundColor: withAlpha(colors.primary, 0.12),
  },
  teamSeatBadge: {
    width: componentSizes.avatar.sm,
    height: componentSizes.avatar.sm,
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  smallSeatBadge: {
    width: componentSizes.badge.md,
    height: componentSizes.badge.md,
  },
  seatBadgeText: {
    ...textStyles.caption,
    color: colors.text,
    fontWeight: typography.weights.semibold,
  },
  leaderSeatBadgeText: {
    color: colors.primary,
  },
  teamSeatBadgeText: {
    color: colors.textInverse,
  },
  smallSeatBadgeText: {
    ...textStyles.captionSmall,
  },
  leaderMarker: {
    position: 'absolute',
    top: -spacing.small,
    right: -spacing.tight,
    width: componentSizes.badge.sm,
    height: componentSizes.badge.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voteBar: {
    flexDirection: 'row',
    height: spacing.small,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    backgroundColor: withAlpha(colors.error, 0.12),
  },
  voteBarSegment: {
    flexBasis: 0,
  },
  voteBarApproveSegment: {
    backgroundColor: colors.primary,
  },
  voteBarRejectSegment: {
    backgroundColor: colors.error,
  },
  voteBarAbstainSegment: {
    backgroundColor: colors.border,
  },
  voteCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.small,
  },
  voteCount: {
    ...textStyles.caption,
    color: colors.textSecondary,
  },
  voteCountValue: {
    color: colors.text,
    fontWeight: typography.weights.bold,
  },
  ballotChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.tight,
  },
  ballotChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.tight,
    paddingVertical: spacing.micro,
    paddingRight: spacing.small,
    paddingLeft: spacing.micro,
    borderWidth: fixed.borderWidth,
    borderColor: colors.borderLight,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
  },
  secretNote: {
    ...textStyles.caption,
    color: colors.textSecondary,
  },
  rejectedProposal: {
    borderWidth: fixed.borderWidth,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: borderRadius.medium,
    backgroundColor: withAlpha(colors.text, 0.03),
  },
  rejectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
    padding: spacing.small,
  },
  rejectedSummary: {
    flex: 1,
    minWidth: 0,
    gap: spacing.tight,
  },
  rejectedTitle: {
    ...textStyles.secondary,
    color: colors.text,
  },
  rejectedMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.small,
  },
  miniTeam: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.micro,
  },
  voteSummary: {
    ...textStyles.caption,
    color: colors.textSecondary,
  },
  rejectedBadge: {
    paddingVertical: spacing.micro,
    paddingHorizontal: spacing.small,
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
    borderRadius: borderRadius.full,
    flexShrink: 0,
  },
  rejectedBadgeText: {
    ...textStyles.caption,
    color: colors.textSecondary,
    fontWeight: typography.weights.semibold,
  },
  rejectedDetails: {
    paddingHorizontal: spacing.small,
    paddingBottom: spacing.small,
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
  emptyText: {
    ...textStyles.secondary,
    color: colors.textSecondary,
    padding: spacing.small,
  },
});
