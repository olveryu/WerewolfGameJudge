/**
 * 阿瓦隆刺杀阶段：刺客点选指认（二次确认走 AlertModal，由调用方渲染）；
 * 其余人等待；不亮牌（D11，沿用晚上互认状态）。
 */

import { type AvalonViewModel } from '@game-judge/game-engine/games/avalon/public';
import { StyleSheet, Text } from 'react-native';

import { colors, textStyles } from '@/theme';

import {
  eligibleStrikeTargets,
  resolveAssassinInstruction,
} from '../policy/avalonInteractionPolicy';
import { AvalonSeatPicker } from './AvalonSeatPicker';
import { AvalonInfoCard, AvalonStageFrame } from './AvalonStageFrame';

/**
 * 刺杀视图：刺客点选座位后把意图上报调用方（调用方弹 AlertModal 二次确认）。
 */
export function AvalonAssassinView({
  viewModel,
  onSelectSeat,
}: {
  readonly viewModel: AvalonViewModel;
  readonly onSelectSeat: (seat: number) => void;
}) {
  const instruction = resolveAssassinInstruction(viewModel);
  if (instruction.kind === 'goodWait')
    return (
      <AvalonStageFrame title="刺杀阶段" testID="avalon-assassin">
        <AvalonInfoCard title="等待刺杀结果">
          <Text style={styles.body}>坏人正在商量刺杀目标…</Text>
        </AvalonInfoCard>
      </AvalonStageFrame>
    );
  if (instruction.kind === 'evilWait')
    return (
      <AvalonStageFrame title="刺杀阶段" testID="avalon-assassin">
        <AvalonInfoCard title="坏人商量时间">
          <Text style={styles.body}>坏人商量时间（线下口头），等待刺客指认。</Text>
        </AvalonInfoCard>
      </AvalonStageFrame>
    );
  const targets = eligibleStrikeTargets(viewModel);
  return (
    <AvalonStageFrame title="刺杀：指认梅林" testID="avalon-assassin">
      <AvalonInfoCard title="选择指认目标" testID="avalon-assassin-picker">
        <Text style={styles.body}>
          点选一名玩家指认其为梅林（除自己外任意座位）。指认正确坏人获胜，指认错误好人直接获胜。
        </Text>
        <AvalonSeatPicker
          seats={targets.map((seat) => ({
            seat,
            displayName:
              viewModel.seats.find((seatView) => seatView.seat === seat)?.displayName ??
              `座位${seat + 1}`,
          }))}
          selectedSeats={new Set()}
          disabledSeats={new Set()}
          onSelect={onSelectSeat}
          testIDPrefix="avalon-assassin"
        />
      </AvalonInfoCard>
    </AvalonStageFrame>
  );
}

const styles = StyleSheet.create({
  body: {
    ...textStyles.body,
    color: colors.text,
  },
});
