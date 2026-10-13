/** Canonical minimal Undercover state for client tests (AU-46). */

import type { UndercoverState } from '@game-judge/game-engine/games/undercover/public';
import { undercoverEngine } from '@game-judge/game-engine/games/undercover/public';

function withOverrides<S>(base: S, overrides: Partial<S>): S {
  return { ...base, ...overrides };
}

export function buildUndercoverTestState(
  overrides: Partial<UndercoverState> = {},
): UndercoverState {
  return withOverrides(
    undercoverEngine.createInitialState(
      { numberOfPlayers: 8, hasBlank: true, category: 'all' },
      { roomCode: 'ABCD', hostUserId: 'host-1', nowMs: 0, commandId: 'create' },
    ),
    overrides,
  );
}
