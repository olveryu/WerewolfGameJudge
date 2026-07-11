/**
 * handlers/shared — shared utility functions (Workers)
 *
 * Provides Hono validation, DO stub retrieval, and error-handling utilities shared across Worker handlers.
 */

import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { validator } from 'hono/validator';
import type { z } from 'zod';

import type { WeChatAuthProxy } from '../durableObjects/WeChatAuthProxy';
import type { Env } from '../env';
import { createLogger } from '../lib/logger';

const log = createLogger('do');

/**
 * Hono validator middleware — JSON body parsing + zod validation.
 *
 * On validation failure returns 400 ({ success: false, reason: 'VALIDATION_ERROR', detail }),
 * matching the format of the original parseBody. JSON parse errors are handled centrally by app.onError.
 *
 * @throws 400 — returns a 400 JSON response directly when the body does not match the schema (not thrown)
 */
export function jsonBody<T extends z.ZodType>(schema: T) {
  return validator('json', (value: unknown, c: Context) => {
    const result = schema.safeParse(value);
    if (!result.success) {
      const issue = result.error.issues[0];
      const detail = `${issue.path.join('.')}: ${issue.message}`;
      return c.json(
        {
          success: false,
          reason: 'VALIDATION_ERROR',
          detail,
        },
        400,
      );
    }
    return result.data;
  });
}

/**
 * Get a WeChatAuthProxy stub with locationHint: "apac".
 *
 * Uses a singleton DO (idFromName("wechat-auth")) — stateless, only proxies
 * outbound fetch to api.weixin.qq.com from an APAC node.
 */
export function getWeChatAuthStub(env: Env): DurableObjectStub<WeChatAuthProxy> {
  const id = env.WECHAT_AUTH.idFromName('wechat-auth');
  return env.WECHAT_AUTH.get(id, { locationHint: 'apac' });
}

/**
 * Wraps a DO RPC call and handles DO-specific error properties.
 *
 * @throws HTTPException 503 — err.retryable === true (DO temporarily unavailable; client may retry)
 * @throws HTTPException 429 — err.overloaded === true (DO overloaded; client should back off)
 * @throws original error — non-DO errors are re-thrown as-is for app.onError to handle
 */
export async function callDO<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: unknown) {
    const doErr = err as { retryable?: boolean; overloaded?: boolean; message?: string };
    if (doErr.retryable) {
      log.warn('retryable error', { message: doErr.message });
      throw new HTTPException(503, { message: 'SERVICE_UNAVAILABLE' });
    }
    if (doErr.overloaded) {
      log.warn('overloaded', { message: doErr.message });
      throw new HTTPException(429, { message: 'OVERLOADED' });
    }
    throw err;
  }
}
