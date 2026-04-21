/**
 * defineGameAction — Declarative factory for game HTTP API actions.
 *
 * Encapsulates the repetitive pattern of: debug-log → connection-guard →
 * build body → callGameControlApi → optional after-hook.
 * Does not handle business logic — that lives on the server.
 */

import type { GameStore } from '@werewolf/game-engine/engine/store';
import type { GameState, GameStatePayload } from '@werewolf/game-engine/engine/store/types';

import { facadeLog } from '@/utils/logger';

import { type ApiResponse, callApiWithRetry } from './apiUtils';
import type { GameActionsContext } from './gameActions';

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

const NOT_CONNECTED = { success: false, reason: 'NOT_CONNECTED' } as const;

async function callGameControlApi(
  path: string,
  body: Record<string, unknown>,
  store?: GameStore,
  optimisticFn?: (state: GameState) => GameStatePayload,
): Promise<ApiResponse> {
  return callApiWithRetry(path, body, 'callGameControlApi', store, optimisticFn);
}

function getConnectionOrFail(
  ctx: GameActionsContext,
): { roomCode: string; myUserId: string } | null {
  const roomCode = ctx.store.getState()?.roomCode;
  if (!roomCode || !ctx.myUserId) return null;
  return { roomCode, myUserId: ctx.myUserId };
}

function getRoomCodeOrFail(ctx: GameActionsContext): { roomCode: string } | null {
  const roomCode = ctx.store.getState()?.roomCode;
  if (!roomCode) return null;
  return { roomCode };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/** Standard return type for all game actions */
type ActionResult = { success: boolean; reason?: string };

/**
 * Configuration for a game action.
 *
 * @template TArgs - Tuple of extra arguments beyond `ctx`.
 */
interface GameActionDef<TArgs extends unknown[]> {
  /** Debug log label (e.g. 'assignRoles') */
  name: string;
  /** API endpoint path (e.g. '/game/assign') */
  path: string;
  /** True when the action requires myUserId (player actions, not host-only) */
  needsUserId?: boolean;
  /** Build extra body fields beyond roomCode (and userId when needsUserId is true) */
  body?: (...args: TArgs) => Record<string, unknown>;
  /** Optimistic state update applied before the fetch */
  optimistic?: (...args: TArgs) => (state: GameState) => GameStatePayload;
  /** Post-call hook — fire-and-forget side-effects or failure logging */
  after?: (ctx: GameActionsContext, result: ActionResult, ...args: TArgs) => void;
}

/**
 * Create a standardised game action function from a declarative definition.
 *
 * The returned function: debug-logs → guards connection → builds body →
 * calls the Game Control API → runs `after` hook (if any) → returns result.
 */
export function defineGameAction<TArgs extends unknown[]>(
  def: GameActionDef<TArgs>,
): (ctx: GameActionsContext, ...args: TArgs) => Promise<ActionResult> {
  return async (ctx: GameActionsContext, ...args: TArgs): Promise<ActionResult> => {
    facadeLog.debug('gameAction called', { name: def.name });

    let roomCode: string;
    let myUserId: string | null = null;

    if (def.needsUserId) {
      const conn = getConnectionOrFail(ctx);
      if (!conn) return NOT_CONNECTED;
      roomCode = conn.roomCode;
      myUserId = conn.myUserId;
    } else {
      const conn = getRoomCodeOrFail(ctx);
      if (!conn) return NOT_CONNECTED;
      roomCode = conn.roomCode;
    }

    const extraBody = def.body?.(...args) ?? {};
    const requestBody: Record<string, unknown> = { roomCode, ...extraBody };
    if (def.needsUserId && myUserId) {
      requestBody.userId = myUserId;
    }

    const result = await callGameControlApi(
      def.path,
      requestBody,
      ctx.store,
      def.optimistic?.(...args),
    );

    def.after?.(ctx, result, ...args);

    return result;
  };
}
