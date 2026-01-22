/**
 * Message Router - PlayerMessage/HostBroadcast 路由分发
 *
 * 拆分自 V2GameFacade.ts（纯重构 PR，无行为变更）
 *
 * 职责：
 * - Host: 处理 PlayerMessage（REQUEST_STATE / SEAT_ACTION_REQUEST）
 * - Player: 处理 HostBroadcast（STATE_UPDATE / SEAT_ACTION_ACK）
 *
 * 禁止：
 * - 业务逻辑/校验规则
 * - 直接修改 state
 */

import type { PlayerMessage, HostBroadcast } from '../../protocol/types';
import type { GameStore } from '../store';
import type { BroadcastService } from '../../BroadcastService';
import type { SeatActionsContext, PendingSeatAction } from './seatActions';

import { hostProcessJoinSeat, hostProcessLeaveMySeat } from './seatActions';
import { v2FacadeLog } from '../../../utils/logger';
import { REASON_INVALID_ACTION } from '../protocol/reasonCodes';

/**
 * Message Router 依赖的上下文接口
 */
export interface MessageRouterContext {
  readonly store: GameStore;
  readonly broadcastService: BroadcastService;
  isHost: boolean;
  myUid: string | null;
  getMySeatNumber: () => number | null;
  broadcastCurrentState: () => Promise<void>;
  findSeatByUid: (uid: string | null) => number | null;
  generateRequestId: () => string;
  /**
   * Host 处理 Player 发来的 VIEWED_ROLE 消息
   * 由 V2GameFacade 注入 hostActions.markViewedRole 实现
   */
  handleViewedRole?: (seat: number) => Promise<{ success: boolean; reason?: string }>;
}

// =============================================================================
// Host: 处理 PlayerMessage
// =============================================================================

/**
 * Host 处理 PlayerMessage
 */
export function hostHandlePlayerMessage(
  ctx: MessageRouterContext,
  msg: PlayerMessage,
  _senderId: string,
): void {
  if (!ctx.isHost) return;

  switch (msg.type) {
    case 'REQUEST_STATE':
      void ctx.broadcastCurrentState();
      break;

    case 'SEAT_ACTION_REQUEST':
      hostHandleSeatActionRequest(ctx, msg);
      break;

    case 'VIEWED_ROLE':
      if (ctx.handleViewedRole) {
        void ctx.handleViewedRole(msg.seat);
      }
      break;
  }
}

/**
 * Host 处理座位请求
 */
function hostHandleSeatActionRequest(
  ctx: MessageRouterContext,
  msg: Extract<PlayerMessage, { type: 'SEAT_ACTION_REQUEST' }>,
): void {
  const { action, seat, uid, displayName, avatarUrl, requestId } = msg;

  // 构造 SeatActionsContext
  const seatCtx: SeatActionsContext = {
    store: ctx.store,
    broadcastService: ctx.broadcastService,
    isHost: ctx.isHost,
    myUid: ctx.myUid,
    getMySeatNumber: ctx.getMySeatNumber,
    broadcastCurrentState: ctx.broadcastCurrentState,
    findSeatByUid: ctx.findSeatByUid,
    generateRequestId: ctx.generateRequestId,
  };

  let result: { success: boolean; reason?: string };

  if (action === 'sit') {
    result = hostProcessJoinSeat(seatCtx, seat, uid, displayName, avatarUrl);
  } else if (action === 'standup') {
    result = hostProcessLeaveMySeat(seatCtx, uid);
  } else {
    result = { success: false, reason: REASON_INVALID_ACTION };
  }

  // 发送 ACK
  void sendSeatActionAck(ctx.broadcastService, requestId, uid, result.success, seat, result.reason);
}

/**
 * Host 发送座位操作 ACK
 */
async function sendSeatActionAck(
  broadcastService: BroadcastService,
  requestId: string,
  toUid: string,
  success: boolean,
  seat: number,
  reason?: string,
): Promise<void> {
  const ack: HostBroadcast = {
    type: 'SEAT_ACTION_ACK',
    requestId,
    toUid,
    success,
    seat,
    reason,
  };
  await broadcastService.broadcastAsHost(ack);
}

// =============================================================================
// Player: 处理 HostBroadcast
// =============================================================================

/**
 * Player 处理 HostBroadcast
 */
export function playerHandleHostBroadcast(
  ctx: MessageRouterContext,
  msg: HostBroadcast,
  pendingSeatAction: { current: PendingSeatAction | null },
): void {
  if (ctx.isHost) return;

  switch (msg.type) {
    case 'STATE_UPDATE':
      ctx.store.applySnapshot(msg.state, msg.revision);
      ctx.broadcastService.markAsLive();
      break;

    case 'SEAT_ACTION_ACK':
      playerHandleSeatActionAck(ctx, msg, pendingSeatAction);
      break;
  }
}

/**
 * Player 处理座位操作 ACK
 */
function playerHandleSeatActionAck(
  ctx: MessageRouterContext,
  msg: Extract<HostBroadcast, { type: 'SEAT_ACTION_ACK' }>,
  pendingSeatAction: { current: PendingSeatAction | null },
): void {
  // 检查是否是发给自己的 ACK
  if (msg.toUid !== ctx.myUid) return;

  // 检查 requestId 是否匹配
  if (!pendingSeatAction.current || pendingSeatAction.current.requestId !== msg.requestId) {
    v2FacadeLog.warn('Received ACK for unknown request', { requestId: msg.requestId });
    return;
  }

  // 清理 timeout
  clearTimeout(pendingSeatAction.current.timeoutHandle);

  // Resolve promise
  const pending = pendingSeatAction.current;
  pendingSeatAction.current = null;
  pending.resolve({ success: msg.success, reason: msg.reason });

  v2FacadeLog.debug('playerHandleSeatActionAck', {
    requestId: msg.requestId,
    success: msg.success,
    reason: msg.reason,
  });
}
