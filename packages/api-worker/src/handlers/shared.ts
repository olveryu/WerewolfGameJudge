/**
 * handlers/shared — 通用工具函数（Workers 版）
 *
 * 提供 Worker handler 共用的 Hono 校验、DO stub 获取、错误处理工具。
 * game-engine 相关的 buildHandlerContext/extractAudioActions 已迁移到 gameProcessor.ts。
 */

import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { validator } from 'hono/validator';
import type { z } from 'zod';

import type { GameRoom } from '../durableObjects/GameRoom';
import type { Env } from '../env';

/**
 * Hono validator middleware — JSON body 解析 + zod 校验。
 *
 * 校验失败返回 400（{ success: false, reason: 'VALIDATION_ERROR', detail }），
 * 格式与原 parseBody 一致。JSON 解析失败由 app.onError 统一处理。
 */
export function jsonBody<T extends z.ZodType>(schema: T) {
  return validator('json', (value: unknown, c: Context) => {
    const result = schema.safeParse(value);
    if (!result.success) {
      const issue = result.error.issues[0];
      return c.json(
        {
          success: false,
          reason: 'VALIDATION_ERROR',
          detail: `${issue.path.join('.')}: ${issue.message}`,
        },
        400,
      );
    }
    return result.data as z.output<T>;
  });
}

/** Validate that a value is a valid seat number (finite non-negative integer). */
export function isValidSeat(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/** HTTP 状态码映射 */
export function resultToStatus(result: { success: boolean; reason?: string }): 200 | 400 | 500 {
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
 * 若 err.retryable === true，抛 503 HTTPException。
 * 若 err.overloaded === true，抛 429 HTTPException。
 */
export async function callDO<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: unknown) {
    const doErr = err as { retryable?: boolean; overloaded?: boolean; message?: string };
    if (doErr.retryable) {
      throw new HTTPException(503, { message: 'SERVICE_UNAVAILABLE' });
    }
    if (doErr.overloaded) {
      throw new HTTPException(429, { message: 'OVERLOADED' });
    }
    throw err;
  }
}
