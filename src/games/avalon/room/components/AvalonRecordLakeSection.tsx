/**
 * 阿瓦隆记录共享件：单轮湖仙节。
 *
 * 只写公开事实，不写查验结果（好 / 坏）：
 * - 已完成：持有人查验了谁 → 新持有人即被查验者；
 * - 进行中：只写持有人查验进行中，不写被选目标——token 尚未移交，
 *   目标公开的时点是 acknowledge，不是 check；
 * - 终局未发生：仅终局时渲染，局中不渲染未来轮次的未发生行。
 *   未发生的原因由本节按轮次状态推导，不由调用方各写一份：
 *   轮次从未开始 / 否决终局 / 本轮结算后即终局（湖仙未轮到）/
 *   未结算轮被刺杀打断。未 acknowledge 即终局的查验不进公开历史，
 *   按“未进行”口径处理，不写成已完成。
 */

import {
  AVALON_LADY_ROUNDS,
  type AvalonLadyCheckRecordView,
  type AvalonRoundRecordView,
} from '@game-judge/game-engine/games/avalon/public';
import { StyleSheet, Text, View } from 'react-native';

import { SeatDot } from '@/components/SeatDot';
import { borderRadius, colors, spacing, textStyles, typography, withAlpha } from '@/theme';

export function AvalonRecordLakeSection({
  afterRound,
  record,
  completed,
  inProgressHolderSeat,
  ended,
  testIDPrefix,
}: {
  readonly afterRound: number;
  readonly record: AvalonRoundRecordView | null;
  readonly completed: AvalonLadyCheckRecordView | null;
  readonly inProgressHolderSeat: number | null;
  readonly ended: boolean;
  readonly testIDPrefix?: string;
}) {
  const ladyRounds: readonly number[] = AVALON_LADY_ROUNDS;
  if (!ladyRounds.includes(afterRound)) return null;
  const prefix = testIDPrefix ?? `avalon-history-lake-${afterRound}`;
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
  const reason =
    record === null
      ? '任务未开始'
      : record.vetoEnded
        ? '否决达上限终局'
        : record.quest !== null
          ? '本轮结算后即终局，湖仙未进行'
          : '提前刺杀打断';
  return (
    <View style={styles.section} testID={prefix}>
      <Text style={styles.title}>湖仙查验</Text>
      <Text style={styles.text}>未发生（{reason}）</Text>
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
