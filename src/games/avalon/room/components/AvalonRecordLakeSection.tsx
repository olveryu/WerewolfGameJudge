/**
 * 阿瓦隆记录共享件：单轮湖仙节。
 *
 * 只写公开事实，不写查验结果（好 / 坏）：
 * - 已完成：持有人查验了谁 → 新持有人即被查验者；
 * - 进行中：只写持有人查验进行中，不写被选目标——token 尚未移交，
 *   目标公开的时点是 acknowledge，不是 check；
 * - 终局未发生：仅终局时渲染，局中不渲染未来轮次的未发生行。
 *   未发生的原因由本节按轮次状态推导，不由调用方各写一份。
 */

import type {
  AvalonLadyCheckRecordView,
  AvalonRoundRecordView,
} from '@game-judge/game-engine/games/avalon/public';
import { StyleSheet, Text, View } from 'react-native';

import { SeatDot } from '@/components/SeatDot';
import { borderRadius, colors, spacing, textStyles, typography, withAlpha } from '@/theme';

const LADY_ROUNDS = [2, 3, 4] as const;

export function AvalonRecordLakeSection({
  record,
  completed,
  inProgressHolderSeat,
  ended,
  testIDPrefix,
}: {
  readonly record: AvalonRoundRecordView;
  readonly completed: AvalonLadyCheckRecordView | null;
  readonly inProgressHolderSeat: number | null;
  readonly ended: boolean;
  readonly testIDPrefix?: string;
}) {
  const ladyRounds: readonly number[] = LADY_ROUNDS;
  if (!ladyRounds.includes(record.round)) return null;
  const prefix = testIDPrefix ?? `avalon-history-lake-${record.round}`;
  if (completed !== null) {
    return (
      <View style={styles.section} testID={prefix}>
        <Text style={styles.title}>湖仙查验</Text>
        <View style={styles.line}>
          <SeatDot seat={completed.holderSeat} size="sm" />
          <Text style={styles.text}>
            {completed.holderSeat + 1} 号查验了 {completed.targetSeat + 1} 号
          </Text>
          <SeatDot seat={completed.targetSeat} size="sm" />
          <Text style={styles.text}>→ 新持有人 {completed.targetSeat + 1} 号</Text>
        </View>
        <Text style={styles.note}>查验结果只给当时持有人看，不进记录。</Text>
      </View>
    );
  }
  if (inProgressHolderSeat !== null) {
    return (
      <View style={styles.section} testID={prefix}>
        <Text style={styles.title}>湖仙查验</Text>
        <Text style={styles.text}>{inProgressHolderSeat + 1} 号查验进行中</Text>
      </View>
    );
  }
  if (!ended) return null;
  // 终局且本轮无已完成查验：本轮未结算（被打断或否决终局），湖仙未发生。
  return (
    <View style={styles.section} testID={prefix}>
      <Text style={styles.title}>湖仙查验</Text>
      <Text style={styles.text}>
        未发生（{record.vetoEnded ? '否决达上限终局' : '提前刺杀打断'}）
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.tight,
    padding: spacing.small,
    borderRadius: borderRadius.medium,
    backgroundColor: withAlpha(colors.primary, 0.06),
  },
  title: {
    ...textStyles.caption,
    color: colors.textSecondary,
    fontWeight: typography.weights.semibold,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.tight,
  },
  text: {
    ...textStyles.secondary,
    color: colors.text,
  },
  note: {
    ...textStyles.caption,
    color: colors.textSecondary,
  },
});
