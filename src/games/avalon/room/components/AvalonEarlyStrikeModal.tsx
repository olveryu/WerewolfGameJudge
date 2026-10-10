/**
 * 阿瓦隆提前刺杀选人弹窗：刺客点常驻「刺杀」按钮后以覆盖层弹出，
 * 不再整份替换当前阶段 UI；点选目标后走刺杀二次确认弹窗。
 */

import { type AvalonViewModel } from '@game-judge/game-engine/games/avalon/public';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Modal } from '@/components/AppModal';
import { Button } from '@/components/Button';
import { borderRadius, colors, shadows, spacing, textStyles } from '@/theme';

import { eligibleStrikeTargets } from '../policy/avalonInteractionPolicy';
import { AvalonSeatPicker } from './AvalonSeatPicker';

/** 提前刺杀选人弹窗：点选意图上报调用方（调用方关本弹窗并打开二次确认）。 */
export function AvalonEarlyStrikeModal({
  viewModel,
  onSelectSeat,
  onClose,
}: {
  readonly viewModel: AvalonViewModel;
  readonly onSelectSeat: (seat: number) => void;
  readonly onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View
          style={[styles.panel, { paddingBottom: Math.max(insets.bottom, spacing.medium) }]}
          testID="avalon-early-strike-modal"
        >
          <Text style={styles.title}>提前刺杀：选择目标</Text>
          <Text style={styles.body}>
            除自己外任意座位可选；刺中梅林坏人直接获胜，刺错好人直接获胜。
          </Text>
          <AvalonSeatPicker
            seats={eligibleStrikeTargets(viewModel).map((seat) => ({
              seat,
              displayName:
                viewModel.seats.find((seatView) => seatView.seat === seat)?.displayName ??
                `座位${seat + 1}`,
            }))}
            selectedSeats={new Set()}
            disabledSeats={new Set()}
            onSelect={onSelectSeat}
            testIDPrefix="avalon-early-strike"
          />
          <Button
            variant="secondary"
            size="lg"
            onPress={onClose}
            testID="avalon-early-strike-cancel"
          >
            取消
          </Button>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.overlay,
  },
  panel: {
    width: '85%',
    gap: spacing.medium,
    padding: spacing.large,
    borderRadius: borderRadius.large,
    backgroundColor: colors.card,
    ...shadows.md,
  },
  title: {
    ...textStyles.titleBold,
    color: colors.text,
    textAlign: 'center',
  },
  body: {
    ...textStyles.body,
    color: colors.text,
  },
});
