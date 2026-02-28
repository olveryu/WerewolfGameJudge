/**
 * Seat Actions - 座位操作编排（HTTP API）
 *
 * 所有座位操作（入座/离座）统一通过 HTTP 调用服务端 API。
 * 服务端处理 handler → reducer → DB 写入 → Realtime 广播。
 * Host 和 Player 不再有区别。负责 HTTP 调用和结果解析。
 * 不包含业务逻辑/校验规则（全部在服务端 handler），不直接修改 state（全部在服务端 reducer）。
 */

import type { GameStore } from '@werewolf/game-engine/engine/store';
import type { GameState } from '@werewolf/game-engine/engine/store/types';

import { facadeLog } from '@/utils/logger';

import { type ApiResponse, applyOptimisticUpdate, callApiOnce } from './apiUtils';

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
 * 调用座位 API
 *
 * 支持客户端乐观更新：传入 `optimisticFn` 在 fetch 前即时渲染预测 state，
 * 服务端响应后 applySnapshot 覆盖；失败时 rollbackOptimistic。
 */
async function callSeatApi(
  roomCode: string,
  body: Record<string, unknown>,
  store?: GameStore,
  optimisticFn?: (state: GameState) => GameState,
): Promise<SeatApiResponse> {
  applyOptimisticUpdate(store, optimisticFn);
  return callApiOnce('/game/seat', { roomCode, ...body }, 'callSeatApi', store);
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
    // 乐观预测：立即显示玩家入座（同时清除旧座位）
    (state) => {
      const updatedPlayers = { ...state.players };
      // 移除同一 uid 的旧座位
      for (const [seat, player] of Object.entries(updatedPlayers)) {
        if (player && player.uid === ctx.myUid) {
          updatedPlayers[Number(seat)] = null;
          break;
        }
      }
      // 设置新座位
      updatedPlayers[seatNumber] = {
        uid: ctx.myUid!,
        seatNumber,
        displayName,
        avatarUrl,
        hasViewedRole: false,
      };
      return { ...state, players: updatedPlayers };
    },
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
    // 乐观预测：立即移除玩家座位
    (state) => {
      const updatedPlayers = { ...state.players };
      for (const [seat, player] of Object.entries(updatedPlayers)) {
        if (player && player.uid === uid) {
          updatedPlayers[Number(seat)] = null;
          break;
        }
      }
      return { ...state, players: updatedPlayers };
    },
  );
}
