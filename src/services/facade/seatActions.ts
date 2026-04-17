/**
 * Seat Actions - 座位操作编排（HTTP API）
 *
 * 所有座位操作（入座/离座）统一通过 HTTP 调用服务端 API。
 * 服务端处理 handler → reducer → DB 写入 → Realtime 广播。
 * Host 和 Player 不再有区别。负责 HTTP 调用和结果解析。
 * 不包含业务逻辑/校验规则（全部在服务端 handler），不直接修改 state（全部在服务端 reducer）。
 */

import type { GameStore } from '@werewolf/game-engine/engine/store';

import { facadeLog } from '@/utils/logger';

import { type ApiResponse, callApiWithRetry } from './apiUtils';

/**
 * Seat Actions 依赖的上下文接口
 *
 * 迁移后只需 roomCode + uid 信息，不再需要 store / realtimeService 等
 */
export interface SeatActionsContext {
  myUid: string | null;
  getRoomCode: () => string | null;
  /** GameStore 实例（用于 HTTP 响应即时 applySnapshot） */
  readonly store?: GameStore;
}

/** 座位操作 API 响应（alias for readability within this file） */
type SeatApiResponse = ApiResponse;

/**
 * 调用座位 API（内置客户端重试）
 *
 * 座位操作不做客户端乐观更新：低频操作（点一次等结果），
 * 靠 HTTP 响应的 applySnapshot 即时渲染（~100-300ms 延迟可接受）。
 * 乐观更新曾导致服务端拒绝 / 广播竞态时客户端 state 脱轨。
 *
 * 服务端瞬时错误（CONFLICT_RETRY / INTERNAL_ERROR）透明重试最多 2 次。
 */
async function callSeatApi(
  roomCode: string,
  body: Record<string, unknown>,
  store?: GameStore,
): Promise<SeatApiResponse> {
  return callApiWithRetry('/game/seat', { roomCode, ...body }, 'callSeatApi', store);
}

// =============================================================================
// Public API
// =============================================================================

/**
 * 入座（返回 boolean，兼容旧 API）
 */
export async function takeSeat(
  ctx: SeatActionsContext,
  seatNumber: number,
  displayName?: string,
  avatarUrl?: string,
  avatarFrame?: string,
  seatFlair?: string,
  nameStyle?: string,
  level?: number,
): Promise<boolean> {
  const result = await takeSeatWithAck(
    ctx,
    seatNumber,
    displayName,
    avatarUrl,
    avatarFrame,
    seatFlair,
    nameStyle,
    level,
  );
  return result.success;
}

/**
 * 入座并返回完整结果（包含 reason）
 */
export async function takeSeatWithAck(
  ctx: SeatActionsContext,
  seatNumber: number,
  displayName?: string,
  avatarUrl?: string,
  avatarFrame?: string,
  seatFlair?: string,
  nameStyle?: string,
  level?: number,
): Promise<{ success: boolean; reason?: string }> {
  const roomCode = ctx.getRoomCode();
  if (!roomCode || !ctx.myUid) {
    return { success: false, reason: 'NOT_CONNECTED' };
  }

  facadeLog.debug('takeSeatWithAck', { seat: seatNumber, uid: ctx.myUid });

  return callSeatApi(
    roomCode,
    {
      action: 'sit',
      uid: ctx.myUid,
      seat: seatNumber,
      displayName,
      avatarUrl,
      avatarFrame,
      seatFlair,
      nameStyle,
      level,
    },
    ctx.store,
  );
}

/**
 * 离座（返回 boolean，兼容旧 API）
 */
export async function leaveSeat(ctx: SeatActionsContext): Promise<boolean> {
  const result = await leaveSeatWithAck(ctx);
  return result.success;
}

/**
 * 离座并返回完整结果（包含 reason）
 */
export async function leaveSeatWithAck(
  ctx: SeatActionsContext,
): Promise<{ success: boolean; reason?: string }> {
  const roomCode = ctx.getRoomCode();
  if (!roomCode || !ctx.myUid) {
    return { success: false, reason: 'NOT_CONNECTED' };
  }

  facadeLog.debug('leaveSeatWithAck', { uid: ctx.myUid });

  const uid = ctx.myUid;

  return callSeatApi(
    roomCode,
    {
      action: 'standup',
      uid,
    },
    ctx.store,
  );
}

/**
 * 将玩家移出座位（Host-only）
 */
export async function kickPlayer(
  ctx: SeatActionsContext,
  targetSeat: number,
): Promise<{ success: boolean; reason?: string }> {
  const roomCode = ctx.getRoomCode();
  if (!roomCode || !ctx.myUid) {
    return { success: false, reason: 'NOT_CONNECTED' };
  }

  facadeLog.debug('kickPlayer', { targetSeat, uid: ctx.myUid });

  return callSeatApi(
    roomCode,
    {
      action: 'kick',
      uid: ctx.myUid,
      targetSeat,
    },
    ctx.store,
  );
}
