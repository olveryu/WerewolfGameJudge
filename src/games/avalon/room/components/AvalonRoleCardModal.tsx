/**
 * 阿瓦隆角色卡弹窗：走共享 RevealAnimationGate（身份查看协议）。
 *
 * 锚点是服务端 roleViewedSeats：本人尚未查看时首次打开才播装备动画，
 * 查看落记录后（含回看）恒静态。无立绘时显示阵营色占位（角色名首字）。
 */
import type { AvalonRoleId } from '@game-judge/game-engine/games/avalon/public';

import { RevealAnimationGate } from '@/features/room/components/RevealAnimationGate';
import { RoleCardSimple } from '@/features/room/components/RoleCardSimple';
import type { RevealEffectType } from '@/features/room/components/RoleRevealEffects/types';
import type { RevealRoleData } from '@/features/room/model/RevealRoleData';

import { toRevealRoleData } from '../../components/AvalonRoleCardAdapter';

export function AvalonRoleCardModal({
  visible,
  roleId,
  effectType,
  shouldPlay,
  allRoles,
  onClose,
}: {
  readonly visible: boolean;
  readonly roleId: AvalonRoleId | null;
  /** 卡片主人的装备揭示动画；预览或接管机器人时为 null（D-1）。 */
  readonly effectType?: RevealEffectType | null;
  /** 服务端锚点：该座位尚未查看角色时为 true（首次查看才播动画）。 */
  readonly shouldPlay: boolean;
  /** 动画候选池：本局完整角色分布（state.roles 公开广播，D6-Q1）。 */
  readonly allRoles: readonly RevealRoleData[];
  readonly onClose: () => void;
}) {
  const role = roleId != null ? toRevealRoleData(roleId) : null;

  if (role == null) {
    return <RoleCardSimple visible={visible} role={role} onClose={onClose} confirmText="知道了" />;
  }

  return (
    <RevealAnimationGate
      visible={visible}
      effectType={effectType ?? null}
      shouldPlay={shouldPlay}
      role={role}
      allRoles={allRoles}
    >
      <RoleCardSimple visible={visible} role={role} onClose={onClose} confirmText="知道了" />
    </RevealAnimationGate>
  );
}
