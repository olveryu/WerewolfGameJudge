/**
 * Host Actions - Host-only 业务编排
 *
 * 拆分自 GameFacade.ts（纯重构 PR，无行为变更）
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

import type { BroadcastGameState } from '../protocol/types';
import type { GameStore } from '../engine/store';
import type { HandlerContext, HandlerResult } from '../engine/handlers/types';
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
} from '../engine/intents/types';
import type { StateAction } from '../engine/reducer/types';
import type { RoleId } from '../../models/roles';
import type { GameTemplate } from '../../models/Template';

import { doesRoleParticipateInWolfVote } from '../../models/roles';

import {
  handleAssignRoles,
  handleStartNight,
  handleRestartGame,
  handleUpdateTemplate,
} from '../engine/handlers/gameControlHandler';
import {
  handleViewedRole,
  handleSubmitAction,
  handleSubmitWolfVote,
} from '../engine/handlers/actionHandler';
import {
  handleAdvanceNight,
  handleEndNight,
  handleSetAudioPlaying,
  handleNightProgression,
  resetProgressionTracker,
} from '../engine/handlers/nightFlowHandler';
import { handleSetWolfRobotHunterStatusViewed } from '../engine/handlers/wolfRobotHunterGateHandler';
import { gameReducer } from '../engine/reducer';
import { facadeLog } from '../../utils/logger';

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
  /**
   * P0-1/P0-5 修复: 音频播放回调
   * @param audioKey - 'night' | 'night_end' | RoleId
   * @param isEndAudio - 如果为 true，使用 audio_end 目录
   */
  playAudio?: (audioKey: string, isEndAudio?: boolean) => Promise<void>;
  /**
   * 设置音频播放状态（Audio Gate）
   * 根据 copilot-instructions.md：音频播放前设 true，结束后设 false
   */
  setAudioPlayingGate?: (isPlaying: boolean) => Promise<void>;
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
  },
): Promise<{ success: boolean; reason?: string }> {
  const state = ctx.store.getState();
  const { logPrefix, logData } = options ?? {};

  if (!result.success) {
    if (logPrefix) {
      facadeLog.warn(`${logPrefix} failed`, { reason: result.reason, ...logData });
    }

    // 失败时也需要应用 actions（如 ACTION_REJECTED），否则 UI 无法通过 STATE_UPDATE 感知拒绝。
    // 统一放在出口层处理，避免调用点遗漏造成回归。
    if (state && result.actions.length > 0) {
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

  // 收集所有 PLAY_AUDIO 副作用（支持队列播放）
  const audioEffects =
    result.sideEffects?.filter((e): e is { type: 'PLAY_AUDIO'; audioKey: string; isEndAudio?: boolean } => 
      e.type === 'PLAY_AUDIO'
    ) ?? [];

  // 如果有音频要播放，必须在 BROADCAST_STATE 之前设置 gate
  // 根据 copilot-instructions.md：先 gate，再 broadcast，然后播放
  if (audioEffects.length > 0 && ctx.playAudio && ctx.setAudioPlayingGate) {
    await ctx.setAudioPlayingGate(true);
  }

  // 执行副作用：广播状态
  if (result.sideEffects?.some((e) => e.type === 'BROADCAST_STATE')) {
    await ctx.broadcastCurrentState();
  }
  if (result.sideEffects?.some((e) => e.type === 'SAVE_STATE')) {
    // SAVE_STATE side effect: 用于 crash recovery，暂由 log 占位
    facadeLog.debug('SAVE_STATE side effect triggered');
  }

  // 播放所有音频（按顺序）
  // Gate 在上面已设置，这里逐个播放，最后 finally 释放
  if (audioEffects.length > 0 && ctx.playAudio) {
    try {
      for (const effect of audioEffects) {
        await ctx.playAudio(effect.audioKey, effect.isEndAudio);
      }
    } finally {
      // 无论成功/失败/中断，都必须释放 gate
      if (ctx.setAudioPlayingGate) {
        await ctx.setAudioPlayingGate(false);
      }
    }
  }

  if (logPrefix) {
    facadeLog.info(`${logPrefix} success`, logData);
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
  facadeLog.debug('assignRoles called', { isHost: ctx.isHost });

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
  facadeLog.debug('markViewedRole called', { seat, isHost: ctx.isHost });

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
  facadeLog.debug('startNight called', { isHost: ctx.isHost });

  // 重置推进追踪器（新夜晚开始）
  resetProgressionTracker();

  const intent: StartNightIntent = { type: 'START_NIGHT' };
  const context = buildHandlerContext(ctx);
  const result = handleStartNight(intent, context);

  // 诊断日志：确认 handler 返回的 currentStepId
  if (result.success && result.actions.length > 0) {
    const startNightAction = result.actions.find((a) => a.type === 'START_NIGHT');
    if (startNightAction && 'payload' in startNightAction) {
      facadeLog.debug('startNight action payload', {
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
 * PR8: 仅在“准备看牌前”（unseated | seated）允许
 */
export async function updateTemplate(
  ctx: HostActionsContext,
  template: GameTemplate,
): Promise<{ success: boolean; reason?: string }> {
  facadeLog.debug('updateTemplate called', { isHost: ctx.isHost });

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
  facadeLog.debug('restartGame called', { isHost: ctx.isHost });

  // 重置推进追踪器（游戏重新开始）
  resetProgressionTracker();

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
 * 成功后自动评估并执行夜晚推进（幂等，基于 revision + currentStepId）。
 */
export async function submitAction(
  ctx: HostActionsContext,
  seat: number,
  role: RoleId,
  target: number | null,
  extra?: unknown,
): Promise<{ success: boolean; reason?: string }> {
  facadeLog.debug('submitAction called', { seat, role, target, isHost: ctx.isHost });

  const intent: SubmitActionIntent = {
    type: 'SUBMIT_ACTION',
    payload: { seat, role, target, extra },
  };
  const context = buildHandlerContext(ctx);
  const result = handleSubmitAction(intent, context);

  const submitResult = await processHandlerResult(ctx, result, {
    logPrefix: 'submitAction',
    logData: { seat, role, target },
  });

  // Host-only 自动推进：成功提交后透传调用 handler 层推进
  if (submitResult.success) {
    await callNightProgression(ctx);
  }

  return submitResult;
}

/**
 * Host: 处理狼人投票
 *
 * PR5: WOLF_VOTE（Night-1 only）
 *
 * 成功后自动评估并执行夜晚推进（幂等，基于 revision + currentStepId）。
 */
export async function submitWolfVote(
  ctx: HostActionsContext,
  voterSeat: number,
  targetSeat: number,
): Promise<{ success: boolean; reason?: string }> {
  facadeLog.debug('submitWolfVote called', { voterSeat, targetSeat, isHost: ctx.isHost });

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

  if (!submitResult.success) {
    const state = ctx.store.getState();
    const voterRole = state?.players?.[voterSeat]?.role ?? null;
    const participatesInWolfVote = voterRole ? doesRoleParticipateInWolfVote(voterRole) : null;
    facadeLog.warn('submitWolfVote failed (context)', {
      voterSeat,
      targetSeat,
      voterRole,
      participatesInWolfVote,
      currentStepId: state?.currentStepId ?? null,
      status: state?.status ?? null,
      reason: submitResult.reason,
    });
  }

  // Host-only 自动推进：成功提交后透传调用 handler 层推进
  if (submitResult.success) {
    await callNightProgression(ctx);
  }

  return submitResult;
}

/**
 * Host: 推进夜晚到下一步
 *
 * PR6: ADVANCE_NIGHT（音频结束后调用）
 */
export async function advanceNight(
  ctx: HostActionsContext,
): Promise<{ success: boolean; reason?: string }> {
  facadeLog.debug('advanceNight called', { isHost: ctx.isHost });

  const intent: AdvanceNightIntent = { type: 'ADVANCE_NIGHT' };
  const context = buildHandlerContext(ctx);
  const result = handleAdvanceNight(intent, context);

  return processHandlerResult(ctx, result, { logPrefix: 'advanceNight' });
}
/**
 * Host: 结束夜晚，进行死亡结算
 *
 * PR6: END_NIGHT（夜晚结束音频结束后调用）
 */
export async function endNight(
  ctx: HostActionsContext,
): Promise<{ success: boolean; reason?: string }> {
  facadeLog.debug('endNight called', { isHost: ctx.isHost });

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
  facadeLog.debug('setAudioPlaying called', { isPlaying, isHost: ctx.isHost });

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

// =============================================================================
// Reveal Ack 处理
// =============================================================================

/**
 * Host: 清除 pending reveal acks 并推进夜晚
 *
 * 当用户确认 reveal 弹窗后调用
 */
export async function clearRevealAcks(
  ctx: HostActionsContext,
): Promise<{ success: boolean; reason?: string }> {
  facadeLog.debug('clearRevealAcks called', { isHost: ctx.isHost });

  const state = ctx.store.getState();
  if (!state) {
    return { success: false, reason: 'no_state' };
  }

  // 应用 CLEAR_REVEAL_ACKS action
  const newState = gameReducer(state, { type: 'CLEAR_REVEAL_ACKS' });
  ctx.store.setState(newState);
  
  // 必须 await broadcast，确保 Player 先收到 ack 清除再推进
  await ctx.broadcastCurrentState();

  // 推进夜晚流程
  await callNightProgression(ctx);

  return { success: true };
}

/**
 * Host: 设置机械狼查看猎人状态的 gate
 *
 * 当机械狼学到猎人后查看状态按钮被点击时调用
 *
 * 编排职责：调用 handler → reducer → store → broadcast
 * 业务逻辑全部在 handler 层（handleSetWolfRobotHunterStatusViewed）
 */
export async function setWolfRobotHunterStatusViewed(
  ctx: HostActionsContext,
  seat: number,
): Promise<{ success: boolean; reason?: string }> {
  facadeLog.debug('setWolfRobotHunterStatusViewed called', { isHost: ctx.isHost, seat });

  // 构建 handler context
  const handlerCtx = {
    state: ctx.store.getState(),
    isHost: ctx.isHost,
    myUid: ctx.myUid,
    mySeat: ctx.getMySeatNumber(),
  };

  // 调用 handler（业务逻辑全部在 handler）
  const result = handleSetWolfRobotHunterStatusViewed(handlerCtx, {
    type: 'SET_WOLF_ROBOT_HUNTER_STATUS_VIEWED',
    seat,
  });

  if (!result.success) {
    return { success: false, reason: result.reason };
  }

  // 应用 actions（通过 reducer）
  let state = ctx.store.getState();
  if (!state) {
    return { success: false, reason: 'no_state_after_handler' };
  }
  for (const action of result.actions) {
    state = gameReducer(state, action);
  }
  ctx.store.setState(state);

  // 必须 await broadcast，确保 Player 先收到 gate 解除再推进
  await ctx.broadcastCurrentState();

  // 推进夜晚流程（gate 解除后自动推进到下一步）
  await callNightProgression(ctx);

  return { success: true };
}

// =============================================================================
// 夜晚推进透传（调用 handler 层的 handleNightProgression）
// =============================================================================

/**
 * 构建夜晚推进回调
 *
 * 将 HostActionsContext 转换为 handler 需要的回调接口
 */
function buildNightProgressionCallbacks(ctx: HostActionsContext) {
  return {
    getRevision: () => ctx.store.getRevision(),
    getState: () => ctx.store.getState(),
    isHost: ctx.isHost,
    advanceNight: () => advanceNight(ctx),
    endNight: () => endNight(ctx),
  };
}

/**
 * Host: 透传调用夜晚推进
 *
 * 这是一个透传方法，将 HostActionsContext 转换后调用 handler 层的 handleNightProgression。
 */
async function callNightProgression(ctx: HostActionsContext): Promise<void> {
  const callbacks = buildNightProgressionCallbacks(ctx);
  await handleNightProgression(callbacks);
}
