/**
 * 阿瓦隆角色卡弹窗：使用共享 RoleRevealAnimator，与狼人杀同款动画。
 *
 * 无立绘时显示阵营色占位（角色名首字）。
 */
import type { AvalonRoleId } from '@game-judge/game-engine/games/avalon/public';

import { useState } from 'react';

import { RoleRevealAnimator } from '@/features/room/components/RoleRevealEffects/RoleRevealAnimator';
import { AVALON_REVEAL_CONFIG } from '@/features/room/components/RoleRevealEffects/revealConfig';
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
  const [animationDone, setAnimationDone] = useState(false);

  const role = roleId != null ? toRevealRoleData(roleId) : null;

  // After animation completes, show static card
  if (animationDone || role == null) {
    return <RoleCardSimple visible={visible} role={role} onClose={onClose} confirmText="知道了" />;
  }

  return (
    <RoleRevealAnimator
      visible={visible}
      role={role}
      effectType={AVALON_REVEAL_CONFIG.defaultEffect}
      onComplete={() => setAnimationDone(true)}
    />
  );
}
