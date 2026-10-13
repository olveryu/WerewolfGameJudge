/** Canonical minimal Pictionary state for client tests (AU-46). */

import type { PictionaryState } from '@game-judge/game-engine/games/pictionary/public';
import {
  DEFAULT_PICTIONARY_CONFIG,
  pictionaryEngine,
} from '@game-judge/game-engine/games/pictionary/public';

export function buildPictionaryTestState(
  overrides: Partial<PictionaryState> = {},
): PictionaryState {
  return {
    ...pictionaryEngine.createInitialState(DEFAULT_PICTIONARY_CONFIG, {
      roomCode: 'ABCD',
      hostUserId: 'host-1',
      nowMs: 0,
      commandId: 'create',
    }),
    ...overrides,
  };
}
