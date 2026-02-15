/**
 * Wolf Robot Resolver (HOST-ONLY, 纯函数)
 *
 * 职责：校验机器狼学习行动 + 返回精确角色身份 + 计算 canShootAsHunter
 *
 * ✅ 允许：学习行动校验 + 猎人技能继承判定（是否被女巫毒 → 不能开枪）
 * ❌ 禁止：IO（网络 / 音频 / Alert）
 *
 * NOTE: Nightmare block guard is handled at actionHandler layer (single-point guard).
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';
import { SCHEMAS } from '@werewolf/game-engine/models/roles/spec/schemas';
import { validateConstraints } from '@werewolf/game-engine/resolvers/constraintValidator';
import type {
  ActionInput,
  ResolverContext,
  WolfRobotResolverResult,
} from '@werewolf/game-engine/resolvers/types';
import { getRoleAfterSwap } from '@werewolf/game-engine/resolvers/types';

// =============================================================================
// 内部强类型定义（编译期保证 learnedRoleId 必须存在）
// =============================================================================

/**
 * 跳过学习时的返回类型
 */
interface SkipResult {
  readonly valid: true;
  readonly result: Record<string, never>;
}

/**
 * 成功学习时的返回类型（learnedRoleId 编译期必填）
 */
interface LearnSuccessResult {
  readonly valid: true;
  readonly result: {
    readonly learnTarget: number;
    readonly learnedRoleId: RoleId; // 编译期必填
    readonly identityResult: RoleId;
    readonly canShootAsHunter?: boolean;
  };
}

/**
 * 校验失败时的返回类型
 */
interface RejectResult {
  readonly valid: false;
  readonly rejectReason: string;
}

/**
 * Resolver 内部使用的严格类型（union 分支）
 *
 * 这个类型在编译期强制：
 * - 返回 learnTarget 时必须同时返回 learnedRoleId
 * - 所有 return 语句都必须满足其中一个分支
 */
type StrictWolfRobotResult = SkipResult | LearnSuccessResult | RejectResult;

/**
 * Wolf Robot Learn Resolver
 *
 * 编译期类型安全保证：
 * - 内部使用 StrictWolfRobotResult（union 分支）确保 learnedRoleId 必须存在
 * - 外部返回 WolfRobotResolverResult（兼容 ResolverResult）供测试和调用方使用
 */
export const wolfRobotLearnResolver = (
  context: ResolverContext,
  input: ActionInput,
): WolfRobotResolverResult => {
  const { actorSeat, players, currentNightResults } = context;
  const target = input.target;

  // 内部函数使用严格类型（编译期保证 learnedRoleId 必须存在）
  const resolve = (): StrictWolfRobotResult => {
    // Allow skip (schema.canSkip: true)
    if (target === undefined || target === null) {
      return { valid: true, result: {} };
    }

    // Block guard is handled at actionHandler layer (single-point guard)

    // Validate constraints from schema
    const schema = SCHEMAS.wolfRobotLearn;
    const constraintResult = validateConstraints(schema.constraints, { actorSeat, target });
    if (!constraintResult.valid) {
      return { valid: false, rejectReason: constraintResult.rejectReason ?? '约束校验失败' };
    }

    // Target must exist (check original role)
    const originalRoleId = players.get(target);
    if (!originalRoleId) {
      return { valid: false, rejectReason: '目标玩家不存在' };
    }

    // Get effective role after magician swap (if any)
    const effectiveRoleId = getRoleAfterSwap(target, players, currentNightResults.swappedSeats);
    if (!effectiveRoleId) {
      return { valid: false, rejectReason: '目标玩家不存在' };
    }

    // If learned hunter, compute canShootAsHunter
    // Rule: cannot shoot if poisoned by witch
    let canShootAsHunter: boolean | undefined;
    if (effectiveRoleId === 'hunter') {
      // Check if wolfRobot (actorSeat) is poisoned by witch
      const poisonedSeat = currentNightResults.poisonedSeat;
      canShootAsHunter = poisonedSeat !== actorSeat;
    }

    // Return learned role identity (after swap)
    // NOTE: TypeScript 在这里强制 learnedRoleId 必须是 RoleId 类型
    return {
      valid: true,
      result: {
        learnTarget: target,
        learnedRoleId: effectiveRoleId, // 编译期必填
        identityResult: effectiveRoleId,
        canShootAsHunter,
      },
    };
  };

  // 调用内部函数并返回（StrictWolfRobotResult 兼容 WolfRobotResolverResult）
  return resolve();
};
