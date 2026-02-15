/**
 * Restart Game API Route — POST /api/game/restart
 *
 * Host 重新开始游戏（任意状态 → unseated）。
 * 使用 game-engine handleRestartGame 纯函数 + gameStateManager 读写广播。
 *
 * 额外副作用：成功后通过 Realtime 广播 GAME_RESTARTED 消息（v1 对齐）。
 *
 * ✅ 允许：请求解析、调用 handler + gameStateManager + 额外 broadcast
 * ❌ 禁止：直接操作 DB 或 state
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  type BroadcastGameState,
  type HandlerContext,
  handleRestartGame,
} from '@werewolf/game-engine';

import { handleCors } from '../_lib/cors';
import { processGameAction } from '../_lib/gameStateManager';
import { getServiceClient } from '../_lib/supabase';
import type { RestartRequestBody } from '../_lib/types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, reason: 'METHOD_NOT_ALLOWED' });
  }

  const body = req.body as RestartRequestBody;
  const { roomCode, hostUid } = body;

  if (!roomCode || !hostUid) {
    return res.status(400).json({ success: false, reason: 'MISSING_PARAMS' });
  }

  // v1 对齐：在状态变更前广播 GAME_RESTARTED 通知 Player
  const supabase = getServiceClient();
  const preChannel = supabase.channel(`room:${roomCode}`);
  await preChannel.send({
    type: 'broadcast',
    event: 'host',
    payload: { type: 'GAME_RESTARTED' },
  });
  await supabase.removeChannel(preChannel);

  const result = await processGameAction(roomCode, (state: BroadcastGameState) => {
    const isHost = state.hostUid === hostUid;
    const handlerCtx: HandlerContext = {
      state,
      isHost,
      myUid: hostUid,
      mySeat: findSeatByUid(state, hostUid),
    };
    return handleRestartGame({ type: 'RESTART_GAME' }, handlerCtx);
  });

  return res.status(result.success ? 200 : 400).json(result);
}

function findSeatByUid(state: BroadcastGameState, uid: string): number | null {
  for (const [seatKey, player] of Object.entries(state.players)) {
    if (player?.uid === uid) return Number(seatKey);
  }
  return null;
}
