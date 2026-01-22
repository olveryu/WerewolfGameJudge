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
  AdvanceNightIntent,
  EndNightIntent,
  SetAudioPlayingIntent,
  RestartGameIntent,
  UpdateTemplateIntent,
} from '../intents/types';
import type { StateAction } from '../reducer/types';
import type { RoleId } from '../../../models/roles';
import type { GameTemplate } from '../../../models/Template';

import { doesRoleParticipateInWolfVote } from '../../../models/roles';
import {
  handleAssignRoles,
  handleStartNight,
  handleRestartGame,
  handleUpdateTemplate,
} from '../handlers/gameControlHandler';
import {
  handleViewedRole,
  handleSubmitAction,
  handleSubmitWolfVote,
} from '../handlers/actionHandler';
import {
  handleAdvanceNight,
  handleEndNight,
  handleSetAudioPlaying,
} from '../handlers/nightFlowHandler';
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

  // 诊断日志：确认 handler 返回的 currentStepId
  if (result.success && result.actions.length > 0) {
    const startNightAction = result.actions.find((a) => a.type === 'START_NIGHT');
    if (startNightAction && 'payload' in startNightAction) {
      v2FacadeLog.debug('startNight action payload', {
        currentStepId: (startNightAction.payload as { currentStepId?: string }).currentStepId,
        currentActionerIndex: (startNightAction.payload as { currentActionerIndex?: number })
          .currentActionerIndex,
      });
    }
  }

  return processHandlerResult(ctx, result, { logPrefix: 'startNight' });
}

/**
 * Host: 更新模板
 *
 * PR8: 仅在 unseated 状态允许
 */
export async function updateTemplate(
  ctx: HostActionsContext,
  template: GameTemplate,
): Promise<{ success: boolean; reason?: string }> {
  v2FacadeLog.debug('updateTemplate called', { isHost: ctx.isHost });

  const intent: UpdateTemplateIntent = {
    type: 'UPDATE_TEMPLATE',
    payload: { templateRoles: template.roles },
  };
  const context = buildHandlerContext(ctx);
  const result = handleUpdateTemplate(intent, context);

  return processHandlerResult(ctx, result, { logPrefix: 'updateTemplate' });
}

/**
 * Host: 重新开始游戏
 *
 * PR8: RESTART_GAME（任意状态 → unseated）
 */
export async function restartGame(
  ctx: HostActionsContext,
): Promise<{ success: boolean; reason?: string }> {
  v2FacadeLog.debug('restartGame called', { isHost: ctx.isHost });

  const intent: RestartGameIntent = { type: 'RESTART_GAME' };
  const context = buildHandlerContext(ctx);
  const result = handleRestartGame(intent, context);

  return processHandlerResult(ctx, result, { logPrefix: 'restartGame' });
}

/**
 * Host: 处理玩家提交的夜晚行动
 *
 * PR4: SUBMIT_ACTION（Night-1 only）
 *
 * 当 action 成功提交后，自动触发 advanceNight 推进夜晚流程。
 * 如果没有更多步骤，会自动触发 endNight。
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

  const submitResult = await processHandlerResult(ctx, result, {
    logPrefix: 'submitAction',
    logData: { seat, role, target },
    applyActionsOnFailure: true, // PR4: ACTION_REJECTED 也需要应用
  });

  // 如果 action 成功，自动推进夜晚流程
  if (submitResult.success) {
    v2FacadeLog.debug('Action succeeded, triggering advanceNight', { seat, role });
    await advanceNight(ctx);
  }

  return submitResult;
}

/**
 * Host: 处理狼人投票
 *
 * PR5: WOLF_VOTE（Night-1 only）
 *
 * 当所有狼人都投完票后，自动触发 advanceNight 推进夜晚流程。
 * 这对齐 legacy 行为（GameStateService.handleWolfVote L1056）。
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

  const submitResult = await processHandlerResult(ctx, result, {
    logPrefix: 'submitWolfVote',
    logData: { voterSeat, targetSeat },
  });

  // 如果投票成功，检查是否所有狼人都投完票
  if (submitResult.success) {
    const state = ctx.store.getState();
    if (state?.wolfVotes) {
      // 获取所有参与投票的狼人座位
      const votingWolfSeats: number[] = [];
      for (const [seatStr, player] of Object.entries(state.players)) {
        if (player?.role && doesRoleParticipateInWolfVote(player.role)) {
          votingWolfSeats.push(Number.parseInt(seatStr, 10));
        }
      }

      // 检查是否所有狼人都已投票
      const allVoted = votingWolfSeats.every((seat) => seat.toString() in state.wolfVotes!);

      if (allVoted) {
        v2FacadeLog.debug('All wolves voted, triggering advanceNight', {
          votingWolfSeats,
          wolfVotes: state.wolfVotes,
        });
        // 自动触发 advanceNight（对齐 legacy L1056）
        await advanceNight(ctx);
      }
    }
  }

  return submitResult;
}

/**
 * Host: 推进夜晚到下一步
 *
 * PR6: ADVANCE_NIGHT（音频结束后调用）
 *
 * 当没有下一步时（nextStepId === null），自动触发 endNight 结束夜晚。
 * 这对齐 legacy 的 NightFlowController 行为。
 */
export async function advanceNight(
  ctx: HostActionsContext,
): Promise<{ success: boolean; reason?: string }> {
  v2FacadeLog.debug('advanceNight called', { isHost: ctx.isHost });

  const intent: AdvanceNightIntent = { type: 'ADVANCE_NIGHT' };
  const context = buildHandlerContext(ctx);
  const result = handleAdvanceNight(intent, context);

  const advanceResult = await processHandlerResult(ctx, result, { logPrefix: 'advanceNight' });

  // 如果推进成功，检查是否已经没有下一步了（夜晚结束）
  if (advanceResult.success) {
    const state = ctx.store.getState();
    // 如果 currentStepId 为 undefined，说明没有下一步了，应该结束夜晚
    if (state && state.currentStepId === undefined && state.status === 'ongoing') {
      v2FacadeLog.debug('No more steps, triggering endNight', {
        currentActionerIndex: state.currentActionerIndex,
      });
      // 自动触发 endNight（对齐 legacy NightFlowController 行为）
      await endNight(ctx);
    }
  }

  return advanceResult;
}
/**
 * Host: 结束夜晚，进行死亡结算
 *
 * PR6: END_NIGHT（夜晚结束音频结束后调用）
 */
export async function endNight(
  ctx: HostActionsContext,
): Promise<{ success: boolean; reason?: string }> {
  v2FacadeLog.debug('endNight called', { isHost: ctx.isHost });

  const intent: EndNightIntent = { type: 'END_NIGHT' };
  const context = buildHandlerContext(ctx);
  const result = handleEndNight(intent, context);

  return processHandlerResult(ctx, result, { logPrefix: 'endNight' });
}

/**
 * Host: 设置音频播放状态
 *
 * PR7: 音频时序控制
 * - 当音频开始播放时，调用 setAudioPlaying(true)
 * - 当音频结束（或被跳过）时，调用 setAudioPlaying(false)
 */
export async function setAudioPlaying(
  ctx: HostActionsContext,
  isPlaying: boolean,
): Promise<{ success: boolean; reason?: string }> {
  v2FacadeLog.debug('setAudioPlaying called', { isPlaying, isHost: ctx.isHost });

  const intent: SetAudioPlayingIntent = {
    type: 'SET_AUDIO_PLAYING',
    payload: { isPlaying },
  };
  const context = buildHandlerContext(ctx);
  const result = handleSetAudioPlaying(intent, context);

  return processHandlerResult(ctx, result, {
    logPrefix: 'setAudioPlaying',
    logData: { isPlaying },
  });
}
