/** Canonical minimal DrawGuess state for client tests (AU-46). */

import type { DrawGuessState } from '@game-judge/game-engine/games/drawguess/public';
import {
  DEFAULT_DRAWGUESS_CONFIG,
  drawGuessEngine,
} from '@game-judge/game-engine/games/drawguess/public';

export function buildDrawGuessTestState(overrides: Partial<DrawGuessState> = {}): DrawGuessState {
  return {
    ...drawGuessEngine.createInitialState(DEFAULT_DRAWGUESS_CONFIG, {
      roomCode: 'ABCD',
      hostUserId: 'host-1',
      nowMs: 0,
      commandId: 'create',
    }),
    ...overrides,
  };
}
