/** Undercover button availability projected from authoritative phase and explicit local selection. */
import type {
  RoomBottomActionModel,
  RoomBottomButton,
} from '@/features/room/model/RoomBottomActions';

import type { UndercoverRoundControls } from './hooks/useUndercoverRoundControls';

type Controls = UndercoverRoundControls;

export function createUndercoverBottomActions(controls: Controls): RoomBottomActionModel {
  const actions: RoomBottomButton[] = [];
  if (controls.canViewCard && !controls.isSelecting)
    actions.push({
      key: 'card',
      label:
        controls.controlledSeat !== null
          ? `查看 ${controls.controlledSeat + 1} 号词卡`
          : '查看我的词',
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
    message: controls.isSelecting ? '选择本次出局玩家' : null,
    actions,
  };
}
