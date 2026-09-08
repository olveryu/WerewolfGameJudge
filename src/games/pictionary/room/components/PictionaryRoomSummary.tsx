/** Pictionary lobby summary above the shared seat board. */

import Ionicons from '@expo/vector-icons/Ionicons';
import type { PictionaryConfig } from '@game-judge/game-engine/games/pictionary/public';
import type React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors, componentSizes, fixed, spacing, typography, withAlpha } from '@/theme';

interface PictionaryRoomSummaryProps {
  readonly config: PictionaryConfig;
  readonly occupiedSeatCount: number;
  readonly onOpenRules: () => void;
}

function formatDuration(value: number | null): string {
  return value === null ? '不限时' : `${value}秒`;
}

export const PictionaryRoomSummary: React.FC<PictionaryRoomSummaryProps> = ({
  config,
  occupiedSeatCount,
  onOpenRules,
}) => (
  <View style={styles.container}>
    <View style={styles.summaryRow}>
      <View style={styles.iconBox}>
        <Ionicons name="brush-outline" size={componentSizes.icon.md} color={colors.primary} />
      </View>
      <View style={styles.summaryText}>
        <Text style={styles.title}>你画我猜接龙 · {config.numberOfPlayers}人局</Text>
        <Text style={styles.subtitle}>
          {occupiedSeatCount}/{config.numberOfPlayers} 人就座 · 画画{' '}
          {formatDuration(config.drawingDurationSeconds)}
        </Text>
      </View>
    </View>
    <TouchableOpacity
      style={styles.rulesRow}
      activeOpacity={fixed.activeOpacity}
      onPress={onOpenRules}
      accessibilityLabel="查看你画我猜接龙玩法说明"
    >
      <Ionicons name="book-outline" size={componentSizes.icon.sm} color={colors.primary} />
      <View style={styles.rulesText}>
        <Text style={styles.rulesTitle}>玩法说明</Text>
        <Text style={styles.rulesSubtitle}>人数决定轮数，每轮写题或猜词后作画</Text>
      </View>
      <Ionicons name="chevron-forward" size={componentSizes.icon.sm} color={colors.textMuted} />
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.medium,
    borderBottomWidth: fixed.borderWidth,
    borderBottomColor: colors.borderLight,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.medium },
  iconBox: {
    width: componentSizes.avatar.md,
    height: componentSizes.avatar.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.small,
    borderRadius: componentSizes.avatar.md / 2,
    backgroundColor: withAlpha(colors.primary, 0.08),
  },
  summaryText: { flex: 1, minWidth: 0 },
  title: {
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  subtitle: {
    marginTop: spacing.micro,
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
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
  rulesText: { flex: 1, minWidth: 0, marginHorizontal: spacing.small },
  rulesTitle: {
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  rulesSubtitle: {
    marginTop: spacing.micro,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    color: colors.textMuted,
  },
});
