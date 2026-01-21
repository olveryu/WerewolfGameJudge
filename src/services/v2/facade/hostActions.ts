/**
 * Host Actions - Host-only 业务编排
 *
 * 拆分自 V2GameFacade.ts（纯重构 PR，无行为变更）
 *
 * 职责：
 * - Host-only 游戏控制方法（assignRoles/markViewedRole/startNight）
 * - Host-only 夜晚行动方法（submitAction/submitWolfVote）
 * - 统一 handler → reducer → store → broadcast 编排模式
 *
 * 禁止：
 * - 业务逻辑/校验规则（全部在 handler）
 * - 直接修改 state（全部在 reducer）
 */

import type { BroadcastGameState } from '../../protocol/types';
import type { GameStore } from '../store';
import type { HandlerContext, HandlerResult } from '../handlers/types';
import type {
  AssignRolesIntent,
  ViewedRoleIntent,
  StartNightIntent,
  SubmitActionIntent,
  SubmitWolfVoteIntent,
} from '../intents/types';
import type { StateAction } from '../reducer/types';
import type { RoleId } from '../../../models/roles';

import { handleAssignRoles, handleStartNight } from '../handlers/gameControlHandler';
import {
  handleViewedRole,
  handleSubmitAction,
  handleSubmitWolfVote,
} from '../handlers/actionHandler';
import { gameReducer } from '../reducer';
import { v2FacadeLog } from '../../../utils/logger';

/**
 * Host Actions 依赖的上下文接口
 * （从 Facade 注入，避免循环依赖）
 */
export interface HostActionsContext {
  readonly store: GameStore;
  isHost: boolean;
  myUid: string | null;
  getMySeatNumber: () => number | null;
  broadcastCurrentState: () => Promise<void>;
}

/**
 * 应用 actions 到 reducer → store
 */
function applyActions(
  store: GameStore,
  currentState: BroadcastGameState,
  actions: StateAction[],
): void {
  let newState = currentState;
  for (const action of actions) {
    newState = gameReducer(newState, action);
  }
  store.setState(newState);
}

/**
 * 构建 handler context
 */
function buildHandlerContext(ctx: HostActionsContext): HandlerContext {
  return {
    state: ctx.store.getState(),
    isHost: ctx.isHost,
    myUid: ctx.myUid,
    mySeat: ctx.getMySeatNumber(),
  };
}

/**
 * 统一的 handler 结果处理
 * - 应用 actions
 * - 执行 side effects
 * - 返回 success/reason
 */
async function processHandlerResult(
  ctx: HostActionsContext,
  result: HandlerResult,
  options?: {
    logPrefix?: string;
    logData?: Record<string, unknown>;
    applyActionsOnFailure?: boolean;
  },
): Promise<{ success: boolean; reason?: string }> {
  const state = ctx.store.getState();
  const { logPrefix, logData, applyActionsOnFailure = false } = options ?? {};

  if (!result.success) {
    if (logPrefix) {
      v2FacadeLog.warn(`${logPrefix} failed`, { reason: result.reason, ...logData });
    }

    // 某些场景需要在失败时也应用 actions（如 ACTION_REJECTED）
    if (applyActionsOnFailure && state && result.actions.length > 0) {
      applyActions(ctx.store, state, result.actions);
    }

    // 无论如何都 broadcast（防 UI pending 卡死）
    await ctx.broadcastCurrentState();
    return { success: false, reason: result.reason };
  }

  // 成功：应用 actions
  if (state) {
    applyActions(ctx.store, state, result.actions);
  }

  // 执行副作用
  if (result.sideEffects?.some((e) => e.type === 'BROADCAST_STATE')) {
    await ctx.broadcastCurrentState();
  }
  if (result.sideEffects?.some((e) => e.type === 'SAVE_STATE')) {
    // SAVE_STATE side effect: 用于 crash recovery，暂由 log 占位
    v2FacadeLog.debug('SAVE_STATE side effect triggered');
  }

  if (logPrefix) {
    v2FacadeLog.info(`${logPrefix} success`, logData);
  }

  return { success: true };
}

// =============================================================================
// Host Actions
// =============================================================================

/**
 * Host: 分配角色
 *
 * PR1: ASSIGN_ROLES (seated → assigned)
 */
export async function assignRoles(
  ctx: HostActionsContext,
): Promise<{ success: boolean; reason?: string }> {
  v2FacadeLog.debug('assignRoles called', { isHost: ctx.isHost });

  const intent: AssignRolesIntent = { type: 'ASSIGN_ROLES' };
  const context = buildHandlerContext(ctx);
  const result = handleAssignRoles(intent, context);

  return processHandlerResult(ctx, result, { logPrefix: 'assignRoles' });
}

/**
 * Host: 标记某座位已查看角色
 *
 * PR2: VIEWED_ROLE (assigned → ready)
 */
export async function markViewedRole(
  ctx: HostActionsContext,
  seat: number,
): Promise<{ success: boolean; reason?: string }> {
  v2FacadeLog.debug('markViewedRole called', { seat, isHost: ctx.isHost });

  const intent: ViewedRoleIntent = {
    type: 'VIEWED_ROLE',
    payload: { seat },
  };
  const context = buildHandlerContext(ctx);
  const result = handleViewedRole(intent, context);

  return processHandlerResult(ctx, result, {
    logPrefix: 'markViewedRole',
    logData: { seat },
  });
}

/**
 * Host: 开始夜晚
 *
 * PR3: START_NIGHT (ready → ongoing)
 */
export async function startNight(
  ctx: HostActionsContext,
): Promise<{ success: boolean; reason?: string }> {
  v2FacadeLog.debug('startNight called', { isHost: ctx.isHost });

  const intent: StartNightIntent = { type: 'START_NIGHT' };
  const context = buildHandlerContext(ctx);
  const result = handleStartNight(intent, context);

  return processHandlerResult(ctx, result, { logPrefix: 'startNight' });
}

/**
 * Host: 处理玩家提交的夜晚行动
 *
 * PR4: SUBMIT_ACTION（Night-1 only）
 */
export async function submitAction(
  ctx: HostActionsContext,
  seat: number,
  role: RoleId,
  target: number | null,
  extra?: unknown,
): Promise<{ success: boolean; reason?: string }> {
  v2FacadeLog.debug('submitAction called', { seat, role, target, isHost: ctx.isHost });

  const intent: SubmitActionIntent = {
    type: 'SUBMIT_ACTION',
    payload: { seat, role, target, extra },
  };
  const context = buildHandlerContext(ctx);
  const result = handleSubmitAction(intent, context);

  return processHandlerResult(ctx, result, {
    logPrefix: 'submitAction',
    logData: { seat, role, target },
    applyActionsOnFailure: true, // PR4: ACTION_REJECTED 也需要应用
  });
}

/**
 * Host: 处理狼人投票
 *
 * PR5: WOLF_VOTE（Night-1 only）
 */
export async function submitWolfVote(
  ctx: HostActionsContext,
  voterSeat: number,
  targetSeat: number,
): Promise<{ success: boolean; reason?: string }> {
  v2FacadeLog.debug('submitWolfVote called', { voterSeat, targetSeat, isHost: ctx.isHost });

  const intent: SubmitWolfVoteIntent = {
    type: 'SUBMIT_WOLF_VOTE',
    payload: { seat: voterSeat, target: targetSeat },
  };
  const context = buildHandlerContext(ctx);
  const result = handleSubmitWolfVote(intent, context);

  return processHandlerResult(ctx, result, {
    logPrefix: 'submitWolfVote',
    logData: { voterSeat, targetSeat },
  });
}
