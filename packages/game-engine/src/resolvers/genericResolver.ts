/**
 * Generic Resolver (SERVER-ONLY, 纯函数)
 *
 * Data-driven resolver：从 ROLE_SPECS_V2 的 abilities 声明驱动行动校验与结果计算。
 * 替代大量 pattern-identical 的独立 resolver 文件。
 *
 * 支持的 effect kinds（按 P2-P4 逐步扩展）:
 * - writeSlot: 写入 CurrentNightResults 槽位（guard/dreamcatcher/silenceElder/votebanElder/wolfQueen）
 * - chooseIdol: 选择榜样（slacker/wildChild）
 * - check: 查验阵营/身份（seer family/psychic/gargoyle/wolfWitch/pureWhite）
 * - charm: 魅惑目标（wolfQueen — writeSlot 的语义变体）
 * - block: 封锁目标技能（nightmare）
 * - learn: 学习目标身份和技能（wolfRobot）
 * - hypnotize: 催眠多目标（piper）
 * - convert: 转化目标阵营（awakenedGargoyle）
 *
 * 不处理：witch（compound 双步骤）、wolf（投票聚合）、shadow（跨角色联动）。
 * 这些角色保留 customResolver。
 */

import type { RoleId } from '../models';
import { getSeerCheckResultForTeam, ROLE_SPECS } from '../models/roles/spec';
import { Team } from '../models/roles/spec/types';
import type { ActiveAbility, CheckEffect } from '../models/roles/spec/v2/ability.types';
import { TargetConstraint } from '../models/roles/spec/v2/ability.types';
import type { RoleSpecV2 } from '../models/roles/spec/v2/roleSpec.types';
import { ROLE_SPECS_V2 } from '../models/roles/spec/v2/specs';
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
  if (effect.kind !== 'writeSlot') {
    throw new Error(`[FAIL-FAST] Expected writeSlot effect, got ${effect.kind}`);
  }

  const slot = effect.slot;

  // Map slot → result key for backward compat
  const resultKeyMap: Record<string, string> = {
    guardedSeat: 'guardedTarget',
    dreamingSeat: 'dreamTarget',
    silencedSeat: 'silenceTarget',
    votebannedSeat: 'votebanTarget',
  };

  const resultKey = resultKeyMap[slot];

  return {
    valid: true,
    updates: { [slot]: target },
    result: resultKey ? { [resultKey]: target } : {},
  };
}

/**
 * charm: 魅惑目标（wolfQueen — 不写 updates，只 result）
 */
function processCharm(
  _ability: ActiveAbility,
  _context: ResolverContext,
  _input: ActionInput,
  target: number,
): ResolverResult {
  return {
    valid: true,
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
  const effect = ability.effects[0] as CheckEffect;

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

  const targetSpec = ROLE_SPECS[effectiveRoleId];
  const normalResult = getSeerCheckResultForTeam(targetSpec.team);

  let checkResult = normalResult;
  if (effect.transformer === 'invert') {
    checkResult = invertCheckResult(normalResult);
  } else if (effect.transformer === 'random') {
    // 50% chance to invert
    const shouldInvert = crypto.getRandomValues(new Uint8Array(1))[0] < 128;
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
  if (effect.kind !== 'block') {
    throw new Error(`[FAIL-FAST] Expected block effect, got ${effect.kind}`);
  }

  const updates: Record<string, unknown> = { blockedSeat: target };

  // If target is wolf team and disablesWolfKillOnWolfTarget, disable wolf kill
  if (effect.disablesWolfKillOnWolfTarget) {
    const targetRoleId = context.players.get(target);
    if (targetRoleId) {
      const targetSpec = ROLE_SPECS[targetRoleId];
      if (targetSpec.team === Team.Wolf) {
        updates.wolfKillDisabled = true;
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
  if (effect.kind !== 'learn') {
    throw new Error(`[FAIL-FAST] Expected learn effect, got ${effect.kind}`);
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
  if (effect.gateTriggersOnRoles?.includes(effectiveRoleId)) {
    // wolfRobot: canShoot=false if wolfRobot itself is poisoned
    const isPoisoned = context.currentNightResults.poisonedSeat === context.actorSeat;
    result.canShootAsHunter = !isPoisoned;
  }

  return {
    valid: true,
    result,
  };
}

/**
 * hypnotize: 催眠多目标（piper）
 */
function processHypnotize(
  _ability: ActiveAbility,
  _context: ResolverContext,
  input: ActionInput,
  _target: number,
): ResolverResult {
  // Piper uses multiChooseSeat — targets come from input.targets
  const targets = input.targets;
  if (!targets || targets.length === 0) {
    return { valid: true, result: {} };
  }

  // Deduplicate
  const uniqueTargets = [...new Set(targets)];

  return {
    valid: true,
    updates: { hypnotizedSeats: uniqueTargets },
    result: { hypnotizedTargets: uniqueTargets },
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
  hypnotize: processHypnotize,
  confirm: processConfirm,
};

// =============================================================================
// Generic Resolver Entry Point
// =============================================================================

/**
 * Create a generic resolver for a given V2 role spec's active ability.
 *
 * @param roleId - The role ID in ROLE_SPECS_V2
 * @param abilityIndex - Which ability to use (default 0)
 */
export function createGenericResolver(roleId: string, abilityIndex = 0): ResolverFn {
  const spec = ROLE_SPECS_V2[roleId as keyof typeof ROLE_SPECS_V2] as RoleSpecV2 | undefined;
  if (!spec) {
    throw new Error(`[FAIL-FAST] Role ${roleId} not found in ROLE_SPECS_V2`);
  }

  const ability = spec.abilities[abilityIndex];
  if (!ability || ability.type !== 'active') {
    throw new Error(`[FAIL-FAST] Role ${roleId} ability[${abilityIndex}] is not an active ability`);
  }

  const activeAbility = ability;
  const effectKind = activeAbility.effects.length > 0 ? activeAbility.effects[0].kind : null;

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
 * Extract target from input based on action kind.
 * multiChooseSeat uses targets[0] as primary (for constraint validation),
 * but the full targets array is passed via input.
 */
function getTarget(ability: ActiveAbility, input: ActionInput): number | undefined {
  if (ability.actionKind === 'multiChooseSeat') {
    return input.targets?.[0];
  }
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
