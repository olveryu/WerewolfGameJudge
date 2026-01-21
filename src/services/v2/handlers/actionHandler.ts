/**
 * Action Handler - 夜晚行动处理器
 *
 * 处理 SUBMIT_ACTION / SUBMIT_WOLF_VOTE / VIEWED_ROLE intent
 * 调用 resolver 验证和计算结果
 */

import type {
  SubmitActionIntent,
  SubmitWolfVoteIntent,
  ViewedRoleIntent,
} from '../intents/types';
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
import { NIGHT_STEPS } from '../../../models/roles/spec';
import type { ResolverContext, ActionInput, ResolverResult } from '../../night/resolvers/types';
import type { RoleId } from '../../../models/roles';

/**
 * 构建 Resolver 上下文
 */
function buildResolverContext(
  state: HandlerContext['state'],
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
 * 验证前置条件
 */
function validateActionPreconditions(
  context: HandlerContext,
  role: RoleId,
): { valid: false; result: HandlerResult } | { valid: true; schemaId: SchemaId } {
  const { state, isHost } = context;

  if (!isHost) {
    return {
      valid: false,
      result: { success: false, reason: 'host_only', actions: [] },
    };
  }

  if (state.status !== 'ongoing') {
    return {
      valid: false,
      result: { success: false, reason: 'game_not_ongoing', actions: [] },
    };
  }

  const schemaId = getSchemaIdForRole(role);
  if (!schemaId) {
    return {
      valid: false,
      result: { success: false, reason: 'unknown_role', actions: [] },
    };
  }

  if (!RESOLVERS[schemaId]) {
    return {
      valid: false,
      result: { success: false, reason: 'no_resolver', actions: [] },
    };
  }

  return { valid: true, schemaId };
}

/**
 * 处理提交行动
 */
export function handleSubmitAction(
  intent: SubmitActionIntent,
  context: HandlerContext,
): HandlerResult {
  const { seat, role, target, extra } = intent.payload;
  const { state } = context;

  // 验证前置条件
  const validation = validateActionPreconditions(context, role);
  if (!validation.valid) {
    return validation.result;
  }
  const { schemaId } = validation;

  // 获取 resolver
  const resolver = RESOLVERS[schemaId]!;

  // 构建上下文和输入
  const resolverContext = buildResolverContext(state, seat, role);
  const actionInput = buildActionInput(
    schemaId,
    target,
    extra as Record<string, unknown> | undefined,
  );

  // 调用 resolver
  const result = resolver(resolverContext, actionInput);

  if (!result.valid) {
    return buildRejectionResult(schemaId, result.rejectReason, state, seat);
  }

  // 构建成功结果
  return buildSuccessResult(schemaId, seat, target, role, result);
}

/**
 * 构建拒绝结果
 */
function buildRejectionResult(
  schemaId: SchemaId,
  rejectReason: string | undefined,
  state: HandlerContext['state'],
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
): HandlerResult {
  const protocolAction: ProtocolAction = {
    schemaId,
    actorSeat: seat,
    targetSeat: target ?? undefined,
    timestamp: Date.now(),
  };

  const recordAction: RecordActionAction = {
    type: 'RECORD_ACTION',
    payload: { action: protocolAction },
  };

  const actions: (RecordActionAction | ApplyResolverResultAction)[] = [recordAction];

  if (result.updates || result.result) {
    const applyAction: ApplyResolverResultAction = {
      type: 'APPLY_RESOLVER_RESULT',
      payload: buildRevealPayload(result, role, target ?? 0),
    };
    actions.push(applyAction);
  }

  return {
    success: true,
    actions,
    sideEffects: [{ type: 'BROADCAST_STATE' }, { type: 'SAVE_STATE' }],
  };
}

/**
 * 处理狼人投票
 */
export function handleSubmitWolfVote(
  intent: SubmitWolfVoteIntent,
  context: HandlerContext,
): HandlerResult {
  const { seat, target } = intent.payload;
  const { state, isHost } = context;

  // 仅主机处理
  if (!isHost) {
    return {
      success: false,
      reason: 'host_only',
      actions: [],
    };
  }

  // 验证游戏状态
  if (state.status !== 'ongoing') {
    return {
      success: false,
      reason: 'game_not_ongoing',
      actions: [],
    };
  }

  // 验证目标座位有效
  if (!(target in state.players)) {
    return {
      success: false,
      reason: 'invalid_target',
      actions: [],
    };
  }

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
    sideEffects: [{ type: 'BROADCAST_STATE' }],
  };
}

/**
 * 处理查看角色
 */
export function handleViewedRole(
  intent: ViewedRoleIntent,
  context: HandlerContext,
): HandlerResult {
  const { seat } = intent.payload;
  const { state } = context;

  // 验证座位有玩家
  if (!state.players[seat]) {
    return {
      success: false,
      reason: 'invalid_seat',
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
    sideEffects: [{ type: 'BROADCAST_STATE' }],
  };
}
