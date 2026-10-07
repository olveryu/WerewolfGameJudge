/**
 * 阿瓦隆组队提名：队长多选队员后提交；非队长等待。
 */

import { type AvalonViewModel } from '@game-judge/game-engine/games/avalon/public';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { colors, spacing, textStyles } from '@/theme';

import { getAvalonCheckedFactionDisplayName } from '../../model/avalonRoleDisplay';
import {
  formatAvalonRoundLabel,
  resolveNominateInstruction,
} from '../policy/avalonInteractionPolicy';
import { AvalonSeatPicker } from './AvalonSeatPicker';
import { AvalonInfoCard, AvalonStageFrame } from './AvalonStageFrame';

/** 组队视图：本地多选态归视图所有，提交意图上报调用方。 */
export function AvalonNominateView({
  viewModel,
  isSubmitting,
  onPropose,
}: {
  readonly viewModel: AvalonViewModel;
  readonly isSubmitting: boolean;
  readonly onPropose: (seats: readonly number[]) => void;
}) {
  const instruction = resolveNominateInstruction(viewModel, viewModel.mySeat);
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  const toggle = (seat: number) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(seat)) next.delete(seat);
      else next.add(seat);
      return next;
    });
  };
  const seats = viewModel.seats.map((entry) => ({
    seat: entry.seat,
    displayName: entry.displayName,
  }));
  const lastHistory = viewModel.questHistory[viewModel.questHistory.length - 1];
  return (
    <AvalonStageFrame
      title={`${formatAvalonRoundLabel(viewModel.questResults.length + 1)} · 队长组队`}
      testID="avalon-nominate"
    >
      {viewModel.rejectStreak > 0 ? (
        <AvalonInfoCard title="组队被否决">
          <Text style={styles.body}>
            上次组队被否决（第 {viewModel.rejectStreak} 次），队长已顺时针移交。
          </Text>
        </AvalonInfoCard>
      ) : null}
      {lastHistory !== undefined ? (
        <AvalonInfoCard title={`${formatAvalonRoundLabel(lastHistory.round)}任务结算`}>
          <Text style={styles.body}>
            任务{lastHistory.result === 'success' ? '成功' : '失败'}（成功{' '}
            {lastHistory.successCount} · 失败 {lastHistory.failCount}）
          </Text>
        </AvalonInfoCard>
      ) : null}
      {viewModel.ladyCheckResult !== null ? (
        <AvalonInfoCard title="湖仙查验结果">
          <Text style={styles.body}>
            上次查验结果：{getAvalonCheckedFactionDisplayName(viewModel.ladyCheckResult)}
          </Text>
        </AvalonInfoCard>
      ) : null}
      {instruction.isLeader ? (
        <AvalonInfoCard title="选择队员" testID="avalon-nominate-picker">
          <Text style={styles.body}>请选择 {instruction.requiredSize} 名队员（可含自己）</Text>
          <AvalonSeatPicker
            seats={seats}
            selectedSeats={selected}
            disabledSeats={new Set()}
            onSelect={toggle}
            testIDPrefix="avalon-nominate"
          />
          <Text style={styles.hint}>
            已选 {selected.size} / {instruction.requiredSize}
          </Text>
          <Button
            variant="primary"
            size="lg"
            loading={isSubmitting}
            onPress={() => onPropose([...selected])}
            testID="avalon-nominate-submit"
          >
            提交队伍
          </Button>
          {selected.size !== instruction.requiredSize ? (
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
