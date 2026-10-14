/**
 * 对局摘要条：座位表上方常驻（入口按狼人杀口径）——最新结算结论或
 * 当前轮次状态一句，行尾「对局记录 ›」是打开对局记录浮层的唯一入口。
 * 整条可点；纯投影，无私密信息。
 */

import { StyleSheet, Text, TouchableOpacity } from 'react-native';

import { borderRadius, colors, fixed, spacing, textStyles } from '@/theme';

export function AvalonHistorySummary({
  summary,
  onOpenHistory,
}: {
  readonly summary: string;
  readonly onOpenHistory: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={fixed.activeOpacity}
      accessibilityRole="button"
      accessibilityLabel="对局记录"
      testID="avalon-history-summary"
      onPress={onOpenHistory}
    >
      <Text style={styles.summary} numberOfLines={1}>
        {summary}
      </Text>
      <Text style={styles.entry}>对局记录 ›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.small,
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.medium,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.medium,
  },
  summary: {
    ...textStyles.secondary,
    color: colors.text,
    flexShrink: 1,
  },
  entry: {
    ...textStyles.secondarySemibold,
    color: colors.primary,
  },
});
