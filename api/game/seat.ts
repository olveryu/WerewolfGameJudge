/**
 * Seat API Route — POST /api/game/seat
 *
 * 处理入座 (sit) 和离座 (standup) 操作。
 * 使用 game-engine 纯函数验证 + gameStateManager 读写广播。
 *
 * ✅ 允许：请求解析、调用 handler + gameStateManager
 * ❌ 禁止：直接操作 DB 或 state
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  type BroadcastGameState,
  handleJoinSeat,
  handleLeaveMySeat,
  type HandlerContext,
  type JoinSeatIntent,
  type LeaveMySeatIntent,
} from '@werewolf/game-engine';

import { handleCors } from '../_lib/cors';
import { processGameAction } from '../_lib/gameStateManager';
import type { SeatRequestBody } from '../_lib/types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, reason: 'METHOD_NOT_ALLOWED' });
  }

  const body = req.body as SeatRequestBody;
  const { roomCode, action, uid, seat, displayName, avatarUrl } = body;

  // 基本参数校验
  if (!roomCode || !uid || !action) {
    return res.status(400).json({ success: false, reason: 'MISSING_PARAMS' });
  }

  if (action === 'sit' && seat == null) {
    return res.status(400).json({ success: false, reason: 'MISSING_SEAT' });
  }

  const result = await processGameAction(roomCode, (state: BroadcastGameState) => {
    if (action === 'sit') {
      const intent: JoinSeatIntent = {
        type: 'JOIN_SEAT',
        payload: { seat: seat!, uid, displayName: displayName ?? '', avatarUrl },
      };
      const handlerCtx: HandlerContext = {
        state,
        isHost: false, // 服务端不区分 Host/Player
        myUid: uid,
        mySeat: findSeatByUid(state, uid),
      };
      return handleJoinSeat(intent, handlerCtx);
    } else {
      const mySeat = findSeatByUid(state, uid);
      const intent: LeaveMySeatIntent = {
        type: 'LEAVE_MY_SEAT',
        payload: { uid },
      };
      const handlerCtx: HandlerContext = {
        state,
        isHost: false,
        myUid: uid,
        mySeat,
      };
      return handleLeaveMySeat(intent, handlerCtx);
    }
  });

  return res.status(result.success ? 200 : 400).json(result);
}

/** 从 state.players 中查找 uid 对应的座位号 */
function findSeatByUid(state: BroadcastGameState, uid: string): number | null {
  for (const [seatKey, player] of Object.entries(state.players)) {
    if (player?.uid === uid) return Number(seatKey);
  }
  return null;
}
