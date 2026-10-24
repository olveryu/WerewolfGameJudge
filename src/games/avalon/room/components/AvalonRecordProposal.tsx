/**
 * 阿瓦隆记录共享件：已结算提案块。
 *
 * 从 AvalonHistoryOverlay 整段搬出，记录浮层与本局复盘共用同一份实现，
 * 不许另写第二份提案渲染。暗投时 ballots 为 null：被采用卡直接给静态
 * 说明；被否决行不渲染“展开逐人票”切换（展开也只能看到同一句说明，
 * 切换本身就是误导），直接给静态说明。
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import type {
  AvalonBallot,
  AvalonProposalRecordView,
} from '@game-judge/game-engine/games/avalon/public';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { SeatDot } from '@/components/SeatDot';
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

function ballotLabel(ballot: AvalonBallot): string {
  return ballot === 'approve' ? '赞成' : '反对';
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
          <SeatDot seat={seat} size="sm" />
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
      <SeatDot
        seat={proposal.leaderSeat}
        emphasis="leader"
        stateLabel="组队者"
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
export function AvalonRecordProposal({
  round,
  proposal,
  index,
  testIDPrefix,
}: {
  readonly round: number;
  readonly proposal: AvalonProposalRecordView;
  readonly index: number;
  readonly testIDPrefix?: string;
}) {
  const [isExpanded, setExpanded] = useState(false);
  const prefix = testIDPrefix ?? `avalon-history-proposal-${round}-${index + 1}`;

  if (proposal.approved) {
    return (
      <View style={styles.adoptedProposal} testID={prefix}>
        <ProposerRow proposal={proposal} index={index} badge="通过 · 采用" testIDPrefix={prefix} />
        <View style={styles.teamRow} testID={`${prefix}-team`}>
          <Text style={styles.teamLabel}>队伍</Text>
          {proposal.teamSeats.map((seat) => (
            <SeatDot
              key={seat}
              seat={seat}
              emphasis="filled"
              testID={`${prefix}-team-seat-${seat + 1}`}
            />
          ))}
        </View>
        <VoteRatioBar proposal={proposal} />
        {proposal.ballots === null ? (
          <Text style={styles.secretNote}>暗投模式不公布逐人票</Text>
        ) : (
          <BallotChips ballots={proposal.ballots} testIDPrefix={prefix} />
        )}
      </View>
    );
  }

  // 暗投被否决：没有可展开的逐人票，不渲染切换，只给静态说明。
  if (proposal.ballots === null) {
    return (
      <View style={styles.rejectedProposal} testID={prefix}>
        <View style={styles.rejectedHeader}>
          <SeatDot
            seat={proposal.leaderSeat}
            emphasis="leader"
            stateLabel="组队者"
            testID={`${prefix}-leader-seat-${proposal.leaderSeat + 1}`}
          />
          <View style={styles.rejectedSummary}>
            <Text style={styles.rejectedTitle}>
              {proposal.leaderSeat + 1} 号 · 组队者 · 第 {index + 1} 次提议
            </Text>
            <View style={styles.rejectedMeta}>
              <View style={styles.miniTeam} testID={`${prefix}-team`}>
                {proposal.teamSeats.map((seat) => (
                  <SeatDot
                    key={seat}
                    seat={seat}
                    size="sm"
                    testID={`${prefix}-team-seat-${seat + 1}`}
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
        </View>
        <View style={styles.rejectedDetails}>
          <Text style={styles.secretNote}>暗投模式不公布逐人票</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.rejectedProposal} testID={prefix}>
      <TouchableOpacity
        style={styles.rejectedHeader}
        activeOpacity={fixed.activeOpacity}
        accessibilityRole="button"
        accessibilityLabel={`展开第${index + 1}次提案的逐人票`}
        accessibilityState={{ expanded: isExpanded }}
        testID={`${prefix}-toggle`}
        onPress={() => setExpanded((current) => !current)}
      >
        <SeatDot
          seat={proposal.leaderSeat}
          emphasis="leader"
          stateLabel="组队者"
          testID={`${prefix}-leader-seat-${proposal.leaderSeat + 1}`}
        />
        <View style={styles.rejectedSummary}>
          <Text style={styles.rejectedTitle}>
            {proposal.leaderSeat + 1} 号 · 组队者 · 第 {index + 1} 次提议
          </Text>
          <View style={styles.rejectedMeta}>
            <View style={styles.miniTeam} testID={`${prefix}-team`}>
              {proposal.teamSeats.map((seat) => (
                <SeatDot
                  key={seat}
                  seat={seat}
                  size="sm"
                  testID={`${prefix}-team-seat-${seat + 1}`}
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
          <BallotChips ballots={proposal.ballots} testIDPrefix={prefix} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
});
