/**
 * 刺杀二次确认：由房间状态驱动的确认弹窗。
 */

import { formatSeat } from '@game-judge/game-engine/platform/room/formatSeat';

import { AvalonAlertDialog } from './AvalonAlertDialog';

export interface AvalonStrikeConfirmation {
  readonly seat: number;
  readonly mode: 'accuse' | 'earlyStrike';
}

/** 刺杀/指认的二次确认弹窗；确认意图上报调用方执行提交。 */
export function AvalonStrikeConfirmModal({
  confirmation,
  onConfirm,
  onClose,
}: {
  readonly confirmation: AvalonStrikeConfirmation | null;
  readonly onConfirm: () => void;
  readonly onClose: () => void;
}) {
  if (confirmation === null) return null;
  const seat = formatSeat(confirmation.seat);
  const isEarlyStrike = confirmation.mode === 'earlyStrike';
  return (
    <AvalonAlertDialog
      title={isEarlyStrike ? `提前刺杀${seat}？` : `指认${seat}为梅林？`}
      message={isEarlyStrike ? '刺错则好人直接获胜。' : ''}
      buttons={[
        { text: '取消', style: 'cancel', onPress: onClose },
        { text: '确定', style: 'default', onPress: onConfirm },
      ]}
      onClose={onClose}
    />
  );
}
