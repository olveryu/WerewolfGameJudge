/** Canonical game identifiers shared by every runtime. */

export const GAME_TYPES = ['werewolf'] as const;

export type GameType = (typeof GAME_TYPES)[number];

export const WEREWOLF_GAME_TYPE: GameType = 'werewolf';

export type WerewolfGameType = typeof WEREWOLF_GAME_TYPE;

export function isGameType(value: unknown): value is GameType {
  return GAME_TYPES.some((gameType) => gameType === value);
}

export function parseGameType(value: unknown): GameType {
  if (!isGameType(value)) {
    throw new Error(`Unknown game type: ${String(value)}`);
  }
  return value;
}
