/**
 * 阿瓦隆组队提名：队长在座位盘上点选队员（选中座位带「队员」徽标），
 * 本视图只做说明与提交；非队长等待。
 */

import { type AvalonViewModel } from '@game-judge/game-engine/games/avalon/public';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { colors, spacing, textStyles } from '@/theme';

import {
  formatAvalonRoundLabel,
  resolveNominateInstruction,
} from '../policy/avalonInteractionPolicy';
import { AvalonInfoCard, AvalonStageFrame } from './AvalonStageFrame';

/** 提名视图：选中集归 Screen（座位盘点选驱动），本视图消费它渲染计数与提交。 */
export function AvalonNominateView({
  viewModel,
  selectedSeats,
  isSubmitting,
  onPropose,
}: {
  readonly viewModel: AvalonViewModel;
  readonly selectedSeats: ReadonlySet<number>;
  readonly isSubmitting: boolean;
  readonly onPropose: (seats: readonly number[]) => void;
}) {
  const instruction = resolveNominateInstruction(viewModel, viewModel.mySeat);
  const isFull = selectedSeats.size === instruction.requiredSize;
  return (
    <AvalonStageFrame
      title={`${formatAvalonRoundLabel(viewModel.questResults.length + 1)} · 队长组队`}
      testID="avalon-nominate"
    >
      {instruction.isLeader ? (
        <AvalonInfoCard title="在座位盘上选择队员" testID="avalon-nominate-picker">
          <Text style={styles.body}>
            点座位盘点选 {instruction.requiredSize}{' '}
            名队员（可含自己），选中的座位会亮起「队员」徽标，再点一次取消。
          </Text>
          <Text style={styles.hint}>
            已选 {selectedSeats.size} / {instruction.requiredSize}
          </Text>
          <Button
            variant="primary"
            size="lg"
            loading={isSubmitting}
            disabled={!isFull}
            onPress={() => onPropose([...selectedSeats])}
            testID="avalon-nominate-submit"
          >
            提交队伍
          </Button>
          {!isFull ? (
            <Text style={styles.hint}>队员人数必须为 {instruction.requiredSize} 人</Text>
          ) : null}
        </AvalonInfoCard>
      ) : (
        <AvalonInfoCard title="等待队长组队">
          <Text style={styles.body}>
            等待队长组队（{instruction.leaderSeat + 1} 号座位），本轮需要 {instruction.requiredSize}{' '}
            名队员。
          </Text>
        </AvalonInfoCard>
      )}
      <View style={styles.scoreRow}>
        <Text style={styles.score}>
          成功 {viewModel.questResults.filter((result) => result === 'success').length} · 失败{' '}
          {viewModel.questResults.filter((result) => result === 'fail').length}
        </Text>
      </View>
    </AvalonStageFrame>
  );
}

const styles = StyleSheet.create({
  body: {
    ...textStyles.body,
    color: colors.text,
  },
  hint: {
    ...textStyles.secondary,
    color: colors.textSecondary,
  },
  scoreRow: {
    alignItems: 'center',
    paddingVertical: spacing.tight,
  },
  score: {
    ...textStyles.secondary,
    color: colors.textSecondary,
  },
});
