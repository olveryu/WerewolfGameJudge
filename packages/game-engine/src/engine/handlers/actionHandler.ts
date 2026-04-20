/**
 * Action Handler — dispatch shell for night action submission.
 *
 * Validates preconditions (via actionGuards), builds resolver context,
 * dispatches to the matching resolver, and assembles the StateAction list.
 * Does not contain IO (network / audio / alert); does not directly mutate state.
 *
 * Reveal payload construction lives in revealPayload.ts.
 * Gate predicates live in actionGuards.ts.
 * VIEWED_ROLE handling lives in viewedRoleHandler.ts.
 */

import { type RoleId, type SchemaId, SCHEMAS } from '../../models';
import type { ProtocolAction } from '../../protocol/types';
import { RESOLVERS } from '../../resolvers';
import type { ActionInput, ResolverContext, ResolverResult } from '../../resolvers/types';
import { newRejectionId } from '../../utils/id';
import { buildSeatRoleMap } from '../../utils/playerHelpers';
import type { SubmitActionIntent } from '../intents/types';
import { gameReducer } from '../reducer/gameReducer';
import type { ActionRejectedAction, RecordActionAction, StateAction } from '../reducer/types';
import {
  checkNightmareBlockGuard,
  isBottomCardActorOverride,
  validateActionPreconditions,
} from './actionGuards';
import { computeCanShootForSeat } from './confirmContext';
import { decideWolfVoteTimerAction, isWolfVoteAllComplete } from './progressionEvaluator';
import { buildRevealPayload } from './revealPayload';
import type { HandlerContext, HandlerResult, NonNullState } from './types';
import { handlerRejection, handlerSuccess, STANDARD_SIDE_EFFECTS } from './types';

// Re-export moved symbols for backward compatibility
export { checkNightmareBlockGuard, isSkipAction } from './actionGuards';
export { isBottomCardActorOverride } from './actionGuards';
export { handleViewedRole } from './viewedRoleHandler';

/**
 * 构建 Resolver 上下文
 */
function buildResolverContext(
  state: NonNullState,
  actorSeat: number,
  actorRoleId: RoleId,
): ResolverContext {
  // 构建 players: seat -> role
  const players = buildSeatRoleMap(state.players);

  // FAIL-FAST: currentNightResults must exist when status === GameStatus.Ongoing
  if (!state.currentNightResults) {
    throw new Error('[FAIL-FAST] currentNightResults missing in ongoing state');
  }

  return {
    actorSeat,
    actorRoleId,
    players,
    currentNightResults: state.currentNightResults,
    wolfRobotContext: state.wolfRobotContext,
    witchState: state.witchContext,
    gameState: {
      isNight1: true, // Night-1 only
      hypnotizedSeats: state.hypnotizedSeats ?? [],
    },
    ...(state.bottomCards && (state.treasureMasterSeat != null || state.thiefSeat != null)
      ? {
          bottomCardContext: {
            bottomCards: state.bottomCards,
            actorSeat: state.treasureMasterSeat ?? state.thiefSeat!,
          },
        }
      : {}),
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
    cardIndex: extra?.cardIndex as number | undefined,
  };
}

function getActionTimestamp(extra?: Record<string, unknown>): number {
  const maybe = extra?.timestamp;
  return typeof maybe === 'number' ? maybe : Date.now();
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
  const validation = validateActionPreconditions(context.state, seat, role);
  if (!validation.valid) {
    return (validation as { valid: false; result: HandlerResult }).result;
  }
  const { schemaId, state, schema } = validation;

  // 构建 ActionInput（先构建，用于 nightmare guard 和 resolver）
  const actionInput = buildActionInput(
    schemaId,
    target,
    extra as Record<string, unknown> | undefined,
  );

  // Nightmare block guard (single-point guard, schema-aware)
  const blockRejectReason = checkNightmareBlockGuard(
    seat,
    schema,
    actionInput,
    state.currentNightResults?.blockedSeat,
  );
  if (blockRejectReason) {
    return buildRejectionResult(schemaId, blockRejectReason, state, seat);
  }

  // 获取 resolver
  const resolver = RESOLVERS[schemaId]!;

  // Bottom card actor override: when acting on the chosen card's step,
  // use the chosen card's role for the resolver context
  let resolverRole = role;
  if (role === ('treasureMaster' as RoleId) && isBottomCardActorOverride(state, schemaId)) {
    resolverRole = state.treasureMasterChosenCard as RoleId;
  } else if (role === ('thief' as RoleId) && isBottomCardActorOverride(state, schemaId)) {
    resolverRole = state.thiefChosenCard as RoleId;
  }

  // 构建上下文
  const resolverContext = buildResolverContext(state, seat, resolverRole);

  // 调用 resolver（resolver-first）
  let result = resolver(resolverContext, actionInput);

  if (!result.valid) {
    return buildRejectionResult(schemaId, result.rejectReason, state, seat);
  }

  // wolfRobot 学到猎人时，resolver 仅标记 canShootAsHunter=true（不含完整死因信息），
  // 此处用完整 GameState 做权威覆盖（与 confirmContext 猎人/狼王共用同一逻辑）。
  if (result.result?.canShootAsHunter !== undefined) {
    result = {
      ...result,
      result: { ...result.result, canShootAsHunter: computeCanShootForSeat(seat, state) },
    };
  }

  // 构建成功结果
  const handlerResult = buildSuccessResult(
    schemaId,
    seat,
    target,
    role,
    result,
    extra as Record<string, unknown> | undefined,
  );

  // Wolf vote timer: wolfVote 步骤提交后，管理 stepDeadline
  if (schema.kind === 'wolfVote' && handlerResult.kind === 'success') {
    // 临时 reduce 所有 actions 以获取投票最新状态
    let tempState = state;
    for (const action of handlerResult.actions) {
      tempState = gameReducer(tempState, action);
    }
    const allVoted = isWolfVoteAllComplete(tempState);
    const hasExistingTimer = tempState.stepDeadline != null;
    const timerAction = decideWolfVoteTimerAction(allVoted, hasExistingTimer, Date.now());

    const extraActions: StateAction[] = [];
    if (timerAction.type === 'set') {
      extraActions.push({
        type: 'SET_STEP_DEADLINE' as const,
        payload: { deadline: timerAction.deadline },
      });
    } else if (timerAction.type === 'clear') {
      extraActions.push({ type: 'CLEAR_STEP_DEADLINE' as const });
    }
    if (extraActions.length > 0) {
      return handlerSuccess([...handlerResult.actions, ...extraActions], handlerResult.sideEffects);
    }
  }

  return handlerResult;
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
      targetUid:
        state.players[seat]?.uid ??
        (() => {
          throw new Error(`[FAIL-FAST] ACTION_REJECTED: no player at seat ${seat}`);
        })(),
      rejectionId: newRejectionId(),
    },
  };

  return handlerRejection(
    rejectReason ?? 'invalid_action',
    [rejectAction],
    [{ type: 'BROADCAST_STATE' }],
  );
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

  const actions: StateAction[] = [recordAction];

  // Only attach reveal payload when we have a concrete target.
  // (Avoid fabricating seat=0 when target is null.)
  if (target !== null && (result.updates || result.result)) {
    const revealPayload = buildRevealPayload(result, schemaId, target);
    actions.push({
      type: 'APPLY_RESOLVER_RESULT',
      payload: revealPayload,
    });

    // 如果 schema 定义了 revealKind，且 reveal payload 包含实际数据，添加 pending ack 阻塞推进
    // ackKey 使用 schemaId 作为稳定标识符（避免 revealKind 文案变更导致问题）
    // 条件检查 payload 是否有 reveal 数据（shadow 仅在模仿复仇者时才有 reveal）
    const schema = SCHEMAS[schemaId];
    const revealKind = (schema?.ui as { revealKind?: string } | undefined)?.revealKind;
    if (revealKind) {
      const revealKey = `${revealKind}Reveal`;
      const hasRevealData =
        revealKey in revealPayload &&
        revealPayload[revealKey as keyof typeof revealPayload] != null;
      if (hasRevealData) {
        actions.push({
          type: 'ADD_REVEAL_ACK',
          payload: { ackKey: schemaId },
        });
      }
    }
  } else if (result.updates) {
    // Updates can exist without a target (e.g. skip/blocked); keep them.
    actions.push({
      type: 'APPLY_RESOLVER_RESULT',
      payload: { updates: result.updates },
    });
  }

  return handlerSuccess(actions, STANDARD_SIDE_EFFECTS);
}
