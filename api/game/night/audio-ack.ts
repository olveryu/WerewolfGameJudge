/**
 * Audio Ack API Route — POST /api/game/night/audio-ack
 *
 * Host 播放完 pendingAudioEffects 后调用，清除 effects 并解除 isAudioPlaying gate。
 * 清除后触发内联推进，评估是否可以继续推进下一步。
 *
 * ✅ 允许：请求解析、清除 audio effects、内联推进
 * ❌ 禁止：直接操作 DB 或 state
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

import { processGameAction } from '../../_lib/gameStateManager';
import type { AudioAckRequestBody } from '../../_lib/types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, reason: 'METHOD_NOT_ALLOWED' });
  }

  const body = req.body as AudioAckRequestBody;
  const { roomCode, hostUid } = body;

  if (!roomCode || !hostUid) {
    return res.status(400).json({ success: false, reason: 'MISSING_PARAMS' });
  }

  const result = await processGameAction(
    roomCode,
    (state) => {
      // Gate: host_only
      if (state.hostUid !== hostUid) {
        return { success: false, reason: 'host_only', actions: [] };
      }

      // Clear pendingAudioEffects + isAudioPlaying
      return {
        success: true,
        actions: [
          { type: 'CLEAR_PENDING_AUDIO_EFFECTS' as const },
          { type: 'SET_AUDIO_PLAYING' as const, payload: { isPlaying: false } },
        ],
      };
    },
    { enabled: true, hostUid },
  );

  return res.status(result.success ? 200 : 400).json(result);
}
