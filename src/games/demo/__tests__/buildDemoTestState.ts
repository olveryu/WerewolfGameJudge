/** Canonical minimal Demo state for client tests (AU-46). */

import type { DemoState } from '@game-judge/game-engine/games/demo/public';
import { demoEngine } from '@game-judge/game-engine/games/demo/public';

function withOverrides<S>(base: S, overrides: Partial<S>): S {
  return { ...base, ...overrides };
}

export function buildDemoTestState(overrides: Partial<DemoState> = {}): DemoState {
  return withOverrides(
    demoEngine.createInitialState(
      { numberOfPlayers: 6 },
      { roomCode: 'ABCD', hostUserId: 'host-1', nowMs: 0, commandId: 'create' },
    ),
    overrides,
  );
}
