/**
 * 阿瓦隆记录共享件：单轮湖仙节。
 *
 * 查验结果（好 / 坏）只在调用方显式传入时写出：
 * - 对局记录不传 checkedFaction：已完成行只写“持有人查验了谁 →
 *   新持有人即被查验者”，并保留“查验结果只给当时持有人看，不进记录”
 *   的说明——记录里看不到结果是正常的（2026-10-24 用户裁决）；
 * - 本局复盘必传 checkedFaction（从终局已公开的身份推导被查者阵营）：
 *   已完成行写成“X 号查验了 Y 号（好人 / 坏人）”，不写上述说明——
 *   复盘身份全公开，结果在复盘里不属秘密（2026-10-24 用户裁决）。
 *   checkedFaction 为 null 表示复盘里推导不出被查者阵营（终局本不应
 *   发生），此时只写查验了谁，同样不写说明。
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

import { getAvalonCheckedFactionDisplayName } from '../../model/avalonRoleDisplay';

export function AvalonRecordLakeSection({
  afterRound,
  record,
  completed,
  inProgressHolderSeat,
  ended,
  testIDPrefix,
  checkedFaction,
}: {
  readonly afterRound: number;
  readonly record: AvalonRoundRecordView | null;
  readonly completed: AvalonLadyCheckRecordView | null;
  readonly inProgressHolderSeat: number | null;
  readonly ended: boolean;
  readonly testIDPrefix?: string;
  /**
   * 查验结果阵营：undefined = 对局记录模式（不写结果，保留说明）；
   * 'good' | 'evil' = 本局复盘模式（写出结果，不写说明）；
   * null = 复盘模式但推导不出阵营（只写查验了谁，不写说明）。
   */
  readonly checkedFaction?: 'good' | 'evil' | null;
}) {
  const ladyRounds: readonly number[] = AVALON_LADY_ROUNDS;
  if (!ladyRounds.includes(afterRound)) return null;
  const prefix = testIDPrefix ?? `avalon-history-lake-${afterRound}`;
  if (completed !== null) {
    const resultText =
      checkedFaction === undefined || checkedFaction === null
        ? null
        : `${getAvalonCheckedFactionDisplayName(checkedFaction)}人`;
    return (
      <View style={styles.section} testID={prefix}>
        <Text style={styles.title}>湖仙查验</Text>
        <View style={styles.line}>
          <SeatDot seat={completed.holderSeat} size="sm" />
          <Text style={styles.text}>
            {completed.holderSeat + 1} 号查验了 {completed.targetSeat + 1} 号
            {resultText !== null ? `（${resultText}）` : ''}
          </Text>
          <SeatDot seat={completed.targetSeat} size="sm" />
          <Text style={styles.text}>→ 新持有人 {completed.targetSeat + 1} 号</Text>
        </View>
        {checkedFaction === undefined ? (
          <Text style={styles.note}>查验结果只给当时持有人看，不进记录。</Text>
        ) : null}
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
