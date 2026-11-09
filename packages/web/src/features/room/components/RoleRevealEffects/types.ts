/**
 * RoleRevealEffects/types - 动画系统共享类型（游戏无关）。
 */
import type { RoleRevealEffectId } from '@game-judge/game-engine/product/rewards';

import type { RevealRoleData } from '../../model/RevealRoleData';

/**
 * 揭示特效类型 —— 直接从引擎的 canonical `ROLE_REVEAL_EFFECT_IDS` 派生。
 * 新增特效只需改引擎一处，此处自动同步，无手抄。
 */
export type RevealEffectType = RoleRevealEffectId;

/** Props every reveal effect component receives from the animator. */
export interface RevealEffectProps {
  /** 要揭示的角色（游戏无关，调用方通过 adapter 构造） */
  readonly role: RevealRoleData;
  /** 揭示动画完成时的回调，只触发一次 */
  readonly onComplete: () => void;
  /** 减少动态效果：仍等待交互，随后静态展示卡面 */
  readonly reducedMotion: boolean;
  /** 测试 ID 前缀 */
  readonly testIDPrefix: string;
  /** 轮盘类特效旋转经过的角色；调用方未提供时只有被揭示的角色 */
  readonly allRoles: readonly RevealRoleData[];
  /** cardPick 特效：剩余未查看卡牌数 */
  readonly remainingCards?: number;
}

/** RoleRevealAnimator 的 props */
export interface RoleRevealAnimatorProps {
  /** 特效类型 */
  readonly effectType: RevealEffectType;
  readonly role: RevealRoleData;
  readonly onComplete: () => void;
  /** 覆盖系统"减少动态效果"偏好 */
  readonly reducedMotion?: boolean;
  readonly testIDPrefix?: string;
  readonly allRoles?: readonly RevealRoleData[];
  readonly remainingCards?: number;
}
