/**
 * 刺杀二次确认：统一走 AlertModal（禁止 Alert.alert，react-native-web 上是空实现）。
 */

import { AlertModal } from '@/components/AlertModal';

export interface AvalonStrikeConfirmation {
  readonly seat: number;
  readonly mode: 'accuse' | 'earlyStrike';
}

/** 刺杀/指认的二次确认弹窗；确认意图上报调用方执行提交。 */
export function AvalonStrikeConfirmModal({
  confirmation,
  seatName,
  onConfirm,
  onClose,
}: {
  readonly confirmation: AvalonStrikeConfirmation | null;
  readonly seatName: string;
  readonly onConfirm: () => void;
  readonly onClose: () => void;
}) {
  if (confirmation === null) return null;
  const isEarlyStrike = confirmation.mode === 'earlyStrike';
  return (
    <AlertModal
      visible
      title={isEarlyStrike ? '提前刺杀' : '指认梅林'}
      message={
        isEarlyStrike
          ? `确定提前刺杀【${seatName}】？刺错则好人直接获胜`
          : `确定指认【${seatName}】为梅林？`
      }
      buttons={[
        { text: '取消', style: 'cancel', onPress: onClose },
        {
          text: isEarlyStrike ? '确认刺杀' : '确认指认',
          style: 'destructive',
          onPress: onConfirm,
        },
      ]}
      onClose={onClose}
    />
  );
}
