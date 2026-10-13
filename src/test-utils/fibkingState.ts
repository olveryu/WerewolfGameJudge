/** Canonical minimal Fibking state for client tests (AU-46). */

import type { FibState } from '@game-judge/game-engine/games/fibking/public';
import { fibEngine } from '@game-judge/game-engine/games/fibking/public';

export function buildFibkingTestState(overrides: Partial<FibState> = {}): FibState {
  return {
    ...fibEngine.createInitialState(
      { numberOfPlayers: 6 },
      { roomCode: 'ABCD', hostUserId: 'host-1', nowMs: 0, commandId: 'create' },
    ),
    ...overrides,
  };
}
