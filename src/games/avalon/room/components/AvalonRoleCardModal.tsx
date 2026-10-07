/**
 * 阿瓦隆角色卡弹窗：查看身份。
 * 对齐狼人杀 RoleCardModal 的简化版（纯信息展示，走 AlertModal message）。
 */

import type { AvalonRoleId } from '@game-judge/game-engine/games/avalon/public';

import { AlertModal } from '@/components/AlertModal';

import { getAvalonRoleMeta } from '../../model/avalonRoleMeta';

export function AvalonRoleCardModal({
  visible,
  roleId,
  onClose,
}: {
  readonly visible: boolean;
  readonly roleId: AvalonRoleId | null;
  readonly onClose: () => void;
}) {
  if (!visible || roleId === null) return null;
  const meta = getAvalonRoleMeta(roleId);
  return (
    <AlertModal
      visible
      title="我的身份"
      message={`${meta.displayName} · ${meta.factionName}\n\n${meta.description}`}
      onClose={onClose}
      buttons={[{ text: '知道了', onPress: onClose }]}
    />
  );
}
