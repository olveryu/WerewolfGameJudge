/**
 * handlers/shared — 通用工具函数（Workers 版）
 *
 * 与 Edge Functions 的 shared.ts 逻辑一致。
 * `createSimpleHandler` 接受 `D1Database` 参数。
 */

import type {
  HandlerContext,
  HandlerResult,
  SideEffect,
} from '@werewolf/game-engine/engine/handlers/types';
import type { StateAction } from '@werewolf/game-engine/engine/reducer/types';
import type { AudioEffect } from '@werewolf/game-engine/protocol/types';
import type { GameState } from '@werewolf/game-engine/protocol/types';

import type { Env } from '../env';
import { broadcastIfNeeded } from '../lib/broadcast';
import { jsonResponse } from '../lib/cors';
import { processGameAction } from '../lib/gameStateManager';

/** A route handler that receives the original Request + Env + ExecutionContext and returns a Response. */
export type HandlerFn = (req: Request, env: Env, ctx: ExecutionContext) => Promise<Response>;

/** Respond with 400 MISSING_PARAMS */
export function missingParams(env: Env): Response {
  return jsonResponse({ success: false, reason: 'MISSING_PARAMS' }, 400, env);
}

/** Validate that a value is a valid seat number (finite non-negative integer). */
export function isValidSeat(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/** HTTP 状态码映射 */
export function resultToStatus(result: { success: boolean; reason?: string }): number {
  if (result.success) return 200;
  return result.reason === 'INTERNAL_ERROR' ? 500 : 400;
}

/** Find seat number by UID */
function findSeatByUid(state: GameState, uid: string): number | null {
  for (const [seatKey, player] of Object.entries(state.players)) {
    if (player?.uid === uid) return Number(seatKey);
  }
  return null;
}

/** Build HandlerContext for game-engine pure handler functions */
export function buildHandlerContext(state: GameState, uid: string): HandlerContext {
  return {
    state,
    myUid: uid,
    mySeat: findSeatByUid(state, uid),
  };
}

/** Extract PLAY_AUDIO side effects into AudioEffect state actions. */
export function extractAudioActions(sideEffects: readonly SideEffect[] | undefined): StateAction[] {
  const audioEffects: AudioEffect[] = (sideEffects ?? [])
    .filter(
      (e): e is { type: 'PLAY_AUDIO'; audioKey: string; isEndAudio?: boolean } =>
        e.type === 'PLAY_AUDIO',
    )
    .map((e) => ({ audioKey: e.audioKey, isEndAudio: e.isEndAudio }));

  if (audioEffects.length === 0) return [];

  return [
    { type: 'SET_PENDING_AUDIO_EFFECTS', payload: { effects: audioEffects } },
    { type: 'SET_AUDIO_PLAYING', payload: { isPlaying: true } },
  ];
}

/**
 * Factory for simple handlers that only need roomCode.
 */
export function createSimpleHandler<I extends { type: string }>(
  handlerFn: (intent: I, ctx: HandlerContext) => HandlerResult,
  intent: I,
): HandlerFn {
  return async (req: Request, env: Env, ctx: ExecutionContext) => {
    const body = (await req.json()) as { roomCode?: string };
    const { roomCode } = body;
    if (!roomCode) return missingParams(env);

    const result = await processGameAction(env.DB, roomCode, (state: GameState) => {
      const handlerCtx = buildHandlerContext(state, state.hostUid);
      return handlerFn(intent, handlerCtx);
    });
    broadcastIfNeeded(env, roomCode, result, ctx);
    return jsonResponse(result, resultToStatus(result), env);
  };
}
