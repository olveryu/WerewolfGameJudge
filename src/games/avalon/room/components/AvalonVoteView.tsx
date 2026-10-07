/**
 * 阿瓦隆组队投票：两张大卡片（浅色赞成 / 深色反对，D17），点另一张改票。
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import {
  type AvalonBallot,
  type AvalonViewModel,
} from '@game-judge/game-engine/games/avalon/public';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { borderRadius, colors, componentSizes, fixed, shadows, spacing, textStyles } from '@/theme';

import { formatAvalonRoundLabel, resolveVoteInstruction } from '../policy/avalonInteractionPolicy';
import { AvalonInfoCard, AvalonStageFrame } from './AvalonStageFrame';

const BALLOT_COPY: Readonly<Record<AvalonBallot, string>> = {
  approve: '赞成',
  reject: '反对',
};

function ballotName(viewModel: AvalonViewModel, seat: number): string {
  const entry = viewModel.seats.find((seatView) => seatView.seat === seat);
  const name = entry?.displayName ?? `座位${seat + 1}`;
  return `${seat + 1} 号 · ${name}`;
}

/** 投票视图：大卡片点选/改选，投票意图上报调用方。 */
export function AvalonVoteView({
  viewModel,
  onVote,
}: {
  readonly viewModel: AvalonViewModel;
  readonly onVote: (vote: AvalonBallot) => void;
}) {
  const instruction = resolveVoteInstruction(viewModel);
  const proposed = viewModel.proposedSeats ?? [];
  return (
    <AvalonStageFrame
      title={`${formatAvalonRoundLabel(viewModel.questResults.length + 1)} · 组队投票`}
      testID="avalon-vote"
    >
      <AvalonInfoCard title="待表决的队伍">
        {proposed.map((seat) => (
          <Text key={seat} style={styles.team} testID={`avalon-vote-team-${seat}`}>
            {ballotName(viewModel, seat)}
          </Text>
        ))}
      </AvalonInfoCard>
      {instruction.canVote ? (
        <View style={styles.cardsRow}>
          <TouchableOpacity
            style={[
              styles.card,
              styles.approveCard,
              instruction.myBallot === 'approve' && styles.cardSelected,
            ]}
            activeOpacity={fixed.activeOpacity}
            accessibilityRole="button"
            accessibilityLabel="赞成"
            accessibilityState={{ selected: instruction.myBallot === 'approve' }}
            testID="avalon-vote-approve"
            onPress={() => onVote('approve')}
          >
            <Ionicons
              name="checkmark-circle-outline"
              size={componentSizes.icon.xl}
              color={colors.success}
            />
            <Text style={styles.approveText}>赞成</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.card,
              styles.rejectCard,
              instruction.myBallot === 'reject' && styles.cardSelectedReject,
            ]}
            activeOpacity={fixed.activeOpacity}
            accessibilityRole="button"
            accessibilityLabel="反对"
            accessibilityState={{ selected: instruction.myBallot === 'reject' }}
            testID="avalon-vote-reject"
            onPress={() => onVote('reject')}
          >
            <Ionicons
              name="close-circle-outline"
              size={componentSizes.icon.xl}
              color={colors.textInverse}
            />
            <Text style={styles.rejectText}>反对</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {instruction.myBallot !== null ? (
        <Text style={styles.hint}>
          已投票（{BALLOT_COPY[instruction.myBallot]}
          ），可点另一张改票；等待他人投票，房主将结束投票。
        </Text>
      ) : instruction.canVote ? (
        <Text style={styles.hint}>请选择赞成或反对；投票后可改票。</Text>
      ) : (
        <Text style={styles.hint}>你不在座位上，无法投票。</Text>
      )}
    </AvalonStageFrame>
  );
}

const styles = StyleSheet.create({
  team: {
    ...textStyles.body,
    color: colors.text,
  },
  hint: {
    ...textStyles.secondary,
    color: colors.textSecondary,
  },
  cardsRow: {
    flexDirection: 'row',
    gap: spacing.small,
  },
  card: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.small,
    minHeight: 160,
    borderRadius: borderRadius.large,
    ...shadows.sm,
  },
  approveCard: {
    backgroundColor: colors.card,
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
  },
  rejectCard: {
    backgroundColor: colors.text,
  },
  cardSelected: {
    borderColor: colors.primary,
    borderWidth: fixed.borderWidthThick,
  },
  cardSelectedReject: {
    borderWidth: fixed.borderWidthThick,
    borderColor: colors.primaryLight,
  },
  approveText: {
    ...textStyles.titleBold,
    color: colors.text,
  },
  rejectText: {
    ...textStyles.titleBold,
    color: colors.textInverse,
  },
});
