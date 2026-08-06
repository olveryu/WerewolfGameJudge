/** Compact FibKing room summary and aligned rules entry above the shared seat board. */

import Ionicons from '@expo/vector-icons/Ionicons';
import type { FibPhase } from '@game-judge/game-engine/games/fibking/public';
import type React from 'react';
import { memo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { TESTIDS } from '@/testids';
import { colors, componentSizes, fixed, spacing, typography, withAlpha } from '@/theme';

interface FibRoomSummaryProps {
  readonly phase: FibPhase;
  readonly occupiedSeatCount: number;
  readonly playerCount: number;
  readonly onOpenRules: () => void;
}

const PHASE_LABELS = {
  lobby: '等待入座',
  preparing: '准备词语',
  preparationFailed: '词语准备失败',
  ongoing: '描述进行中',
  ended: '本轮已结束',
} as const satisfies Readonly<Record<FibPhase, string>>;

const FibRoomSummaryComponent: React.FC<FibRoomSummaryProps> = ({
  phase,
  occupiedSeatCount,
  playerCount,
  onOpenRules,
}) => (
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
