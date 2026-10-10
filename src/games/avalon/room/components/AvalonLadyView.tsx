/**
 * 阿瓦隆湖中仙女阶段条：持有人在座位盘上点选查验目标（点选后走二次确认弹窗），
 * 被查验者的确认展示走弹窗，本条只做状态说明与弹窗重开入口。
 */

import { type AvalonViewModel } from '@game-judge/game-engine/games/avalon/public';
import { StyleSheet, Text } from 'react-native';

import { Button } from '@/components/Button';
import { colors, textStyles } from '@/theme';

import { getAvalonCheckedFactionDisplayName } from '../../model/avalonRoleDisplay';
import { resolveLadyInstruction } from '../policy/avalonInteractionPolicy';
import { AvalonInfoCard, AvalonStageFrame } from './AvalonStageFrame';

function seatName(viewModel: AvalonViewModel, seat: number): string {
  const entry = viewModel.seats.find((seatView) => seatView.seat === seat);
  const name = entry?.displayName ?? `座位${seat + 1}`;
  return `${seat + 1} 号 · ${name}`;
}

/** 湖仙阶段条：按视角呈现选人提示 / 等待 / 确认入口 / 旁观文案。 */
export function AvalonLadyView({
  viewModel,
  onShowAcknowledge,
}: {
  readonly viewModel: AvalonViewModel;
  readonly onShowAcknowledge: () => void;
}) {
  const instruction = resolveLadyInstruction(viewModel);
  return (
    <AvalonStageFrame title="湖中仙女查验" testID="avalon-lady">
      {instruction.kind === 'holderPick' ? (
        <AvalonInfoCard title="在座位盘上选择查验目标" testID="avalon-lady-picker">
          <Text style={styles.body}>
            点座位盘点选一名没当过湖仙的玩家进行查验（只能看到其阵营：好 / 坏），点选后会再次确认。
          </Text>
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
            要查验你的阵营，确认展示后对方将看到你是好人还是坏人。
          </Text>
          <Button
            variant="primary"
            size="lg"
            onPress={onShowAcknowledge}
            testID="avalon-lady-acknowledge-open"
          >
            查看查验请求
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
            {instruction.targetSeat !== null
              ? `${seatName(viewModel, instruction.holderSeat)}正在查验${seatName(viewModel, instruction.targetSeat)}，请等待。`
              : `${seatName(viewModel, instruction.holderSeat)}正在选择查验目标，请等待。`}
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
