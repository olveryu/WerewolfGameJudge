/**
 * gameTypes — stable game type ids used by room routing.
 */

export const WEREWOLF_GAME_TYPE = 'werewolf' as const;
export const FIB_GAME_TYPE = 'fibking' as const;

export const GAME_TYPES = [WEREWOLF_GAME_TYPE, FIB_GAME_TYPE] as const;

export type GameType = (typeof GAME_TYPES)[number];

export function isGameType(value: string): value is GameType {
  return GAME_TYPES.some((gameType) => gameType === value);
}
