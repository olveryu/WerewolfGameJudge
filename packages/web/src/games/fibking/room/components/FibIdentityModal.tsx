/**
 * FibKing 身份弹窗：共享 RoleCardDialog 视觉卡（与其他游戏身份卡统一外观）。
 * 数据映射在 FibRoleCardAdapter；可见性由服务端 FibRoundView 裁剪，本组件只展示。
 * 揭示动画走共享 RevealAnimationGate：是否播放由服务端的查看记录锚定
 * （shouldPlay，身份查看协议），本组件不再维护本地动画状态。
 * 挂载即展示、卸载即隐藏。
 */
import type { FibRoundView } from '@game-judge/game-engine/games/fibking/public';

import { RoleCardDialog } from '@/features/room/components/RoleCard';
import { RevealAnimationGate } from '@/features/room/components/RoleRevealEffects/RevealAnimationGate';
import type { RevealEffectType } from '@/features/room/components/RoleRevealEffects/types';
import type { RevealRoleData } from '@/features/room/model/RevealRoleData';
import { TESTIDS } from '@/testids';

import { toFibRevealRoleData } from './FibRoleCardAdapter';

interface FibIdentityModalProps {
  readonly view: FibRoundView;
  /** 装备的揭示动画；null 则直接显示静态卡（未装备装饰）。 */
  readonly effectType: RevealEffectType | null;
  /** 是否播放揭示动画（服务端查看记录锚点，由 hook 计算）。 */
  readonly shouldPlay: boolean;
  /** Animator 的角色池（只有种类与计数，零泄密）。 */
  readonly allRoles: readonly RevealRoleData[];
  /** 桌上未看牌数（已占座位数 − 已查看数）。 */
  readonly remainingCards: number;
  /** 关闭：查看记录已在弹卡前落下（useRoleViewing），这里只收起卡片。 */
  readonly onClose: () => void;
}

/** Shows the viewer's FibKing identity or the public round result; mounted means open. */
export function FibIdentityModal({
  view,
  effectType,
  shouldPlay,
  allRoles,
  remainingCards,
  onClose,
}: FibIdentityModalProps) {
  const role = toFibRevealRoleData(view);
  return (
    <RevealAnimationGate
      visible
      effectType={effectType}
      shouldPlay={shouldPlay}
      role={role}
      allRoles={allRoles}
      remainingCards={remainingCards}
    >
      <RoleCardDialog
        role={role}
        onClose={onClose}
        confirmText="知道了"
        testId={TESTIDS.fibIdentityModal}
        nameTestId={TESTIDS.fibIdentityRole}
      />
    </RevealAnimationGate>
  );
}
