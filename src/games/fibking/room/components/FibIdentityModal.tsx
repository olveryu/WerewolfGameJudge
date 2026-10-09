/**
 * FibKing 身份弹窗：共享 RoleCardSimple 视觉卡（与其他游戏身份卡统一外观）。
 * 数据映射在 FibRoleCardAdapter；可见性由服务端 FibRoundView 裁剪，本组件只展示。
 * 揭示动画走共享 RevealAnimationGate：是否播放由服务端的查看记录锚定
 * （shouldPlay，身份查看协议），本组件不再维护本地动画状态。
 * viewing 阶段未确认时，确认按钮即查看确认（onConfirm 提交服务端记录）。
 */

import type { FibRoundView } from '@game-judge/game-engine/games/fibking/public';
import type React from 'react';
import { memo } from 'react';

import { RevealAnimationGate } from '@/features/room/components/RevealAnimationGate';
import { RoleCardSimple } from '@/features/room/components/RoleCardSimple';
import type { RevealEffectType } from '@/features/room/components/RoleRevealEffects/types';
import type { RevealRoleData } from '@/features/room/model/RevealRoleData';
import { TESTIDS } from '@/testids';

import { toFibRevealRoleData } from './FibRoleCardAdapter';

interface FibIdentityModalProps {
  readonly view: FibRoundView;
  /** 装备的揭示动画；null/undefined 则直接显示静态卡（未装备装饰）。 */
  readonly effectType?: RevealEffectType | null;
  /** 是否播放揭示动画（服务端查看记录锚点，由 hook 计算）。 */
  readonly shouldPlay: boolean;
  /** Animator 的角色池（只有种类与计数，零泄密）。 */
  readonly allRoles: readonly RevealRoleData[];
  /** 确认按钮文案：viewing 未确认时为「我已看清」，其余为「知道了」。 */
  readonly confirmText: string;
  /** 确认按钮动作：viewing 未确认时提交查看记录并关闭，其余等同关闭。 */
  readonly onConfirm: () => void;
}

const FibIdentityModalComponent: React.FC<FibIdentityModalProps> = ({
  view,
  effectType,
  shouldPlay,
  allRoles,
  confirmText,
  onConfirm,
}) => {
  const role = toFibRevealRoleData(view);
  const card = (
    <RoleCardSimple
      visible={true}
      role={role}
      onClose={onConfirm}
      confirmText={confirmText}
      testID={TESTIDS.fibIdentityModal}
      nameTestID={TESTIDS.fibIdentityRole}
    />
  );

  if (effectType == null) return card;

  return (
    <RevealAnimationGate
      visible={true}
      effectType={effectType}
      shouldPlay={shouldPlay}
      role={role}
      allRoles={allRoles}
    >
      {card}
    </RevealAnimationGate>
  );
};

export const FibIdentityModal = memo(FibIdentityModalComponent);
