/**
 * End Night API Route — POST /api/game/night/end
 *
 * 结束夜晚，进行死亡结算（Host-only）。
 * 使用 game-engine handleEndNight 纯函数 + gameStateManager 读写广播。
 * 返回 sideEffects 供 Host 客户端播放音频。
 *
 * ✅ 允许：请求解析、调用 handler + gameStateManager
 * ❌ 禁止：直接操作 DB 或 state、播放音频
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  type BroadcastGameState,
  type EndNightIntent,
  handleEndNight,
  type HandlerContext,
} from '@werewolf/game-engine';

import { handleCors } from '../../_lib/cors';
import { processGameAction } from '../../_lib/gameStateManager';
import type { EndNightRequestBody } from '../../_lib/types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, reason: 'METHOD_NOT_ALLOWED' });
  }

  const body = req.body as EndNightRequestBody;
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
    const intent: EndNightIntent = { type: 'END_NIGHT' };
    return handleEndNight(intent, handlerCtx);
  });

  return res.status(result.success ? 200 : 400).json(result);
}

function findSeatByUid(state: BroadcastGameState, uid: string): number | null {
  for (const [seatKey, player] of Object.entries(state.players)) {
    if (player?.uid === uid) return Number(seatKey);
  }
  return null;
}
