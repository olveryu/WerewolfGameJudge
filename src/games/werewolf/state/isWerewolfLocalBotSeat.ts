/** Whether a seat in the local (UI) werewolf state is occupied by a bot. */

import type { LocalGameState } from './LocalGameState';

/**
 * The named bot-seat predicate over the local state shape (players as a
 * Map). The room screen previously inlined this read at the long-press
 * hook call site; the other games call their engine predicates — this is
 * the werewolf local-state equivalent.
 */
export function isWerewolfLocalBotSeat(state: LocalGameState | null, seat: number): boolean {
  return state?.players.get(seat)?.isBot === true;
}
