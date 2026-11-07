/**
 * 对局摘要条：座位表上方常驻（入口按狼人杀口径）——最新结算结论或
 * 当前轮次状态一句，行尾「对局记录 ›」是打开对局记录浮层的唯一入口。
 * 整条可点；纯投影，无私密信息。
 */

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { PendingSeatsRow } from '@/features/room/components/PendingSeatsRow';
import { borderRadius, colors, fixed, spacing, textStyles } from '@/theme';

export function AvalonHistorySummary({
  summary,
  pendingSeats = null,
  pendingLabel = '未投票',
  onOpenHistory,
}: {
  readonly summary: string;
  /** 未提交的座位（投票/任务进行中）；其余阶段为 null，不渲染第二行。 */
  readonly pendingSeats?: readonly number[] | null;
  readonly pendingLabel?: '未投票' | '未出牌';
  readonly onOpenHistory: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.column}
      activeOpacity={fixed.activeOpacity}
      accessibilityRole="button"
      accessibilityLabel="对局记录"
      testID="avalon-history-summary"
      onPress={onOpenHistory}
    >
      <View style={styles.row}>
        <Text style={styles.summary} numberOfLines={1}>
          {summary}
        </Text>
        <Text style={styles.entry}>对局记录 ›</Text>
      </View>
      {pendingSeats !== null && pendingSeats.length > 0 ? (
        <View style={styles.pendingRow}>
          <PendingSeatsRow
            label={pendingLabel}
            seats={pendingSeats}
            testID="avalon-history-summary-pending-seats"
          />
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  column: {
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.medium,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.medium,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.small,
  },
  pendingRow: {
    marginTop: spacing.tight,
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
