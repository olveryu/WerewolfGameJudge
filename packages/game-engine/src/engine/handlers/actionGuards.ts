/**
 * Action guards — precondition validation and nightmare block check.
 *
 * Pure predicates called by handleSubmitAction before resolver dispatch.
 * Exported `isSkipAction` and `checkNightmareBlockGuard` are also consumed by tests.
 */

import {
  type ActionSchema,
  doesRoleParticipateInWolfVote,
  GameStatus,
  type RoleId,
  type SchemaId,
  SCHEMAS,
} from '../../models';
import { BLOCKED_UI_DEFAULTS, getStepSpec, NIGHT_STEPS } from '../../models/roles/spec';
import { RESOLVERS } from '../../resolvers';
import type { ActionInput } from '../../resolvers/types';
import type { HandlerResult, NonNullState } from './types';

/**
 * Check if the given step is a bottom card role's chosen card role's step.
 *
 * Used for Gate 4b override and for resolver role substitution.
 * Supports both treasureMaster and thief.
 */
export function isBottomCardActorOverride(state: NonNullState, stepId: SchemaId): boolean {
  // treasureMaster
  if (state.treasureMasterChosenCard) {
    const step = getStepSpec(stepId);
    if (step && step.roleId === state.treasureMasterChosenCard) return true;
  }
  // thief
  if (state.thiefChosenCard) {
    const step = getStepSpec(stepId);
    if (step && step.roleId === state.thiefChosenCard) return true;
  }
  return false;
}

/**
 * 根据角色获取对应的 SchemaId
 */
function getSchemaIdForRole(role: RoleId): SchemaId | null {
  for (const step of NIGHT_STEPS) {
    if (step.roleId === role) {
      return step.id;
    }
  }
  return null;
}

/**
 * 验证前置条件（PR4 完整 gate）
 *
 * Gate 顺序（必须遵守）：
 * 1. no_state
 * 2. invalid_status (must be ongoing)
 * 3. forbidden_while_audio_playing
 * 4. invalid_step (currentStepId 必须存在且匹配)
 * 5. not_seated (actor seat 必须有玩家)
 * 6. schema constraints (由 resolver 处理)
 */
export function validateActionPreconditions(
  state: NonNullState | null,
  actorSeat: number,
  role: RoleId,
):
  | { valid: false; result: HandlerResult }
  | { valid: true; schemaId: SchemaId; state: NonNullState; schema: ActionSchema } {
  // Gate 1: no_state
  if (!state) {
    return {
      valid: false,
      result: { success: false, reason: 'no_state', actions: [] },
    };
  }

  // Gate 2: invalid_status (must be ongoing)
  if (state.status !== GameStatus.Ongoing) {
    return {
      valid: false,
      result: { success: false, reason: 'invalid_status', actions: [] },
    };
  }

  // Gate 3: forbidden_while_audio_playing
  if (state.isAudioPlaying) {
    return {
      valid: false,
      result: { success: false, reason: 'forbidden_while_audio_playing', actions: [] },
    };
  }

  // Gate 4: invalid_step (currentStepId 必须存在且能在 SCHEMAS 里找到)
  const currentStepId = state.currentStepId;
  if (!currentStepId) {
    return {
      valid: false,
      result: { success: false, reason: 'invalid_step', actions: [] },
    };
  }

  const schema = SCHEMAS[currentStepId];
  if (!schema) {
    return {
      valid: false,
      result: { success: false, reason: 'invalid_step', actions: [] },
    };
  }

  // Gate 4b: step mismatch - 提交的 role 必须与当前 step 对应
  const expectedSchemaId = getSchemaIdForRole(role);
  // Special case: wolfKill is a meeting step shared by multiple wolf-team roles
  // (e.g. wolf, spiritKnight, wolfQueen...). For this step we validate participation
  // via ROLE_SPECS[*].wolfMeeting.participatesInWolfVote instead of role->schema mapping.
  if (currentStepId === 'wolfKill' && doesRoleParticipateInWolfVote(role)) {
    // ok
  } else if (
    (role === 'treasureMaster' || role === 'thief') &&
    isBottomCardActorOverride(state, currentStepId)
  ) {
    // Bottom card role acting on the chosen card's step — allowed
  } else if (expectedSchemaId !== currentStepId) {
    return {
      valid: false,
      result: { success: false, reason: 'step_mismatch', actions: [] },
    };
  }

  // Gate 5: not_seated (actor seat 必须有玩家)
  const player = state.players[actorSeat];
  if (!player) {
    return {
      valid: false,
      result: { success: false, reason: 'not_seated', actions: [] },
    };
  }

  // Gate 5b: 玩家角色必须匹配
  if (player.role !== role) {
    return {
      valid: false,
      result: { success: false, reason: 'role_mismatch', actions: [] },
    };
  }

  // Gate 6: resolver 存在性检查
  if (!RESOLVERS[currentStepId]) {
    return {
      valid: false,
      result: { success: false, reason: 'no_resolver', actions: [] },
    };
  }

  return { valid: true, schemaId: currentStepId, state, schema };
}

// =============================================================================
// Nightmare Block Guard (Single-point guard, schema-aware)
// =============================================================================

/**
 * Schema-aware skip 判断
 *
 * 根据 schema.kind 判断本次提交是否为 skip（无实际行动）
 *
 * @param schema - 当前步骤的 schema 定义
 * @param actionInput - 玩家提交的 action input
 * @returns true 表示是 skip，false 表示是实际行动
 */
export function isSkipAction(schema: ActionSchema, actionInput: ActionInput): boolean {
  switch (schema.kind) {
    case 'confirm':
      // confirm 类型：confirmed !== true 视为 skip
      return actionInput.confirmed !== true;

    case 'chooseSeat':
    case 'wolfVote':
      // 选择座位类型：target == null 视为 skip
      return actionInput.target === undefined || actionInput.target === null;

    case 'multiChooseSeat':
      // 多目标选择类型：targets 为空视为 skip
      return !actionInput.targets || actionInput.targets.length === 0;

    case 'swap':
      // 交换类型：targets 为空视为 skip
      return !actionInput.targets || actionInput.targets.length === 0;

    case 'compound': {
      // 复合类型：stepResults 为空或所有 step 都是 null 视为 skip
      if (!actionInput.stepResults) return true;
      const results = Object.values(actionInput.stepResults);
      // empty array is considered skip; all-null is also skip
      if (results.length === 0) return true;
      return results.every((v) => v === null);
    }

    case 'groupConfirm':
      // groupConfirm 类型：确认步骤，永远不是 skip
      return false;

    case 'chooseCard':
      // 选卡类型：cardIndex == null 视为 skip
      return actionInput.cardIndex === undefined || actionInput.cardIndex === null;

    default:
      // 未知类型：安全策略 - 统一视为 non-skip
      // 被 block 时宁可多 reject，避免漏过非法输入
      return false;
  }
}

/**
 * 统一的 nightmare block 校验（单点 guard，schema-aware）
 *
 * 规则（MUST follow）：
 *
 * 1. 被梦魇封锁 = 规则禁止输入，只能跳过
 *    - 被 block 时：只有 skip 是 valid，任何非 skip 行动都必须 reject
 *
 * 2. confirm 类（hunter/darkWolfKing）的 skip 规则：
 *    - 未被 block 时：不允许 skip（confirmed 不是 true 就是非法输入 → reject）
 *    - 被 block 时：只允许 skip（confirmed===true 也要 reject；只有"跳过"才 valid）
 *
 * 3. 其他类（chooseSeat/wolfVote/swap/compound）：
 *    - 被 block 时：只允许 skip
 *    - 未被 block 时：不做额外限制
 *
 * @param seat - 行动者座位
 * @param schema - 当前步骤的 schema 定义
 * @param actionInput - 构建好的 ActionInput（包含所有 payload 字段）
 * @param blockedSeat - 被梦魇封锁的座位
 * @returns rejectReason if rejected, undefined if allowed
 */
export function checkNightmareBlockGuard(
  seat: number,
  schema: ActionSchema,
  actionInput: ActionInput,
  blockedSeat: number | undefined,
): string | undefined {
  const isBlocked = blockedSeat === seat;
  const isSkip = isSkipAction(schema, actionInput);

  // confirm 类的特殊规则：未被 block 时不允许 skip
  if (schema.kind === 'confirm') {
    if (!isBlocked && isSkip) {
      return '当前无法跳过，请执行行动';
    }
    if (isBlocked && !isSkip) {
      return BLOCKED_UI_DEFAULTS.message;
    }
    return undefined;
  }

  // 其他 schema：被 block 时只允许 skip
  if (isBlocked && !isSkip) {
    return BLOCKED_UI_DEFAULTS.message;
  }

  return undefined;
}
