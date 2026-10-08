/**
 * 阿瓦隆角色卡弹窗：使用共享 RoleCardSimple，与狼人杀同款卡牌视觉。
 *
 * 无立绘时显示阵营色占位（角色名首字）。
 */
import type { AvalonRoleId } from '@game-judge/game-engine/games/avalon/public';

import { RoleCardSimple } from '@/features/room/components/RoleCardSimple';

import { toRevealRoleData } from '../../components/AvalonRoleCardAdapter';

export function AvalonRoleCardModal({
  visible,
  roleId,
  onClose,
}: {
  readonly visible: boolean;
  readonly roleId: AvalonRoleId | null;
  readonly onClose: () => void;
}) {
  return (
    <RoleCardSimple
      visible={visible}
      role={roleId != null ? toRevealRoleData(roleId) : null}
      onClose={onClose}
      confirmText="知道了"
    />
  );
}
