/**
 * Audio Gate API Route — POST /api/game/night/audio-gate
 *
 * 设置音频播放状态（Host-only）。
 * 使用 game-engine handleSetAudioPlaying 纯函数 + gameStateManager 读写广播。
 *
 * ✅ 允许：请求解析、调用 handler + gameStateManager
 * ❌ 禁止：直接操作 DB 或 state
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  type BroadcastGameState,
  type HandlerContext,
  handleSetAudioPlaying,
  type SetAudioPlayingIntent,
} from '@werewolf/game-engine';

import { handleCors } from '../../_lib/cors';
import { processGameAction } from '../../_lib/gameStateManager';
import type { AudioGateRequestBody } from '../../_lib/types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, reason: 'METHOD_NOT_ALLOWED' });
  }

  const body = req.body as AudioGateRequestBody;
  const { roomCode, hostUid, isPlaying } = body;

  if (!roomCode || !hostUid || isPlaying == null) {
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
    const intent: SetAudioPlayingIntent = {
      type: 'SET_AUDIO_PLAYING',
      payload: { isPlaying },
    };
    return handleSetAudioPlaying(intent, handlerCtx);
  });

  return res.status(result.success ? 200 : 400).json(result);
}

function findSeatByUid(state: BroadcastGameState, uid: string): number | null {
  for (const [seatKey, player] of Object.entries(state.players)) {
    if (player?.uid === uid) return Number(seatKey);
  }
  return null;
}
