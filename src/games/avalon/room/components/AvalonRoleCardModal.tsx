/**
 * 阿瓦隆角色卡弹窗：使用共享 RoleCardSimple，与狼人杀同款卡牌视觉。
 *
 * 无立绘时显示阵营色占位（角色名首字）。
 */
import type { AvalonRoleId } from '@game-judge/game-engine/games/avalon/public';

import { RoleCardSimple } from '@/features/room/components/RoleCardSimple';
import type { RevealRoleData } from '@/features/room/model/RevealRoleData';

import { getAvalonRoleMeta } from '../../model/avalonRoleMeta';

function toRevealRoleData(roleId: AvalonRoleId): RevealRoleData {
  const meta = getAvalonRoleMeta(roleId);
  return {
    id: roleId,
    name: meta.displayName,
    // 坏人 → wolf（红），好人 → god（蓝）
    alignment: meta.isEvil ? 'wolf' : 'god',
    image: undefined, // 暂无立绘，显示阵营色占位
    description: meta.description,
    factionName: meta.factionName,
  };
}

export function AvalonRoleCardModal({
  visible,
  roleId,
  onClose,
}: {
  readonly visible: boolean;
  readonly roleId: AvalonRoleId | null;
  readonly title?: string;
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
