/**
 * Seat Actions - 座位操作编排（HTTP API）
 *
 * 所有座位操作（入座/离座）统一通过 HTTP 调用服务端 API。
 * 服务端处理 handler → reducer → DB 写入 → Realtime 广播。
 * Host 和 Player 不再有区别。
 *
 * ✅ 允许：HTTP 调用、结果解析
 * ❌ 禁止：业务逻辑/校验规则（全部在服务端 handler）
 * ❌ 禁止：直接修改 state（全部在服务端 reducer）
 */

import { API_BASE_URL } from '@/config/api';
import type { GameStore } from '@/services/engine/store';
import { facadeLog } from '@/utils/logger';

/**
 * Seat Actions 依赖的上下文接口
 *
 * 迁移后只需 roomCode + uid 信息，不再需要 store / broadcastService 等
 */
export interface SeatActionsContext {
  myUid: string | null;
  getRoomCode: () => string | null;
  /** GameStore 实例（用于 HTTP 响应即时 applySnapshot） */
  readonly store?: GameStore;
}

/** 座位操作 API 响应 */
interface SeatApiResponse {
  success: boolean;
  reason?: string;
  state?: Record<string, unknown>;
  revision?: number;
}

/**
 * 调用座位 API
 */
async function callSeatApi(
  roomCode: string,
  body: Record<string, unknown>,
  store?: GameStore,
): Promise<SeatApiResponse> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/game/seat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomCode, ...body }),
    });
    const result = (await res.json()) as SeatApiResponse;

    // Optimistic Response: HTTP 响应含 state 时立即 apply，不等 broadcast
    if (result.success && result.state && result.revision != null && store) {
      store.applySnapshot(result.state as never, result.revision);
    }

    return result;
  } catch (e) {
    const err = e as { message?: string };
    facadeLog.error('callSeatApi failed', { error: err?.message ?? String(e) });
    return { success: false, reason: 'NETWORK_ERROR' };
  }
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
): Promise<boolean> {
  const result = await takeSeatWithAck(ctx, seatNumber, displayName, avatarUrl);
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

  return callSeatApi(
    roomCode,
    {
      action: 'standup',
      uid: ctx.myUid,
    },
    ctx.store,
  );
}
