/**
 * FibKing 身份弹窗：迁到共享 RoleCardSimple 视觉卡（与其他游戏身份卡统一外观）。
 * 数据映射在 FibRoleCardAdapter；可见性由服务端 FibRoundView 裁剪，本组件只展示。
 * 装备了揭示动画时先播 RoleRevealAnimator，播完再切静态卡（与狼人杀/阿瓦隆同款门控）；
 * 组件按开挂载、关闭即卸载，动画状态每次打开自动重置。
 */

import type { FibRoundView } from '@game-judge/game-engine/games/fibking/public';
import type React from 'react';
import { memo, useState } from 'react';

import { RoleCardSimple } from '@/features/room/components/RoleCardSimple';
import { RoleRevealAnimator } from '@/features/room/components/RoleRevealEffects/RoleRevealAnimator';
import type { RevealEffectType } from '@/features/room/components/RoleRevealEffects/types';
import { TESTIDS } from '@/testids';

import { toFibRevealRoleData } from './FibRoleCardAdapter';

interface FibIdentityModalProps {
  readonly view: FibRoundView;
  readonly onClose: () => void;
  /** 装备的揭示动画；null/undefined 则直接显示静态卡（未装备装饰）。 */
  readonly effectType?: RevealEffectType | null;
}

const FibIdentityModalComponent: React.FC<FibIdentityModalProps> = ({
  view,
  onClose,
  effectType,
}) => {
  const [animationDone, setAnimationDone] = useState(false);
  const role = toFibRevealRoleData(view);

  if (effectType != null && !animationDone) {
    return (
      <RoleRevealAnimator
        visible={true}
        role={role}
        effectType={effectType}
        onComplete={() => setAnimationDone(true)}
      />
    );
  }

  return (
    <RoleCardSimple
      visible={true}
      role={role}
      onClose={onClose}
      confirmText="知道了"
      testID={TESTIDS.fibIdentityModal}
      nameTestID={TESTIDS.fibIdentityRole}
    />
  );
};

export const FibIdentityModal = memo(FibIdentityModalComponent);
