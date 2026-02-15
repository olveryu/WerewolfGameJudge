/**
 * View Role API Route — POST /api/game/view-role
 *
 * 任意玩家标记自己已查看角色（assigned 阶段）。
 * 不要求 hostUid — 任何已入座玩家都可以标记自己的座位。
 * 使用 game-engine handleViewedRole 纯函数 + gameStateManager 读写广播。
 *
 * ✅ 允许：请求解析、调用 handler + gameStateManager
 * ❌ 禁止：直接操作 DB 或 state
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  type BroadcastGameState,
  type HandlerContext,
  handleViewedRole,
} from '@werewolf/game-engine';

import { processGameAction } from '../_lib/gameStateManager';
import type { ViewRoleRequestBody } from '../_lib/types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, reason: 'METHOD_NOT_ALLOWED' });
  }

  const body = req.body as ViewRoleRequestBody;
  const { roomCode, uid, seat } = body;

  if (!roomCode || !uid || seat == null) {
    return res.status(400).json({ success: false, reason: 'MISSING_PARAMS' });
  }

  const result = await processGameAction(roomCode, (state: BroadcastGameState) => {
    // handleViewedRole 目前要求 isHost=true（handler 层 gate）。
    // 服务端代表 Host 执行此操作，因此强制设为 true。
    const handlerCtx: HandlerContext = {
      state,
      isHost: true,
      myUid: uid,
      mySeat: seat,
    };
    const handlerResult = handleViewedRole({ type: 'VIEWED_ROLE', payload: { seat } }, handlerCtx);
    return handlerResult;
  });
  return res.status(result.success ? 200 : 400).json(result);
}
