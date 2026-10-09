/**
 * RoleRevealEffects/types - 动画系统共享类型（游戏无关）。
 *
 * 从狼人杀 types.ts 移植：
 * - 删除 `RoleData`（统一用 `RevealRoleData`）
 * - `RoleAlignment` 保留（与 `RevealAlignment` 同值）
 * - `AlignmentTheme` + `createAlignmentThemes` 已通用，直接保留
 */
import type { RoleRevealEffectId } from '@game-judge/game-engine/product/rewards';

import type { RevealRoleData } from '../../model/RevealRoleData';

/**
 * 揭示特效类型 —— 直接从引擎的 canonical `ROLE_REVEAL_EFFECT_IDS` 派生。
 * 新增特效只需改引擎一处，此处自动同步，无手抄。
 */
export type RevealEffectType = RoleRevealEffectId;

/**
 * 所有揭示特效组件的通用 props
 */
export interface RevealEffectProps {
  /** 要揭示的角色（游戏无关，调用方通过 adapter 构造） */
  readonly role: RevealRoleData;
  /** 揭示动画完成时的回调 */
  readonly onComplete: () => void;
  /** 是否尊重系统"减少动态效果"偏好 */
  readonly reducedMotion?: boolean;
  /** 是否启用触觉反馈（仅移动端） */
  readonly enableHaptics?: boolean;
  /** 测试 ID 前缀 */
  readonly testIDPrefix?: string;
}

/**
 * RoleRevealAnimator 的 props
 */
export interface RoleRevealAnimatorProps extends RevealEffectProps {
  /** 特效类型 */
  readonly effectType: RevealEffectType;
  /** 是否可见 */
  readonly visible: boolean;
  /** 轮盘类特效：所有角色列表 */
  readonly allRoles?: readonly RevealRoleData[];
  /** cardPick 特效：剩余未查看卡牌数 */
  readonly remainingCards?: number;
}
