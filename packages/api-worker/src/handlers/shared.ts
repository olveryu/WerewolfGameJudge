/**
 * handlers/shared — shared utility functions (Workers)
 *
 * Provides Hono validation, DO stub retrieval, and error-handling utilities shared across Worker handlers.
 */

import type { SideEffect } from '@werewolf/game-engine/protocol/common';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { validator } from 'hono/validator';
import type { z } from 'zod';

import type { IGameRoomRPC } from '../durableObjects/IGameRoomRPC';
import type { DispatchResult } from '../durableObjects/processEngineAction';
import type { WeChatAuthProxy } from '../durableObjects/WeChatAuthProxy';
import type { Env } from '../env';
import { createLogger } from '../lib/logger';

/**
 * Strip the `& Disposable` intersection that @cloudflare/workers-types adds
 * to DO stub RPC return values. This restores proper discriminated union narrowing.
 *
 * Usage: cast the raw CF stub once at the creation site → all downstream call
 * sites get clean types without per-call `as Promise<T>`.
 */
type StripDisposable<T> = T extends Disposable ? Omit<T, keyof Disposable> : T;

type CleanRpcMethods<DO> = {
  [K in keyof DO]: DO[K] extends (...args: infer A) => Promise<infer R>
    ? (...args: A) => Promise<StripDisposable<R>>
    : DO[K];
};

/** GameRoom stub with clean RPC return types (Disposable stripped). */
type GameRoomStub = CleanRpcMethods<DurableObjectStub<IGameRoomRPC>>;

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

/** Validate that a value is a valid seat number (finite non-negative integer). */
export function isValidSeat(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/** HTTP status code mapping */
export function resultToStatus(result: { success: boolean; reason?: string }): 200 | 400 | 500 {
  if (result.success) return 200;
  return result.reason === 'INTERNAL_ERROR' ? 500 : 400;
}

/**
 * Maps CF continent codes to DO location hints.
 * Only affects the first get() for a new DO — subsequent calls ignore the hint.
 */
const CONTINENT_TO_HINT: Partial<Record<string, DurableObjectLocationHint>> = {
  AS: 'apac',
  OC: 'oc',
  EU: 'weur',
  NA: 'enam',
  SA: 'enam', // SA unsupported → falls back to ENAM per CF docs
  AF: 'afr',
};

/**
 * Get a typed DO stub for the given room code.
 *
 * Returns a GameRoomStub with clean RPC types (Disposable stripped),
 * eliminating per-call RPC return casts at Worker handler call sites.
 *
 * Optionally accepts the incoming Request to extract cf.continent
 * and pass a locationHint, co-locating the DO near the first requester.
 */
export function getGameRoomStub(env: Env, roomCode: string, req?: Request): GameRoomStub {
  const id = env.GAME_ROOM.idFromName(roomCode);
  const cf = (req as CfRequest | undefined)?.cf;
  const locationHint = cf?.continent ? CONTINENT_TO_HINT[cf.continent] : undefined;
  return env.GAME_ROOM.get(id, locationHint ? { locationHint } : undefined);
}

/** Dispatch a room command through GameRoom and validate the RPC result shape. */
export async function dispatchEngineAction(
  env: Env,
  roomCode: string,
  req: Request,
  actionType: string,
  payload: unknown,
): Promise<DispatchResult> {
  const raw = await callDO(() =>
    getGameRoomStub(env, roomCode, req).engineAction(actionType, payload),
  );
  return parseDispatchResult(raw);
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

/** Request with Cloudflare-specific properties. */
type CfRequest = Request & { cf?: IncomingRequestCfProperties };

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

function parseDispatchResult(value: unknown): DispatchResult {
  if (!isRecord(value) || typeof value.success !== 'boolean') {
    throw new Error('[FAIL-FAST] GameRoom.engineAction returned invalid DispatchResult');
  }

  const result: DispatchResult = value.success
    ? { success: true }
    : { success: false, reason: readRequiredString(value, 'reason') };

  if ('reason' in value) result.reason = readOptionalString(value, 'reason');
  if ('state' in value) result.state = value.state;
  if ('revision' in value) result.revision = readOptionalNumber(value, 'revision');
  if ('broadcastAction' in value) {
    result.broadcastAction = readOptionalStringOrNull(value, 'broadcastAction');
  }
  if (value.success) {
    result.sideEffects = readSideEffects(value.sideEffects);
  } else if ('sideEffects' in value) {
    result.sideEffects = readSideEffects(value.sideEffects);
  }

  return result;
}

function readSideEffects(value: unknown): readonly SideEffect[] {
  if (!Array.isArray(value)) {
    throw new Error('[FAIL-FAST] DispatchResult.sideEffects must be an array');
  }
  return value.map(readSideEffect);
}

function readSideEffect(value: unknown): SideEffect {
  if (!isRecord(value)) {
    throw new Error('[FAIL-FAST] DispatchResult.sideEffects item must be an object');
  }

  switch (value.type) {
    case 'BROADCAST_STATE':
      return { type: 'BROADCAST_STATE' };
    case 'SAVE_STATE':
      return { type: 'SAVE_STATE' };
    case 'PLAY_AUDIO':
      return {
        type: 'PLAY_AUDIO',
        audioKey: readRequiredString(value, 'audioKey'),
        ...(typeof value.isEndAudio === 'boolean' ? { isEndAudio: value.isEndAudio } : {}),
      };
    case 'SEND_MESSAGE':
      return { type: 'SEND_MESSAGE', message: value.message };
    default:
      throw new Error('[FAIL-FAST] Unknown DispatchResult sideEffect type');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readRequiredString(value: Record<string, unknown>, key: string): string {
  const field = value[key];
  if (typeof field !== 'string') {
    throw new Error(`[FAIL-FAST] DispatchResult.${key} must be a string`);
  }
  return field;
}

function readOptionalString(value: Record<string, unknown>, key: string): string | undefined {
  const field = value[key];
  if (field === undefined) return undefined;
  if (typeof field !== 'string') {
    throw new Error(`[FAIL-FAST] DispatchResult.${key} must be a string`);
  }
  return field;
}

function readOptionalStringOrNull(
  value: Record<string, unknown>,
  key: string,
): string | null | undefined {
  const field = value[key];
  if (field === undefined || field === null) return field;
  if (typeof field !== 'string') {
    throw new Error(`[FAIL-FAST] DispatchResult.${key} must be a string or null`);
  }
  return field;
}

function readOptionalNumber(value: Record<string, unknown>, key: string): number | undefined {
  const field = value[key];
  if (field === undefined) return undefined;
  if (typeof field !== 'number') {
    throw new Error(`[FAIL-FAST] DispatchResult.${key} must be a number`);
  }
  return field;
}
