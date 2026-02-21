/**
 * Shared handler context helpers
 *
 * Builds HandlerContext from BroadcastGameState for API routes.
 * Extracted from game/[action].ts and game/night/[action].ts to eliminate duplication.
 */

import type { BroadcastGameState, HandlerContext } from '@werewolf/game-engine';

/** Find seat number by UID, or null if user is not seated */
export function findSeatByUid(state: BroadcastGameState, uid: string): number | null {
  for (const [seatKey, player] of Object.entries(state.players)) {
    if (player?.uid === uid) return Number(seatKey);
  }
  return null;
}

/** Build a HandlerContext for game-engine pure handler functions */
export function buildHandlerContext(state: BroadcastGameState, uid: string): HandlerContext {
  return {
    state,
    isHost: state.hostUid === uid,
    myUid: uid,
    mySeat: findSeatByUid(state, uid),
  };
}
