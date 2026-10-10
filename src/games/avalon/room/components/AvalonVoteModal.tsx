/**
 * 阿瓦隆组队投票弹窗：轮到投票时自动弹出一次，可关（去看座位盘），
 * 阶段条有重开入口。全员投完后显示揭晓倒计时（引擎武装的 deadlineAt）。
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import {
  type AvalonBallot,
  type AvalonViewModel,
} from '@game-judge/game-engine/games/avalon/public';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
} from '@/theme';

import { formatAvalonRoundLabel, resolveVoteInstruction } from '../policy/avalonInteractionPolicy';

const BALLOT_COPY: Readonly<Record<AvalonBallot, string>> = {
  approve: '赞成',
  reject: '反对',
};

function seatName(viewModel: AvalonViewModel, seat: number): string {
  const entry = viewModel.seats.find((seatView) => seatView.seat === seat);
  return `${seat + 1} 号 · ${entry?.displayName ?? `座位${seat + 1}`}`;
}

/** 投票弹窗：大卡片点选/改票，意图上报调用方；提交中禁用防重复提交。 */
export function AvalonVoteModal({
  viewModel,
  remainingSeconds,
  isSubmitting,
  onVote,
  onClose,
}: {
  readonly viewModel: AvalonViewModel;
  readonly remainingSeconds: number | null;
  readonly isSubmitting: boolean;
  readonly onVote: (vote: AvalonBallot) => void;
  readonly onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const instruction = resolveVoteInstruction(viewModel);
  const proposed = viewModel.proposedSeats ?? [];
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View
          style={[styles.panel, { paddingBottom: Math.max(insets.bottom, spacing.medium) }]}
          testID="avalon-vote-modal"
        >
          <Text style={styles.title}>
            {formatAvalonRoundLabel(viewModel.questResults.length + 1)} · 组队投票
          </Text>
          <View style={styles.teamBox}>
            <Text style={styles.teamTitle}>待表决的队伍</Text>
            {proposed.map((seat) => (
              <Text key={seat} style={styles.team} testID={`avalon-vote-team-${seat}`}>
                {seatName(viewModel, seat)}
              </Text>
            ))}
          </View>
          {remainingSeconds !== null ? (
            <Text style={styles.countdown} testID="avalon-vote-countdown">
              已全部投票，{remainingSeconds} 秒后揭晓
            </Text>
          ) : null}
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
                accessibilityState={{
                  selected: instruction.myBallot === 'approve',
                  disabled: isSubmitting,
                }}
                disabled={isSubmitting}
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
                accessibilityState={{
                  selected: instruction.myBallot === 'reject',
                  disabled: isSubmitting,
                }}
                disabled={isSubmitting}
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
              已投票（{BALLOT_COPY[instruction.myBallot]}），揭晓前可点另一张改票。
            </Text>
          ) : instruction.canVote ? (
            <Text style={styles.hint}>请选择赞成或反对；揭晓前可改票。</Text>
          ) : (
            <Text style={styles.hint}>你不在座位上，无法投票。</Text>
          )}
          <Button variant="secondary" size="lg" onPress={onClose} testID="avalon-vote-close">
            关闭
          </Button>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.overlay,
  },
  panel: {
    width: '85%',
    gap: spacing.medium,
    padding: spacing.large,
    borderRadius: borderRadius.large,
    backgroundColor: colors.card,
    ...shadows.md,
  },
  title: {
    ...textStyles.titleBold,
    color: colors.text,
    textAlign: 'center',
  },
  teamBox: {
    gap: spacing.tight,
  },
  teamTitle: {
    ...textStyles.secondary,
    color: colors.textSecondary,
  },
  team: {
    ...textStyles.body,
    color: colors.text,
  },
  countdown: {
    ...textStyles.body,
    fontWeight: typography.weights.bold,
    color: colors.primary,
    textAlign: 'center',
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
  hint: {
    ...textStyles.secondary,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
