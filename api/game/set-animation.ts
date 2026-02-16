/**
 * Set Animation API Route — POST /api/game/set-animation
 *
 * Host 设置开牌动画（任意阶段）。
 * 使用 game-engine handleSetRoleRevealAnimation 纯函数 + gameStateManager 读写广播。
 *
 * ✅ 允许：请求解析、调用 handler + gameStateManager
 * ❌ 禁止：直接操作 DB 或 state
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  type BroadcastGameState,
  type HandlerContext,
  handleSetRoleRevealAnimation,
} from '@werewolf/game-engine';

import { handleCors } from '../_lib/cors';
import { processGameAction } from '../_lib/gameStateManager';
import { resultToStatus } from '../_lib/responseStatus';
import type { SetAnimationRequestBody } from '../_lib/types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, reason: 'METHOD_NOT_ALLOWED' });
  }

  const body = req.body as SetAnimationRequestBody;
  const { roomCode, hostUid, animation } = body;

  if (!roomCode || !hostUid || !animation) {
    return res.status(400).json({ success: false, reason: 'MISSING_PARAMS' });
  }

  const result = await processGameAction(roomCode, (state: BroadcastGameState) => {
    const isHost = state.hostUid === hostUid;
    const handlerCtx: HandlerContext = {
      state,
      isHost,
      myUid: hostUid,
      mySeat: findSeatByUid(state, hostUid),
    };
    return handleSetRoleRevealAnimation(
      { type: 'SET_ROLE_REVEAL_ANIMATION', animation },
      handlerCtx,
    );
  });

  return res.status(resultToStatus(result)).json(result);
}

function findSeatByUid(state: BroadcastGameState, uid: string): number | null {
  for (const [seatKey, player] of Object.entries(state.players)) {
    if (player?.uid === uid) return Number(seatKey);
  }
  return null;
}
