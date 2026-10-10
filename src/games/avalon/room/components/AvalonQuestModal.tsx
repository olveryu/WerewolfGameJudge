/**
 * 阿瓦隆任务出牌弹窗：队员在任务阶段自动弹出一次，可关（去看座位盘），
 * 阶段条有重开入口。全员出完后显示揭晓倒计时（引擎武装的 deadlineAt）。
 * 出牌内容秘密：弹窗只显示自己的选择。
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import { type AvalonPlay, type AvalonViewModel } from '@game-judge/game-engine/games/avalon/public';
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

import { formatAvalonRoundLabel, resolveQuestInstruction } from '../policy/avalonInteractionPolicy';

const PLAY_COPY: Readonly<Record<AvalonPlay, string>> = {
  success: '成功',
  fail: '失败',
};

function seatName(viewModel: AvalonViewModel, seat: number): string {
  const entry = viewModel.seats.find((seatView) => seatView.seat === seat);
  return `${seat + 1} 号 · ${entry?.displayName ?? `座位${seat + 1}`}`;
}

/** 出牌弹窗：秘密点选/改牌，意图上报调用方；提交中禁用防重复提交。 */
export function AvalonQuestModal({
  viewModel,
  remainingSeconds,
  isSubmitting,
  onPlay,
  onClose,
}: {
  readonly viewModel: AvalonViewModel;
  readonly remainingSeconds: number | null;
  readonly isSubmitting: boolean;
  readonly onPlay: (play: AvalonPlay) => void;
  readonly onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const instruction = resolveQuestInstruction(viewModel);
  const teamSeats = viewModel.teamSeats ?? [];
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View
          style={[styles.panel, { paddingBottom: Math.max(insets.bottom, spacing.medium) }]}
          testID="avalon-quest-modal"
        >
          <Text style={styles.title}>
            {formatAvalonRoundLabel(viewModel.questResults.length + 1)} · 任务执行
          </Text>
          <View style={styles.teamBox}>
            <Text style={styles.teamTitle}>本轮队员</Text>
            {teamSeats.map((seat) => (
              <Text key={seat} style={styles.team}>
                {seatName(viewModel, seat)}
              </Text>
            ))}
          </View>
          {remainingSeconds !== null ? (
            <Text style={styles.countdown} testID="avalon-quest-countdown">
              已全部出牌，{remainingSeconds} 秒后揭晓
            </Text>
          ) : null}
          {instruction.isTeamMember ? (
            <View style={styles.cardsRow}>
              {instruction.availableCards.includes('success') ? (
                <TouchableOpacity
                  style={[
                    styles.card,
                    styles.successCard,
                    instruction.myPlay === 'success' && styles.cardSelected,
                  ]}
                  activeOpacity={fixed.activeOpacity}
                  accessibilityRole="button"
                  accessibilityLabel="成功"
                  accessibilityState={{
                    selected: instruction.myPlay === 'success',
                    disabled: isSubmitting,
                  }}
                  disabled={isSubmitting}
                  testID="avalon-quest-success"
                  onPress={() => onPlay('success')}
                >
                  <Ionicons
                    name="trophy-outline"
                    size={componentSizes.icon.xl}
                    color={colors.textInverse}
                  />
                  <Text style={styles.cardText}>成功</Text>
                </TouchableOpacity>
              ) : null}
              {instruction.availableCards.includes('fail') ? (
                <TouchableOpacity
                  style={[
                    styles.card,
                    styles.failCard,
                    instruction.myPlay === 'fail' && styles.cardSelected,
                  ]}
                  activeOpacity={fixed.activeOpacity}
                  accessibilityRole="button"
                  accessibilityLabel="失败"
                  accessibilityState={{
                    selected: instruction.myPlay === 'fail',
                    disabled: isSubmitting,
                  }}
                  disabled={isSubmitting}
                  testID="avalon-quest-fail"
                  onPress={() => onPlay('fail')}
                >
                  <Ionicons
                    name="skull-outline"
                    size={componentSizes.icon.xl}
                    color={colors.textInverse}
                  />
                  <Text style={styles.cardText}>失败</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
          {instruction.isTeamMember && instruction.myPlay !== null ? (
            <Text style={styles.hint}>
              已出牌（{PLAY_COPY[instruction.myPlay]}），揭晓前可改牌；出牌人不公开。
            </Text>
          ) : instruction.isTeamMember ? (
            <Text style={styles.hint}>秘密出牌：点选一张卡，出牌人不公开。</Text>
          ) : (
            <Text style={styles.hint}>等待队员出牌…</Text>
          )}
          <Button variant="secondary" size="lg" onPress={onClose} testID="avalon-quest-close">
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
  successCard: {
    backgroundColor: colors.warning,
  },
  failCard: {
    backgroundColor: colors.text,
  },
  cardSelected: {
    borderWidth: fixed.borderWidthThick,
    borderColor: colors.primaryLight,
  },
  cardText: {
    ...textStyles.titleBold,
    color: colors.textInverse,
  },
  hint: {
    ...textStyles.secondary,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
