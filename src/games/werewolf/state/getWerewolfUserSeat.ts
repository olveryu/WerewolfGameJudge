/** Resolve one authenticated user's seat from authoritative Werewolf state. */

import type { GameState } from '@werewolf/game-engine/protocol/types';

export function getWerewolfUserSeat(state: GameState | null, userId: string | null): number | null {
  if (state === null || userId === null) return null;
  for (const [seatKey, player] of Object.entries(state.players)) {
    if (player?.userId === userId) return Number.parseInt(seatKey, 10);
  }
  return null;
}
