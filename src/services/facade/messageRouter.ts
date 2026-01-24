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

import type { PlayerMessage, HostBroadcast } from '../protocol/types';
import type { GameStore } from '../engine/store';
import type { BroadcastService } from '../transport/BroadcastService';
import type { SeatActionsContext, PendingSeatAction } from './seatActions';
import type { RoleId } from '../../models/roles';

import { hostProcessJoinSeat, hostProcessLeaveMySeat } from './seatActions';
import { v2FacadeLog } from '../../utils/logger';
import { REASON_INVALID_ACTION } from '../v2/protocol/reasonCodes';

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

  // ===========================================================================
  // Host 处理 Player 消息的回调（由 V2GameFacade 注入）
  // ===========================================================================

  /**
   * Host 处理 Player 发来的 VIEWED_ROLE 消息
   * 由 V2GameFacade 注入 hostActions.markViewedRole 实现
   */
  handleViewedRole?: (seat: number) => Promise<{ success: boolean; reason?: string }>;

  /**
   * Host 处理 Player 发来的 ACTION 消息
   * 由 V2GameFacade 注入 hostActions.submitAction 实现
   */
  handleAction?: (
    seat: number,
    role: RoleId,
    target: number | null,
    extra?: unknown,
  ) => Promise<{ success: boolean; reason?: string }>;

  /**
   * Host 处理 Player 发来的 WOLF_VOTE 消息
   * 由 V2GameFacade 注入 hostActions.submitWolfVote 实现
   */
  handleWolfVote?: (
    voterSeat: number,
    targetSeat: number,
  ) => Promise<{ success: boolean; reason?: string }>;

  /**
   * Host 处理 Player 发来的 REVEAL_ACK 消息
   * 由 V2GameFacade 注入 hostActions.clearRevealAcks 实现
   */
  handleRevealAck?: () => Promise<{ success: boolean; reason?: string }>;
}

// =============================================================================
// Host: 处理 PlayerMessage
// =============================================================================

/**
 * Host 处理 PlayerMessage
 *
 * PR9 强制显式处理：每个 PlayerMessage['type'] 必须有 case
 * - 禁止 default silent drop
 * - Legacy types: warn + no-op
 * - Unimplemented types: warn + no-op（但有明确日志）
 */
export async function hostHandlePlayerMessage(
  ctx: MessageRouterContext,
  msg: PlayerMessage,
  _senderId: string,
): Promise<void> {
  if (!ctx.isHost) return;

  switch (msg.type) {
    // =========================================================================
    // Implemented types (v2 主路径)
    // =========================================================================
    case 'REQUEST_STATE':
      await ctx.broadcastCurrentState();
      break;

    case 'SEAT_ACTION_REQUEST':
      hostHandleSeatActionRequest(ctx, msg);
      break;

    case 'VIEWED_ROLE':
      if (ctx.handleViewedRole) {
        await ctx.handleViewedRole(msg.seat);
      }
      break;

    // =========================================================================
    // Legacy types (已被 SEAT_ACTION_REQUEST 替代)
    // =========================================================================
    case 'JOIN':
      v2FacadeLog.warn('[messageRouter] Legacy PlayerMessage type received', {
        type: msg.type,
        guidance: 'Use SEAT_ACTION_REQUEST with action="sit" instead',
      });
      break;

    case 'LEAVE':
      v2FacadeLog.warn('[messageRouter] Legacy PlayerMessage type received', {
        type: msg.type,
        guidance: 'Use SEAT_ACTION_REQUEST with action="standup" instead',
      });
      break;

    // =========================================================================
    // Tracked types (需要在 v2 完整实现后接入)
    // Host 直接处理这些行动，Player 应通过新入口发送
    // =========================================================================
    case 'ACTION':
      if (ctx.handleAction) {
        void ctx.handleAction(msg.seat, msg.role, msg.target, msg.extra);
      } else {
        v2FacadeLog.warn('[messageRouter] ACTION received but handleAction not wired', {
          type: msg.type,
          seat: msg.seat,
          role: msg.role,
        });
      }
      break;

    case 'WOLF_VOTE':
      if (ctx.handleWolfVote) {
        void ctx.handleWolfVote(msg.seat, msg.target);
      } else {
        v2FacadeLog.warn('[messageRouter] WOLF_VOTE received but handleWolfVote not wired', {
          type: msg.type,
          seat: msg.seat,
          target: msg.target,
        });
      }
      break;

    case 'REVEAL_ACK': {
      // Player 确认 reveal 弹窗后，Host 需要清除 pendingRevealAcks 并推进夜晚
      v2FacadeLog.debug('[messageRouter] REVEAL_ACK received', {
        seat: msg.seat,
        role: msg.role,
        revision: msg.revision,
      });

      // 基本校验：revision 必须匹配当前 revision（防止过时消息）
      const currentRevision = ctx.store.getRevision();
      if (msg.revision !== undefined && msg.revision !== currentRevision) {
        v2FacadeLog.warn('[messageRouter] REVEAL_ACK revision mismatch, dropping', {
          msgRevision: msg.revision,
          currentRevision,
        });
        break;
      }

      // 必须 await，确保 ack 处理完成后再处理其他消息
      if (ctx.handleRevealAck) {
        await ctx.handleRevealAck();
      }
      break;
    }

    case 'SNAPSHOT_REQUEST':
      v2FacadeLog.warn('[messageRouter] Unimplemented PlayerMessage type', {
        type: msg.type,
        guidance:
          '正确方式是发送 REQUEST_STATE；SNAPSHOT_REQUEST 保留 for future differential sync',
      });
      break;

    // =========================================================================
    // Exhaustive check: 新增 PlayerMessage.type 时编译报错
    // =========================================================================
    default: {
      const _exhaustiveCheck: never = msg;
      v2FacadeLog.error('[messageRouter] Unknown PlayerMessage type', {
        msg: _exhaustiveCheck,
      });
    }
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
