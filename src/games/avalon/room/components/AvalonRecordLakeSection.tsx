/**
 * 阿瓦隆对局记录共享件：单轮湖仙节。
 *
 * - 已完成：只写“持有人查验了谁 → 新持有人即被查验者”，查验结果不进
 *   记录，并保留“查验结果只给当时持有人看，不进记录”的说明——记录里
 *   看不到结果是正常的（2026-10-24 用户裁决）；带结果的完整版只在本局
 *   复盘文档里（复盘身份全公开，结果不属秘密）；
 * - 进行中：只写持有人查验进行中，不写被选目标——token 尚未移交，
 *   目标公开的时点是 acknowledge，不是 check；
 * - 终局未发生：仅终局时渲染，局中不渲染未来轮次的未发生行；原因由
 *   记录口径 formatAvalonLadySkipped 按轮次状态推导，与复盘同源。
 */

import {
  AVALON_LADY_ROUNDS,
  type AvalonLadyCheckRecordView,
  type AvalonRoundRecordView,
} from '@game-judge/game-engine/games/avalon/public';
import { StyleSheet, Text, View } from 'react-native';

import { SeatDot } from '@/components/SeatDot';
import { borderRadius, colors, spacing, textStyles, typography, withAlpha } from '@/theme';

import {
  formatAvalonLadyCheck,
  formatAvalonLadyHandover,
  formatAvalonLadySkipped,
} from '../avalonRecordCopy';

export function AvalonRecordLakeSection({
  afterRound,
  record,
  completed,
  inProgressHolderSeat,
  ended,
  testIDPrefix,
}: {
  readonly afterRound: number;
  readonly record: AvalonRoundRecordView;
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
          <Text style={styles.text}>{formatAvalonLadyCheck(completed)}</Text>
          <SeatDot seat={completed.targetSeat} size="sm" />
          <Text style={styles.text}>{formatAvalonLadyHandover(completed)}</Text>
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
  return (
    <View style={styles.section} testID={prefix}>
      <Text style={styles.title}>湖仙查验</Text>
      <Text style={styles.text}>{formatAvalonLadySkipped(record)}</Text>
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
