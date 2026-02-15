/**
 * Update Template API Route — POST /api/game/update-template
 *
 * Host 更新游戏模板（仅 unseated/seated 阶段）。
 * 使用 game-engine handleUpdateTemplate 纯函数 + gameStateManager 读写广播。
 *
 * ✅ 允许：请求解析、调用 handler + gameStateManager
 * ❌ 禁止：直接操作 DB 或 state
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  type BroadcastGameState,
  type HandlerContext,
  handleUpdateTemplate,
} from '@werewolf/game-engine';

import { handleCors } from '../_lib/cors';
import { processGameAction } from '../_lib/gameStateManager';
import type { UpdateTemplateRequestBody } from '../_lib/types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, reason: 'METHOD_NOT_ALLOWED' });
  }

  const body = req.body as UpdateTemplateRequestBody;
  const { roomCode, hostUid, templateRoles } = body;

  if (!roomCode || !hostUid || !templateRoles) {
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
    return handleUpdateTemplate(
      { type: 'UPDATE_TEMPLATE', payload: { templateRoles } },
      handlerCtx,
    );
  });

  return res.status(result.success ? 200 : 400).json(result);
}

function findSeatByUid(state: BroadcastGameState, uid: string): number | null {
  for (const [seatKey, player] of Object.entries(state.players)) {
    if (player?.uid === uid) return Number(seatKey);
  }
  return null;
}
