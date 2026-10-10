/**
 * 阿瓦隆湖仙确认展示弹窗：被查验者轮到确认时自动弹出一次，
 * 可关（去看座位盘），阶段条有重开入口。确认后持有人将看到其阵营。
 */

import { type AvalonViewModel } from '@game-judge/game-engine/games/avalon/public';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Modal } from '@/components/AppModal';
import { Button } from '@/components/Button';
import { borderRadius, colors, shadows, spacing, textStyles } from '@/theme';

import { resolveLadyInstruction } from '../policy/avalonInteractionPolicy';

/** 确认展示弹窗：确认意图上报调用方；提交中禁用防重复提交。 */
export function AvalonLadyAcknowledgeModal({
  viewModel,
  isSubmitting,
  onAcknowledge,
  onClose,
}: {
  readonly viewModel: AvalonViewModel;
  readonly isSubmitting: boolean;
  readonly onAcknowledge: () => void;
  readonly onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const instruction = resolveLadyInstruction(viewModel);
  const holderSeat = instruction.kind === 'targetConfirm' ? instruction.holderSeat : null;
  // 渲染门控已保证 targetConfirm；竞态下指令已变则不渲染空名文案。
  if (holderSeat === null) return null;
  const holderName = `${holderSeat + 1} 号 · ${viewModel.seats.find((seatView) => seatView.seat === holderSeat)?.displayName ?? `座位${holderSeat + 1}`}`;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View
          style={[styles.panel, { paddingBottom: Math.max(insets.bottom, spacing.medium) }]}
          testID="avalon-lady-acknowledge-modal"
        >
          <Text style={styles.title}>湖中仙女查验</Text>
          <Text style={styles.body}>
            {holderName} 要查验你的阵营。确认展示后，对方将看到你是好人还是坏人。
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
          <Button variant="secondary" size="lg" onPress={onClose} testID="avalon-lady-ack-close">
            稍后再说
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
    textAlign: 'center',
  },
});
