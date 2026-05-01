/**
 * Generic Resolver (SERVER-ONLY, 纯函数)
 *
 * Data-driven resolver：从 ROLE_SPECS 的 abilities 声明驱动行动校验与结果计算。
 * 替代大量 pattern-identical 的独立 resolver 文件。
 *
 * 支持的 effect kinds（按 P2-P4 逐步扩展）:
 * - writeSlot: 写入 CurrentNightResults 槽位（guard/dreamcatcher/silenceElder/votebanElder/wolfQueen）
 * - chooseIdol: 选择榜样（slacker/wildChild）
 * - check: 查验阵营/身份（seer family/psychic/gargoyle/wolfWitch/pureWhite）
 * - charm: 魅惑目标（wolfQueen — writeSlot charmedSeat + result）
 * - block: 封锁目标技能（nightmare）
 * - learn: 学习目标身份和技能（wolfRobot）
 * - confirm: 确认类（hunter/darkWolfKing/avenger）
 *
 * 不处理：witch（compound 双步骤）、wolf（投票聚合）、shadow（跨角色联动）、
 * piper（多目标 + 累积催眠）、magician（swap 双目标）、awakenedGargoyle（转化逻辑）。
 * 这些角色保留 customResolver。
 */

import type { RoleId } from '../models';
import { getSeerCheckResultForTeam } from '../models/roles/spec';
import type { ActiveAbility, CheckEffect } from '../models/roles/spec/ability.types';
import { TargetConstraint } from '../models/roles/spec/ability.types';
import type { RoleSpec } from '../models/roles/spec/roleSpec.types';
import { WOLF_KILL_OVERRIDE_TEXTS } from '../models/roles/spec/schema.types';
import { ROLE_SPECS } from '../models/roles/spec/specs';
import { Team } from '../models/roles/spec/types';
import { secureRng } from '../utils/random';
import { validateConstraints } from './constraintValidator';
import { invertCheckResult } from './shared';
import type { ActionInput, ResolverContext, ResolverFn, ResolverResult } from './types';
import { getRoleAfterSwap, resolveRoleForChecks } from './types';

// =============================================================================
// Constants
// =============================================================================

const REJECT_TARGET_NOT_FOUND = '目标玩家不存在' as const;
const REJECT_MUST_CHOOSE_IDOL = '必须选择榜样' as const;

// =============================================================================
// Effect Processors
// =============================================================================

type EffectProcessor = (
  ability: ActiveAbility,
  context: ResolverContext,
  input: ActionInput,
  target: number,
) => ResolverResult;

/**
 * writeSlot: 写入 target 到 CurrentNightResults 指定槽位
 */
function processWriteSlot(
  ability: ActiveAbility,
  _context: ResolverContext,
  _input: ActionInput,
  target: number,
): ResolverResult {
  const effect = ability.effects[0];
  if (!effect || effect.kind !== 'writeSlot') {
    throw new Error(`[FAIL-FAST] Expected writeSlot effect, got ${effect?.kind}`);
  }

  const slot = effect.slot;

  // Map slot → result key for backward compat
  const resultKeyMap: Record<string, string> = {
    guardedSeat: 'guardedTarget',
    dreamingSeat: 'dreamTarget',
    silencedSeat: 'silenceTarget',
    votebannedSeat: 'votebanTarget',
    cursedSeat: 'curseTarget',
    poisonedSeat: 'poisonedTarget',
  };

  const resultKey = resultKeyMap[slot];

  return {
    valid: true,
    updates: { [slot]: target },
    result: resultKey ? { [resultKey]: target } : {},
  };
}

/**
 * charm: 魅惑目标（wolfQueen — 写入 charmedSeat + result）
 */
function processCharm(
  _ability: ActiveAbility,
  _context: ResolverContext,
  _input: ActionInput,
  target: number,
): ResolverResult {
  return {
    valid: true,
    updates: { charmedSeat: target },
    result: { charmTarget: target },
  };
}

/**
 * chooseIdol: 选择榜样（slacker/wildChild）
 */
function processChooseIdol(
  _ability: ActiveAbility,
  _context: ResolverContext,
  _input: ActionInput,
  target: number,
): ResolverResult {
  return {
    valid: true,
    result: { idolTarget: target },
  };
}

/**
 * check: 阵营查验（seer family）或身份查验（psychic/gargoyle/pureWhite/wolfWitch）
 */
function processCheck(
  ability: ActiveAbility,
  context: ResolverContext,
  _input: ActionInput,
  target: number,
): ResolverResult {
  const effect = ability.effects[0];
  if (!effect || effect.kind !== 'check') {
    throw new Error(`[FAIL-FAST] Expected check effect, got ${effect?.kind}`);
  }

  if (effect.resultType === 'faction') {
    return processFactionCheck(effect, context, target);
  }

  // identity check
  return processIdentityCheck(context, target);
}

function processFactionCheck(
  effect: CheckEffect,
  context: ResolverContext,
  target: number,
): ResolverResult {
  const effectiveRoleId = resolveRoleForChecks(context, target);
  if (!effectiveRoleId) {
    return { valid: false, rejectReason: REJECT_TARGET_NOT_FOUND };
  }

  const targetSpec = ROLE_SPECS[effectiveRoleId] as RoleSpec | undefined;
  if (!targetSpec) {
    throw new Error(`[FAIL-FAST] Unknown role after resolve: ${effectiveRoleId}`);
  }
  const normalResult = getSeerCheckResultForTeam(targetSpec.team);

  let checkResult = normalResult;
  if (effect.transformer === 'invert') {
    checkResult = invertCheckResult(normalResult);
  } else if (effect.transformer === 'random') {
    // 50% chance to invert
    const shouldInvert = secureRng() < 0.5;
    if (shouldInvert) {
      checkResult = invertCheckResult(normalResult);
    }
  }

  return {
    valid: true,
    result: { checkResult },
  };
}

function processIdentityCheck(context: ResolverContext, target: number): ResolverResult {
  const effectiveRoleId = resolveRoleForChecks(context, target);
  if (!effectiveRoleId) {
    return { valid: false, rejectReason: REJECT_TARGET_NOT_FOUND };
  }

  return {
    valid: true,
    result: { identityResult: effectiveRoleId },
  };
}

/**
 * block: 封锁目标技能（nightmare）
 */
function processBlock(
  ability: ActiveAbility,
  context: ResolverContext,
  _input: ActionInput,
  target: number,
): ResolverResult {
  const effect = ability.effects[0];
  if (!effect || effect.kind !== 'block') {
    throw new Error(`[FAIL-FAST] Expected block effect, got ${effect?.kind}`);
  }

  const updates: Record<string, unknown> = { blockedSeat: target };

  // If target is wolf team and disablesWolfKillOnWolfTarget, disable wolf kill
  if (effect.disablesWolfKillOnWolfTarget) {
    const targetRoleId = context.players.get(target);
    if (targetRoleId) {
      const targetSpec = ROLE_SPECS[targetRoleId];
      if (targetSpec.team === Team.Wolf) {
        updates.wolfKillOverride = {
          source: 'nightmare',
          ui: WOLF_KILL_OVERRIDE_TEXTS.nightmare,
        };
      }
    }
  }

  return {
    valid: true,
    updates,
    result: { blockedTarget: target },
  };
}

/**
 * learn: 学习目标身份（wolfRobot）
 */
function processLearn(
  ability: ActiveAbility,
  context: ResolverContext,
  _input: ActionInput,
  target: number,
): ResolverResult {
  const effect = ability.effects[0];
  if (!effect || effect.kind !== 'learn') {
    throw new Error(`[FAIL-FAST] Expected learn effect, got ${effect?.kind}`);
  }

  // Learn uses getRoleAfterSwap (magician swap only, no wolfRobot disguise)
  // This matches V1 wolfRobot behavior: learns the real role after swap.
  const effectiveRoleId = getRoleAfterSwap(
    target,
    context.players,
    context.currentNightResults.swappedSeats,
  );
  if (!effectiveRoleId) {
    return { valid: false, rejectReason: REJECT_TARGET_NOT_FOUND };
  }

  const result: Record<string, unknown> = {
    learnTarget: target,
    learnedRoleId: effectiveRoleId,
    identityResult: effectiveRoleId,
  };

  // Gate triggers (e.g., hunter → canShootAsHunter)
  // Resolver 仅标记"学到了 gate role"，权威 canShoot 计算由 actionHandler 层
  // 使用完整 GameState + computeCanShootForSeat 覆盖。
  if (effect.gateTriggersOnRoles?.includes(effectiveRoleId)) {
    result.canShootAsHunter = true;
  }

  return {
    valid: true,
    result,
  };
}

/**
 * confirm: 确认类（hunter/darkWolfKing confirm status）
 */
function processConfirm(
  _ability: ActiveAbility,
  _context: ResolverContext,
  _input: ActionInput,
  _target: number,
): ResolverResult {
  // Confirm actions don't produce updates — the status display is handled by
  // confirmContext.ts and the UI layer. Resolver just validates.
  return { valid: true, result: {} };
}

// =============================================================================
// Effect Processor Registry
// =============================================================================

const EFFECT_PROCESSORS: Record<string, EffectProcessor> = {
  writeSlot: processWriteSlot,
  charm: processCharm,
  chooseIdol: processChooseIdol,
  check: processCheck,
  block: processBlock,
  learn: processLearn,
  confirm: processConfirm,
};

// =============================================================================
// Generic Resolver Entry Point
// =============================================================================

/**
 * Create a generic resolver for a given V2 role spec's active ability.
 *
 * @param roleId - The role ID in ROLE_SPECS
 * @param abilityIndex - Which ability to use (default 0)
 */
export function createGenericResolver(roleId: string, abilityIndex = 0): ResolverFn {
  const spec = ROLE_SPECS[roleId as keyof typeof ROLE_SPECS] as RoleSpec | undefined;
  if (!spec) {
    throw new Error(`[FAIL-FAST] Role ${roleId} not found in ROLE_SPECS`);
  }

  const ability = spec.abilities[abilityIndex];
  if (!ability || ability.type !== 'active') {
    throw new Error(`[FAIL-FAST] Role ${roleId} ability[${abilityIndex}] is not an active ability`);
  }

  const activeAbility = ability;
  const effectKind = activeAbility.effects[0]?.kind ?? null;

  return (context: ResolverContext, input: ActionInput): ResolverResult => {
    // --- Handle skip ---
    const target = getTarget(activeAbility, input);

    if (target === undefined || target === null) {
      return handleSkip(activeAbility, context);
    }

    // --- Validate target exists ---
    if (!context.players.has(target)) {
      return { valid: false, rejectReason: REJECT_TARGET_NOT_FOUND };
    }

    // --- Validate constraints ---
    if (activeAbility.target) {
      const constraintCtx = buildConstraintContext(activeAbility, context, target);
      const constraintResult = validateConstraints(
        activeAbility.target.constraints as TargetConstraint[],
        constraintCtx,
      );
      if (!constraintResult.valid) {
        return { valid: false, rejectReason: constraintResult.rejectReason };
      }
    }

    // --- Process effect ---
    if (!effectKind) {
      return { valid: true, result: {} };
    }

    const processor = EFFECT_PROCESSORS[effectKind];
    if (!processor) {
      throw new Error(`[FAIL-FAST] No effect processor for kind '${effectKind}'`);
    }

    return processor(activeAbility, context, input, target);
  };
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Extract target from input.
 */
function getTarget(_ability: ActiveAbility, input: ActionInput): number | undefined {
  return input.target;
}

/**
 * Handle skip action. canSkip=false → reject (unless nightmare-blocked).
 */
function handleSkip(ability: ActiveAbility, context: ResolverContext): ResolverResult {
  if (ability.canSkip) {
    return { valid: true, result: {} };
  }

  // canSkip=false → normally must choose, but nightmare block exception
  if (context.currentNightResults.blockedSeat === context.actorSeat) {
    return { valid: true, result: {} };
  }

  // chooseIdol abilities require a target
  if (ability.effects.some((e: { kind: string }) => e.kind === 'chooseIdol')) {
    return { valid: false, rejectReason: REJECT_MUST_CHOOSE_IDOL };
  }

  return { valid: false, rejectReason: '必须选择目标' };
}

/**
 * Build constraint validation context, including players map for
 * faction-based constraints (NotWolfFaction, AdjacentToWolfFaction).
 */
function buildConstraintContext(
  ability: ActiveAbility,
  context: ResolverContext,
  target: number,
): {
  actorSeat: number;
  target: number;
  players?: ReadonlyMap<number, RoleId>;
  swappedSeats?: readonly [number, number];
  totalSeats?: number;
} {
  const constraints = ability.target?.constraints ?? [];
  const needsPlayers = constraints.some(
    (c: TargetConstraint) =>
      c === TargetConstraint.NotWolfFaction || c === TargetConstraint.AdjacentToWolfFaction,
  );
  const needsAdjacency = constraints.includes(TargetConstraint.AdjacentToWolfFaction);

  const result: {
    actorSeat: number;
    target: number;
    players?: ReadonlyMap<number, RoleId>;
    swappedSeats?: readonly [number, number];
    totalSeats?: number;
  } = {
    actorSeat: context.actorSeat,
    target,
  };

  if (needsPlayers) {
    result.players = context.players;
  }

  if (needsAdjacency) {
    result.swappedSeats = context.currentNightResults.swappedSeats;
    result.totalSeats = context.players.size;
  }

  return result;
}
