/**
 * Werewolf handler context helpers — pure adapters from WerewolfState to HandlerContext.
 */

import type { HandlerContext } from './handlers/types';
import type { WerewolfState } from './protocol/types';

export function findSeatByUserId(state: WerewolfState, userId: string): number | null {
  for (const [seatKey, player] of Object.entries(state.players)) {
    if (player?.userId === userId) return Number(seatKey);
  }
  return null;
}

export function buildHandlerContext(state: WerewolfState, userId: string): HandlerContext {
  return {
    state,
    myUserId: userId,
    mySeat: findSeatByUserId(state, userId),
  };
}
