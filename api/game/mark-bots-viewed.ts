/**
 * Mark Bots Viewed API Route — POST /api/game/mark-bots-viewed
 *
 * Host 标记所有机器人已查看角色（Debug-only, assigned 阶段）。
 * 使用 game-engine handleMarkAllBotsViewed 纯函数 + gameStateManager 读写广播。
 *
 * ✅ 允许：请求解析、调用 handler + gameStateManager
 * ❌ 禁止：直接操作 DB 或 state
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  type BroadcastGameState,
  handleMarkAllBotsViewed,
  type HandlerContext,
} from '@werewolf/game-engine';

import { processGameAction } from '../_lib/gameStateManager';
import type { MarkBotsViewedRequestBody } from '../_lib/types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, reason: 'METHOD_NOT_ALLOWED' });
  }

  const body = req.body as MarkBotsViewedRequestBody;
  const { roomCode, hostUid } = body;

  if (!roomCode || !hostUid) {
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
    return handleMarkAllBotsViewed({ type: 'MARK_ALL_BOTS_VIEWED' }, handlerCtx);
  });

  return res.status(result.success ? 200 : 400).json(result);
}

function findSeatByUid(state: BroadcastGameState, uid: string): number | null {
  for (const [seatKey, player] of Object.entries(state.players)) {
    if (player?.uid === uid) return Number(seatKey);
  }
  return null;
}
