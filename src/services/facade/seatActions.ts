/**
 * Seat Actions - 座位操作编排
 *
 * 拆分自 GameFacade.ts（纯重构 PR，无行为变更）
 *
 * 职责：
 * - 座位操作方法（takeSeat/leaveSeat）
 * - Host: handler → reducer → store → broadcast
 * - Player: 发送请求 + 等待 ACK + timeout 处理
 *
 * 禁止：
 * - 业务逻辑/校验规则（全部在 handler）
 * - 直接修改 state（全部在 reducer）
 */

import { handleJoinSeat, handleLeaveMySeat } from '@/services/engine/handlers/seatHandler';
import type { HandlerContext } from '@/services/engine/handlers/types';
import type { JoinSeatIntent, LeaveMySeatIntent } from '@/services/engine/intents/types';
import { gameReducer } from '@/services/engine/reducer';
import type { StateAction } from '@/services/engine/reducer/types';
import type { GameStore } from '@/services/engine/store';
import { REASON_CANCELLED, REASON_TIMEOUT } from '@/services/protocol/reasonCodes';
import type { BroadcastGameState, PlayerMessage } from '@/services/protocol/types';
import type { BroadcastService } from '@/services/transport/BroadcastService';
import { facadeLog } from '@/utils/logger';

/**
 * Seat Actions 依赖的上下文接口
 */
export interface SeatActionsContext {
  readonly store: GameStore;
  readonly broadcastService: BroadcastService;
  isHost: boolean;
  myUid: string | null;
  getMySeatNumber: () => number | null;
  broadcastCurrentState: () => Promise<void>;
  findSeatByUid: (uid: string | null) => number | null;
  generateRequestId: () => string;
}

/** ACK 超时时间 */
const ACK_TIMEOUT_MS = 5000;

/**
 * Pending seat action request (Player: waiting for ACK)
 */
export interface PendingSeatAction {
  requestId: string;
  resolve: (result: { success: boolean; reason?: string }) => void;
  reject: (error: Error) => void;
  timeoutHandle: ReturnType<typeof setTimeout>;
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

// =============================================================================
// Host: 处理座位操作
// =============================================================================

/**
 * Host 处理入座
 *
 * Facade 不做任何校验，全部委托给 handler
 */
export function hostProcessJoinSeat(
  ctx: SeatActionsContext,
  seat: number,
  requestUid: string | null,
  displayName?: string,
  avatarUrl?: string,
): { success: boolean; reason?: string } {
  facadeLog.debug('hostProcessJoinSeat', { seat, requestUid });

  const state = ctx.store.getState();

  const intent: JoinSeatIntent = {
    type: 'JOIN_SEAT',
    payload: {
      seat,
      uid: requestUid ?? '',
      displayName: displayName ?? '',
      avatarUrl,
    },
  };

  const context: HandlerContext = {
    state,
    isHost: true,
    myUid: ctx.myUid,
    mySeat: ctx.getMySeatNumber(),
  };

  const result = handleJoinSeat(intent, context);

  if (!result.success) {
    void ctx.broadcastCurrentState();
    return { success: false, reason: result.reason };
  }

  if (state) {
    applyActions(ctx.store, state, result.actions);
  }

  if (result.sideEffects?.some((e) => e.type === 'BROADCAST_STATE')) {
    void ctx.broadcastCurrentState();
  }

  return { success: true };
}

/**
 * Host 处理离座（LEAVE_MY_SEAT）
 *
 * 不需要 payload 中的 seat，从 context.mySeat（基于 uid 推导）获取
 */
export function hostProcessLeaveMySeat(
  ctx: SeatActionsContext,
  requestUid: string | null,
): { success: boolean; reason?: string } {
  facadeLog.debug('hostProcessLeaveMySeat', { requestUid });

  const state = ctx.store.getState();

  const intent: LeaveMySeatIntent = {
    type: 'LEAVE_MY_SEAT',
    payload: {
      uid: requestUid ?? '',
    },
  };

  const requestUidSeat = ctx.findSeatByUid(requestUid);

  const context: HandlerContext = {
    state,
    isHost: true,
    myUid: requestUid,
    mySeat: requestUidSeat,
  };

  const result = handleLeaveMySeat(intent, context);

  if (!result.success) {
    void ctx.broadcastCurrentState();
    return { success: false, reason: result.reason };
  }

  if (state) {
    applyActions(ctx.store, state, result.actions);
  }

  if (result.sideEffects?.some((e) => e.type === 'BROADCAST_STATE')) {
    void ctx.broadcastCurrentState();
  }

  return { success: true };
}

// =============================================================================
// Player: 发送座位请求并等待 ACK
// =============================================================================

/**
 * Player: 发送座位请求并等待 ACK
 */
export async function playerSendSeatActionWithAck(
  ctx: SeatActionsContext,
  action: 'sit' | 'standup',
  seat: number,
  pendingSeatAction: { current: PendingSeatAction | null },
  displayName?: string,
  avatarUrl?: string,
): Promise<{ success: boolean; reason?: string }> {
  // 如果有 pending 请求，先取消
  if (pendingSeatAction.current) {
    clearTimeout(pendingSeatAction.current.timeoutHandle);
    pendingSeatAction.current.reject(new Error('Cancelled by new request'));
    pendingSeatAction.current = null;
  }

  const requestId = ctx.generateRequestId();
  facadeLog.debug('Player sending seat action:', { action, seat, requestId });

  // 创建 Promise 等待 ACK
  const ackPromise = new Promise<{ success: boolean; reason?: string }>((resolve, _reject) => {
    const timeoutHandle = setTimeout(() => {
      if (pendingSeatAction.current?.requestId === requestId) {
        facadeLog.warn('Seat action ACK timeout:', requestId);
        pendingSeatAction.current = null;
        resolve({ success: false, reason: REASON_TIMEOUT });

        // 自恢复：超时后主动请求最新状态，确保 Player 最终能同步到正确状态
        // （无论 Host 是否已成功处理）
        if (ctx.myUid) {
          const reqMsg: PlayerMessage = { type: 'REQUEST_STATE', uid: ctx.myUid };
          void ctx.broadcastService.sendToHost(reqMsg).catch((e) => {
            const err = e as { message?: string };
            facadeLog.warn('Failed to request state after ACK timeout', {
              error: err?.message ?? String(e),
            });
          });
        }
      }
    }, ACK_TIMEOUT_MS);

    pendingSeatAction.current = {
      requestId,
      resolve,
      reject: (err) => {
        facadeLog.warn('Pending request rejected:', err);
        resolve({ success: false, reason: REASON_CANCELLED });
      },
      timeoutHandle,
    };
  });

  // 发送请求
  const msg: PlayerMessage = {
    type: 'SEAT_ACTION_REQUEST',
    requestId,
    action,
    seat,
    uid: ctx.myUid ?? '',
    displayName,
    avatarUrl,
  };
  await ctx.broadcastService.sendToHost(msg);

  // 等待 ACK
  const result = await ackPromise;
  facadeLog.debug('Player seat action result:', { action, seat, requestId, result });
  return result;
}

// =============================================================================
// Public API
// =============================================================================

/**
 * 入座（返回 boolean，兼容旧 API）
 */
export async function takeSeat(
  ctx: SeatActionsContext,
  pendingSeatAction: { current: PendingSeatAction | null },
  seatNumber: number,
  displayName?: string,
  avatarUrl?: string,
): Promise<boolean> {
  const result = await takeSeatWithAck(ctx, pendingSeatAction, seatNumber, displayName, avatarUrl);
  return result.success;
}

/**
 * 入座并返回完整结果（包含 reason）
 */
export async function takeSeatWithAck(
  ctx: SeatActionsContext,
  pendingSeatAction: { current: PendingSeatAction | null },
  seatNumber: number,
  displayName?: string,
  avatarUrl?: string,
): Promise<{ success: boolean; reason?: string }> {
  if (ctx.isHost) {
    return hostProcessJoinSeat(ctx, seatNumber, ctx.myUid, displayName, avatarUrl);
  }
  return playerSendSeatActionWithAck(
    ctx,
    'sit',
    seatNumber,
    pendingSeatAction,
    displayName,
    avatarUrl,
  );
}

/**
 * 离座（返回 boolean，兼容旧 API）
 */
export async function leaveSeat(
  ctx: SeatActionsContext,
  pendingSeatAction: { current: PendingSeatAction | null },
): Promise<boolean> {
  const result = await leaveSeatWithAck(ctx, pendingSeatAction);
  return result.success;
}

/**
 * 离座并返回完整结果（包含 reason）
 */
export async function leaveSeatWithAck(
  ctx: SeatActionsContext,
  pendingSeatAction: { current: PendingSeatAction | null },
): Promise<{ success: boolean; reason?: string }> {
  if (ctx.isHost) {
    return hostProcessLeaveMySeat(ctx, ctx.myUid);
  }
  // standup 的 seat 字段不参与业务判断，仅用于协议兼容/日志占位
  return playerSendSeatActionWithAck(ctx, 'standup', 0, pendingSeatAction);
}
