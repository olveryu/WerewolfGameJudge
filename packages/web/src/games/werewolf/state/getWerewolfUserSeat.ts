/** Resolve one authenticated user's seat from authoritative Werewolf state. */

import {
  type GameState,
  getWerewolfUserSeat as findWerewolfSeat,
} from '@game-judge/game-engine/games/werewolf/public';

export function getWerewolfUserSeat(state: GameState | null, userId: string | null): number | null {
  if (state === null || userId === null) return null;
  return findWerewolfSeat(state, userId);
}
