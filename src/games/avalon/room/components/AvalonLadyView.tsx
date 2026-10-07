/**
 * 阿瓦隆湖中仙女：持有人点选查验目标 → 被查验者确认 → 持有人看到阵营。
 */

import { type AvalonViewModel } from '@game-judge/game-engine/games/avalon/public';
import { StyleSheet, Text } from 'react-native';

import { Button } from '@/components/Button';
import { colors, textStyles } from '@/theme';

import { getAvalonCheckedFactionDisplayName } from '../../model/avalonRoleDisplay';
import { resolveLadyInstruction } from '../policy/avalonInteractionPolicy';
import { AvalonSeatPicker } from './AvalonSeatPicker';
import { AvalonInfoCard, AvalonStageFrame } from './AvalonStageFrame';

function seatName(viewModel: AvalonViewModel, seat: number): string {
  const entry = viewModel.seats.find((seatView) => seatView.seat === seat);
  const name = entry?.displayName ?? `座位${seat + 1}`;
  return `${seat + 1} 号 · ${name}`;
}

/** 湖仙视图：查验点选 / 等待确认 / 确认展示，意图上报调用方。 */
export function AvalonLadyView({
  viewModel,
  isSubmitting,
  onCheck,
  onAcknowledge,
}: {
  readonly viewModel: AvalonViewModel;
  readonly isSubmitting: boolean;
  readonly onCheck: (seat: number) => void;
  readonly onAcknowledge: () => void;
}) {
  const instruction = resolveLadyInstruction(viewModel);
  return (
    <AvalonStageFrame title="湖中仙女查验" testID="avalon-lady">
      {instruction.kind === 'holderPick' ? (
        <AvalonInfoCard title="选择查验目标" testID="avalon-lady-picker">
          <Text style={styles.body}>
            点选一名没当过湖仙的玩家进行查验（只能看到其阵营：好 / 坏）。
          </Text>
          <AvalonSeatPicker
            seats={instruction.eligibleSeats.map((seat) => ({
              seat,
              displayName:
                viewModel.seats.find((seatView) => seatView.seat === seat)?.displayName ??
                `座位${seat + 1}`,
            }))}
            selectedSeats={new Set()}
            disabledSeats={new Set()}
            onSelect={onCheck}
            testIDPrefix="avalon-lady"
          />
        </AvalonInfoCard>
      ) : instruction.kind === 'holderWait' ? (
        <AvalonInfoCard title="等待确认">
          <Text style={styles.body}>
            已选择查验{seatName(viewModel, instruction.targetSeat)}，等待对方确认展示。
          </Text>
        </AvalonInfoCard>
      ) : instruction.kind === 'targetConfirm' ? (
        <AvalonInfoCard title="湖仙查验" testID="avalon-lady-confirm">
          <Text style={styles.body}>
            {seatName(viewModel, instruction.holderSeat)}
            要查验你的阵营，点确认后对方将看到你是好人还是坏人。
          </Text>
          <Button
            variant="primary"
            size="lg"
            loading={isSubmitting}
            onPress={onAcknowledge}
            testID="avalon-lady-acknowledge"
          >
            确认展示
          </Button>
        </AvalonInfoCard>
      ) : instruction.kind === 'result' ? (
        <AvalonInfoCard title="查验结果" testID="avalon-lady-result">
          <Text style={styles.body}>
            {seatName(viewModel, instruction.targetSeat)} 是
            {getAvalonCheckedFactionDisplayName(instruction.faction)}人。
          </Text>
          <Text style={styles.hint}>查验结果只有你能看到，可在讨论中透露、隐瞒或误导。</Text>
        </AvalonInfoCard>
      ) : (
        <AvalonInfoCard title="湖仙查验中">
          <Text style={styles.body}>
            {seatName(viewModel, instruction.holderSeat)}正在查验，请等待。
          </Text>
        </AvalonInfoCard>
      )}
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
});
