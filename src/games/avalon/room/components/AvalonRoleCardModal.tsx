/**
 * 阿瓦隆角色卡弹窗：使用共享 RoleRevealAnimator，与狼人杀同款动画。
 *
 * 无立绘时显示阵营色占位（角色名首字）。
 */
import type { AvalonRoleId } from '@game-judge/game-engine/games/avalon/public';
import { useState } from 'react';

import { RoleCardSimple } from '@/features/room/components/RoleCardSimple';
import { RoleRevealAnimator } from '@/features/room/components/RoleRevealEffects/RoleRevealAnimator';
import type { RevealEffectType } from '@/features/room/components/RoleRevealEffects/types';

import { toRevealRoleData } from '../../components/AvalonRoleCardAdapter';

export function AvalonRoleCardModal({
  visible,
  roleId,
  effectType,
  onClose,
}: {
  readonly visible: boolean;
  readonly roleId: AvalonRoleId | null;
  /** 装备的揭示动画；null/undefined 则直接显示静态卡（未装备装饰）。 */
  readonly effectType?: RevealEffectType | null;
  readonly onClose: () => void;
}) {
  const [animationDone, setAnimationDone] = useState(false);

  const role = roleId != null ? toRevealRoleData(roleId) : null;

  // 未装备装饰或动画已播完，直接显示静态卡
  if (animationDone || role == null || effectType == null) {
    return <RoleCardSimple visible={visible} role={role} onClose={onClose} confirmText="知道了" />;
  }

  return (
    <RoleRevealAnimator
      visible={visible}
      role={role}
      effectType={effectType}
      onComplete={() => setAnimationDone(true)}
    />
  );
}
