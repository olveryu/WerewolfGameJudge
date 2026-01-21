/**
 * Action Handler - 夜晚行动处理器
 *
 * 处理 SUBMIT_ACTION / SUBMIT_WOLF_VOTE / VIEWED_ROLE intent
 * 调用 resolver 验证和计算结果
 */

import type { SubmitActionIntent, SubmitWolfVoteIntent, ViewedRoleIntent } from '../intents/types';
import type { HandlerContext, HandlerResult } from './types';
import type {
  RecordActionAction,
  ApplyResolverResultAction,
  RecordWolfVoteAction,
  PlayerViewedRoleAction,
  ActionRejectedAction,
} from '../reducer/types';
import type { ProtocolAction } from '../../protocol/types';
import type { SchemaId } from '../../../models/roles/spec';
import { RESOLVERS } from '../../night/resolvers';
import { NIGHT_STEPS, SCHEMAS } from '../../../models/roles/spec';
import type { ResolverContext, ActionInput, ResolverResult } from '../../night/resolvers/types';
import type { RoleId } from '../../../models/roles';

import { doesRoleParticipateInWolfVote } from '../../../models/roles';

/**
 * 非 null 的 state 类型（通过 validation 后使用）
 */
type NonNullState = NonNullable<HandlerContext['state']>;

/**
 * 构建 Resolver 上下文
 */
function buildResolverContext(
  state: NonNullState,
  actorSeat: number,
  actorRoleId: RoleId,
): ResolverContext {
  // 构建 players: seat -> role
  const players = new Map<number, RoleId>();
  for (const [seatStr, player] of Object.entries(state.players)) {
    if (player?.role) {
      players.set(Number.parseInt(seatStr, 10), player.role);
    }
  }

  return {
    actorSeat,
    actorRoleId,
    players,
    currentNightResults: state.currentNightResults ?? {},
    gameState: {
      witchHasAntidote: state.witchContext?.canSave,
      witchHasPoison: state.witchContext?.canPoison,
      isNight1: true, // Night-1 only
    },
  };
}

/**
 * 构建 ActionInput
 */
function buildActionInput(
  schemaId: SchemaId,
  target: number | null,
  extra?: Record<string, unknown>,
): ActionInput {
  return {
    schemaId,
    target: target ?? undefined,
    confirmed: extra?.confirmed as boolean | undefined,
    targets: extra?.targets as readonly number[] | undefined,
    stepResults: extra?.stepResults as Record<string, number | null> | undefined,
  };
}

function getActionTimestamp(extra?: Record<string, unknown>): number {
  const maybe = extra?.timestamp;
  return typeof maybe === 'number' ? maybe : Date.now();
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
 * 从 resolver result 构建 ApplyResolverResultAction payload
 */
function buildRevealPayload(
  result: ResolverResult,
  role: RoleId,
  targetSeat: number,
): ApplyResolverResultAction['payload'] {
  const payload: ApplyResolverResultAction['payload'] = {
    updates: result.updates,
  };

  // 根据角色类型设置对应的 reveal
  if (result.result?.checkResult && role === 'seer') {
    payload.seerReveal = { targetSeat, result: result.result.checkResult };
  }
  if (result.result?.identityResult) {
    if (role === 'psychic') {
      payload.psychicReveal = { targetSeat, result: result.result.identityResult };
    } else if (role === 'gargoyle') {
      payload.gargoyleReveal = { targetSeat, result: result.result.identityResult };
    } else if (role === 'wolfRobot') {
      payload.wolfRobotReveal = { targetSeat, result: result.result.identityResult };
    }
  }

  return payload;
}

/**
 * 验证前置条件（PR4 完整 gate）
 *
 * Gate 顺序（必须遵守）：
 * 1. host_only
 * 2. no_state
 * 3. invalid_status (must be ongoing)
 * 4. forbidden_while_audio_playing
 * 5. invalid_step (currentStepId 必须存在且匹配)
 * 6. not_seated (actor seat 必须有玩家)
 * 7. schema constraints (由 resolver 处理)
 */
function validateActionPreconditions(
  context: HandlerContext,
  actorSeat: number,
  role: RoleId,
):
  | { valid: false; result: HandlerResult }
  | { valid: true; schemaId: SchemaId; state: NonNullState; schema: (typeof SCHEMAS)[SchemaId] } {
  const { state, isHost } = context;

  // Gate 1: host_only
  if (!isHost) {
    return {
      valid: false,
      result: { success: false, reason: 'host_only', actions: [] },
    };
  }

  // Gate 2: no_state
  if (!state) {
    return {
      valid: false,
      result: { success: false, reason: 'no_state', actions: [] },
    };
  }

  // Gate 3: invalid_status (must be ongoing)
  if (state.status !== 'ongoing') {
    return {
      valid: false,
      result: { success: false, reason: 'invalid_status', actions: [] },
    };
  }

  // Gate 4: forbidden_while_audio_playing
  if (state.isAudioPlaying) {
    return {
      valid: false,
      result: { success: false, reason: 'forbidden_while_audio_playing', actions: [] },
    };
  }

  // Gate 5: invalid_step (currentStepId 必须存在且能在 SCHEMAS 里找到)
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

  // Gate 5b: step mismatch - 提交的 role 必须与当前 step 对应
  const expectedSchemaId = getSchemaIdForRole(role);
  if (expectedSchemaId !== currentStepId) {
    return {
      valid: false,
      result: { success: false, reason: 'step_mismatch', actions: [] },
    };
  }

  // Gate 6: not_seated (actor seat 必须有玩家)
  const player = state.players[actorSeat];
  if (!player) {
    return {
      valid: false,
      result: { success: false, reason: 'not_seated', actions: [] },
    };
  }

  // Gate 6b: 玩家角色必须匹配
  if (player.role !== role) {
    return {
      valid: false,
      result: { success: false, reason: 'role_mismatch', actions: [] },
    };
  }

  // Gate 7: resolver 存在性检查
  if (!RESOLVERS[currentStepId]) {
    return {
      valid: false,
      result: { success: false, reason: 'no_resolver', actions: [] },
    };
  }

  return { valid: true, schemaId: currentStepId, state, schema };
}

/**
 * 处理提交行动（PR4: SUBMIT_ACTION）
 *
 * Resolver-first：所有业务校验由 resolver 完成
 * Reject 也 broadcast：防 UI pending 卡死
 */
export function handleSubmitAction(
  intent: SubmitActionIntent,
  context: HandlerContext,
): HandlerResult {
  const { seat, role, target, extra } = intent.payload;

  // 验证前置条件（完整 gate 链）
  const validation = validateActionPreconditions(context, seat, role);
  if (!validation.valid) {
    return validation.result;
  }
  const { schemaId, state } = validation;

  // 获取 resolver
  const resolver = RESOLVERS[schemaId]!;

  // 构建上下文和输入
  const resolverContext = buildResolverContext(state, seat, role);
  const actionInput = buildActionInput(
    schemaId,
    target,
    extra as Record<string, unknown> | undefined,
  );

  // 调用 resolver（resolver-first）
  const result = resolver(resolverContext, actionInput);

  if (!result.valid) {
    return buildRejectionResult(schemaId, result.rejectReason, state, seat);
  }

  // 构建成功结果
  return buildSuccessResult(
    schemaId,
    seat,
    target,
    role,
    result,
    extra as Record<string, unknown> | undefined,
  );
}

/**
 * 构建拒绝结果
 */
function buildRejectionResult(
  schemaId: SchemaId,
  rejectReason: string | undefined,
  state: NonNullState,
  seat: number,
): HandlerResult {
  const rejectAction: ActionRejectedAction = {
    type: 'ACTION_REJECTED',
    payload: {
      action: schemaId,
      reason: rejectReason ?? 'invalid_action',
      targetUid: state.players[seat]?.uid ?? '',
    },
  };

  return {
    success: false,
    reason: rejectReason,
    actions: [rejectAction],
    sideEffects: [{ type: 'BROADCAST_STATE' }],
  };
}

/**
 * 构建成功结果
 */
function buildSuccessResult(
  schemaId: SchemaId,
  seat: number,
  target: number | null,
  role: RoleId,
  result: ResolverResult,
  extra?: Record<string, unknown>,
): HandlerResult {
  const protocolAction: ProtocolAction = {
    schemaId,
    actorSeat: seat,
    targetSeat: target ?? undefined,
    timestamp: getActionTimestamp(extra),
  };

  const recordAction: RecordActionAction = {
    type: 'RECORD_ACTION',
    payload: { action: protocolAction },
  };

  const actions: (RecordActionAction | ApplyResolverResultAction)[] = [recordAction];

  // Only attach reveal payload when we have a concrete target.
  // (Avoid fabricating seat=0 when target is null.)
  if (target !== null && (result.updates || result.result)) {
    actions.push({
      type: 'APPLY_RESOLVER_RESULT',
      payload: buildRevealPayload(result, role, target),
    });
  } else if (result.updates) {
    // Updates can exist without a target (e.g. skip/blocked); keep them.
    actions.push({
      type: 'APPLY_RESOLVER_RESULT',
      payload: { updates: result.updates },
    });
  }

  return {
    success: true,
    actions,
    sideEffects: [{ type: 'BROADCAST_STATE' }, { type: 'SAVE_STATE' }],
  };
}

/**
 * 处理狼人投票
 *
 * PR5: WOLF_VOTE (Night-1 only)
 * 完整 gate 链：
 * 1. host_only
 * 2. no_state
 * 3. invalid_status (must be ongoing)
 * 4. forbidden_while_audio_playing
 * 5. invalid_step (currentStepId 必须存在且对应 wolfVote schema)
 * 6. not_seated (voter seat 必须有玩家)
 * 7. not_wolf_participant (voter 必须参与 wolf vote)
 * 8. invalid_target (target 必须在 players 范围内)
 * 9. target_not_seated (target seat 必须有玩家)
 *
 * 注意：不做 notSelf/notWolf 限制（中立裁判规则）
 */
export function handleSubmitWolfVote(
  intent: SubmitWolfVoteIntent,
  context: HandlerContext,
): HandlerResult {
  const { seat, target } = intent.payload;
  const { state, isHost } = context;

  // Gate 1: host_only
  if (!isHost) {
    return {
      success: false,
      reason: 'host_only',
      actions: [],
    };
  }

  // Gate 2: no_state
  if (!state) {
    return {
      success: false,
      reason: 'no_state',
      actions: [],
    };
  }

  // Gate 3: invalid_status (must be ongoing)
  if (state.status !== 'ongoing') {
    return {
      success: false,
      reason: 'invalid_status',
      actions: [],
    };
  }

  // Gate 4: forbidden_while_audio_playing
  if (state.isAudioPlaying) {
    return {
      success: false,
      reason: 'forbidden_while_audio_playing',
      actions: [],
    };
  }

  // Gate 5: invalid_step (currentStepId 必须存在且对应 wolfVote schema)
  const { currentStepId } = state;
  if (!currentStepId) {
    return {
      success: false,
      reason: 'invalid_step',
      actions: [],
    };
  }
  const schema = SCHEMAS[currentStepId];
  if (schema?.kind !== 'wolfVote') {
    return {
      success: false,
      reason: 'step_mismatch',
      actions: [],
    };
  }

  // Gate 6: not_seated (voter seat 必须有玩家)
  const voter = state.players[seat];
  if (!voter) {
    return {
      success: false,
      reason: 'not_seated',
      actions: [],
    };
  }

  // Gate 7: not_wolf_participant (voter 必须参与 wolf vote)
  if (!voter.role || !doesRoleParticipateInWolfVote(voter.role)) {
    return {
      success: false,
      reason: 'not_wolf_participant',
      actions: [],
    };
  }

  // Gate 8: invalid_target (target 必须在 players 范围内)
  if (!(target in state.players)) {
    return {
      success: false,
      reason: 'invalid_target',
      actions: [],
    };
  }

  // Gate 9: target_not_seated (target seat 必须有玩家)
  const targetPlayer = state.players[target];
  if (!targetPlayer) {
    return {
      success: false,
      reason: 'target_not_seated',
      actions: [],
    };
  }

  // 成功：产生 RECORD_WOLF_VOTE
  const action: RecordWolfVoteAction = {
    type: 'RECORD_WOLF_VOTE',
    payload: {
      voterSeat: seat,
      targetSeat: target,
    },
  };

  return {
    success: true,
    actions: [action],
    sideEffects: [{ type: 'BROADCAST_STATE' }, { type: 'SAVE_STATE' }],
  };
}

/**
 * 处理查看角色
 *
 * PR2: VIEWED_ROLE (assigned → ready)
 * - 前置条件：isHost、state != null、status === 'assigned'
 * - 标记 seat 的 hasViewedRole = true
 * - 当所有玩家都 viewed 时，reducer 会将 status → 'ready'
 */
export function handleViewedRole(intent: ViewedRoleIntent, context: HandlerContext): HandlerResult {
  const { seat } = intent.payload;
  const { state, isHost } = context;

  // 验证：仅主机可操作
  if (!isHost) {
    return {
      success: false,
      reason: 'host_only',
      actions: [],
    };
  }

  // 验证：state 必须存在
  if (!state) {
    return {
      success: false,
      reason: 'no_state',
      actions: [],
    };
  }

  // 验证：status 必须是 'assigned'
  if (state.status !== 'assigned') {
    return {
      success: false,
      reason: 'invalid_status',
      actions: [],
    };
  }

  // 验证座位有玩家
  if (!state.players[seat]) {
    return {
      success: false,
      reason: 'not_seated',
      actions: [],
    };
  }

  const action: PlayerViewedRoleAction = {
    type: 'PLAYER_VIEWED_ROLE',
    payload: { seat },
  };

  return {
    success: true,
    actions: [action],
    sideEffects: [{ type: 'BROADCAST_STATE' }, { type: 'SAVE_STATE' }],
  };
}
