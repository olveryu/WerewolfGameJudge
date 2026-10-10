/**
 * 湖仙查验二次确认：持有人在座位盘点选目标后弹出，确认才提交查验。
 * 统一走 AlertModal（禁止 Alert.alert，react-native-web 上是空实现）。
 */

import { AlertModal } from '@/components/AlertModal';

/** 查验目标二次确认弹窗；目标为空时不渲染。 */
export function AvalonLadyCheckConfirmModal({
  targetName,
  onConfirm,
  onClose,
}: {
  readonly targetName: string | null;
  readonly onConfirm: () => void;
  readonly onClose: () => void;
}) {
  if (targetName === null) return null;
  return (
    <AlertModal
      visible
      title="湖中仙女查验"
      message={`确定查验【${targetName}】的阵营？对方确认展示后，你将看到其为好人还是坏人。`}
      buttons={[
        { text: '取消', style: 'cancel', onPress: onClose },
        { text: '确认查验', style: 'default', onPress: onConfirm },
      ]}
      onClose={onClose}
    />
  );
}
