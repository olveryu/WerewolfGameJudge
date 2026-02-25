/**
 * Shared Resolver Utilities — DRY 提取
 *
 * 提供通用常量和工厂函数，消除 resolver 间的重复逻辑。
 * 仅包含纯函数和常量，不包含 IO。
 */

import { ROLE_SPECS } from '../models/roles';
import type { SchemaId } from '../models/roles/spec/schemas';
import { SCHEMAS } from '../models/roles/spec/schemas';
import { getSeerCheckResultForTeam } from '../models/roles/spec/types';
import { validateConstraints } from './constraintValidator';
import type { ResolverFn, ResolverResult } from './types';
import { resolveRoleForChecks } from './types';

// =============================================================================
// 共享常量
// =============================================================================

/** 目标玩家不存在（所有 resolver 共用的拒绝理由） */
export const REJECT_TARGET_NOT_FOUND = '目标玩家不存在' as const;

/** 必须选择榜样（wildChild / slacker 共用） */
export const REJECT_MUST_CHOOSE_IDOL = '必须选择榜样' as const;

/**
 * 反转预言家查验结果：'好人' → '狼人'，'狼人' → '好人'
 *
 * 被 mirrorSeer（固定反转）和 drunkSeer（随机反转）共用。
 */
export function invertCheckResult(result: '好人' | '狼人'): '好人' | '狼人' {
  return result === '好人' ? '狼人' : '好人';
}

// =============================================================================
// Resolver 工厂函数
// =============================================================================

/**
 * 创建 identity-check resolver（psychic / gargoyle / pureWhite / wolfWitch）
 *
 * 算法：canSkip → validateConstraints → target exists → resolveRoleForChecks → identityResult
 * 唯一差异：schemaId + wolfWitch 需要传 players 给 constraint 校验。
 *
 * @param schemaId - schema key（如 'psychicCheck'）
 * @param options.passPlayersToConstraints - 是否将 players 传入 validateConstraints（wolfWitch 的 notWolfFaction 需要）
 */
export function createIdentityCheckResolver(
  schemaId: SchemaId,
  options?: { passPlayersToConstraints?: boolean },
): ResolverFn {
  return (context, input): ResolverResult => {
    const { actorSeat, players } = context;
    const target = input.target;

    // Allow skip (schema.canSkip: true)
    if (target === undefined || target === null) {
      return { valid: true, result: {} };
    }

    // Validate constraints from schema (all identity-check schemas are chooseSeat kind)
    const schema = SCHEMAS[schemaId];
    if (!('constraints' in schema)) {
      throw new Error(`Schema ${schemaId} does not have constraints`);
    }
    const constraintCtx = options?.passPlayersToConstraints
      ? { actorSeat, target, players }
      : { actorSeat, target };
    const constraintResult = validateConstraints(schema.constraints, constraintCtx);
    if (!constraintResult.valid) {
      return { valid: false, rejectReason: constraintResult.rejectReason };
    }

    // Target must exist (check original role)
    const originalRoleId = players.get(target);
    if (!originalRoleId) {
      return { valid: false, rejectReason: REJECT_TARGET_NOT_FOUND };
    }

    // Get effective role using unified resolution (magician swap + wolfRobot disguise)
    const effectiveRoleId = resolveRoleForChecks(context, target);
    if (!effectiveRoleId) {
      return { valid: false, rejectReason: REJECT_TARGET_NOT_FOUND };
    }

    // Return exact role identity (after swap and disguise)
    return {
      valid: true,
      result: { identityResult: effectiveRoleId },
    };
  };
}

/**
 * 预言家查验结果变换器类型
 *
 * - seer: 原样返回
 * - mirrorSeer: 反转
 * - drunkSeer: 随机（外部传入）
 */
export type CheckResultTransformer = (normalResult: '好人' | '狼人') => '好人' | '狼人';

/**
 * 创建 seer-family check resolver（seer / mirrorSeer / drunkSeer）
 *
 * 算法：canSkip → validateConstraints → target exists → resolveRoleForChecks
 *       → getSeerCheckResultForTeam → transformer → checkResult
 *
 * @param schemaId - schema key（如 'seerCheck'）
 * @param transformer - 查验结果变换器（identity / invert / random）
 */
export function createSeerCheckResolver(
  schemaId: SchemaId,
  transformer: CheckResultTransformer,
): ResolverFn {
  return (context, input): ResolverResult => {
    const { actorSeat, players } = context;
    const target = input.target;

    // Schema allows skip (canSkip: true)
    if (target === undefined || target === null) {
      return { valid: true, result: {} };
    }

    // Validate constraints from schema (all seer-family schemas are chooseSeat kind)
    const schema = SCHEMAS[schemaId];
    if (!('constraints' in schema)) {
      throw new Error(`Schema ${schemaId} does not have constraints`);
    }
    const constraintResult = validateConstraints(schema.constraints, { actorSeat, target });
    if (!constraintResult.valid) {
      return { valid: false, rejectReason: constraintResult.rejectReason };
    }

    // Target must exist
    const originalRoleId = players.get(target);
    if (!originalRoleId) {
      return { valid: false, rejectReason: REJECT_TARGET_NOT_FOUND };
    }

    // Get effective role using unified resolution (magician swap + wolfRobot disguise)
    const effectiveRoleId = resolveRoleForChecks(context, target);
    if (!effectiveRoleId) {
      return { valid: false, rejectReason: REJECT_TARGET_NOT_FOUND };
    }

    // Compute result with transformer
    const targetSpec = ROLE_SPECS[effectiveRoleId];
    const normalResult = getSeerCheckResultForTeam(targetSpec.team);
    const checkResult = transformer(normalResult);

    return {
      valid: true,
      result: { checkResult },
    };
  };
}

/**
 * 创建 choose-idol resolver（wildChild / slacker）
 *
 * 算法：canSkip=false（nightmare 阻断例外）→ validateConstraints → target exists → idolTarget
 *
 * @param schemaId - schema key（如 'wildChildChooseIdol'）
 */
export function createChooseIdolResolver(schemaId: SchemaId): ResolverFn {
  return (context, input): ResolverResult => {
    const { actorSeat, players, currentNightResults } = context;
    const target = input.target;

    // Normally must choose someone (canSkip=false)
    // But if blocked, skip is allowed (forced by nightmare block)
    if (target === undefined || target === null) {
      if (currentNightResults.blockedSeat === actorSeat) {
        return { valid: true, result: {} };
      }
      return { valid: false, rejectReason: REJECT_MUST_CHOOSE_IDOL };
    }

    // Validate constraints from schema (all choose-idol schemas are chooseSeat kind)
    const schema = SCHEMAS[schemaId];
    if (!('constraints' in schema)) {
      throw new Error(`Schema ${schemaId} does not have constraints`);
    }
    const constraintResult = validateConstraints(schema.constraints, { actorSeat, target });
    if (!constraintResult.valid) {
      return { valid: false, rejectReason: constraintResult.rejectReason };
    }

    // Target must exist
    if (!players.has(target)) {
      return { valid: false, rejectReason: REJECT_TARGET_NOT_FOUND };
    }

    return {
      valid: true,
      result: { idolTarget: target },
    };
  };
}
