/**
 * handlers/shared — 通用工具函数（Workers 版）
 *
 * 提供 Worker handler 共用的参数校验、DO stub 获取、错误处理工具。
 * game-engine 相关的 buildHandlerContext/extractAudioActions 已迁移到 gameProcessor.ts。
 */

import type { GameActionResult } from '../durableObjects/gameProcessor';
import type { GameRoom } from '../durableObjects/GameRoom';
import type { Env } from '../env';
import { jsonResponse } from '../lib/cors';

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

/** Get a typed DO stub for the given room code. */
export function getGameRoomStub(env: Env, roomCode: string): DurableObjectStub<GameRoom> {
  const id = env.GAME_ROOM.idFromName(roomCode);
  return env.GAME_ROOM.get(id);
}

/**
 * 包装 DO RPC 调用，处理 DO 特有的错误属性。
 * 若 err.retryable === true，返回 503 让客户端 retry。
 * 若 err.overloaded === true，返回 429。
 */
export async function callDO<T>(fn: () => Promise<T>, env: Env): Promise<T | Response> {
  try {
    return await fn();
  } catch (err: unknown) {
    const doErr = err as { retryable?: boolean; overloaded?: boolean; message?: string };
    if (doErr.retryable) {
      return jsonResponse({ success: false, reason: 'SERVICE_UNAVAILABLE' }, 503, env);
    }
    if (doErr.overloaded) {
      return jsonResponse({ success: false, reason: 'OVERLOADED' }, 429, env);
    }
    throw err;
  }
}

/**
 * Factory for simple handlers that only need roomCode (no-arg RPC).
 *
 * Note: RPC stub methods return serialized types (tuples → arrays),
 * so the lambda returns Promise<unknown> and the result is cast via resultToStatus.
 */
export function createSimpleHandler(
  rpcMethod: (stub: DurableObjectStub<GameRoom>) => Promise<unknown>,
): HandlerFn {
  return async (req: Request, env: Env) => {
    const body = (await req.json()) as { roomCode?: string };
    const { roomCode } = body;
    if (!roomCode) return missingParams(env);

    const doResult = await callDO(() => {
      const stub = getGameRoomStub(env, roomCode);
      return rpcMethod(stub);
    }, env);
    if (doResult instanceof Response) return doResult;
    const result = doResult as GameActionResult;
    return jsonResponse(result, resultToStatus(result), env);
  };
}
