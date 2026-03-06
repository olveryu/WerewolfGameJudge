/**
 * handlers/shared — Shared types and helper factories for game route handlers.
 *
 * Provides `HandlerFn` type alias, `missingParams()` response factory,
 * and `createSimpleHandler()` for intent-only routes that need only roomCode.
 * Does not contain business logic or route definitions.
 */

import { jsonResponse } from '../../_shared/cors.ts';
import type { GameState } from '../../_shared/game-engine/index.js';
import { handleAssignRoles } from '../../_shared/game-engine/index.js';
import { processGameAction } from '../../_shared/gameStateManager.ts';
import { buildHandlerContext } from '../../_shared/handlerContext.ts';
import { resultToStatus } from '../../_shared/responseStatus.ts';

/** A route handler that receives the original Request and returns a Response. */
export type HandlerFn = (req: Request) => Promise<Response>;

/** Respond with 400 MISSING_PARAMS */
export function missingParams(): Response {
  return jsonResponse({ success: false, reason: 'MISSING_PARAMS' }, 400);
}

/**
 * Factory for simple handlers that only need roomCode.
 *
 * Pattern: parse body → validate → processGameAction →
 * buildHandlerContext(state, state.hostUid) → handlerFn → respond.
 */
export function createSimpleHandler<I extends { type: string }>(
  handlerFn: (
    intent: I,
    ctx: ReturnType<typeof buildHandlerContext>,
  ) => ReturnType<typeof handleAssignRoles>,
  intent: I,
): HandlerFn {
  return async (req: Request) => {
    const body = (await req.json()) as { roomCode?: string };
    const { roomCode } = body;
    if (!roomCode) return missingParams();

    const result = await processGameAction(roomCode, (state: GameState) => {
      const handlerCtx = buildHandlerContext(state, state.hostUid);
      return handlerFn(intent, handlerCtx);
    });
    return jsonResponse(result, resultToStatus(result));
  };
}
