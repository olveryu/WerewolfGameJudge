/** Canonical games sharing the editorial supply and submission contracts. */
import type { GameType } from '../../platform/protocol/gameTypes';

export const GAME_WORD_GAMES = [
  'fibking',
  'undercover',
  'drawguess',
] as const satisfies readonly GameType[];
export type GameWordGame = (typeof GAME_WORD_GAMES)[number];

/** Narrow an untrusted value without selecting a default inventory. */
export function isGameWordGame(value: unknown): value is GameWordGame {
  return GAME_WORD_GAMES.some((game) => game === value);
}
