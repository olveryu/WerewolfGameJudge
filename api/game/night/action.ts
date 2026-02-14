/**
 * Night Action API Route — POST /api/game/night/action
 *
 * 提交夜晚行动（Host-only）。
 * 使用 game-engine handleSubmitAction 纯函数 + gameStateManager 读写广播。
 * 内联推进：action 写入后自动评估并执行推进（advance / endNight）。
 *
 * ✅ 允许：请求解析、调用 handler + gameStateManager
 * ❌ 禁止：直接操作 DB 或 state、播放音频
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  type BroadcastGameState,
  type HandlerContext,
  handleSubmitAction,
  type SubmitActionIntent,
} from '@werewolf/game-engine';

import { processGameAction } from '../../_lib/gameStateManager';
import type { ActionRequestBody } from '../../_lib/types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, reason: 'METHOD_NOT_ALLOWED' });
  }

  const body = req.body as ActionRequestBody;
  const { roomCode, hostUid, seat, role, target, extra } = body;

  if (!roomCode || !hostUid || seat == null || !role) {
    return res.status(400).json({ success: false, reason: 'MISSING_PARAMS' });
  }

  const result = await processGameAction(
    roomCode,
    (state: BroadcastGameState) => {
      const isHost = state.hostUid === hostUid;
      const handlerCtx: HandlerContext = {
        state,
        isHost,
        myUid: hostUid,
        mySeat: findSeatByUid(state, hostUid),
      };
      const intent: SubmitActionIntent = {
        type: 'SUBMIT_ACTION',
        payload: { seat, role, target, extra },
      };
      return handleSubmitAction(intent, handlerCtx);
    },
    { enabled: true, hostUid },
  );

  return res.status(result.success ? 200 : 400).json(result);
}

function findSeatByUid(state: BroadcastGameState, uid: string): number | null {
  for (const [seatKey, player] of Object.entries(state.players)) {
    if (player?.uid === uid) return Number(seatKey);
  }
  return null;
}
