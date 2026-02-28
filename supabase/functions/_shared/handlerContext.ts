/**
 * Shared handler context helpers
 *
 * Builds HandlerContext from GameState for Edge Function routes.
 * 从 api/_lib/handlerContext.ts 移植，逻辑完全一致。
 */

import type { GameState, HandlerContext } from '../_shared/game-engine/index.js';

/** Find seat number by UID, or null if user is not seated */
function findSeatByUid(state: GameState, uid: string): number | null {
  for (const [seatKey, player] of Object.entries(state.players)) {
    if (player?.uid === uid) return Number(seatKey);
  }
  return null;
}

/** Build a HandlerContext for game-engine pure handler functions */
export function buildHandlerContext(state: GameState, uid: string): HandlerContext {
  return {
    state,
    myUid: uid,
    mySeat: findSeatByUid(state, uid),
  };
}
