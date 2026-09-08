/** Client-only projections over authoritative Pictionary room state. */

import {
  getPictionaryBotDisplayName,
  isPictionaryImplicitBotSeat,
  type PictionaryState,
} from '@game-judge/game-engine/games/pictionary/public';

export function getPictionaryUserSeat(state: PictionaryState, userId: string): number | null {
  for (const occupant of Object.values(state.realSeats)) {
    if (occupant?.userId === userId) return occupant.seat;
  }
  return null;
}

export function getPictionaryCompletedCount(state: PictionaryState): number {
  if (state.stepIndex < 0) return 0;
  if (state.phase === 'answering') return state.readySeats.length;
  return state.chains.reduce(
    (count, chain) => count + (chain.entries.length > state.stepIndex ? 1 : 0),
    0,
  );
}

export function getPictionarySeatDisplayName(state: PictionaryState, seat: number): string {
  const occupant = state.realSeats[seat];
  if (occupant !== undefined) return occupant.profile.displayName;
  if (isPictionaryImplicitBotSeat(state, seat)) return getPictionaryBotDisplayName(seat);
  throw new Error(`[FAIL-FAST] Pictionary state references empty seat ${seat}`);
}
