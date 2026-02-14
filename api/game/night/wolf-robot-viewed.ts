/**
 * WolfRobot Hunter Viewed API Route — POST /api/game/night/wolf-robot-viewed
 *
 * 设置机械狼查看猎人状态（Host-only）。
 * 使用 game-engine handleSetWolfRobotHunterStatusViewed 纯函数 + gameStateManager。
 * 内联推进：gate 清除后自动评估推进。
 *
 * ✅ 允许：请求解析、调用 handler + gameStateManager
 * ❌ 禁止：直接操作 DB 或 state
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  type BroadcastGameState,
  type HandlerContext,
  handleSetWolfRobotHunterStatusViewed,
} from '@werewolf/game-engine';

import { processGameAction } from '../../_lib/gameStateManager';
import type { WolfRobotViewedRequestBody } from '../../_lib/types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, reason: 'METHOD_NOT_ALLOWED' });
  }

  const body = req.body as WolfRobotViewedRequestBody;
  const { roomCode, hostUid, seat } = body;

  if (!roomCode || !hostUid || seat == null) {
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
      return handleSetWolfRobotHunterStatusViewed(handlerCtx, {
        type: 'SET_WOLF_ROBOT_HUNTER_STATUS_VIEWED',
        seat,
      });
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
