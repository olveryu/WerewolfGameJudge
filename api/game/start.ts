/**
 * Start Night API Route — POST /api/game/start
 *
 * Host 开始夜晚（ready → ongoing）。
 * 使用 game-engine handleStartNight 纯函数 + gameStateManager 读写广播。
 * Handler 的 PLAY_AUDIO sideEffects 写入 state.pendingAudioEffects，
 * 客户端通过 store subscription 响应式播放后 POST audio-ack 释放 gate。
 *
 * ✅ 允许：请求解析、调用 handler + gameStateManager
 * ❌ 禁止：直接操作 DB 或 state、播放音频
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  type AudioEffect,
  type BroadcastGameState,
  type HandlerContext,
  handleStartNight,
  type StateAction,
} from '@werewolf/game-engine';

import { processGameAction } from '../_lib/gameStateManager';
import type { StartRequestBody } from '../_lib/types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, reason: 'METHOD_NOT_ALLOWED' });
  }

  const body = req.body as StartRequestBody;
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
    const handlerResult = handleStartNight({ type: 'START_NIGHT' }, handlerCtx);
    if (!handlerResult.success) return handlerResult;

    // Extract PLAY_AUDIO from handler sideEffects → write to state as pendingAudioEffects
    // This way audio flows through broadcast → client store subscription → reactive playback
    const audioEffects: AudioEffect[] = (handlerResult.sideEffects ?? [])
      .filter(
        (e): e is { type: 'PLAY_AUDIO'; audioKey: string; isEndAudio?: boolean } =>
          e.type === 'PLAY_AUDIO',
      )
      .map((e) => ({ audioKey: e.audioKey, isEndAudio: e.isEndAudio }));

    if (audioEffects.length > 0) {
      const extraActions: StateAction[] = [
        { type: 'SET_PENDING_AUDIO_EFFECTS', payload: { effects: audioEffects } },
        { type: 'SET_AUDIO_PLAYING', payload: { isPlaying: true } },
      ];
      return {
        ...handlerResult,
        actions: [...handlerResult.actions, ...extraActions],
      };
    }

    return handlerResult;
  });

  return res.status(result.success ? 200 : 400).json(result);
}

function findSeatByUid(state: BroadcastGameState, uid: string): number | null {
  for (const [seatKey, player] of Object.entries(state.players)) {
    if (player?.uid === uid) return Number(seatKey);
  }
  return null;
}
