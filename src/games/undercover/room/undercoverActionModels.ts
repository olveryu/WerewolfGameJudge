/** Undercover button availability projected from authoritative phase and explicit local selection. */
import type {
  RoomBottomActionModel,
  RoomBottomButton,
} from '@/features/room/model/RoomBottomActions';

import type { UndercoverRoundControls } from './hooks/useUndercoverRoundControls';

type Controls = UndercoverRoundControls;

export function createUndercoverBottomActions(controls: Controls): RoomBottomActionModel {
  const actions: RoomBottomButton[] = [];
  const cardLabel =
    controls.controlledSeat !== null ? `查看 ${controls.controlledSeat + 1} 号词卡` : '查看我的词';
  if (controls.canViewCard && !controls.isSelecting)
    actions.push({
      key: 'card',
      label: cardLabel,
      variant: 'primary',
      size: 'lg',
      isEnabled: true,
      onPress: controls.openCard,
      testID: 'undercover-view-word',
    });
  if (controls.isSelecting) {
    actions.push({
      key: 'cancel',
      label: '取消选择',
      variant: 'ghost',
      size: 'md',
      isEnabled: true,
      onPress: controls.cancelSelection,
    });
  }
  return {
    kind: 'info',
    // 查看阶段本人（或被接管座位）未确认时提示去看词卡（展示契约
    // self-hint 态，本人提示只走底部这一处出口）。
    message: controls.isSelecting
      ? '选择本次出局玩家'
      : controls.shouldConfirm
        ? `请点击下方「${cardLabel}」，查看词语`
        : null,
    progress: null,
    actions,
  };
}
