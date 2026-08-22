/** Compact FibKing room summary and aligned rules entry above the shared seat board. */

import Ionicons from '@expo/vector-icons/Ionicons';
import type {
  FibPhase,
  FibPreparationFailureCode,
  FibPreparationStage,
} from '@game-judge/game-engine/games/fibking/public';
import type React from 'react';
import { memo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { TESTIDS } from '@/testids';
import { colors, componentSizes, fixed, spacing, typography, withAlpha } from '@/theme';

interface FibRoomSummaryProps {
  readonly phase: FibPhase;
  readonly occupiedSeatCount: number;
  readonly playerCount: number;
  readonly preparationStage: FibPreparationStage | null;
  readonly preparationFailureCode: FibPreparationFailureCode | null;
  readonly onOpenRules: () => void;
}

const PHASE_LABELS = {
  lobby: '等待入座',
  preparing: '准备词语',
  preparationFailed: '准备失败',
  ongoing: '描述进行中',
  ended: '本轮已结束',
} as const;

const PREPARATION_STAGE_LABELS: Readonly<Record<FibPreparationStage, string>> = {
  queued: '等待选取词语',
  selecting: '正在选取中文词语',
  finalizing: '正在检查词语和释义',
};

const PREPARATION_FAILURE_LABELS: Readonly<Record<FibPreparationFailureCode, string>> = {
  selectionFailed: '暂无可用词语，请重新准备',
};

const FibRoomSummaryComponent: React.FC<FibRoomSummaryProps> = ({
  phase,
  occupiedSeatCount,
  playerCount,
  preparationStage,
  preparationFailureCode,
  onOpenRules,
}) => {
  const preparationStatus =
    phase === 'preparing'
      ? preparationStage === null
        ? null
        : PREPARATION_STAGE_LABELS[preparationStage]
      : phase === 'preparationFailed'
        ? preparationFailureCode === null
          ? null
          : PREPARATION_FAILURE_LABELS[preparationFailureCode]
        : null;
  if ((phase === 'preparing' || phase === 'preparationFailed') && preparationStatus === null) {
    throw new Error(`[FAIL-FAST] Fib summary is missing status for phase ${phase}`);
  }

  return (
    <View style={styles.container}>
      <View style={styles.summaryRow}>
        <View style={styles.iconBox}>
          <Ionicons name="bulb-outline" size={componentSizes.icon.md} color={colors.primary} />
        </View>
        <View style={styles.summaryText}>
          <Text style={styles.title}>瞎掰王 · {playerCount}人局</Text>
          <Text style={styles.subtitle}>
            {PHASE_LABELS[phase]} · {occupiedSeatCount}/{playerCount} 人就座
          </Text>
          {preparationStatus !== null ? (
            <View style={styles.preparationStatusRow} accessibilityLabel={preparationStatus}>
              <Ionicons
                name={phase === 'preparationFailed' ? 'alert-circle-outline' : 'time-outline'}
                size={componentSizes.icon.sm}
                color={phase === 'preparationFailed' ? colors.error : colors.primary}
              />
              <Text
                testID={TESTIDS.fibPreparationStatus}
                style={
                  phase === 'preparationFailed'
                    ? styles.preparationFailureText
                    : styles.preparationStatusText
                }
              >
                {preparationStatus}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <TouchableOpacity
        style={styles.rulesRow}
        activeOpacity={fixed.activeOpacity}
        onPress={onOpenRules}
        accessibilityLabel="查看瞎掰王玩法说明"
        testID={TESTIDS.fibRulesButton}
      >
        <Ionicons name="book-outline" size={componentSizes.icon.sm} color={colors.primary} />
        <View style={styles.rulesText}>
          <Text style={styles.rulesTitle}>玩法说明</Text>
          <Text style={styles.rulesSubtitle}>身份、描述与公布规则</Text>
        </View>
        <Ionicons name="chevron-forward" size={componentSizes.icon.sm} color={colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
};

export const FibRoomSummary = memo(FibRoomSummaryComponent);

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.medium,
    borderBottomWidth: fixed.borderWidth,
    borderBottomColor: colors.borderLight,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.medium,
  },
  iconBox: {
    width: componentSizes.avatar.md,
    height: componentSizes.avatar.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(colors.primary, 0.08),
    borderRadius: componentSizes.avatar.md / 2,
    marginRight: spacing.small,
  },
  summaryText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: typography.body,
    lineHeight: typography.body * 1.35,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  subtitle: {
    marginTop: spacing.micro,
    fontSize: typography.secondary,
    lineHeight: typography.secondary * 1.4,
    color: colors.textSecondary,
  },
  preparationStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.small,
    gap: spacing.tight,
  },
  preparationStatusText: {
    fontSize: typography.caption,
    lineHeight: typography.caption * 1.4,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
  },
  preparationFailureText: {
    fontSize: typography.caption,
    lineHeight: typography.caption * 1.4,
    fontWeight: typography.weights.semibold,
    color: colors.error,
  },
  rulesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: componentSizes.button.lg,
    paddingVertical: spacing.small,
    borderTopWidth: fixed.borderWidth,
    borderTopColor: colors.borderLight,
  },
  rulesText: {
    flex: 1,
    minWidth: 0,
    marginHorizontal: spacing.small,
  },
  rulesTitle: {
    fontSize: typography.secondary,
    lineHeight: typography.secondary * 1.4,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  rulesSubtitle: {
    marginTop: spacing.micro,
    fontSize: typography.caption,
    lineHeight: typography.caption * 1.4,
    color: colors.textMuted,
  },
});
