/**
 * 阿瓦隆晚上三步：坏人互认 → 梅林 → 派西维尔；非参与者显示等待。
 */

import {
  type AvalonNightStep,
  type AvalonViewModel,
} from '@game-judge/game-engine/games/avalon/public';
import { StyleSheet, Text } from 'react-native';

import { Button } from '@/components/Button';
import { colors, textStyles } from '@/theme';

import { resolveNightInstruction } from '../policy/avalonInteractionPolicy';
import { AvalonInfoCard, AvalonStageFrame } from './AvalonStageFrame';

const NIGHT_STEP_TITLES: Readonly<Record<AvalonNightStep, string>> = {
  evilReveal: '天黑：坏人睁眼',
  merlinReveal: '梅林睁眼',
  percivalReveal: '派西维尔睁眼',
};

/** 按 view model 的私密投影渲染晚上信息卡；确认意图上报给调用方。 */
export function AvalonNightView({
  viewModel,
  isSubmitting,
  onConfirm,
}: {
  readonly viewModel: AvalonViewModel;
  readonly isSubmitting: boolean;
  readonly onConfirm: () => void;
}) {
  const instruction = resolveNightInstruction(viewModel);
  const stepTitle = viewModel.nightStep === null ? '天黑' : NIGHT_STEP_TITLES[viewModel.nightStep];
  return (
    <AvalonStageFrame title={stepTitle} testID="avalon-night">
      {instruction.kind === 'waiting' ? (
        <AvalonInfoCard title="天黑等待">
          <Text style={styles.body}>闭眼等待，其他人正在确认身份信息。</Text>
        </AvalonInfoCard>
      ) : instruction.kind === 'confirmed' ? (
        <AvalonInfoCard title="已确认">
          <Text style={styles.body}>已确认，等待其他人完成确认。</Text>
        </AvalonInfoCard>
      ) : instruction.kind === 'evilPeers' ? (
        <AvalonInfoCard title="坏人互认" testID="avalon-night-evil">
          {instruction.isAlone ? (
            <Text style={styles.body}>
              无人可认：你看不见其他坏人，他们也看不见你。点确认继续。
            </Text>
          ) : (
            <>
              <Text style={styles.body}>睁眼看到的坏人同伴：</Text>
              {instruction.peers.map((seat) => (
                <Text key={seat} style={styles.peer} testID={`avalon-night-peer-${seat}`}>
                  {seat + 1} 号 · {seatName(viewModel, seat)}
                </Text>
              ))}
              <Text style={styles.hint}>线下口头讨论，每人点确认推进。</Text>
            </>
          )}
          <Button
            variant="primary"
            size="lg"
            loading={isSubmitting}
            onPress={onConfirm}
            testID="avalon-night-confirm"
          >
            确认
          </Button>
        </AvalonInfoCard>
      ) : instruction.kind === 'merlin' ? (
        <AvalonInfoCard title="梅林的视野" testID="avalon-night-merlin">
          <Text style={styles.body}>你看到的坏人（莫德雷德不在其中）：</Text>
          {instruction.sees.map((seat) => (
            <Text key={seat} style={styles.peer} testID={`avalon-night-peer-${seat}`}>
              {seat + 1} 号 · {seatName(viewModel, seat)}
            </Text>
          ))}
          <Button
            variant="primary"
            size="lg"
            loading={isSubmitting}
            onPress={onConfirm}
            testID="avalon-night-confirm"
          >
            确认
          </Button>
        </AvalonInfoCard>
      ) : (
        <AvalonInfoCard title="派西维尔的视野" testID="avalon-night-percival">
          <Text style={styles.body}>你看到的两个人，其中一个是梅林，另一个是莫甘娜：</Text>
          {instruction.sees.map((seat) => (
            <Text key={seat} style={styles.peer} testID={`avalon-night-peer-${seat}`}>
              {seat + 1} 号 · {seatName(viewModel, seat)}
            </Text>
          ))}
          <Button
            variant="primary"
            size="lg"
            loading={isSubmitting}
            onPress={onConfirm}
            testID="avalon-night-confirm"
          >
            确认
          </Button>
        </AvalonInfoCard>
      )}
    </AvalonStageFrame>
  );
}

function seatName(viewModel: AvalonViewModel, seat: number): string {
  return viewModel.seats.find((entry) => entry.seat === seat)?.displayName ?? `座位${seat + 1}`;
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
  peer: {
    ...textStyles.body,
    color: colors.primaryDark,
  },
});
