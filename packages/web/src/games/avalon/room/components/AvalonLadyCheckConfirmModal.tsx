/**
 * 湖仙查验二次确认：持有人在座位盘点选目标后弹出，确认才提交查验。
 */

import { formatSeat } from '@game-judge/game-engine/platform/room/formatSeat';

import { AvalonAlertDialog } from './AvalonAlertDialog';

/** 查验目标二次确认弹窗；目标为空时不渲染。 */
export function AvalonLadyCheckConfirmModal({
  targetSeat,
  onConfirm,
  onClose,
}: {
  readonly targetSeat: number | null;
  readonly onConfirm: () => void;
  readonly onClose: () => void;
}) {
  if (targetSeat === null) return null;
  return (
    <AvalonAlertDialog
      title={`查验${formatSeat(targetSeat)}？`}
      message=""
      buttons={[
        { text: '取消', style: 'cancel', onPress: onClose },
        { text: '确定', style: 'default', onPress: onConfirm },
      ]}
      onClose={onClose}
    />
  );
}
